// ============================================
// IMPORT PACKAGES
// ============================================

// Express: Web framework for creating APIs
const express = require('express');

// MySQL2: Connect to MySQL database
const mysql = require('mysql2');

// CORS: Allow frontend to talk to backend (different ports)
const cors = require('cors');

// Bcrypt Import
const bcrypt = require('bcrypt');

// Dotenv: Load environment variables from .env file
require('dotenv').config();

// IMPORT MIDDLEWARE
const { apiLimiter, authLimiter, paymentLimiter, checkInLimiter } = require('./middleware/rateLimiter');
const {
    handleValidationErrors, 
    validateAddMember, 
    validateEditMember, 
    validateRecordPayment, 
    validateFreezeMember, 
    validateUnfreezeMember, 
    validateReactivateMember, 
    validateCheckIn, 
    validateGetCheckIns, 
    validateAddStaff, 
    validateEditStaff
} = require('./middleware/validation');


// ============================================
// CREATE EXPRESS APP
// ============================================

const app = express();

// ============================================
// MIDDLEWARE (Functions that run on every request)
// ============================================

// Enable CORS = allows HTML files to call this API
app.use(cors());

// PARSE JSON in request body - so we can receive data from frontend
app.use(express.json());

/* ============================================
   APPLY RATE LIMITERS
   ============================================ */

// Apply general rate limiter to ALL API routes
// This catches everything under /api/*
// Must come BEFORE route definitions
app.use('/api/', apiLimiter);

// WHY apply to /api/?
// - Protects all backend endpoints
// - Doesn't affect static files (HTML, CSS, JS)
// - Easy to manage (one line protects everything)

console.log('✅ General API rate limiting active (100 req/15min)');

// ============================================
// CREATE DATABASE CONNECTION
// ============================================

const db = require('./config/database');

// ============================================
// TEST ROUTE (Make sure server is working)
// ============================================

app.get('/', (req, res) => {
    res.json({
        message: '🚀 GymFlow API is running!', 
        status:'success'
    });
});

// ============================================
// MOUNT ROUTES
// ============================================

// Import route modules
const memberRoutes = require('./routes/members');

// Mount member routes at /api/members
// All routes in memberRoutes will be prefixed with /api/members
// Example: router.get('/') becomes GET /api/members
//          router.get('/:id') becomes GET /api/members/:id
app.use('/api/members', memberRoutes);

console.log('✅ Member routes mounted at /api/members');


// ============================================
// STAFF API ENDPOINTS
// ============================================


/* ============================================
   GET /api/staff
   GET all staff members with optional filters
   ============================================ */

app.get('/api/staff', (req, res) => {
    // Get query parameters for filtering
    const { role, location, status, search } = req.query;

    // Base query with JOIN to get location names
    // WHY JOIN? We store location_id but need to display location name
    let query = `
        SELECT
            s.id,
            s.name,
            s.email,
            s.phone,
            s.role,
            s.location_id,
            l.name as location_name,
            s.hire_date,
            s.status,
            s.created_at
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
        query += ` AND (s.name LIKE ? OR s.email LIKE ? OR s.role LIKE ?)`;
        const searchPattern = `%${search}%`;
        params.push(searchPattern, searchPattern, searchPattern);
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

app.get('/api/staff/stats', (req, res) => {
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

app.get('/api/staff/:id', (req, res) => {
    const staffId = req.params.id;

    console.log(`👁️ Fetching details for staff ${staffId}`);

    // Fetch staff details with location
    const staffQuery = `
        SELECT
            s.id,
            s.name,
            s.email,
            s.phone,
            s.role,
            s.location_id,
            l.name AS location_name,
            s.hire_date,
            s.status,
            s.created_at
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

app.post('/api/staff', validateAddStaff, handleValidationErrors, (req, res) => {
    const { name, email, phone, role, location_id, hire_date } = req.body;

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

        // Insert new staff member
        // WHY default status to 'active'?
        // New hires are active by default
        const insertQuery = `
            INSERT INTO staff (name, email, phone, role, location_id, hire_date, status)
            VALUES (?, ?, ?, ?, ?, ?, 'active')
        `;

        db.query(insertQuery, [name, email, phone || null, role, location_id, hire_date], (err, result) => {
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

                console.log(`✅ Staff created: ${name} (ID: ${newStaffId})`);
                res.status(201).json({
                    success: true, 
                    id: newStaffId, 
                    message: 'Staff member created successfully', 
                    staff: staff[0]
                });
            });
        });
    });
});

