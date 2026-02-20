const chatService = require('../services/chatService');

const chatController = {
    /**
     * GET /api/extinguishers/:id/messages
     */
    getMessages: async (req, res) => {
        const { id: extinguisherId } = req.params;
        const { id: userId, role } = req.user;

        try {
            // 1. Validate participant (check if customer owns the extinguisher or user is staff)
            const isParticipant = await chatService.isUserParticipant(extinguisherId, userId, role);
            if (!isParticipant) {
                return res.status(403).json({ error: 'You are not authorized to view this chat history.' });
            }

            // 2. Fetch messages
            const messages = await chatService.getMessagesByExtinguisherId(extinguisherId);
            res.status(200).json(messages);
        } catch (err) {
            console.error('Error fetching messages:', err);
            res.status(500).json({ error: 'Failed to fetch chat history.' });
        }
    },

    /**
     * POST /api/extinguishers/:id/messages
     * Unified API for both agents and customers.
     * Sender information is automatically securely derived from the JWT token.
     */
    sendMessage: async (req, res) => {
        const { id: extinguisherId } = req.params;
        const { content } = req.body;

        // Extract sender data from req.user (populated by verifyToken middleware)
        const { id: userId, role: userRole } = req.user;

        if (!content || content.trim() === '') {
            return res.status(400).json({ error: 'Message content is required.' });
        }

        // Validate that the userRole is one we expect
        const validRoles = ['customer', 'agent', 'admin'];
        if (!validRoles.includes(userRole)) {
            return res.status(403).json({ error: 'Invalid user role for sending messages.' });
        }

        try {
            // 1. Validate extinguisher exists and user is participant (belongs to them or is staff)
            const isParticipant = await chatService.isUserParticipant(extinguisherId, userId, userRole);
            if (!isParticipant) {
                return res.status(403).json({ error: 'You are not authorized to send messages for this extinguisher.' });
            }

            // 2. Insert message with extinguisher_id and securely derived sender info
            const newMessage = await chatService.createMessage({
                extinguisher_id: extinguisherId,
                sender_id: userId,
                sender_type: userRole, // 'customer', 'agent', or 'admin'
                content: content.trim()
            });

            res.status(201).json(newMessage);
        } catch (err) {
            console.error('Error sending message:', err);
            res.status(500).json({ error: 'Failed to send message.' });
        }
    },

    /**
     * GET /api/customers/:customerId/header
     */
    getCustomerHeader: async (req, res) => {
        const { customerId } = req.params;

        try {
            const customerInfo = await chatService.getCustomerHeaderInfo(customerId);
            if (!customerInfo) {
                return res.status(404).json({ error: 'Customer not found.' });
            }
            res.status(200).json(customerInfo);
        } catch (err) {
            console.error('Error fetching customer header:', err);
            res.status(500).json({ error: 'Failed to fetch customer info.' });
        }
    }
};

module.exports = chatController;
