require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
// const db = require('./db'); // Replaced by Supabase

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(bodyParser.json());
app.use('/uploads', express.static('uploads'));

// Basic health check
app.get('/', (req, res) => {
    res.json({ message: 'Fire Protection Service API is running' });
});

const authRoutes = require('./routes/auth');
const agentsRoutes = require('./routes/agents');
const customersRoutes = require('./routes/customers');
const servicesRoutes = require('./routes/services');
const adminRoutes = require('./routes/admin');


app.use('/api/auth', authRoutes);
app.use('/api/agents', agentsRoutes);
app.use('/api/customers', customersRoutes);
app.use('/api/services', servicesRoutes);
app.use('/api/admin', adminRoutes);


app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
