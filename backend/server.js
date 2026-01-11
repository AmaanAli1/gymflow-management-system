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
   GET /api/members/:id
   Get single member details with check-in count
   ============================================ */

app.get('/api/members/:id', (req, res) => {
    const memberId = req.params.id;

    console.log(`👁️ Fetching details for member ${memberId}`);

    // Fetch member details with location
    const memberQuery = `
        SELECT
            m.id,
            m.member_id,
            m.name,
            m.email,
            m.phone,
            m.emergency_contact,
            m.location_id,
            l.name AS location_name,
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

    db.query(memberQuery, [memberId], (err, members) => {
        if (err) {
            console.error('❌ Database error:', err);
            return res.status(500).json({ error: 'Failed to fetch member '});
        }

        if (members.length === 0) {
            console.log(`❌ Member ${memberId} not found`);
            return res.status(404).json({ error: 'Member not found' });
        }

        const member = members[0];

        // Get total check-in count for this member
        // WHY? For "Total Check-ins" stat in slide panel
        const countQuery = 'SELECT COUNT(*) AS total_check_ins FROM check_ins WHERE member_id = ?';

        db.query(countQuery, [memberId], (err, countResult) => {
            if (err) {
                console.error('❌ Failed to count check-ins:', err);
                // Return member anyway, just without check-in count
                member.total_check_ins = 0;
                return res.json(member);
            }

            // Add check-in count to member object
            member.total_check_ins = countResult[0].total_check_ins;

            console.log(`✅ Member ${member.name} - ${member.total_check_ins} total check-ins`);

            res.json(member);
        });
    });
});

/* ============================================
   POST /api/members
   Add new member
   ============================================ */

app.post('/api/members', validateAddMember, handleValidationErrors, (req, res) => {
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

app.put('/api/members/:id', validateEditMember, handleValidationErrors, (req, res) => {
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

app.post('/api/members/:id/freeze', validateFreezeMember, handleValidationErrors, (req, res) => {
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

app.post('/api/members/:id/unfreeze', validateUnfreezeMember, handleValidationErrors, (req, res) => {
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

/* ============================================
   POST /api/members/:id/reactivate
   Reactivate a cancelled member
   ============================================ */

app.post('/api/members/:id/reactivate', validateReactivateMember, handleValidationErrors, (req, res) => {
    const memberId = req.params.id;
    const { reason, start_date, notes } = req.body;

    console.log(`🔄 Reactivating member ${memberId}`, req.body);

    // VALIDATION - Check required fields
    if (!reason || !start_date) {
        console.log('❌ Validation failed: Missing required fields');
        return res.status(400).json({
            error: 'Missing required fields', 
            required: ['reason', 'start_date']
        });
    }

    // Update member to active status
    const reactivateQuery = `
        UPDATE members
        SET status = 'active'
        WHERE id = ?
    `;

    db.query(reactivateQuery, [memberId], (err, result) => {
        if (err) {
            console.error('❌ Reactivate error:', err);
            return res.status(500).json({ error: 'Failed to reactivate member' });
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
            LEFT JOIN locations l on m.location_id = l.id
            WHERE m.id = ?
        `;

        db.query(fetchQuery, [memberId], (err, members) => {
            if (err) {
                console.error('❌ Fetch error:', err);
                return res.status(500).json({ error: 'Failed to fetch updated member' });
            }

            console.log(`✅ Member ${memberId} reactivated successfully`);
            res.json({
                success: true, 
                message: 'Member reactivated successfully', 
                member: members[0]
            });
        });
    });
});

/* ============================================
   POST /api/admin/verify-password
   Verify admin password for sensitive operations
   ============================================ */

