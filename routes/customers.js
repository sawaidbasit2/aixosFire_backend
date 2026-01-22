const express = require('express');
const router = express.Router();
const supabase = require('../supabase');

// GET Customer Dashboard (Inventory + Pending Services)
router.get('/:id/dashboard', async (req, res) => {
    const customerId = req.params.id;

    try {
        const { data: extinguishers, error: eError } = await supabase
            .from('extinguishers')
            .select('*')
            .eq('customer_id', customerId);

        if (eError) throw eError;

        const { data: services, error: sError } = await supabase
            .from('services')
            .select('*')
            .eq('customer_id', customerId)
            .order('request_date', { ascending: false })
            .limit(5);

        if (sError) throw sError;

        res.json({ extinguishers, services });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error fetching dashboard data' });
    }
});

// GET Customer Inventory (Dedicated)
router.get('/:id/inventory', async (req, res) => {
    const customerId = req.params.id;
    try {
        const { data, error } = await supabase
            .from('extinguishers')
            .select('*')
            .eq('customer_id', customerId);
        if (error) throw error;
        res.json(data);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error fetching inventory' });
    }
});

// GET Customer History (Dedicated)
router.get('/:id/history', async (req, res) => {
    const customerId = req.params.id;
    try {
        const { data, error } = await supabase
            .from('services')
            .select('*')
            .eq('customer_id', customerId)
            .order('scheduled_date', { ascending: false });
        if (error) throw error;
        res.json(data);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error fetching history' });
    }
});

// BOOK SERVICE
router.post('/book', async (req, res) => {
    const { customerId, serviceType, date, notes, assetIds } = req.body;

    try {
        const { data, error } = await supabase
            .from('services')
            .insert([
                { customer_id: customerId, service_type: serviceType, scheduled_date: date, notes }
            ])
            .select();

        if (error) throw error;

        const serviceId = data[0].id;

        // Note: service_items migration would go here if implemented in Supabase
        // For now, we skip it as it wasn't in the core schema in db.js

        res.status(201).json({ message: 'Service booked successfully', id: serviceId });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// ADD EXTINGUISHER
router.post('/inventory', async (req, res) => {
    const { customerId, type, capacity, quantity, installDate, expiryDate } = req.body;
    try {
        const { data, error } = await supabase
            .from('extinguishers')
            .insert([
                { customer_id: customerId, type, capacity, quantity, install_date: installDate, expiry_date: expiryDate, status: 'Valid' }
            ])
            .select();

        if (error) throw error;
        res.status(201).json({ message: 'Extinguisher added', id: data[0].id });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// UPDATE LOCATION
router.post('/location', async (req, res) => {
    const { id, lat, lng } = req.body;
    try {
        const { error } = await supabase
            .from('customers')
            .update({ location_lat: lat, location_lng: lng })
            .eq('id', id);
        if (error) throw error;
        res.json({ message: 'Location updated' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'DB Error' });
    }
});

module.exports = router;
