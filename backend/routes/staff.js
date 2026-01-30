// routes/staff.js

/* ============================================
   STAFF ROUTES
   ALL endpoints related to staff management
   ============================================ */

const express = require('express');
const router = express.Router();

// Import database
const db = require('../config/database');

// Import validators
const {
    handleValidationErrors, 
    validateAddStaff, 
    validateEditStaff, 
    validateAddTrainer
} = require('../middleware/validation');

const {
    requireAdmin
} = require('../middleware/adminAuth');

// WHY separate route file?
// - Groups staff-related endpoints together
// - Matches the pattern from members.js
// - Easier to maintain and test
// - Clean separation of concerns

// ============================================
// STAFF API ENDPOINTS
// ============================================

/* ============================================
   GET /api/staff
   GET all staff members with optional filters
   ============================================ */

router.get('/', (req, res) => {
    // Get query parameters for filtering
    const { role, location, status, search } = req.query;

    // Base query with JOIN to get location names
    // WHY JOIN? We store location_id but need to display location name
    let query = `
        SELECT
           s.*,
           l.name as location_name
        FROM staff s
        LEFT JOIN locations l ON s.location_id = l.id
        WHERE 1=1
    `;

    // Add filters dynamically
    const params = [];

    if (role) {
        query += ` AND s.role = ?`;
        params.push(role);
    }

    if (location) {
        query += ` AND s.location_id = ?`;
        params.push(location)
    }

    if (status) {
        query += ` AND s.status = ?`;
        params.push(status);
    }

    if (search) {
        query += ` AND (s.name LIKE ? OR s.email LIKE ? OR s.role LIKE ? OR s.staff_id LIKE ?)`;
        const searchPattern = `%${search}%`;
        params.push(searchPattern, searchPattern, searchPattern, searchPattern);
    }

    // Order by newest first
    query += ` ORDER BY s.created_at DESC`;

    console.log('🔍 Staff query:', query);
    console.log('📊 Params:', params);

    // Execute query
    db.query(query, params, (err, results) => {
        if (err) {
            console.error('❌ Staff query error:', err);
            return res.status(500).json({ error: 'Failed to fetch staff' });
        }

        console.log(`✅ Found ${results.length} staff members`);
        res.json({ staff: results });
    });
});

/* ============================================
   GET /api/staff/stats
   Get KPI statistics for staff
   ============================================ */

router.get('/stats', (req, res) => {
    // Query to get all stats in one go
    const statsQuery = `
        SELECT
            -- Total staff count
            COUNT(*) as total,
            
            -- Active staff count
            SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active,
            
            -- New hires this month
            SUM(CASE
                WHEN MONTH(hire_date) = MONTH(CURDATE())
                AND YEAR(hire_date) = YEAR(CURDATE())
                THEN 1 ELSE 0
            END) as newThisMonth
        FROM staff
    `;

    // Query to get most common role (for "By Role" KPI)
    const roleQuery = `
        SELECT
            role,
            COUNT(*) as count
        FROM staff
        WHERE status = 'active'
        GROUP BY role
        ORDER BY count DESC
        LIMIT 1
    `;

    // Execute both queries
    db.query(statsQuery, (err, statsResults) => {
        if (err) {
            console.error('❌ Stats query error:', err);
            return res.status(500).json({ error: 'Failed to fetch stats' });
        }

        db.query(roleQuery, (err, roleResults) => {
            if (err) {
                console.error('❌ Role query error:', err);
                return res.status(500).json({ error: 'Failed to fetch role stats' });
            }

            const stats = statsResults[0];

            // Add role data
            if (roleResults.length > 0) {
                stats.byRole = roleResults[0].count;
                stats.byRoleName = roleResults[0].role;
            } else {
                stats.byRole = 0;
                stats.byRoleName = 'N/A';
            }

            console.log('📊 Staff stats:', stats);
            res.json(stats);
        });
    });
});

/* ============================================
   GET /api/staff/:id
   Get single staff member details
   ============================================ */

