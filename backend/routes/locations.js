/* ============================================
   LOCATIONS ROUTES
   All endpoints related to gym location
   ============================================ */

const express = require('express');
const router = express.Router();

// Import database
const db = require('../config/database');

/* ============================================
   GET /api/locations
   Get all gym locations
   ============================================ */
router.get('/', (req, res) => {
    
    const query = 'SELECT id, name FROM locations ORDER BY name';

    db.query(query, (err, results) => {
        if (err) {
            console.error('❌ Error fetching locations:', err);
            return res.status(500).json({ error: 'Failed to fetch locations' });
        }

        console.log(`✅ Found ${results.length} locations`);

        res.json(results);
    });
});

module.exports = router;