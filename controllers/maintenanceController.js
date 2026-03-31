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
}

module.exports = new MaintenanceController();