router.get('/:id', (req, res) => {
    const staffId = req.params.id;

    console.log(`👁️ Fetching details for staff ${staffId}`);

    // Fetch staff details with location
    const staffQuery = `
        SELECT
            s.*,
            l.name AS location_name,
            l.address AS location_address
        FROM staff s
        LEFT JOIN locations l ON s.location_id = l.id
        WHERE s.id = ?
    `;

    db.query(staffQuery, [staffId], (err, staff) => {
        if (err) {
            console.error('❌ Database error:', err);
            return res.status(500).json({ error: 'Failed to fetch staff member' });
        }

        if (staff.length === 0) {
            console.log(`❌ Staff ${staffId} not found`);
            return res.status(404).json({ error: 'Staff member not found' });
        }

        console.log(`✅ Staff member: ${staff[0].name}`);
        res.json(staff[0]);
    });
});

/* ============================================
   POST /api/staff
   Add new staff member
   ============================================ */

router.post('/', validateAddStaff, handleValidationErrors, (req, res) => {
    const { name, email, phone, emergency_contact, emergency_phone, role, location_id, hire_date, hourly_rate, notes } = req.body;

    console.log('➕ Adding new staff:', req.body);

    // Validate required fields
    if (!name || !email || !role || !location_id || !hire_date) {
        return res.status(400).json({
            error: 'Missing required fields', 
            required: ['name', 'email', 'role', 'location_id', 'hire_date']
        });
    }

    // Check if email already exists
    db.query('SELECT id FROM staff WHERE email = ?', [email], (err, results) => {
        if (err) {
            console.error('❌ Email check error:', err);
            return res.status(500).json({ error: 'Database error' });
        }

        if (results.length > 0) {
            return res.status(400).json({ error: 'Email already exists' });
        }

        // Step 1: Generate staff_id (like S-0001)
        const getMaxIdQuery = `
            SELECT MAX(CAST(SUBSTRING(staff_id, 3) AS UNSIGNED)) as max_num
            FROM staff
        `;

        db.query(getMaxIdQuery, (err, results) => {
            if (err) {
                console.error('❌ Error generating staff ID:', err);
                return res.status(500).json({ error: 'Database error' });
            }

            // Generate next staff_id
            // results[0].max_num might be null if table is empty, so we'll use || 0
            const nextNum = (results[0].max_num || 0) + 1;

            // LPAD equivalent in JavaScript
            const staff_id = `S-${String(nextNum).padStart(4, '0')}`;

            console.log(`📋 Genereated staff ID: ${staff_id}`);

            // Step 2: Insert new staff member
            const insertQuery = `
                INSERT INTO staff (
                    staff_id, name, email, phone, emergency_contact,
                    emergency_phone, role, location_id, hire_date,
                    hourly_rate, notes, status
                )
                VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')
            `;

            const values = [
                staff_id, 
                name, 
                email, 
                phone || null, 
                emergency_contact || null, 
                emergency_phone || null, 
                role, 
                location_id, 
                hire_date, 
                hourly_rate || null, 
                notes || null
            ];

            db.query(insertQuery, values, (err, result) => {
                if (err) {
                    console.error('❌ Insert error:', err);
                    return res.status(500).json({ error: 'Failed to create staff member' });
                }

                const newStaffId = result.insertId;

                // Fetch the newly created staff member (with location name)
                const fetchQuery = `
                    SELECT
                        s.*,
                        l.name AS location_name
                    FROM staff s
                    LEFT JOIN locations l ON s.location_id = l.id
                    WHERE s.id = ?
                `;

                db.query(fetchQuery, [newStaffId], (err, staff) => {
                    if (err) {
                        console.error('❌ Fetch error:', err);
                        return res.status(500).json({ error: 'Staff created but failed to fetch' });
                    }

                    console.log(`✅ Staff created: ${name} (${staff_id})`);
                    res.status(201).json({
                        success: true, 
                        id: newStaffId, 
                        staff_id: staff_id, 
                        message: 'Staff member created successfully', 
                        staff: staff[0]
                    });
                });
            });
        });
    });
});

/* ============================================
   PUT /api/staff/:id
   Update staff member details
   ============================================ */

