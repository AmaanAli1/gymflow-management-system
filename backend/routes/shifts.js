// routes/shifts.js

/* ============================================
   SHIFT ROUTES
   ALL endpoints related to shift scheduling
   ============================================ */

const express = require('express');
const router = express.Router();

// Import database
const db = require('../config/database');

// Middleware
const {
    requireAdmin
} = require('../middleware/adminAuth');

const {
    validateAddShift, 
    validateEditShift, 
    handleValidationErrors,
    validateEditStaff
} = require('../middleware/validation');

const {
    apiLimiter
} = require('../middleware/rateLimiter');

/* ============================================
   GET /api/shifts
   Get all shifts with optional filters
   Query params: staff_id, location_id, start_date, end_date
   ============================================ */

router.get('/', apiLimiter, (req, res) => {
    
    // Get query parameters for filtering
    const { staff_id, location_id, start_date, end_date } = req.query;

    // Base query with JOINs to get staff and location names
    let query = `
        SELECT
            s.id,
            s.staff_id,
            s.location_id,
            s.shift_date,
            s.start_time,
            s.end_time,
            s.role,
            s.status,
            s.notes,
            staff.name AS staff_name,
            locations.name AS location_name
        FROM shifts s
        JOIN staff ON s.staff_id = staff.id
        JOIN locations ON s.location_id = locations.id
        WHERE 1=1
    `;

    const params = [];

    // Add filters dynamically
    if (staff_id) {
        query += ` AND s.staff_id = ?`;
        params.push(staff_id);
    }

    if (location_id) {
        query += ` AND s.location_id = ?`;
        params.push(location_id);
    }

    if (start_date) {
        query += ` AND s.shift_date >= ?`;
        params.push(start_date);
    }

    if (end_date) {
        query += ` AND s.shift_date <= ?`;
        params.push(end_date);
    }

    // Order by date and time
    query += ` ORDER BY s.shift_date, s.start_time`;

    console.log('Query:', query);
    console.log('Params:', params);

    // Execute query
    db.query(query, params, (err, results) => {
        if (err) {
            console.error('❌ Shifts query error:', err);
            return res.status(500).json({ error: 'Failed to fetch shifts' });
        }

        console.log(`✅ Found ${results.length} shifts`);
        res.json({
            shifts: results, 
            count: results.length
        });
    });
});

/* ============================================
   GET /api/shifts/:id
   Get single shift details
   ============================================ */

router.get('/:id', apiLimiter, (req, res) => {
    const shiftId = req.params.id;

    const query = `
        SELECT
            s.*,
            staff.name AS staff_name,
            locations.name AS location_name
        FROM shifts s
        JOIN staff ON s.staff_id = staff.id
        JOIN locations ON s.location_id = locations.id
        WHERE s.id = ?
    `;

    db.query(query, [shiftId], (err, results) => {
        if (err) {
            console.error('❌ Database error:', err);
            return res.status(500).json({ error: 'Failed to fetch shift' });
        }

        if (results.length === 0) {
            return res.status(404).json({ error: 'Shift not found' });
        }

        console.log(`✅ Shift found: ${results[0].staff_name} on ${results[0].shift_date}`);
        res.json(results[0]);
    });
});

/* ============================================
   POST /api/shifts
   Create new shift
   ============================================ */

