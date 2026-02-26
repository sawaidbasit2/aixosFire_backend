const express = require('express');
const router = express.Router();
const supabase = require('../supabase');
const { verifyToken } = require('../middleware/auth');

/**
 * GET /api/partners/dashboard
 * Fetch stats and assigned units for the logged-in partner.
 */
router.get('/dashboard', verifyToken, async (req, res) => {
    const { id: partnerId, role } = req.user;

    console.log(`[Partner Dashboard] Fetching data for ID: ${partnerId}, Role: ${role}`);

    if (role !== 'partner') {
        return res.status(403).json({ error: 'Access denied. Only partners can access this dashboard.' });
    }

    try {
        // Fetch extinguishers assigned to this partner
        const { data: units, error: unitsError } = await supabase
            .from('extinguishers')
            .select('*, customers!fk_ext_customer(business_name, address)')
            .eq('partner_id', partnerId)
            .order('created_at', { ascending: false });

        if (unitsError) throw unitsError;

        // Calculate stats
        const totalUnits = units?.length || 0;
        const refillsNeeded = (units || []).filter(u => u.status === 'Refilled' || u.condition === 'Fair').length;
        const activeQueries = (units || []).filter(u => u.query_status === 'Active').length;

        console.log(`[Partner Dashboard] Found ${totalUnits} units for Partner ID: ${partnerId}`);

        res.json({
            stats: {
                totalUnits,
                refillsNeeded,
                activeQueries
            },
            assignedUnits: units || []
        });
    } catch (err) {
        console.error('[Partner Dashboard Error]:', err);
        res.status(500).json({ error: 'Failed to fetch dashboard data', details: err.message });
    }
});

module.exports = router;
