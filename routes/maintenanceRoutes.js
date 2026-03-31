const express = require('express');
const multer = require('multer');
const { verifyToken } = require('../middleware/auth');
const maintenanceController = require('../controllers/maintenanceController');

const router = express.Router();
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 25 * 1024 * 1024 }
});

/**
 * Maintenance — partner/customer flows backed by Supabase (server-side only).
 */
router.patch('/inquiries/:id/accept', verifyToken, (req, res) =>
    maintenanceController.acceptInquiry(req, res)
);

router.post('/site-assessments', verifyToken, (req, res) =>
    maintenanceController.upsertSiteAssessment(req, res)
);

router.get('/site-assessments/:inquiryId', verifyToken, (req, res) =>
    maintenanceController.getSiteAssessment(req, res)
);

router.post('/inspections', verifyToken, upload.single('file'), (req, res) =>
    maintenanceController.createInspection(req, res)
);

router.get('/inspections/:inquiryId', verifyToken, (req, res) =>
    maintenanceController.listInspections(req, res)
);

module.exports = router;
