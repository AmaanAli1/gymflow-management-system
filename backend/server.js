// ============================================
// IMPORT PACKAGES
// ============================================

// Express: Web framework for creating APIs
const express = require('express');

// MySQL2: Connect to MySQL database
const mysql = require('mysql2');

// CORS: Allow frontend to talk to backend (different ports)
const cors = require('cors');

// Dotenv: Load environment variables from .env file
require('dotenv').config();

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

// ============================================
// CREATE DATABASE CONNECTION
// ============================================

const db = mysql.createConnection({
    host: process.env.DB_HOST,          // 'localhost' from .env
    user: process.env.DB_USER,          // 'root' from .env
    password: process.env.DB_PASSWORD,  // Your password from .env
    database: process.env.DB_NAME,      // 'gymflow' from .env
    port: process.env.DB_PORT           // 3306 from .env
});

// Connect to database
db.connect((err) => {
    if (err) {
        console.error('❌ Database connection failed:', err);
        return;
    }
    console.log('✅ Connected to MySQL database: gymflow');
});

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
// MEMBERS API ENDPOINTS
// ============================================

/* ============================================
   GET /api/members
   Get all members with optional filters
   ============================================ */

app.get('/api/members', (req, res) => {
    // Get query parameters for filtering
    const { location, plan, status, search } = req.query;

    // Base query
    let query = `
        SELECT
            m.id,
            m.member_id,
            m.name,
            m.email,
            m.location_id,
            l.name as location_name,
            m.plan,
            m.status,
            m.created_at
        FROM members m
        LEFT JOIN locations l ON m.location_id = l.id
        WHERE 1=1
    `;

    // Add filters dynamically
    const params = [];

    if (location) {
        query += ` AND m.location_id = ?`;
        params.push(location);
    }

    if (plan) {
        query += ` AND m.plan = ?`;
        params.push(plan);
    }

    if (status) {
        query += ` AND m.status = ?`;
        params.push(status);
    }

    if (search) {
        query += ` AND (m.name LIKE ? OR m.email LIKE ? OR m.member_id LIKE ?)`;
        const searchPattern = `%${search}%`;
        params.push(searchPattern, searchPattern, searchPattern);
    }

    // Order by newest first
    query += ` ORDER BY m.created_at DESC`;

    console.log('🔍 Members query:', query);
    console.log('📊 Params:', params);

    // Execute query
    db.query(query, params, (err, results) => {
        if (err) {
            console.error('❌ Members query error:', err);
            return res.status(500).json({ error: 'Failed to fetch members' });
        }

        console.log(`✅ Found ${results.length} members`);
        res.json({ members: results });
    });
});

/* ============================================
   GET /api/members/stats
   GET KPI statistics
   ============================================ */

app.get('/api/members/stats', (req, res) => {
    // Query to get all stats in one go
    const statsQuery = `
        SELECT
            -- Total active members
            SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as activeMembers,
            
            -- New members this month
            SUM(CASE
                WHEN status = 'active'
                AND created_at >= DATE_FORMAT(NOW(), '%Y-%m-01')
                THEN 1 ELSE 0
            END) as newThisMonth,
            
            -- Frozen members
            SUM(CASE WHEN status = 'frozen' THEN 1 ELSE 0 END) as frozenMembers,
            
            -- Cancelled this month
            SUM(CASE
                WHEN status = 'cancelled'
                AND created_at >= DATE_FORMAT(NOW(), '%Y-%m-01')
                THEN 1 ELSE 0
            END) as cancelledMembers
        FROM members
    `;

    db.query(statsQuery, (err, results) => {
        if (err) {
            console.error('❌ Stats query error:', err);
            return res.status(500).json({ error: 'Failed to fetch stats' });
        }

        const stats = results[0];
        console.log('📊 Member stats:', stats);
        res.json(stats);
    });
});

/* ============================================
   POST /api/members
   Add new member
   ============================================ */

