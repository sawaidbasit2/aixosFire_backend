const partnerService = require('../services/partnerService');

/**
 * Partner Controller
 * Handles requests for partners dashboard and stats.
 */
class PartnerController {
    /**
     * Get dashboard data for the partner.
     */
    async getDashboard(req, res) {
        const { id: partnerId, role } = req.user;

        if (role !== 'partner') {
            return res.status(403).json({
                success: false,
                data: null,
                error: 'Access denied. Only partners can access this dashboard.'
            });
        }

        try {
            const stats = await partnerService.getPartnerStats(partnerId);
            const units = await partnerService.getAssignedUnits(partnerId);

            return res.status(200).json({
                success: true,
                data: {
                    stats,
                    assignedUnits: units
                },
                error: null
            });
        } catch (error) {
            console.error('[PartnerController] getDashboard error:', error);
            return res.status(500).json({
                success: false,
                data: null,
                error: `Failed to fetch dashboard data: ${error.message}`
            });
        }
    }

    /**
     * Get standalone stats for the partner.
     */
    async getStats(req, res) {
        const { id: partnerId, role } = req.user;

        if (role !== 'partner') {
            return res.status(403).json({
                success: false,
                data: null,
                error: 'Access denied. Only partners can access stats.'
            });
        }

        try {
            const stats = await partnerService.getPartnerStats(partnerId);
            return res.status(200).json({
                success: true,
                data: stats,
                error: null
            });
        } catch (error) {
            console.error('[PartnerController] getStats error:', error);
            return res.status(500).json({
                success: false,
                data: null,
                error: `Failed to fetch partner stats: ${error.message}`
            });
        }
    }
}

module.exports = new PartnerController();
