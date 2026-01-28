// ============================================
// IMPORT PACKAGES
// ============================================

// Express: Web framework for creating APIs
const express = require('express');

// MySQL2: Connect to MySQL database
const mysql = require('mysql2');

// CORS: Allow frontend to talk to backend (different ports)
const cors = require('cors');

// Database reset
const cron = require('node-cron');
const resetDatabase = require('./utils/resetDatabase');

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

// ============================================
// AUTO-RESET SCHEDULER (DEMO MODE)
// Resets database daily at 3:00 AM EST
// ============================================

// Schedule database reset every day at 3:00 AM EST
cron.schedule('0 0 3 * * *', async () => {
    console.log('Running scheduled database reset (3:00 AM EST)...');
    const result = await resetDatabase();

    if (result.success) {
        console.log('Scheduled reset completed successfully');
    } else {
        console.error('Scheduled reset failed:', result.error);
    }
}, {
    schedule: true, 
    timezone: "America/Toronto" // EST timezone
});

console.log('Auto-reset scheduled for 3:00 AM EST daily!');

// Manual reset endpoint for testing
app.post('/api/admin/reset-database', async (req, res) => {
    console.log('Manual database reset requested');

    const result = await resetDatabase();

    if (result.success) {
        res.json({
            message: 'Database reset successfully', 
            timestamp: new Date().toISOString(), 
            successCount: result.successCount, 
            errorCount: result.errorCount
        });
    } else {
        res.status(500).json({
            error: 'Failed to reset database', 
            details: result.error
        });
    }
});

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
const staffRoutes = require('./routes/staff');
const dashboardRoutes = require('./routes/dashboard');
const locationsRoutes = require('./routes/locations');
const shiftsRoutes = require('./routes/shifts');
const adminRoutes = require('./routes/admin');
const inventoryRoutes = require('./routes/inventory');
const settingsRoutes = require('./routes/settings');

// Mount member routes at /api/members
app.use('/api/members', memberRoutes);

// Mount staff routes at /api/staff
app.use('/api/staff', staffRoutes);

// Mount shift routes at /api/shifts
app.use('/api/shifts', shiftsRoutes);

// Mount dashboard routes at /api/dashboard
app.use('/api/dashboard', dashboardRoutes);

// Mount dashboard routes at /api/locations
app.use('/api/locations', locationsRoutes);

// Mount admin routes at /api/admin
app.use('/api/admin', adminRoutes);

// Mount inventory routes at api/location
app.use('/api/inventory', inventoryRoutes);

// Mount settings routes at api/settings
app.use('/api/settings', settingsRoutes);

// ============================================
// SERVER STATIC FRONTEND FILES
// Serves the admin pages in production
// ============================================

const path = require('path');

// Serve static files from the parent directory (frontend)
app.use(express.static(path.join(__dirname, '..')));

// Serve admin pages
app.get('/admin/:path*', (req, res) => {
    res.sendFile(path.join(__dirname, '..', req.path + '.html'));
});

// Root redirect to dashboard
app.get('/', (req, res) => {
    res.redirect('/admin/dashboard');
});

console.log('Static file serving configured');


// ============================================
// START THE SERVER
// ============================================

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});