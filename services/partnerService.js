const supabase = require('../supabase');

/**
 * Partner Service
 * Handles data retrieval and stats for partners.
 */
class PartnerService {
    /**
     * Get stats for a specific partner.
     * @param {string} partnerId - UUID of the partner.
     * @returns {Promise<Object>} - Stats object.
     */
    async getPartnerStats(partnerId) {
        try {
            // Fetch inquiries assigned to this partner with their items for sales calculation
            const { data: inquiries, error: inqError } = await supabase
                .from('inquiries')
                .select(`
                    id, 
                    status, 
                    agent_id,
                    inquiry_items (id, price, quantity)
                `)
                .eq('partner_id', partnerId);

            if (inqError) throw inqError;

            // Inquiries stats
            const pending_inquiries = (inquiries || []).filter(i => i.status === 'pending').length;
            const active_inquiries = (inquiries || []).filter(i => ['active', 'accepted'].includes(i.status)).length;
            const closed_inquiries = (inquiries || []).filter(i => ['completed', 'closed'].includes(i.status)).length;

            // Agents stats (unique agents who handled inquiries)
            const uniqueAgents = new Set((inquiries || []).filter(i => i.agent_id).map(i => i.agent_id));
            const total_agents = uniqueAgents.size;

            // Sales Calculation
            let total_sales = 0;
            (inquiries || []).forEach(inquiry => {
                const items = inquiry.inquiry_items || [];
                items.forEach(item => {
                    total_sales += (item.price || 0) * (item.quantity || 1);
                });
            });

            return {
                active_inquiries,
                pending_inquiries,
                closed_inquiries,
                total_sales,
                total_agents
            };
        } catch (error) {
            console.error('[PartnerService] getPartnerStats error:', error);
            throw error;
        }
    }

    /**
     * Get units assigned to a partner.
     * @param {string} partnerId 
     */
    async getAssignedUnits(partnerId) {
        try {
            const { data, error } = await supabase
                .from('extinguishers')
                .select('*, customers!fk_ext_customer(business_name, address)')
                .eq('partner_id', partnerId)
                .order('created_at', { ascending: false });

            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error('[PartnerService] getAssignedUnits error:', error);
            throw new Error(`Unable to fetch assigned units: ${error.message}`);
        }
    }

    /**
     * Get all active partners.
     */
    async getAllPartners() {
        try {
            const { data, error } = await supabase
                .from('partners')
                .select('id, business_name, email, phone')
                .eq('status', 'active');

            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error('[PartnerService] getAllPartners error:', error);
            throw new Error(`Unable to fetch partners: ${error.message}`);
        }
    }
}

module.exports = new PartnerService();