/* ============================================
   PUT /api/staff/:id
   Update staff member details
   ============================================ */

app.put('/api/staff/:id', validateEditStaff, handleValidationErrors, (req, res) => {
    const staffId = req.params.id;
    const { name, email, phone, role, location_id, hire_date, status } = req.body;

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
                role = ?,
                location_id = ?,
                hire_date = ?,
                status = ?
            WHERE id = ?
        `;

        const values = [
            name, 
            email, 
            phone || null, 
            role, 
            location_id, 
            hire_date, 
            status || 'active', 
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

app.delete('/api/staff/:id', (req, res) => {
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

app.post('/api/staff/:id/reactivate', (req, res) => {
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


// ============================================
// DASHBOARD API ENDPOINT
// Returns all data for admin dashboard
// ============================================

app.get('/api/dashboard', (req, res) => {
    // This will run multiple queries and combine results

    // Query 1: Get total members count
    const totalMembersQuery = `
        SELECT COUNT(*) as total FROM members WHERE status = 'active'
    `;

    // Query 2: Get monthly revenue (current month - October)
    const monthlyRevenueQuery = `
        SELECT SUM(amount) as total
        FROM revenue 
        WHERE month = '2025-10-01'
    `;

    // Query 3: Calculate inventory health percentage
    const inventoryHealthQuery = `
        SELECT 
            ROUND(AVG(CASE 
                WHEN status = 'ok' THEN 100 
                WHEN status = 'low' THEN 50 
                WHEN status = 'critical' THEN 0 
            END)) as health_percentage
        FROM inventory
    `;
    
    // Query 4: Count active trainers
    const activeTrainersQuery = `
        SELECT COUNT(*) as total 
        FROM staff 
        WHERE role = 'trainer' AND status = 'active'
    `;

    // Query 5: Get branch performance
    const branchPerformanceQuery = `
        SELECT 
            l.name, 
            COUNT(m.id) as members, 
            l.capacity, 
            ROUND((COUNT(m.id) / l.capacity) * 100, 0) as utilization, 
            CASE 
                WHEN (COUNT(m.id) / l.capacity) >= 0.85 THEN 'Best' 
                WHEN (COUNT(m.id) / l.capacity) >= 0.65 THEN 'Stable' 
                ELSE 'Growth' 
            END as status 
        FROM locations l 
        LEFT JOIN members m ON l.id = m.location_id AND m.status = 'active' 
        GROUP BY l.id, l.name, l.capacity 
        ORDER BY utilization DESC
    `;

    // Query 6: Get membership growth (last 6 months)
    const membershipGrowthQuery = `
        SELECT 
            l.name as location, 
            DATE_FORMAT(r.month, '%b') as month, 
            r.amount / 60 as member_count 
        FROM revenue r 
        JOIN locations l ON r.location_id = l.id 
        WHERE r.month >= DATE_SUB('2025-10-01', INTERVAL 5 MONTH) 
        ORDER BY r.month, l.name 
    `;

    // Query 7: Get revenue by location (current month)
    const revenueByLocationQuery = `
        SELECT 
            l.name, 
            r.amount 
        FROM revenue r 
        JOIN locations l ON r.location_id = l.id 
        WHERE r.month = '2025-10-01'
        ORDER BY r.amount DESC 
    `;
    
    // Query 8: Get inventory alerts
    const inventoryAlertsQuery = `
        SELECT 
            item_name, 
            status, 
            CASE 
                WHEN status = 'critical' THEN 'Reorder required' 
                WHEN status = 'low' THEN 'Below threshold' 
                ELSE 'Optimal stock' 
            END as message 
        FROM inventory 
        WHERE location_id = 1 
        LIMIT 4 
    `;

    // Execute all queries in parallel
    Promise.all([
        new Promise((resolve, reject) => {
            db.query(totalMembersQuery, (err, results) => {
                if (err) reject(err);
                else resolve(results[0].total);
            });
        }),
        new Promise((resolve, reject) => {
            db.query(monthlyRevenueQuery, (err, results) => {
                if (err) reject(err);
                else resolve(results[0].total);
            });
        }),
        new Promise((resolve, reject) => {
            db.query(inventoryHealthQuery, (err, results) => {
                if (err) reject(err);
                else resolve(results[0].health_percentage);
            });
        }),
        new Promise((resolve, reject) => {
            db.query(activeTrainersQuery, (err, results) => {
                if (err) reject(err);
                else resolve(results[0].total);
            });
        }),
        new Promise((resolve, reject) => {
            db.query(branchPerformanceQuery, (err, results) => {
                if (err) reject(err);
                else resolve(results);
            });
        }),
        new Promise((resolve, reject) => {
            db.query(membershipGrowthQuery, (err, results) => {
                if (err) reject(err);
                else resolve(results);
            });
        }),
        new Promise((resolve, reject) => {
            db.query(revenueByLocationQuery, (err, results) => {
                if (err) reject(err);
                else resolve(results);
            });
        }),
        new Promise((resolve, reject) => {
            db.query(inventoryAlertsQuery, (err, results) => {
                if (err) reject(err);
                else resolve(results);
            });
        })
    ])
    .then(([totalMembers, monthlyRevenue, inventoryHealth, activeTrainers, branches, growthData, revenueData, alerts]) => {

        // Format membership growth data for Chart.js
        const membershipGrowth = {
            labels: ['May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct'], 
            datasets: []
        };

        // Group growth data by location
        const locationData = {};
        growthData.forEach(row => {
            if (!locationData[row.location]) {
                locationData[row.location] = [];
            }
            locationData[row.location].push(Math.round(row.member_count));
        });

        // DEBUG: Log to see what we got
        console.log('Growth data from DB:', growthData);
        console.log('Grouped by Location:', locationData);

        // Create datasets for each location
        const colors = {
            'Downtown': { border: '#e60030', bg: 'rgba(230, 0, 48, 0.15)'}, 
            'Midtown': { border: '#24c063', bg: 'rgba(36, 192, 99, 0.15)'}, 
            'Eastside': { border: '#3498db', bg: 'rgba(52, 152, 219, 0.15)'}
        };

        // Only create datasets if we have data
        if (Object.keys(locationData).length > 0) {
            Object.keys(locationData).forEach(location => {
                membershipGrowth.datasets.push({
                    label: location, 
                    data: locationData[location], 
                    borderColor: colors[location]?.border || '#888', 
                    backgroundColor: colors[location]?.bg || 'rgba(136, 136, 136, 0.15)'
                });
            });
        } else {
            // No data - user placeholder
            console.warn('⚠️ No membership growth data found');
            membershipGrowth.datasets.push({
                label: 'No Data', 
                data: [0, 0, 0, 0, 0, 0], 
                borderColor: '#888', 
                backgroundColor: 'rgba(136, 136, 136, 0.15)'
            });
        }

        console.log('Final membershipGrowth:', membershipGrowth);

        // Format revenue by location for Chart.js
        const revenueByLocation = {
            labels: revenueData.map(r => r.name), 
            data: revenueData.map(r => parseFloat(r.amount))
        };

        // Format inventory alerts
        const inventoryAlerts = alerts.map(alert => ({
            item: alert.item_name, 
            status: alert.status, 
            message: alert.message
        }));

        // Send combined response
        res.json({
            kpis: {
                totalMembers, 
                monthlyRevenue: parseFloat(monthlyRevenue), 
                inventoryHealth: parseInt(inventoryHealth), 
                activeTrainers
            }, 
            branches: branches.map(b => ({
                name: b.name, 
                members: b.members, 
                capacity: b.capacity, 
                utilization: b.utilization, 
                status: b.status
            })),
            membershipGrowth, 
            revenueByLocation, 
            inventoryAlerts, 
            systemHealth: [
                { service: 'App Server', status: 'ok', message: 'Online'}, 
                { service: 'Database', status: 'ok', message: 'Connected'}, 
                { service: 'API Response Time', status: 'ok', message: 'Stable'}, 
                { service: 'Scheduled Backup', status: 'warn', message: 'Due in 2 hours'}
            ]
        });
    })
    .catch(err => {
        console.error('❌ Database query error:', err);
        res.status(500).json({
            error: 'Failed to fetch dashboard data', 
            details: err.message
        });
    });
});


// ============================================
// START THE SERVER
// ============================================

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});