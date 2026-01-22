const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const supabase = require('../supabase');
const multer = require('multer');
const path = require('path');
const nodemailer = require('nodemailer');
const crypto = require('crypto');

const SECRET_KEY = process.env.JWT_SECRET || 'super_secret_key_fire_marketplace';

// Configure Multer Storage
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ storage: storage });

// REGISTER AGENT
router.post('/register/agent', upload.fields([{ name: 'profile_photo', maxCount: 1 }, { name: 'cnic_document', maxCount: 1 }]), async (req, res) => {
    const { name, email, password, phone, cnic, territory, terms_accepted } = req.body;

    // Hash password
    const hashedPassword = bcrypt.hashSync(password, 8);

    // Get file paths
    const profile_photo = req.files['profile_photo'] ? req.files['profile_photo'][0].filename : null;
    const cnic_document = req.files['cnic_document'] ? req.files['cnic_document'][0].filename : null;

    const termsAcceptedBool = terms_accepted === 'true' || terms_accepted === true;

    try {
        const { data, error } = await supabase
            .from('agents')
            .insert([
                {
                    name,
                    email,
                    password: hashedPassword,
                    phone,
                    cnic,
                    territory,
                    status: 'Pending',
                    profile_photo,
                    cnic_document,
                    terms_accepted: termsAcceptedBool
                }
            ])
            .select();

        if (error) throw error;

        res.status(201).json({ message: 'Agent registered successfully. Pending Admin Approval.', id: data[0].id });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error registering agent', details: err.message });
    }
});

// REGISTER CUSTOMER
router.post('/register/customer', async (req, res) => {
    const { business_name, owner_name, email, password, phone, address, business_type } = req.body;
    const QRCode = require('qrcode');
    const fs = require('fs');

    const hashedPassword = bcrypt.hashSync(password, 8);

    // Handle Optional Email
    let finalEmail = email;
    if (!finalEmail || finalEmail.trim() === '') {
        finalEmail = `no-email-${Date.now()}-${Math.floor(Math.random() * 1000)}@aixos-placeholder.com`;
    }

    try {
        const { data: customerData, error: customerError } = await supabase
            .from('customers')
            .insert([
                { business_name, owner_name, email: finalEmail, password: hashedPassword, phone, address, business_type }
            ])
            .select();

        if (customerError) throw customerError;

        const customerId = customerData[0].id;

        // Generate QR Code
        const qrDir = path.join(__dirname, '../uploads/qrcodes');
        if (!fs.existsSync(qrDir)) {
            fs.mkdirSync(qrDir, { recursive: true });
        }

        const qrContent = JSON.stringify({
            id: customerId,
            type: 'customer',
            name: business_name,
            url: `https://app.aixos.com/customer/${customerId}`
        });

        const qrFileName = `qr-customer-${customerId}-${Date.now()}.png`;
        const qrFilePath = path.join(qrDir, qrFileName);

        await QRCode.toFile(qrFilePath, qrContent, {
            color: {
                dark: '#000000',
                light: '#0000'
            }
        });

        const qrUrl = `/uploads/qrcodes/${qrFileName}`;

        const { error: updateError } = await supabase
            .from('customers')
            .update({ qr_code_url: qrUrl })
            .eq('id', customerId);

        if (updateError) console.error("QR Update Error:", updateError);

        res.status(201).json({ message: 'Customer registered successfully', id: customerId, qr_code_url: qrUrl });
    } catch (err) {
        console.error("Register Error:", err);
        res.status(500).json({ error: 'Error registering customer', details: err.message });
    }
});

// LOGIN (Generic)
router.post('/login', async (req, res) => {
    const { email, password, role } = req.body;

    let table = '';
    if (role === 'agent') table = 'agents';
    else if (role === 'customer') table = 'customers';
    else if (role === 'admin') table = 'admins';
    else return res.status(400).json({ error: 'Invalid role' });

    try {
        const { data: user, error } = await supabase
            .from(table)
            .select('*')
            .eq('email', email)
            .single();

        if (error || !user) return res.status(404).json({ error: 'User not found' });

        const passwordIsValid = bcrypt.compareSync(password, user.password);
        if (!passwordIsValid) return res.status(401).json({ error: 'Invalid password' });

        if (role === 'agent' && user.status !== 'Active') {
            return res.status(403).json({ error: 'Account is pending approval. Please contact admin.' });
        }

        const token = jwt.sign({ id: user.id, role }, SECRET_KEY, { expiresIn: '24h' });

        res.status(200).json({ auth: true, token: token, user: user });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// FORGOT PASSWORD - SEND OTP
router.post('/forgot-password', async (req, res) => {
    const { email } = req.body;

    try {
        // Use Supabase Auth to send the reset password email/OTP
        const { error } = await supabase.auth.resetPasswordForEmail(email);

        if (error) throw error;

        res.status(200).json({ message: 'OTP sent to your email.' });
    } catch (err) {
        console.error('Supabase Forgot Password Error:', err);
        res.status(500).json({ error: 'Error processing forgot password request', details: err.message });
    }
});

// VERIFY OTP & RESET PASSWORD
router.post('/reset-password', async (req, res) => {
    const { email, otp, newPassword, role } = req.body;

    let table = '';
    if (role === 'agent') table = 'agents';
    else if (role === 'customer') table = 'customers';
    else if (role === 'admin') table = 'admins';
    else return res.status(400).json({ error: 'Invalid role' });

    try {
        // 1. Verify OTP with Supabase Auth
        const { data, error: verifyError } = await supabase.auth.verifyOtp({
            email,
            token: otp,
            type: 'recovery'
        });

        if (verifyError) {
            console.error('OTP Verification Error:', verifyError);
            return res.status(400).json({ error: 'Invalid or expired OTP' });
        }

        // 2. Update Password in custom table
        const hashedPassword = bcrypt.hashSync(newPassword, 8);
        const { error: updateError } = await supabase
            .from(table)
            .update({ password: hashedPassword })
            .eq('email', email);

        if (updateError) throw updateError;

        res.status(200).json({ message: 'Password reset successful.' });
    } catch (err) {
        console.error('Reset Password Error:', err);
        res.status(500).json({ error: 'Error resetting password', details: err.message });
    }
});


module.exports = router;
