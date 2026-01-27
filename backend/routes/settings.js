/* ============================================
   SETTINGS ROUTES
   Manages system-wide configuration
   ============================================ */

const express = require('express');
const router = express.Router();

// Import database connection
const db = require('../config/database');

/* ============================================
   GET /api/settings
   Fetch current system settings
   Used by: Settings page on load
   ============================================ */

router.get('/', (req, res) => {

    // Query the single settings row (id = 1)
    const query = 'SELECT * FROM system_settings WHERE id = 1';

    db.query(query, (err, results) => {
        if (err) {
            console.error('Error fetching settings:', err);
            return res.status(500).json({ error: 'Failed to fetch settings' });
        }

        // Check if settings exist
        if (results.length === 0) {
            console.error('No settings found in database');
            return res.status(404).json({ error: 'Settings not found' });
        }

        // Return the single settings object (not an array)
        res.json(results[0]);
    });
});

/* ============================================
   PUT /api/settings
   Update system settings
   Used by: Settings page save button
   ============================================ */

router.put('/', (req, res) => {

    // Extract settings from request body
    const {
        currency_symbol, 
        date_format, 
        low_inventory_threshold, 
        capacity_warning_percent
    } = req.body;

    // Validation: Check required fields
    if (!currency_symbol || !date_format) {
        return res.status(400).json({ error: 'Currency symbol and date format are required' });
    }

    // Validation: Check threholds are positive numbers
    if (low_inventory_threshold < 1 || capacity_warning_percent < 1 || capacity_warning_percent > 100) {
        return res.status(400).json({ 
            error: 'Invalid thresholds: Inventory must be >= 1, Capacity must be 1-100%' });
    }

    // Update query
    const query = `
        UPDATE system_settings
        SET
            currency_symbol = ?,
            date_format = ?,
            low_inventory_threshold = ?,
            capacity_warning_percent = ?
        WHERE id = 1
    `;

    const values = [
        currency_symbol, 
        date_format, 
        low_inventory_threshold, 
        capacity_warning_percent
    ];

    db.query(query, values, (err, results) => {
        if (err) {
            console.error('Error updating settings:', err);
            return res.status(500).json({ error: 'Failed to update settings' });
        }

        // Check if any rows are actually updated
        if (results.afftedRows === 0) {
            return res.status(404).json({ error: 'Settings not found' });
        }

        // Return success with updated values
        res.json({
            message: 'Settings updated successfully', 
            settings: {
                currency_symbol, 
                date_format, 
                low_inventory_threshold, 
                capacity_warning_percent
            }
        });
    });
});

module.exports = router;