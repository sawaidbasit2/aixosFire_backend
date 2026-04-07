const express = require('express');
const multer = require('multer');
const { verifyToken } = require('../middleware/auth');
const maintenanceController = require('../controllers/maintenanceController');

const router = express.Router();
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 100 * 1024 * 1024 }, // 100MB
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'application/pdf') {
            cb(null, true);
        } else {
            cb(new Error('Only PDF files are allowed.'), false);
        }
    }
});

/**
 * Maintenance — partner/customer flows backed by Supabase (server-side only).
 */
router.patch('/inquiries/:id/accept', verifyToken, (req, res) =>
    maintenanceController.acceptInquiry(req, res)
);

router.post('/schedule', verifyToken, (req, res) =>
    maintenanceController.scheduleVisit(req, res)
);

router.patch('/approve', verifyToken, (req, res) =>
    maintenanceController.approveSchedule(req, res)
);

router.post('/site-assessments', verifyToken, (req, res) =>
    maintenanceController.upsertSiteAssessment(req, res)
);

router.get('/site-assessments/:inquiryId', verifyToken, (req, res) =>
    maintenanceController.getSiteAssessment(req, res)
);

router.post('/inspections', verifyToken, (req, res, next) => {
    upload.single('file')(req, res, (err) => {
        if (err instanceof multer.MulterError) {
            if (err.code === 'LIMIT_FILE_SIZE') {
                return res.status(400).json({ 
                    success: false, 
                    error: 'File size must be less than 100MB' 
                });
            }
            return res.status(400).json({ success: false, error: err.message });
        } else if (err) {
            return res.status(400).json({ success: false, error: err.message });
        }
        maintenanceController.createInspection(req, res);
    });
});

router.get('/inspections/:inquiryId', verifyToken, (req, res) =>
    maintenanceController.listInspections(req, res)
);

/**
 * Quotations
 */
router.post('/quotation/create', verifyToken, (req, res, next) => {
    upload.single('pdf_file')(req, res, (err) => {
        if (err) return res.status(400).json({ success: false, error: err.message });
        maintenanceController.createQuotation(req, res);
    });
});

router.get('/quotations', verifyToken, (req, res) =>
    maintenanceController.listQuotations(req, res)
);

router.get('/quotations/:inquiryId', verifyToken, (req, res) =>
    maintenanceController.getQuotation(req, res)
);

router.patch('/quotations/:id', verifyToken, (req, res) =>
    maintenanceController.updateQuotation(req, res)
);

module.exports = router;