app.post('/api/admin/verify-password', authLimiter, async (req, res) => {
    const { username, password } = req.body;

    console.log(`🔐 Verifying password for admin: ${username}`);

    // Validate required fields
    if (!username || !password) {
        return res.status(400).json ({
            error: 'Missing required fields', 
            required: ['username', 'password']
        });
    }

    // Query database for admin user
    const query = 'SELECT id, username, password_hash FROM admins WHERE username = ?';

    db.query(query, [username], async (err, admins) => {
        if (err) {
            console.error('❌ Database error:', err);
            return res.status(500).json({ error: 'Database error' });
        }

        // Check if admin exists
        if (admins.length === 0) {
            console.log('❌ Admin not found');
            return res.status(401).json({
                verified: false, 
                error: 'Invalid username or password'
            });
        }

        const admin = admins[0];

        try {
            // Compare provided password with stored hash
            const isMatch = await bcrypt.compare(password, admin.password_hash);

            if (isMatch) {
                console.log('✅ Password verified successfully');

                // Update last_login timestamp
                db.query(
                    'UPDATE admins SET last_login = NOW() WHERE id = ?', 
                    [admin.id], 
                    (err) => {
                        if (err) console.error('Failed to update last_login:', err);
                    }
                );

                // Return success
                return res.json({
                    verified: true, 
                    admin: {
                        id: admin.id, 
                        username: admin.username
                    }
                });
            } else {
                console.log('❌ Password incorrect');
                return res.status(401).json({
                    verified: false, 
                    error: 'Invalid username or password'
                });
            }

        } catch (error) {
            console.error('❌ Bcrypt error:', error);
            return res.status(500).json({ error: 'Password verification failed' });
        }
    });
});

/* ============================================
   WHY THIS ENDPOINT?

   - Verifies admin credentials before sensitive operations (like delete)
   - Uses bcrypt.compare() to check password against stored hash
   - Never returns the password hash to the client
   - Updates last_login timestamp for adut trail

   SECRUITY:
   - Returns same error for "user not found" and "wrong password"
     (prevents attackers from knowing which usernames exist)
   - Uses async/await for bcrypt (it's a slow operation by design)
   - Only returns minimal admin info (id, username) on success
   ============================================*/


/* ============================================
   GET /api/members/:id/payments
   GET all payment history for a member
   ============================================ */

app.get('/api/members/:id/payments', paymentLimiter, (req, res) => {
    const memberId = req.params.id;

    console.log(`💰 Fetching payments for member ${memberId}`);

    const query = `
        SELECT
            id,
            amount,
            payment_date,
            payment_method,
            status,
            notes,
            created_at
        FROM payments
        WHERE member_id = ?
        ORDER BY payment_date DESC
    `;

    db.query(query, [memberId], (err, payments) => {
        if (err) {
            console.error(' Database error:', err);
            return res.status(500).json({ error: 'Failed to fetch payments' });
        }

        console.log(`✅ Found ${payments.length} payments`);
        res.json({ payments });
    });
});

/* ============================================
   POST /api/members/:id/payments
   Record a new payment
   ============================================ */

app.post('/api/members/:id/payments', paymentLimiter, validateRecordPayment, handleValidationErrors, (req, res) => {
    const memberId = req.params.id;
    const { amount, payment_date, payment_method, status, notes } = req.body;

    console.log(`💰 Recording payment for member ${memberId}:`, req.body);

    // Validate required fields
    if (!amount || !payment_date || !payment_method) {
        return res.status(400).json({
            error: 'Missing required fields', 
            required: ['amount', 'payment_date', 'payment_method']
        });
    }

    // Validate amount is positive
    if (parseFloat(amount) <= 0) {
        return res.status(400).json({ error: 'Amount must be greater than 0' });
    }

    const insertQuery = `
        INSERT INTO payments (member_id, amount, payment_date, payment_method, status, notes)
        VALUES (?, ?, ?, ?, ?, ?)
    `;

    const values = [
        memberId, 
        parseFloat(amount), 
        payment_date, 
        payment_method, 
        status || 'success', 
        notes || null
    ];

    db.query(insertQuery, values, (err, result) => {
        if (err) {
            console.error('❌ Insert error:', err);
            return res.status(500).json({ error: 'Failed to record payment' });
        }

        // Fetch the newly created payment
        const fetchQuery = 'SELECT * FROM payments WHERE id = ?';

        db.query(fetchQuery, [result.insertId], (err, payments) => {
            if (err) {
                console.error('❌ Fetch error:', err);
                return res.status(500).json({ error: 'Payment recorded but failed to fetch' });
            }

            console.log(`✅ Payment recorded successfully (ID: ${result.insertId})`);
            res.json({
                success: true, 
                message: 'Payment recorded successfully', 
                payment: payments[0]
            });
        });
    });
});