router.put('/:id', validateEditStaff, handleValidationErrors, (req, res) => {
    const staffId = req.params.id;
    const { name, email, phone, emergency_contact, emergency_phone, role, specialty, location_id, hire_date, hourly_rate, status, notes } = req.body;

    console.log(`📝 Update staff ${staffId}:`, req.body);

    // Validate required fields
    if (!name || !email || !role || !location_id || !hire_date) {
        return res.status(400).json({
            error: 'Missing required fields', 
            required: ['name', 'email', 'role', 'location_id', 'hire_date']
        });
    }

    // Check if email is already used by another staff member
    const emailCheckQuery = `
        SELECT id FROM staff
        WHERE email = ? AND id != ?
    `;

    db.query(emailCheckQuery, [email, staffId], (err, results) => {
        if (err) {
            console.error('❌ Email check error:', err);
            return res.status(500).json({ error: 'Database error' });
        }

        if (results.length > 0) {
            return res.status(400).json({
                error: 'Email already in use by another staff member'
            });
        }

        // Update staff member in database
        const updateQuery = `
            UPDATE staff
            SET
                name = ?,
                email = ?,
                phone = ?,
                emergency_contact = ?,
                emergency_phone = ?,
                role = ?,
                specialty = ?,
                location_id = ?,
                hire_date = ?,
                hourly_rate = ?,
                status = ?,
                notes = ?
            WHERE id = ?
        `;

        const values = [
            name, 
            email, 
            phone || null, 
            emergency_contact || null, 
            emergency_phone || null, 
            role, 
            specialty || null, 
            location_id, 
            hire_date, 
            hourly_rate || null, 
            status || 'active', 
            notes || null, 
            staffId
        ];

        db.query(updateQuery, values, (err, result) => {
            if (err) {
                console.error('❌ Update error:', err);
                return res.status(500).json({ error: 'Failed to update staff member' });
            }

            if (result.affectedRows === 0) {
                return res.status(404).json({ error: 'Staff member not found' });
            }

            // Fetch the updated staff data to return
            const fetchQuery = `
                SELECT
                    s.*,
                    l.name as location_name
                FROM staff s
                LEFT JOIN locations l ON s.location_id = l.id
                WHERE s.id = ?
            `;

            db.query(fetchQuery, [staffId], (err, staff) => {
                if (err) {
                    console.error('❌ Fetch error:', err);
                    return res.status(500).json({ error: 'Failed to fetch updated staff' });
                }

                console.log(`✅ Staff ${staffId} updated successfully`);
                res.json({
                    success: true, 
                    message: 'Staff member updated successfully', 
                    staff: staff[0]
                });
            });
        });
    });
});

/* ============================================
   DELETE /api/staff/:id
   Soft delete staff (set status to inactive)
   ============================================ */

router.delete('/:id', requireAdmin, (req, res) => {
    const staffId = req.params.id;

    console.log(`🗑️ Deleting staff ${staffId} (setting to inactive)`);

    // Soft delete - just update status to 'inactive'
    const deleteQuery = `
        UPDATE staff
        SET status = 'inactive'
        WHERE id = ?
    `;

    db.query(deleteQuery, [staffId], (err, result) => {
        if (err) {
            console.error('❌ Delete error:', err);
            return res.status(500).json({ error: 'Failed to delete staff member' });
        }

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Staff member not found' });
        }

        console.log(`✅ Staff ${staffId} marked as inactive`);
        res.json({
            success: true, 
            message: 'Staff member deleted successfully'
        });
    });
});

/* ============================================
   POST /api/staff/:id/reactivate
   Reactivate an inactive staff member
   ============================================ */

