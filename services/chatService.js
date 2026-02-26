const supabase = require('../supabase');

const chatService = {
    /**
     * Fetch chat history for a specific extinguisher
     * Parent changed from 'query' to 'extinguisher' per database schema requirements.
     */
    getMessagesByExtinguisherId: async (extinguisherId) => {
        const { data, error } = await supabase
            .from('messages')
            .select('*')
            .eq('extinguisher_id', extinguisherId)
            .order('created_at', { ascending: true });

        if (error) throw error;
        return data;
    },

    /**
     * Insert a new message into an extinguisher chat
     */
    createMessage: async (messageData) => {
        const { data, error } = await supabase
            .from('messages')
            .insert([messageData])
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    /**
     * Fetch extinguisher details for validation and authorization
     */
    getExtinguisherById: async (id) => {
        const { data, error } = await supabase
            .from('extinguishers')
            .select('*')
            .eq('id', id)
            .single();

        if (error) throw error;
        return data;
    },

    /**
     * Check if a user is authorized to participate in this extinguisher chat
     * Authorization is based on the customer_id linked to the extinguisher.
     */
    isUserParticipant: async (extinguisherId, userId, role) => {
        const { data, error } = await supabase
            .from('extinguishers')
            .select('customer_id, partner_id')
            .eq('id', extinguisherId)
            .single();

        if (error || !data) return false;

        if (role === 'customer') {
            // Customer can only chat about their own extinguishers
            return data.customer_id === userId;
        } else if (role === 'partner') {
            // Partner can only chat about extinguishers assigned to them via partner_id
            return data.partner_id === userId;
        } else if (role === 'agent' || role === 'admin') {
            // Agents and Admins can chat about any extinguisher
            return true;
        }

        return false;
    },

    /**
     * Fetch customer header info (for Agent ↔ Customer chat UI)
     */
    getCustomerHeaderInfo: async (customerId) => {
        const { data, error } = await supabase
            .from('customers')
            .select('id, business_name, owner_name, status, profile_photo')
            .eq('id', customerId)
            .single();

        if (error) throw error;
        return data;
    },

    /**
     * Fetch partner header info (for Agent ↔ Partner chat UI)
     */
    getPartnerHeaderInfo: async (partnerId) => {
        const { data, error } = await supabase
            .from('partners')
            .select('id, business_name, owner_name, status')
            .eq('id', partnerId)
            .single();

        if (error) throw error;
        return data;
    }
};

module.exports = chatService;
