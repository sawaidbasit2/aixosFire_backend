const maintenanceService = require('../services/maintenanceService');

const json = (res, status, success, data, error) => {
    const body = { success, data: data ?? null, error: error ?? null };
    return res.status(status).json(body);
};

class MaintenanceController {
    async acceptInquiry(req, res) {
        const { id } = req.params;
        const { id: userId, role } = req.user;

        if (role !== 'partner') {
            return json(res, 403, false, null, 'Only partners can accept inquiries.');
        }

        try {
            const result = await maintenanceService.acceptInquiry(id, userId);
            if (!result.ok) {
                return json(res, result.code, false, null, result.message);
            }
            return json(res, 200, true, result.data, null);
        } catch (error) {
            console.error('[MaintenanceController] acceptInquiry:', error);
            return json(res, 500, false, null, error.message || 'Failed to accept inquiry.');
        }
    }

    async scheduleVisit(req, res) {
        const { id: userId, role } = req.user;
        if (role !== 'partner') {
            return json(res, 403, false, null, 'Only partners can schedule site visits.');
        }

        try {
            const result = await maintenanceService.scheduleVisit(userId, req.body);
            if (!result.ok) {
                return json(res, result.code, false, null, result.message);
            }
            return json(res, 200, true, result.data, null);
        } catch (error) {
            console.error('[MaintenanceController] scheduleVisit:', error);
            return json(res, 500, false, null, error.message || 'Failed to schedule visit.');
        }
    }

    async approveSchedule(req, res) {
        const { id: userId, role } = req.user;
        try {
            const result = await maintenanceService.approveSchedule(userId, role, req.body);
            if (!result.ok) {
                return json(res, result.code, false, null, result.message);
            }
            return json(res, 200, true, result.data, null);
        } catch (error) {
            console.error('[MaintenanceController] approveSchedule:', error);
            return json(res, 500, false, null, error.message || 'Failed to approve schedule.');
        }
    }

    async upsertSiteAssessment(req, res) {
        const { id: userId, role } = req.user;
        if (role !== 'partner') {
            return json(res, 403, false, null, 'Only partners can submit site assessments.');
        }

        const b = req.body || {};
        const payload = {
            inquiry_id: b.inquiry_id || b.inquiryId,
            observations: b.observations,
            required_services: b.required_services ?? b.requiredServices,
            estimated_cost: b.estimated_cost ?? b.estimatedCost,
            additional_notes: b.additional_notes ?? b.additionalNotes
        };

        try {
            const result = await maintenanceService.upsertSiteAssessment(userId, payload);
            if (!result.ok) {
                return json(res, result.code, false, null, result.message);
            }
            return json(res, 200, true, result.data, null);
        } catch (error) {
            console.error('[MaintenanceController] upsertSiteAssessment:', error);
            return json(res, 500, false, null, error.message || 'Failed to save site assessment.');
        }
    }

    async getSiteAssessment(req, res) {
        const { inquiryId } = req.params;
        try {
            const result = await maintenanceService.getSiteAssessmentByInquiryId(inquiryId, req.user);
            if (!result.ok) {
                return json(res, result.code, false, null, result.message);
            }
            return json(res, 200, true, result.data, null);
        } catch (error) {
            console.error('[MaintenanceController] getSiteAssessment:', error);
            return json(res, 500, false, null, error.message || 'Failed to load site assessment.');
        }
    }

    async listInspections(req, res) {
        const { inquiryId } = req.params;
        try {
            const result = await maintenanceService.listInspectionReportsByInquiryId(inquiryId, req.user);
            if (!result.ok) {
                return json(res, result.code, false, null, result.message);
            }
            return json(res, 200, true, result.data, null);
        } catch (error) {
            console.error('[MaintenanceController] listInspections:', error);
            return json(res, 500, false, null, error.message || 'Failed to load inspections.');
        }
    }

    async createInspection(req, res) {
        const { id: userId, role } = req.user;
        if (role !== 'partner') {
            return json(res, 403, false, null, 'Only partners can upload inspection reports.');
        }

        try {
            const result = await maintenanceService.createInspectionReport(userId, req.file, req.body || {});
            if (!result.ok) {
                return json(res, result.code, false, null, result.message);
            }
            return json(res, 201, true, result.data, null);
        } catch (error) {
            console.error('[MaintenanceController] createInspection:', error);
            return json(res, 500, false, null, error.message || 'Failed to upload inspection.');
        }
    }

    async createQuotation(req, res) {
        const { id: userId, role } = req.user;
        if (role !== 'partner') {
            return json(res, 403, false, null, 'Only partners can submit quotations.');
        }

        try {
            const result = await maintenanceService.createQuotation(userId, req.file, req.body || {});
            if (!result.ok) {
                return json(res, result.code, false, null, result.message);
            }
            return json(res, 201, true, result.data, null);
        } catch (error) {
            console.error('[MaintenanceController] createQuotation:', error);
            return json(res, 500, false, null, error.message || 'Failed to submit quotation.');
        }
    }

    async getQuotation(req, res) {
        const { inquiryId } = req.params;
        try {
            const result = await maintenanceService.getQuotationByInquiryId(inquiryId, req.user);
            if (!result.ok) {
                return json(res, result.code, false, null, result.message);
            }
            return json(res, 200, true, result.data, null);
        } catch (error) {
            console.error('[MaintenanceController] getQuotation:', error);
            return json(res, 500, false, null, error.message || 'Failed to load quotation.');
        }
    }

    async listQuotations(req, res) {
        const { id: userId, role } = req.user;
        if (role !== 'customer') {
            return json(res, 403, false, null, 'Only customers can list their quotations.');
        }

        try {
            const result = await maintenanceService.listQuotationsForCustomer(userId);
            if (!result.ok) {
                return json(res, result.code, false, null, result.message);
            }
            return json(res, 200, true, result.data, null);
        } catch (error) {
            console.error('[MaintenanceController] listQuotations:', error);
            return json(res, 500, false, null, error.message || 'Failed to load quotations.');
        }
    }

    async updateQuotation(req, res) {
        const { id } = req.params;
        const { status } = req.body;
        if (!status) return json(res, 400, false, null, 'Status is required.');

        try {
            const result = await maintenanceService.updateQuotationStatus(id, status, req.user);
            if (!result.ok) {
                return json(res, result.code, false, null, result.message);
            }
            return json(res, 200, true, result.data, null);
        } catch (error) {
            console.error('[MaintenanceController] updateQuotation:', error);
            return json(res, 500, false, null, error.message || 'Failed to update quotation.');
        }
    }
}

module.exports = new MaintenanceController();
