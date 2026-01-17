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
const staffRoutes = require('./routes/staff');
const dashboardRoutes = require('./routes/dashboard');
const locationsRoutes = require('./routes/locations');
const shiftsRoutes = require('./routes/shifts');
const adminRoutes = require('./routes/admin');

// Mount member routes at /api/members
app.use('/api/members', memberRoutes);
console.log('✅ Member routes mounted at /api/members');

// Mount staff routes at /api/staff
app.use('/api/staff', staffRoutes);
console.log('✅ Staff routes mounted at /api/staff');

// Mount shift routes at /api/shifts
app.use('/api/shifts', shiftsRoutes);
console.log('✅ Shifts routes mounted at /api/shifts');

// Mount dashboard routes at /api/dashboard
app.use('/api/dashboard', dashboardRoutes);
console.log('✅ Dashboard routes mounted at /api/dashboard');

// Mount dashboard routes at /api/locations
app.use('/api/locations', locationsRoutes);
console.log('✅ Dashboard routes mounted at /api/locations');

app.use('/api/admin', adminRoutes);


// ============================================
// START THE SERVER
// ============================================

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});