router.post('/:id/reactivate', (req, res) => {
    const staffId = req.params.id;
    const { notes } = req.body;

    console.log(`🔄 Reactivating staff ${staffId}`);

    // Check if staff exists and is inactive
    const checkQuery = 'SELECT name, status FROM staff WHERE id = ?';

    db.query(checkQuery, [staffId], (err, staff) => {
        if (err) {
            console.error('❌ Database error:', err);
            return res.status(500).json({ error: 'Database error' });
        }

        if (staff.length === 0) {
            return res.status(404).json({ error: 'Staff member not found' });
        }

        if (staff[0].status !== 'inactive') {
            return res.status(400).json({
                error: 'Staff member is already active'
            });
        }

        // Reactivate staff member
        const reactivateQuery = `
            UPDATE staff
            SET status = 'active'
            WHERE id = ?
        `;

        db.query(reactivateQuery, [staffId], (err, result) => {
            if (err) {
                console.error('❌ Reactivate error:', err);
                return res.status(500).json({ error: 'Failed to reactivate staff member' });
            }

            // Fetch updated staff data
            const fetchQuery = `
                SELECT
                    s.*,
                    l.name as location_name
                FROM staff s
                LEFT JOIN locations l ON s.location_id = l.id
                WHERE s.id = ?
            `;

            db.query(fetchQuery, [staffId], (err, updatedStaff) => {
                if (err) {
                    console.error('❌ Fetch error:', err);
                    return res.status(500).json({ error: 'Reactivated but failed to fetch' });
                }

                console.log(`✅ Staff ${staff[0].name} reactivated successfully`);
                res.json({
                    success: true, 
                    message: 'Staff member reactivated successfully', 
                    staff: updatedStaff[0]
                });
            });
        });
    });
});

/* ============================================
   POST /api/trainers
   Add new trainer (specialized staff member)
   ============================================ */

router.post('/trainers', validateAddTrainer, handleValidationErrors, (req, res) => {
    // Note: role is NOT included - we set it automatically
    const {
        name, 
        email, 
        phone, 
        emergency_contact, 
        emergency_phone, 
        specialty, 
        location_id, 
        hire_date, 
        hourly_rate, 
        notes
    } = req.body;

    console.log('Adding new trainer:', name);

    // STEP 1: Generate trainer ID (T-0001 format)
    const getMaxIdQuery = `
        SELECT MAX(CAST(SUBSTRING(staff_id, 3) AS UNSIGNED)) as max_num
        FROM staff
        WHERE staff_id LIKE 'T-%'
    `;

    db.query(getMaxIdQuery, (err, results) => {
        if (err) {
            console.error('Error generating trainer ID:', err);
            return res.status(500).json({ error: 'Database error' });
        }

        // Generate next trainer ID
        // results[0].max_num is nullable if no trainers exist yet
        const nextNum = (results[0].max_num || 0) + 1;
        const staff_id = `T-${String(nextNum).padStart(4, '0')}`;

        console.log('Generated trainer ID:', staff_id);

        // STEP 2: Inser trainer into staff table
        // role is hardcoded as 'Trainer' - not user-provided
        // specialty is included - unique to trainers
        const insertQuery = `
            INSERT INTO staff (
                staff_id,
                name,
                email,
                phone,
                emergency_contact,
                emergency_phone,
                role,
                specialty,
                location_id,
                hire_date,
                hourly_rate,
                notes,
                status
            )
            VALUES (?, ?, ?, ?, ?, ?, 'Trainer', ?, ?, ?, ?, ?, 'active')
        `;

        // Values array matches the ? placeholder in order
        // Note: 'Trainer' is hardcoded in query, not in values
        const values = [
            staff_id, 
            name, 
            email, 
            phone, 
            emergency_contact, 
            emergency_phone, 
            specialty, 
            location_id, 
            hire_date, 
            hourly_rate || null, 
            notes || null
        ];

        db.query(insertQuery, values, (err, result) => {
            if (err) {
                console.error('Insert error:', err);
                return res.status(500).json({ error: 'Failed to create trainer' });
            }

            // STEP 3: Fetch the newly created trainer with location name
            const newTrainerId = result.insertId;

            const fetchQuery = `
                SELECT
                    s.*,
                    l.name as location_name
                FROM staff s
                LEFT JOIN locations l ON s.location_id = l.id
                WHERE s.id = ?
            `;

            db.query(fetchQuery, [newTrainerId], (err, trainer) => {
                if (err) {
                    console.error('Fetch error:', err);
                    return res.status(500).json({ error: 'Trainer created but failed to fetch' });
                }

                console.log('Trainer created successfully:', staff_id);

                // Return success response with trainer data
                res.status(201).json({
                    success: true, 
                    id: newTrainerId, 
                    staff_id: staff_id, 
                    message: 'Trainer created successfully', 
                    trainer: trainer[0]
                });
            });
        });
    });
});


// Export router
module.exports = router;