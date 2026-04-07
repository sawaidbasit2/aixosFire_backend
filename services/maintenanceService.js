const supabase = require('../supabase');

const INSPECTION_BUCKET = 'inspection-reports';
const QUOTATION_BUCKET = 'quotations';

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
     * Schedule a date for maintenance visit. Partner only.
     */
    async scheduleVisit(partnerId, payload) {
        const { inquiry_id, scheduled_date } = payload;
        if (!inquiry_id || !scheduled_date) {
            return { ok: false, code: 400, message: 'inquiry_id and scheduled_date are required.' };
        }

        const inquiry = await this.getInquiryAccessRow(inquiry_id);
        if (!inquiry) return { ok: false, code: 404, message: 'Inquiry not found.' };
        if (!this.partnerOwnsInquiry(inquiry, partnerId)) {
            return { ok: false, code: 403, message: 'You do not have access to this inquiry.' };
        }

        const { data, error } = await supabase
            .from('inquiries')
            .update({
                scheduled_date,
                approval_status: 'pending',
                updated_at: new Date().toISOString()
            })
            .eq('id', inquiry_id)
            .select()
            .maybeSingle();

        if (error) throw error;
        
        // Notification to customer
        await supabase.from('notifications').insert({
            sender_id: String(partnerId),
            sender_role: 'partner',
            recipient_id: String(inquiry.customer_id),
            recipient_role: 'customer',
            message: `Your site visit is scheduled for ${new Date(scheduled_date).toLocaleString()}. Please review and approve.`,
            inquiry_id
        });

        return { ok: true, data };
    }

    /**
     * Customer (or partner for testing) approves/rejects scheduled date.
     */
    async approveSchedule(userId, role, payload) {
        const { inquiry_id, status } = payload;
        if (!inquiry_id || !status) {
            return { ok: false, code: 400, message: 'inquiry_id and status are required.' };
        }
        if (status !== 'approved' && status !== 'rejected') {
            return { ok: false, code: 400, message: 'Status must be "approved" or "rejected".' };
        }

        const inquiry = await this.getInquiryAccessRow(inquiry_id);
        if (!inquiry) return { ok: false, code: 404, message: 'Inquiry not found.' };
        
        if (role === 'partner' && !this.partnerOwnsInquiry(inquiry, userId)) {
            return { ok: false, code: 403, message: 'Access denied.' };
        }
        if (role === 'customer' && !this.customerOwnsInquiry(inquiry, userId)) {
            return { ok: false, code: 403, message: 'Access denied.' };
        }

        const { data, error } = await supabase
            .from('inquiries')
            .update({
                approval_status: status,
                updated_at: new Date().toISOString()
            })
            .eq('id', inquiry_id)
            .select()
            .maybeSingle();

        if (error) throw error;

        // Notification to partner
        const isApproved = status === 'approved';
        await supabase.from('notifications').insert({
            sender_id: String(userId),
            sender_role: role,
            recipient_id: String(inquiry.partner_id),
            recipient_role: 'partner',
            message: isApproved 
                ? `Customer has approved the schedule for inquiry ${inquiry_id}.`
                : `Customer has rejected the schedule for inquiry ${inquiry_id}. Please propose a new date.`,
            inquiry_id
        });

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

        // Validate file type (PDF only)
        const allowedMimeTypes = ['application/pdf'];
        if (!allowedMimeTypes.includes(contentType)) {
            return {
                ok: false,
                code: 400,
                message: 'Invalid file type. Only PDF files are allowed.'
            };
        }

        // Validate file size (100MB)
        const maxSize = 100 * 1024 * 1024;
        if (file.size > maxSize || (file.buffer && file.buffer.length > maxSize)) {
            return {
                ok: false,
                code: 400,
                message: 'File size must be less than 100MB'
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

    /**
     * Create quotation: Storage + DB. Partner only.
     */
    async createQuotation(partnerId, file, body) {
        const inquiryId = body.inquiry_id;
        if (!inquiryId) return { ok: false, code: 400, message: 'inquiry_id is required.' };
        if (!file || !file.buffer) return { ok: false, code: 400, message: 'file is required.' };

        const inquiry = await this.getInquiryAccessRow(inquiryId);
        if (!inquiry) return { ok: false, code: 404, message: 'Inquiry not found.' };
        if (!this.partnerOwnsInquiry(inquiry, partnerId)) return { ok: false, code: 403, message: 'Access denied.' };

        // 1. Upload PDF
        const safeName = (file.originalname || 'quotation.pdf').replace(/[^\w.\-]+/g, '_');
        const path = `${inquiryId}/${Date.now()}_${safeName}`;
        const contentType = 'application/pdf';

        const { error: uploadError } = await supabase.storage
            .from(QUOTATION_BUCKET)
            .upload(path, file.buffer, { contentType, upsert: false });

        if (uploadError) {
            // Check if bucket exists, if not, try creating or just error with helpful message
            console.error('[MaintenanceService] Quotation upload error:', uploadError);
            throw uploadError;
        }

        const { data: urlData } = supabase.storage.from(QUOTATION_BUCKET).getPublicUrl(path);
        const pdfUrl = urlData?.publicUrl;

        // 2. Insert record
        const cost = body.estimated_cost ? Number(body.estimated_cost) : null;
        
        const { data, error } = await supabase
            .from('quotations')
            .upsert({
                inquiry_id: inquiryId,
                partner_id: partnerId,
                customer_id: body.customer_id || inquiry.customer_id,
                estimated_cost: cost,
                pdf_url: pdfUrl,
                status: 'sent',
                updated_at: new Date().toISOString()
            }, { onConflict: 'inquiry_id' })
            .select()
            .single();

        if (error) throw error;

        // 3. Update inquiry status
        await supabase.from('inquiries').update({ status: 'quoted' }).eq('id', inquiryId);

        // 4. Notify customer
        await supabase.from('notifications').insert({
            sender_id: String(partnerId),
            sender_role: 'partner',
            recipient_id: String(inquiry.customer_id),
            recipient_role: 'customer',
            message: `A new quotation has been sent for inquiry ${inquiryId}.`,
            inquiry_id: inquiryId,
            type: 'quotation',
            title: 'New Quotation Received'
        });

        return { ok: true, data };
    }

    async getQuotationByInquiryId(inquiryId, user) {
        const { data, error } = await supabase
            .from('quotations')
            .select('*')
            .eq('inquiry_id', inquiryId)
            .maybeSingle();

        if (error) throw error;
        return { ok: true, data };
    }

    async listQuotationsForCustomer(customerId) {
        const { data, error } = await supabase
            .from('quotations')
            .select('*, inquiries(type, status)')
            .eq('customer_id', customerId)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return { ok: true, data: data || [] };
    }

    async updateQuotationStatus(quotationId, status, user) {
        const { data: existing, error: fetchErr } = await supabase
            .from('quotations')
            .select('*')
            .eq('id', quotationId)
            .single();
        
        if (fetchErr || !existing) return { ok: false, code: 404, message: 'Quotation not found.' };

        // Only owning customer can approve/reject
        if (user.role === 'customer' && String(existing.customer_id) !== String(user.id)) {
            return { ok: false, code: 403, message: 'Access denied.' };
        }

        const { data, error } = await supabase
            .from('quotations')
            .update({ status, updated_at: new Date().toISOString() })
            .eq('id', quotationId)
            .select()
            .single();

        if (error) throw error;

        // Notification to partner
        await supabase.from('notifications').insert({
            sender_id: String(user.id),
            sender_role: user.role,
            recipient_id: String(existing.partner_id),
            recipient_role: 'partner',
            message: `Quotation for inquiry ${existing.inquiry_id} has been ${status}.`,
            inquiry_id: existing.inquiry_id,
            type: 'quotation_update',
            title: `Quotation ${status}`
        });

        return { ok: true, data };
    }
}

module.exports = new MaintenanceService();