app.post('/api/members', (req, res) => {
    const { name, email, location_id, plan } = req.body;

    // Validate required fields
    if (!name || !email || !location_id || !plan) {
        return res.status(400).json({
            error: 'Missing required fields', 
            required: ['name', 'email', 'location_id', 'plan']
        });
    }

    // Check if email already exists
    db.query('SELECT id FROM members WHERE email = ?', [email], (err, results) => {
        if (err) {
            console.error('❌ Email check error:', err);
            return res.status(500).json({ error: 'Database error' });
        }

        if (results.length > 0) {
            return res.status(400).json({ error: 'Email already exists' });
        }

        // Insert new member
        const insertQuery = `
            INSERT INTO members (name, email, location_id, plan, status, created_at)
            VALUES (?, ?, ?, ?, 'active', NOW())
        `;

        db.query(insertQuery, [name, email, location_id, plan], (err, results) => {
            if (err) {
                console.error('❌ Insert error:', err);
                return res.status(500).json({ error: 'Failed to create member' });
            }

            const newMemberId = results.insertId;

            // Generate member_id
            const memberIdQuery = `
                UPDATE members
                SET member_id = CONCAT('M-', LPAD(?, 4, '0'))
                WHERE id = ?
            `;

            db.query(memberIdQuery, [newMemberId, newMemberId], (err) => {
                if (err) {
                    console.error('❌ Member ID generation error:', err);
                }

                console.log(`✅ Member created: ${name} (ID: ${newMemberId})`);
                res.status(201).json({
                    success: true, 
                    id: newMemberId, 
                    message: 'Member created successfully'
                });
            });
        });
    });
});

/* ============================================
   PUT /api/members/:id
   Update member details
   ============================================ */

app.put('/api/members/:id', (req, res) => {
    const memberId = req.params.id;
    const { name, email, phone, emergency_contact, location_id, plan, notes } = req.body;

    console.log(`📝 Update member ${memberId}:`, req.body);

    // Validate required fields
    if (!name || !email || !location_id || !plan) {
        return res.status(400).json({
            error: 'Missing required fields', 
            required: ['name', 'email', 'location_id', 'plan']
        });
    }

    // Check if email is already used by another member
    const emailCheckQuery = `
        SELECT id FROM members
        WHERE email = ? AND id != ?
    `;

    db.query(emailCheckQuery, [email, memberId], (err, results) => {
        if (err) {
            console.error('❌ Email check error:', err);
            return res.status(500).json({ error: 'Database error' });
        }

        // If another member has this email
        if (results.length > 0) {
            return res.status(400).json({
                error: 'Email already in use by another member'
            });
        }

        // Update member in database
        const updateQuery = `
            UPDATE members
            SET
                name = ?,
                email = ?,
                phone = ?,
                emergency_contact = ?,
                location_id = ?,
                plan = ?,
                notes = ?
            WHERE id = ?
        `;

        const values = [
            name, 
            email, 
            phone || null, 
            emergency_contact || null, 
            location_id, 
            plan, 
            notes || null, 
            memberId
        ];

        db.query(updateQuery, values, (err, result) => {
            if (err) {
                console.error('❌ Update error:', err);
                return res.status(500).json({ error: 'Failed to update member' });
            }

            if (result.affectedRows === 0) {
                return res.status(404).json({ error: 'Member not found' });
            }

            // Fetch the updated member data to return
            const fetchQuery = `
                SELECT
                    m.id,
                    m.member_id,
                    m.name,
                    m.email,
                    m.phone,
                    m.emergency_contact,
                    m.location_id,
                    l.name as location_name,
                    m.plan,
                    m.status,
                    m.notes,
                    m.created_at,
                    m.updated_at
                FROM members m
                LEFT JOIN locations l ON m.location_id = l.id
                WHERE m.id = ?
            `;

            db.query(fetchQuery, [memberId], (err, members) => {
                if (err) {
                    console.error('❌ Fetch error:', err);
                    return res.status(500).json({ error: 'Failed to fetch updated member' });
                }

                console.log(`✅ Member ${memberId} updated successfully`);
                res.json({
                    success: true, 
                    message: 'Member updated successfully', 
                    member: members[0]
                });
            });
        });
    });
});

/* ============================================
   DELETE /api/members/:id
   Soft delete member (set status to cancelled)
   ============================================ */

app.delete('/api/members/:id', (req, res) => {
    const memberId = req.params.id;

    // Soft delete - just update status to 'cancelled'
    const deleteQuery = `
        UPDATE members
        SET status = 'cancelled'
        WHERE id = ?
    `;

    db.query(deleteQuery, [memberId], (err, result) => {
        if (err) {
            console.error('❌ Delete error:', err);
            return res.status(500).json({ error: 'Failed to delete member' });
        }

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Member not found' });
        }

        console.log(`🗑️ Member ${memberId} marked as cancelled`);
        res.json({
            success: true, 
            message: 'Member deleted successfully'
        });
    });
});

