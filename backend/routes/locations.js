/* ============================================
   LOCATIONS ROUTES
   All endpoints related to gym location
   ============================================ */

const express = require('express');
const router = express.Router();

// Import database
const db = require('../config/database');

const {
    validateEditLocation, 
    handleValidationErrors
} = require('../middleware/validation');

/* ============================================
   GET /api/locations
   Get all gym locations
   Used by: Dropdowns across the app
   ============================================ */
router.get('/', (req, res) => {
    
    const query = 'SELECT id, name FROM locations ORDER BY id';

    db.query(query, (err, results) => {
        if (err) {
            console.error('❌ Error fetching locations:', err);
            return res.status(500).json({ error: 'Failed to fetch locations' });
        }

        console.log(`✅ Found ${results.length} locations`);

        res.json(results);
    });
});

/* ============================================
   GET /api/locations/stats
   Get KPI statistics for locations dashboard
   Returns: Total locations, capacity, members, utilization
   ============================================ */

router.get('/stats', (req, res) => {

    // Calculate multiple metrics in one database call
    // IFNULL handles cases where there might be no members or locations
    const query =`
        SELECT
            COUNT(DISTINCT l.id) as total_locations,
            IFNULL(SUM(l.capacity), 0) as total_capacity,
            IFNULL(COUNT(DISTINCT m.id), 0) as total_members,
            ROUND(
                (IFNULL(COUNT(DISTINCT m.id), 0) / IFNULL(SUM(l.capacity), 1)) * 100,
                1
            ) as avg_utilization
        FROM locations l
        LEFT JOIN members m ON l.id = m.location_id
    `;

    db.query(query, (err, results) => {
        if (err) {
            console.error('Error fetching location stats:', err);
            return res.status(500).json({ error: 'Failed to fetch statistics' });
        }

        // results[0] because aggregate queries always return one row
        const stats = results[0];

        res.json(stats);
    });
});

/* ============================================
   GET /api/locations/details
   Get all locations with detailed statistics
   Used by: Location cards on dashboard
   Returns: Each location with member count, staff count, check-ins, utilization
   ============================================ */

router.get('/details', (req, res) => {

    // Query that joins mulitple tables to get all stats per location
    // we use LEFT JOIN so locations show up even if they have 0 members/staff
    const query = `
        SELECT
            l.id,
            l.name,
            l.capacity,
            l.created_at,
            
            -- Count members at this location
            IFNULL(COUNT(DISTINCT m.id), 0) as current_members,
            
            -- Count staff at this location
            IFNULL(COUNT(DISTINCT s.id), 0) as staff_count,
            
            -- Count check-ins today at this location
            IFNULL(COUNT(DISTINCT CASE
                WHEN DATE(c.check_in_time) = CURDATE()
                THEN c.id
            END), 0) as checkins_today,
            
            -- Calculate utilization percentage
            ROUND(
                (IFNULL(COUNT(DISTINCT m.id), 0) / l.capacity) * 100,
                1
            ) as utilization_percent
        
        FROM locations l
        LEFT JOIN members m ON l.id = m.location_id
        LEFT JOIN staff s ON l.id = s.location_id
        LEFT JOIN check_ins c ON l.id = c.location_id

        -- Group by location to aggregate counts per location
        GROUP BY l.id, l.name, l.capacity, l.created_at
        ORDER BY l.id
    `;

    db.query(query, (err, results) => {
        if (err) {
            console.error('Error fetching location details:', err);
            return res.status(500).json({ error: 'Failed to fetch location details' });
        }

        res.json({ locations: results });
    });
});

/* ============================================
   GET /api/locations/:id
   Get single location with detailed stats
   Used by: When viewing/editing a specific location
   ============================================ */

router.get('/:id', (req, res) => {

    // Extract id from URL parameter and convert to integer
    const locationId = parseInt(req.params.id);

    // Validate that id is a number
    if (isNaN(locationId)) {
        return res.status(400).json({ error: 'Invalid location ID' });
    }

    // Query as /details but filtered to one location
    const query = `
        SELECT
            l.id,
            l.name,
            l.capacity,
            l.created_at,
            IFNULL(COUNT(DISTINCT m.id), 0) as current_members,
            IFNULL(COUNT(DISTINCT s.id), 0) as staff_count,
            IFNULL(COUNT(DISTINCT CASE
                WHEN DATE(c.check_in_time) = CURDATE()
                THEN c.id
            END), 0) as checkins_today,
            ROUND(
                (IFNULL(COUNT(DISTINCT m.id), 0) / l.capacity) * 100,
                1
            ) as utilization_percent
        FROM locations l
        LEFT JOIN members m ON l.id = m.location_id
        LEFT JOIN staff s ON l.id = s.location_id
        LEFT JOIN check_ins c ON l.id = c.location_id
        WHERE l.id = ?
        GROUP BY l.id, l.name, l.capacity, l.created_at
    `;

    // Use parameterized query to prevent SQL injections
    db.query(query, [locationId], (err, results) => {
        if (err) {
            console.error('Error fetching location:', err);
            return res.status(500).json({ error: 'Failed to fetch location' });
        }

        // Check if location exists
        if (results.length === 0) {
            return res.status(404).json({ error: 'Location not found' });
        }

        // Return first result (there will only be one)
        res.json(results[0]);
    });
});

