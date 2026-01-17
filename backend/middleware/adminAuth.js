// middleware/adminAuth.js

/* ============================================
   ADMIN AUTHENTICATION MIDDLEWARE
   Verify admin credentials before sensitive operations
   ============================================ */

const bcrypt = require('bcrypt');
const db = require('../config/database');

/* ============================================
   REQUIRE ADMIN MIDDLEWARE
   Use on routes that need admin verification
   ============================================ */

async function requireAdmin(req, res, next) {
    // Get admin credentials from request headers
    const adminUsername = req.headers['x-admin-username'];
    const adminPassword = req.headers['x-admin-password'];

    console.log('🔐 [MiddleWare] Checking admin credentials for:', req.method, req.path);

    // Check if credentials provided
    if (!adminUsername || !adminPassword) {
        console.log('❌ [MiddleWare] Missing admin credentials');
        return res.status(401).json({
            error: 'Admin authentication required', 
            message: 'This action requires asmin verification'
        });
    }

    // Query database for admin
    const query = 'SELECT * FROM admins WHERE username = ?';

    db.query(query, [adminUsername], async (err, results) => {
        if (err)  {
            console.error('❌ [MiddleWare] Database error:', err);
            return res.status(500).json({
                error: 'Authentication failed', 
                message: 'Unable to verify credentials'
            });
        }

        // Check if admin exists
        if (results.length === 0) {
            console.log('❌ [MiddleWare] Admin not found:', adminUsername);
            return res.status(401).json({
                error: 'Invalid credentials', 
                message: 'Admin authentication failed'
            });
        }

        const admin = results[0];

        try {
            // Verify password with bcrypt
            const isMatch = await bcrypt.compare(adminPassword, admin.password_hash);

            if (isMatch) {
                console.log('✅ [MiddleWare] Admin verified:', adminUsername);

                // Store admin info in request for later use
                req.admin = {
                    id: admin.id, 
                    username: admin.username
                };

                // Allow request to proceed
                next();
            } else {
                console.log('❌ [MiddleWare] Invalid password for:', adminUsername);
                return res.status(401).json({
                    error: 'Invalid credentials', 
                    message: 'Admin authentication failed'
                });
            }

        } catch (error) {
            console.error('❌ [MiddleWare] Bcrypt error:', error);
            return res.status(500).json({
                error: 'Authentication failed', 
                message: 'Unable to verify credentials'
            });
        }
    });
}

module.exports = { requireAdmin };