/* ============================================
   POST /api/members/:id/freeze
   Freeze a member's membership
   ============================================ */

app.post('/api/members/:id/freeze', (req, res) => {
    const memberId = req.params.id;
    const { freeze_start_date, freeze_end_date, freeze_reason, notes } = req.body;

    console.log(`❄️ Freezing member ${memberId}:`, req.body);

    // Validate required fields
    if (!freeze_start_date || !freeze_end_date) {
        return res.status(400).json({
            error: 'Missing required fields', 
            required: ['freeze_start_date', 'freeze_end_date']
        });
    }

    // Validate dates
    const startDate = new Date(freeze_start_date);
    const endDate = new Date(freeze_end_date);

    if(endDate <= startDate) {
        return res.status(400).json({
            error: 'End date must be after start date'
        });
    }

    // Update member to frozen status
    const freezeQuery = `
        UPDATE members
        SET
            status = 'frozen',
            freeze_start_date = ?,
            freeze_end_date = ?,
            freeze_reason = ?,
            notes = CASE
                WHEN notes is NULL THEN ?
                WHEN ? IS NULL THEN notes
                ELSE CONCAT(notes, '\n\nFreeze Note (', CURDATE(), '): ', ?)
            END
        WHERE id = ?
    `;

    const values = [
        freeze_start_date, 
        freeze_end_date, 
        freeze_reason || null, 
        notes || null, 
        notes, 
        notes, 
        memberId
    ];

    db.query(freezeQuery, values, (err, result) => {
        if (err) {
            console.error('❌ Freeze error:', err);
            return res.status(500).json({ error: 'Failed to freeze member' });
        }

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Member not found' });
        }

        // Fetch the updated member data
        const fetchQuery = `
            SELECT
                m.id,
                m.member_id,
                m.name,
                m.email,
                m.phone,
                m.emergency_contact,
                m.location_id,
                l.name as location_name,
                m.plan,
                m.status,
                m.freeze_start_date,
                m.freeze_end_date,
                m.freeze_reason,
                m.notes,
                m.created_at,
                m.updated_at
            FROM members m
            LEFT JOIN locations l ON m.location_id = l.id
            WHERE m.id = ?
        `;

        db.query(fetchQuery, [memberId], (err, members) => {
            if (err) {
                console.error('❌ Fetch error:', err);
                return res.status(500).json({ error: 'Failed to fetch updated member' });
            }

            console.log(`✅ Member ${memberId} frozen successfully`);
            res.json({
                success: true, 
                message: 'Member frozen successfully', 
                member: members[0]
            });
        });
    });
});

/* ============================================
   POST /api/members/:id/unfreeze
   Unfreeze a member's membership
   ============================================ */

app.post('/api/members/:id/unfreeze', (req, res) => {
    const memberId = req.params.id;

    console.log(`🔥 Unfreezing member ${memberId}`);

    // Update member to active status and clear freeze date
    const unfreezeQuery = `
        UPDATE members
        SET
            status = 'active',
            freeze_start_date = NULL,
            freeze_end_date = NULL,
            freeze_reason = NULL
        WHERE id = ?
    `;

    db.query(unfreezeQuery, [memberId], (err, result) => {
        if (err) {
            console.error('❌ Unfreeze error:', err);
            return res.status(500).json({ error: 'Failed to unfreeze member' });
        }

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Member not found' });
        }

        // Fetch the updated member data
        const fetchQuery = `
            SELECT
                m.id,
                m.member_id,
                m.name,
                m.email,
                m.phone,
                m.emergency_contact,
                m.location_id,
                l.name as location_name,
                m.plan,
                m.status,
                m.freeze_start_date,
                m.freeze_end_date,
                m.freeze_reason,
                m.notes,
                m.created_at,
                m.updated_at
            FROM members m
            LEFT JOIN locations l ON m.location_id = l.id
            WHERE m.id = ?
        `;

        db.query(fetchQuery, [memberId], (err, members) => {
            if (err) {
                console.error('❌ Fetch Error:', err);
                return res.status(500).json({ error: 'Failed to fetch updated member' });
            }

            console.log(`✅ Member ${memberId} unfrozen successfully`);
            res.json({
                success: true, 
                message: 'Member unfrozen successfully', 
                member: members[0]
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