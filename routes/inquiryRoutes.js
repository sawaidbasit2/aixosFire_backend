const express = require('express');
const router = express.Router();
const inquiryController = require('../controllers/inquiryController');
const { verifyToken } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');

// Configure Multer for Inquiry Documents
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'inquiry-doc-' + uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

/**
 * 2. Inquiry APIs
 */
// GET /api/inquiries
router.get('/inquiries', verifyToken, inquiryController.getInquiries);

// POST /api/inquiries
router.post('/inquiries', verifyToken, inquiryController.createInquiry);

// GET /api/inquiries/:id
router.get('/inquiries/:id', verifyToken, inquiryController.getInquiryById);

// PATCH /api/inquiries/:id
router.patch('/inquiries/:id', verifyToken, inquiryController.updateInquiry);

/**
 * 3. Inquiry Items APIs
 */
// PATCH /api/inquiry-items/:id
router.patch('/inquiry-items/:id', verifyToken, inquiryController.updateInquiryItem);

// POST /api/inquiries/:id/items
router.post('/inquiries/:id/items', verifyToken, inquiryController.addInquiryItems);

/**
 * 4. Item Services APIs
 */
// POST /api/inquiry-items/:id/services
router.post('/inquiry-items/:id/services', verifyToken, inquiryController.addItemService);

/**
 * 5. Documents API
 */
// POST /api/inquiry-documents
router.post('/inquiry-documents', verifyToken, upload.array('documents', 5), inquiryController.uploadDocument);

module.exports = router;
