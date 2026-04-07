const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');
const { verifyToken } = require('../middleware/auth');

/**
 * Chat Routes refactored to use extinguishers (queries)
 * Each extinguisher record in the system acts as a service query.
 */

// Message Routes — supports sender_type: 'agent' | 'customer' | 'partner' | 'admin'
router.get('/extinguishers/:id/messages', verifyToken, chatController.getMessages);
router.post('/extinguishers/:id/messages', verifyToken, chatController.sendMessage);

// Chat Header Routes (for frontend chat UI)
router.get('/customers/:customerId/header', verifyToken, chatController.getCustomerHeader);
router.get('/partners/:partnerId/header', verifyToken, chatController.getPartnerHeader);

// General Chat System (Customer <-> Partner)
router.get('/messages', verifyToken, chatController.getDirectMessagesHistory);
router.post('/messages', verifyToken, chatController.sendDirectMessage);
router.patch('/messages/status', verifyToken, chatController.updateMessageStatus);

module.exports = router;