/* ============================================
   PUT /api/locations/:id
   Update location capacity
   Used by: Edit location modal
   ============================================ */

router.put('/:id', validateEditLocation, handleValidationErrors, (req, res) => {

    const locationId = parseInt(req.params.id);
    const { capacity } = req.body;

    // Validation: Check if ID is valid
    if (isNaN(locationId)) {
        return res.status(400).json({ error: 'Invalid location ID' });
    }

    // Validation: Check if capacity is provided and is a positive number
    if (!capacity || capacity < 1) {
        return res.status(400).json({ error: 'Capacity must be a positive number' });
    }

    // Update query - only updates capacity, nothing else
    const query = `
        UPDATE locations
        SET capacity = ?
        WHERE id = ?
    `;

    // Execute update with parameterized values
    db.query(query, [capacity, locationId], (err, results) => {
        if (err) {
            console.error('Error updating location:', err);
            return res.status(500).json({ error: 'Failed to update location' });
        }

        // Check if any rows was actually updated
        // affectedRows will be 0 if location doesn't exist
        if (results.affectedRows === 0) {
            return res.status(404).json({ error: 'Location not found' });
        }

        res.json({
            message: 'location updated successfully', 
            id: locationId, 
            capacity: capacity
        });
    });
});

/* ============================================
   GET /api/locations/chart/comparison
   Get data for doughnut chart comparing locations
   Returns: Percentage of members at each location
   ============================================ */

router.get('/chart/comparison', (req, res) => {

    // Query gets member count per location
    const query = `
        SELECT
            l.name as location_name,
            IFNULL(COUNT(DISTINCT m.id), 0) as members
        FROM locations l
        LEFT JOIN members m ON l.id = m.location_id
        GROUP BY l.id, l.name
        ORDER BY l.id
    `;

    db.query(query, (err, results) => {
        if (err) {
            console.error('Error fetching chart data:', err);
            return res.status(500).json({ error: 'Failed to fetch chart data' });
        }

        // Transform into Chart.js doughnut format
        const chartData = {
            labels: results.map(loc => loc.location_name), 
            datasets: [{
                label: 'Members', 
                data: results.map(loc => loc.members), 
                backgroundColor: [
                    'rgba(230, 0, 48, 0.8)',        // Red for first Downtown
                    'rgba(0, 123, 255, 0.8)',       // Blue for Midtown
                    'rgba(40, 167, 69, 0.8)'        // Green for Eastside
                ], 
                borderColor: [
                    '#e60030', 
                    '#007bff', 
                    '#28a745'
                ], 
                borderWidth: 2
            }]
        };

        res.json(chartData);
    });
});

/* ============================================
   GET /api/locations/chart/capacity
   Get data for horizontal bar chart showing capacity breakdown
   Returns: Members vs available capacity per location
   ============================================ */

router.get('/chart/capacity', (req, res) => {

    // Query gets member count and capacity for each location
    const query = `
        SELECT
            l.name as location_name,
            l.capacity,
            IFNULL(COUNT(DISTINCT m.id), 0) as current_members
        FROM locations l
        LEFT JOIN members m ON l.id = m.location_id
        GROUP BY l.id, l.name, l.capacity
        ORDER BY l.id
    `;

    db.query(query, (err, results) => {
        if (err) {
            console.error('Error fetching capacity data:', err);
            return res.status(500).json({ error: 'Failed to fetch capacity data'});
        }

        // Transform into Chart.js horizontal stacked bar format
        // Stacked bars show two values: filled and available
        const chartData = {
            labels: results.map(loc => loc.location_name),  // Y-axis labels
            datasets: [
                {
                    label: 'Current Members', 
                    data: results.map(loc => loc.current_members), 
                    backgroundColor: 'rgba(230, 0, 48, 0.8)', 
                    borderColor: '#e60030', 
                    borderWidth: 1
                }, 
                {
                    label: 'Available Capacity', 
                    data: results.map(loc => loc.capacity - loc.current_members), 
                    backgroundColor: 'rgba(100, 100, 100, 0.3)', 
                    borderColor: '#666', 
                    borderWidth: 1
                }
            ]
        };

        res.json(chartData);
    });
});

module.exports = router;