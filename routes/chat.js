const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');
const { verifyToken } = require('../middleware/auth');

/**
 * Chat Routes refactored to use extinguishers (queries)
 * Each extinguisher record in the system acts as a service query.
 */

// Message Routes
router.get('/extinguishers/:id/messages', verifyToken, chatController.getMessages);
router.post('/extinguishers/:id/messages', verifyToken, chatController.sendMessage);

// Customer Header Route
router.get('/customers/:customerId/header', verifyToken, chatController.getCustomerHeader);

module.exports = router;