/* ============================================
   GET /api/members/:id:payment-method
   Get payment method on file for a member
   ============================================ */

app.get('/api/members/:id/payment-method', paymentLimiter, (req, res) => {
    const memberId = req.params.id;

    console.log(`💳 Fetching payment method for a member ${memberId}`);

    const query = `
        SELECT
            id,
            card_type,
            last_four,
            expiry_month,
            expiry_year,
            cardholder_name,
            billing_zip,
            updated_at
        FROM payment_methods
        WHERE member_id = ?
    `;

    db.query(query, [memberId], (err, methods) => {
        if (err) {
            console.error('❌ Database error:', err);
            return res.status(500).json({ error: 'Failed to fetch payment method' });
        }

        if (methods.length === 0) {
            console.log('ℹ️ No payment method on file');
            return res.json({ payment_method: null});
        }

        console.log('✅ Payment method found');
        res.json({ payment_method: methods[0] });
    });
});

/* ============================================
   PUT /api/members/:id/payment-method
   Update payment method on file
   ============================================ */

app.put('/api/members/:id/payment-method', paymentLimiter, (req, res) => {
    const memberId = req.params.id;
    const { card_type, last_four, expiry_month, expiry_year, cardholder_name, billing_zip } = req.body;

    console.log(`💳 Updating payment method for member ${memberId}`);

    // Validate required fields
    if (!card_type || !last_four || !expiry_month || !expiry_year || !cardholder_name) {
        return res.status(400).json({
            error: 'Missing required fields', 
            required: ['card_type', 'last_four', 'expiry_month', 'expiry_year', 'cardholder_name']
        });
    }

    // Validate last_four is exactly 4 digits
    if (!/^\d{4}$/.test(last_four)) {
        return res.status(400).json({ error: 'last_four must be exactly 4 digits' });
    }

    // Validate expiry_month is 1-12
    if (expiry_month < 1 || expiry_month > 12) {
        return res.status(400).json({ error: 'expiry_month must be between 1 and 12' });
    }

    // Check if payment method already exists
    const checkQuery = 'SELECT id FROM payment_methods WHERE member_id = ?';

    db.query(checkQuery, [memberId], (err, existing) => {
        if (err) {
            console.error('❌ Database error:', err);
            return res.status(500).json({ error: 'Database error' });
        }

        let query, values;

        if (existing.length > 0) {
            // Update existing payment method
            query = `
                UPDATE payment_methods
                SET card_type = ?, last_four = ?, expiry_month = ?, expiry_year = ?,
                    cardholder_name = ?, billing_zip = ?
                WHERE member_id = ?
            `;
            values = [card_type, last_four, expiry_month, expiry_year, cardholder_name, billing_zip || null, memberId];
        } else {
            // INSERT new payment method
            query = `
                INSERT INTO payment_methods (member_id, card_type, last_four, expiry_month, expiry_year, cardholder_name, billing_zip)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `;
            values = [memberId, card_type, last_four, expiry_month, expiry_year, cardholder_name, billing_zip || null];
        }

        db.query(query, values, (err, result) => {
            if (err) {
                console.error('❌ Update error:', err);
                return res.status(500).json({ error: 'Failed to update payment method' });
            }

            // Fetch updated payment method
            const fetchQuery = 'SELECT * FROM payment_methods WHERE member_id = ?';

            db.query(fetchQuery, [memberId], (err, methods) => {
                if (err) {
                    console.error('❌ Fetch error:', err);
                    return res.status(500).json({ error: 'Updated but failed to fetch' });
                }

                console.log('✅ Payment method updated successfully');
                res.json({
                    success: true, 
                    message: 'Payment method updated successfully', 
                    payment_method: methods[0]
                });
            });
        });
    });
});

/* ============================================
   POST /api/members/:id/check-in
   Record member gym check-in
   ============================================ */