router.post('/', apiLimiter, validateAddShift, handleValidationErrors, (req, res) => {
    const {staff_id, location_id, shift_date, start_time, end_time, role, notes } = req.body;

    console.log('➕ Creating new shift:', req.body);

    // Validate required fields
    if (!staff_id || !location_id || !shift_date || !start_time || !end_time || !role) {
        return res.status(400).json({
            error: 'Missing required fields', 
            required: ['staff_id', 'location_id', 'shift_date', 'start_time', 'end_time', 'role']
        });
    }

    // Check if staff exists
    db.query('SELECT id, name FROM staff WHERE id = ?', [staff_id], (err, staff) => {
        if (err) {
            console.error('❌ Staff check error:', err);
            return res.status(500).json({ error: 'Database error' });
        }

        if (staff.length === 0) {
            return res.status(404).json({ error: 'Staff member not found' });
        }

        // Insert shift
        const insertQuery = `
            INSERT INTO shifts (
                staff_id, location_id, shift_date, start_time,
                end_time, role, notes, status
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, 'scheduled')
        `;

        const values = [
            staff_id, 
            location_id, 
            shift_date, 
            start_time, 
            end_time, 
            role, 
            notes || null
        ];

        db.query(insertQuery, values, (err, result) => {
            if (err) {
                console.error('❌ Insert error:', err);
                return res.status(500).json({ error: 'Failed to create shift'});
            }

            const newShiftId = result.insertId;

            // Fetch the newly created shift with details
            const fetchQuery = `
                SELECT
                    s.*,
                    staff.name AS staff_name,
                    locations.name AS location_name
                FROM shifts s
                JOIN staff ON s.staff_id = staff.id
                JOIN locations ON s.location_id = locations.id
                WHERE s.id = ?
            `;

            db.query(fetchQuery, [newShiftId], (err, shift) => {
                if (err) {
                    console.error('❌ Fetch error:', err);
                    return res.status(500).json({ error: 'Shift created but failed to fetch' });
                }

                console.log(`✅ Shift created for ${staff[0].name} on ${shift_date}`);
                res.status(201).json({
                    success: true, 
                    message: 'Shift created successfully', 
                    shift: shift[0]
                });
            });
        });
    });
});

/* ============================================
   PUT /api/shifts/:id
   Update shift details
   ============================================ */

router.put('/:id', apiLimiter, validateEditShift, handleValidationErrors, (req, res) => {
    const shiftId = req.params.id;
    const { staff_id, location_id, shift_date, start_time, end_time, role, status, notes } = req.body;

    console.log(`📝 Updating shift ${shiftId}:`, req.body);

    // Validate required fields
    if (!staff_id || !location_id || !shift_date || !start_time || !end_time || !role ) {
        return res.status(400).json({
            error: 'Missing required fields', 
            required: ['staff_id', 'location_id', 'shift_date', 'start_time', 'end_time', 'role', 'status']
        });
    }

    // Update shift
    const updateQuery = `
        UPDATE shifts
        SET
            staff_id = ?,
            location_id = ?,
            shift_date = ?,
            start_time = ?,
            end_time = ?,
            role = ?,
            status = ?,
            notes = ?
        WHERE id = ?
    `;

    const values = [
        staff_id, 
        location_id, 
        shift_date, 
        start_time, 
        end_time, 
        role, 
        status || 'scheduled', 
        notes || null, 
        shiftId
    ];

    db.query(updateQuery, values, (err, result) => {
        if (err) {
            console.error('❌ Update error:', err);
            return res.status(500).json({ error: 'Failed to update shift'});
        }

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Shift not found' });
        }

        // Fetch updated shift
        const fetchQuery = `
            SELECT
                s.*,
                staff.name AS staff_name,
                locations.name AS location_name
            FROM shifts s
            JOIN staff ON s.staff_id = staff.id
            JOIN locations ON s.location_id = locations.id
            WHERE s.id = ?
        `;

        db.query(fetchQuery, [shiftId], (err, shift) => {
            if (err) {
                console.error('❌ Fetch error:', err);
                return res.status(500).json({ error: 'Failed to fetch updated shift' });
            }

            console.log(`✅ Shift ${shiftId} updated successfully`);
            res.json({
                success: true, 
                message: 'Shift updated successfully', 
                shift: shift[0]
            });
        });
    });
});

/* ============================================
   DELETE /api/shifts/:id
   Delete a shift (requires admin)
   ============================================ */

router.delete('/:id', apiLimiter, requireAdmin, (req, res) => {
    const shiftId = req.params.id;

    console.log(`🗑️ Deleting shift ${shiftId}`);

    const deleteQuery = 'DELETE FROM shifts WHERE id = ?';

    db.query(deleteQuery, [shiftId], (err, result) => {
        if (err) {
            console.error('❌ Delete error:', err);
            return res.status(500).json({ error: 'Failed to delete shift' });
        }

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Shift not found' });
        }

        console.log(`✅ Shift ${shiftId} deleted`);
        res.json({
            success: true, 
            message: 'Shift deleted successfully'
        });
    });
});

// Export router
module.exports = router;