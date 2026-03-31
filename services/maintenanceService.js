const supabase = require('../supabase');

const INSPECTION_BUCKET = 'inspection-reports';

/**
 * Maintenance flow: site assessments, inspection reports, inquiry accept.
 * All Supabase access is server-side (service role).
 */
class MaintenanceService {
    async getInquiryAccessRow(inquiryId) {
        const { data, error } = await supabase
            .from('inquiries')
            .select('id, partner_id, customer_id, status, type')
            .eq('id', inquiryId)
            .maybeSingle();
        if (error) throw error;
        return data;
    }

    partnerOwnsInquiry(inquiry, partnerId) {
        if (!inquiry || partnerId == null) return false;
        return String(inquiry.partner_id) === String(partnerId);
    }

    customerOwnsInquiry(inquiry, customerId) {
        if (!inquiry || customerId == null) return false;
        return String(inquiry.customer_id) === String(customerId);
    }

    /**
     * Partner accepts a pending inquiry (typically maintenance).
     */
    async acceptInquiry(inquiryId, partnerId) {
        const inquiry = await this.getInquiryAccessRow(inquiryId);
        if (!inquiry) {
            return { ok: false, code: 404, message: 'Inquiry not found.' };
        }
        if (!this.partnerOwnsInquiry(inquiry, partnerId)) {
            return { ok: false, code: 403, message: 'You do not have access to this inquiry.' };
        }
        const status = (inquiry.status || '').toLowerCase();
        if (status !== 'pending') {
            return {
                ok: false,
                code: 400,
                message: `Inquiry cannot be accepted in status "${inquiry.status}".`
            };
        }

        const { data, error } = await supabase
            .from('inquiries')
            .update({
                status: 'accepted',
                updated_at: new Date().toISOString()
            })
            .eq('id', inquiryId)
            .eq('partner_id', partnerId)
            .select()
            .maybeSingle();

        if (error) throw error;
        if (!data) {
            return { ok: false, code: 404, message: 'Inquiry not found.' };
        }
        return { ok: true, data };
    }

    /**
     * Upsert site_assessments (one row per inquiry). Partner only.
     */
    async upsertSiteAssessment(partnerId, payload) {
        const inquiryId = payload.inquiry_id;
        if (!inquiryId) {
            return { ok: false, code: 400, message: 'inquiry_id is required.' };
        }

        const inquiry = await this.getInquiryAccessRow(inquiryId);
        if (!inquiry) {
            return { ok: false, code: 404, message: 'Inquiry not found.' };
        }
        if (!this.partnerOwnsInquiry(inquiry, partnerId)) {
            return { ok: false, code: 403, message: 'You do not have access to this inquiry.' };
        }

        const costRaw = payload.estimated_cost;
        let estimated_cost = null;
        if (costRaw !== null && costRaw !== undefined && costRaw !== '') {
            const costNum = Number(costRaw);
            estimated_cost = Number.isFinite(costNum) ? costNum : null;
        }

        const row = {
            inquiry_id: inquiryId,
            observations: (payload.observations || '').trim(),
            required_services: (payload.required_services || '').trim(),
            estimated_cost,
            additional_notes: payload.additional_notes?.trim() || null,
            updated_at: new Date().toISOString()
        };

        const { data, error } = await supabase
            .from('site_assessments')
            .upsert(row, { onConflict: 'inquiry_id' })
            .select()
            .single();

        if (error) throw error;
        return { ok: true, data };
    }

    /**
     * Get a single site assessment by inquiry. Partner or owning customer.
     */
    async getSiteAssessmentByInquiryId(inquiryId, user) {
        const inquiry = await this.getInquiryAccessRow(inquiryId);
        if (!inquiry) {
            return { ok: false, code: 404, message: 'Inquiry not found.' };
        }

        const { role, id: userId } = user;
        if (role === 'partner' && !this.partnerOwnsInquiry(inquiry, userId)) {
            return { ok: false, code: 403, message: 'Access denied.' };
        }
        if (role === 'customer' && !this.customerOwnsInquiry(inquiry, userId)) {
            return { ok: false, code: 403, message: 'Access denied.' };
        }
        if (role !== 'partner' && role !== 'customer') {
            return { ok: false, code: 403, message: 'Access denied.' };
        }

        const { data, error } = await supabase
            .from('site_assessments')
            .select('*')
            .eq('inquiry_id', inquiryId)
            .maybeSingle();

        if (error) throw error;
        return { ok: true, data: data || null };
    }