app.post('/api/members/:id/check-in', checkInLimiter, validateCheckIn, handleValidationErrors, (req, res) => {
    const memberId = req.params.id;
    const { location_id } = req.body;

    console.log(`🏋️ Processing check-in: Member ${memberId} at Location ${location_id}`);

    // Insert check-in record
    // check_in_time defaults to NOW() in database
    const insertQuery = `
        INSERT INTO check_ins (member_id, location_id)
        VALUES (?, ?)
    `;

    db.query(insertQuery, [memberId, location_id], (err, result) => {
        if (err) {
            console.error('❌ Check-in insert error:', err);
            return res.status(500).json({ error: 'Failed to record check-in' });
        }

        // Get the check-in ID that was just created
        const checkInId = result.insertId;

        // Fetch the complete check-in record with member and location details
        // This data will be used for the notification card
        const fetchQuery = `
            SELECT
                c.id,
                c.check_in_time,
                m.id AS member_id,
                m.member_id AS member_code,
                m.name AS member_name,
                l.id AS location_id,
                l.name AS location_name
            FROM check_ins c
            JOIN members m ON c.member_id = m.id
            JOIN locations l ON c.location_id = l.id
            WHERE c.id = ?
        `;

        db.query(fetchQuery, [checkInId], (err, checkIns) => {
            if (err) {
                console.error('❌ Fetch check-in error:', err);
                return res.status(500).json({ error: 'Check-in recorded but failed to fetch details' });
            }

            const checkIn = checkIns[0];

            console.log(`✅ Check-in successful: ${checkIn.member_name} at ${checkIn.location_name}`);

            // Return success with check-in details
            res.status(201).json({
                success: true,
                message: 'Check-in recorded successfully', 
                check_in: checkIn
            });
        });
    });
});

/* ============================================
   GET /api/members/:id/check-ins
   Get member's check-in history
   ============================================ */

app.get('/api/members/:id/check-ins', validateGetCheckIns, handleValidationErrors, (req, res) => {
    const memberId = req.params.id;

    console.log(`📋 Fetching check-in history for member ${memberId}`);

    // First, verify member exists
    // WHY? Better error message if member doesn't exist
    const memberQuery = 'SELECT id, name FROM members WHERE id = ?';

    db.query(memberQuery, [memberId], (err, members) => {
        if (err) {
            console.error('❌ Database error:', err);
            return res.status(500).json({ error: 'Failed to fetch member' });
        }

        if (members.length === 0) {
            console.log(`❌ Member ${memberId} not found`);
            return res.status(404).json({ error: 'Member not found' });
        }

        // Fetch check-in history
        // Join with locations to get location names
        // Order by most recent first
        // Limit to last 50 check-ins (pagination - can be adjusted)
        const checkInsQuery = `
            SELECT
                c.id,
                c.check_in_time,
                l.id AS location_id,
                l.name AS location_name
            FROM check_ins c
            JOIN locations l ON c.location_id = l.id
            WHERE c.member_id = ?
            ORDER BY c.check_in_time DESC
            LIMIT 50
        `;

        db.query(checkInsQuery, [memberId], (err, checkIns) => {
            if (err) {
                console.error('❌ Failed to fetch check-ins:', err);
                return res.status(500).json({ error: 'Failed to fetch check-in history' });
            }

            // Get total count (for "Total Check-ins" stat)
            // WHY separate query? Because LIMIT 50 only shows 50, but total might be 145
            const countQuery = 'SELECT COUNT(*) AS total FROM check_ins WHERE member_id = ?';

            db.query(countQuery, [memberId], (err, countResult) => {
                if (err) {
                    console.error('❌ Failed to count check-ins:', err);
                    // Return check-ins anyway, just without total count
                    return res.json({
                        check_ins: checkIns, 
                        total: checkIns.length  // Fallback to returned count
                    });
                }

                const total = countResult[0].total;

                console.log(`✅ Found ${checkIns.length} recent check-ins (${total} total) for ${members[0].name}`);

                // Return check-in history
                res.json({
                    member_id: memberId, 
                    member_name: members[0].name, 
                    check_ins: checkIns, 
                    total: total, 
                    showing: checkIns.length    // How many we're showing (max 50)
                });
            });
        });
    });
});

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