    /**
     * List inspection_reports for an inquiry. Partner or owning customer.
     */
    async listInspectionReportsByInquiryId(inquiryId, user) {
        const inquiry = await this.getInquiryAccessRow(inquiryId);
        if (!inquiry) {
            return { ok: false, code: 404, message: 'Inquiry not found.' };
        }

        const { role, id: userId } = user;
        if (role === 'partner' && !this.partnerOwnsInquiry(inquiry, userId)) {
            return { ok: false, code: 403, message: 'Access denied.' };
        }
        if (role === 'customer' && !this.customerOwnsInquiry(inquiry, userId)) {
            return { ok: false, code: 403, message: 'Access denied.' };
        }
        if (role !== 'partner' && role !== 'customer') {
            return { ok: false, code: 403, message: 'Access denied.' };
        }

        const { data, error } = await supabase
            .from('inspection_reports')
            .select('*')
            .eq('inquiry_id', inquiryId)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return { ok: true, data: data || [] };
    }

    /**
     * Upload file to storage + insert inspection_reports row. Partner only.
     */
    async createInspectionReport(partnerId, file, body) {
        const inquiryId = body.inquiry_id;
        if (!inquiryId) {
            return { ok: false, code: 400, message: 'inquiry_id is required.' };
        }
        if (!file || !file.buffer) {
            return { ok: false, code: 400, message: 'file is required.' };
        }

        const reportTitle = (body.report_title || body.title || '').trim();
        if (!reportTitle) {
            return { ok: false, code: 400, message: 'report_title is required.' };
        }

        const inspectionDate = body.inspection_date || body.date;
        if (!inspectionDate) {
            return { ok: false, code: 400, message: 'inspection_date is required.' };
        }

        const inquiry = await this.getInquiryAccessRow(inquiryId);
        if (!inquiry) {
            return { ok: false, code: 404, message: 'Inquiry not found.' };
        }
        if (!this.partnerOwnsInquiry(inquiry, partnerId)) {
            return { ok: false, code: 403, message: 'You do not have access to this inquiry.' };
        }

        const safeName = (file.originalname || 'file').replace(/[^\w.\-]+/g, '_');
        const path = `${inquiryId}/${Date.now()}_${safeName}`;
        const contentType = file.mimetype || 'application/octet-stream';

        // Validate file type (PDF or Excel)
        const allowedMimeTypes = [
            'application/pdf',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/vnd.ms-excel'
        ];
        if (!allowedMimeTypes.includes(contentType)) {
            return {
                ok: false,
                code: 400,
                message: 'Invalid file type. Only PDF and Excel files are allowed.'
            };
        }

        const { error: uploadError } = await supabase.storage
            .from(INSPECTION_BUCKET)
            .upload(path, file.buffer, {
                contentType,
                upsert: false
            });

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage.from(INSPECTION_BUCKET).getPublicUrl(path);
        const fileUrl = urlData?.publicUrl;
        if (!fileUrl) {
            return { ok: false, code: 500, message: 'Could not resolve public URL for uploaded file.' };
        }

        const notes = body.notes != null ? String(body.notes) : null;

        const { data, error } = await supabase
            .from('inspection_reports')
            .insert({
                inquiry_id: inquiryId,
                report_title: reportTitle,
                inspection_date: inspectionDate,
                notes,
                file_url: fileUrl,
                file_name: file.originalname || null,
                mime_type: contentType
            })
            .select()
            .single();

        if (error) throw error;
        return { ok: true, data };
    }
}

module.exports = new MaintenanceService();
