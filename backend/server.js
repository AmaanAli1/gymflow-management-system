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

// SECURITY: Rate limiting to prevent abuse
const rateLimit = require('express-rate-limit');

// SECURITY: Input validation and sanitization
const { body, param, validationResult } = require('express-validator');

// ============================================
// CREATE EXPRESS APP
// ============================================

const app = express();

/* ============================================
   SECURITY: RATE LIMITING
   Prevents brute force attacks and Dos
   ============================================ */

// GENERAL API RATE LIMITER
// Applied to ALL /api/* routes
const apiLimiter = rateLimit({
    // windowMs: Time window in milliseconds
    // 15 minutes = 15 * 60 seconds * 1000 milliseconds
    windowMs: 15 * 60 * 1000, 

    // max: Maximum number of requests allowed in the window
    // 100 requests per 15 minutes = ~7 requests per minute
    // This is generous for normal use, strict enough to stop attacks
    max: 100, 

    // message: What to tell the user when they're blocked
    // This appears in the API response
    message: {
        error: 'Too many requests from this IP address. Please try again later.', 
        retryAfter: '15 minutes'
    }, 

    // standardHeaders: Return rate limit info in response header
    // Lets clients see their limit status
    // Headers: X-RateLimit-Limit, X-rateLimit-Remaining, X-RateLimit-Reset
    standardHeaders: true, 

    // legacyHeaders: Don't use old header format (X-RateLimit-*)
    // Modern apps use the new standard
    legacyHeaders: false, 

    // Use default behavior for when limit exceeded (return 429 with message)
});

// STRICT AUTH RATE LIMITER
// Applied ONLY to login/authentication routes
const authLimiter = rateLimit({
    // Shorter window for auth: 15 minutes
    windowMs: 15 * 60 * 1000, 

    // Much stricter limit: Only 5 attempts
    // Why so strict?
    // - Login only happens once per session
    // - 5 attempts = typos are okay, brute force isn't
    // - After 5 fails, likely malicious
    max: 5, 

    // More urgent message for auth failures
    message: {
        error: 'Too many login attempts. Your account has been temporarily locked.', 
        retryAfter: '15 minutes', 
        tip: 'If you forgot your password, contact an administrator.'
    }, 

    standardHeaders: true, 
    legacyHeaders: false, 

    // skipSuccessfulRequests:
    // true = Only count failed attempts (more forgiving)
    // false = Count all attempts (more strict)
    // We'll use false (count everything) to prevent account enumeration
    skipSuccessfulRequests: false,
});

    // WHY separate rate limiters?
    // - Different endpoints have different risk levels
    // - Login is HIGH RISK (credentials theft)
    // - Viewing member is LOW RISK (just data access)
    // - Tailored limits = better security + better UX

// PAYMENT RATE LIMITER
// For future payment endpoints - even stricter
const paymentLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,   // 1 hour
    max: 10,    // Only 10 payment attempts per hour
    message: {
        error: 'Too many payment attempts. Please contact support if you need assistance.', 
        retryAfter: '1 hour'
    }, 
    standardHeaders: true, 
    legacyHeaders: false,
});

// WHY so strict on payments?
// - Financial transactions = HIGH RISK
// - Card testing attacks (stolen cards)
// - Prevents accidental duplicate charges
// - Normal user makes 1-2 payments per session max

// CHECK-IN RATE LIMITER
// Prevents spam check-ins from the same IP
const checkInLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,   // 15 minutes
    max: 50,    // 50 check-ins per 15 minutes (generous for front desk staff)
    message: {
        error: 'Too many check-in attempts. Please wait before trying again.', 
        retryAfter: '15 minutes'
    }, 
    standardHeaders: true, 
    legacyHeaders: false,
});

// WHY 50 check-ins per 15 minutes?
// - Front desk staff might check in many members quickly
// - 50 / 15 = ~3 check-ins per minute (reasonable for busy times)
// - Still prevents automated abuse (bots checking in thousands)

console.log('✅ Rate limiting configured');

/* ============================================
   VALIDATION ERROR HANDLER
   Middleware to check validation results
   ============================================ */

const handleValidationErrors = (req, res, next) => {
    // Collect all validation errors from the request
    const errors = validationResult(req);

    // If there are errors, return theme to the client
    if (!errors.isEmpty()) {
        // errors.array() returns an array like:
        // [
        //    { field: 'email', msg: 'Invalid email format' },
        //    { field: 'name', msg: 'Name must be 2-100 characters' }
        // ]

        console.log('❌ Validation failed:',errors.array());

        return res.status(400).json({
            error: 'Validation failed', 
            details: errors.array()
        });
    }

    // No errors - continue to the route handler
    next();
};

// WHY middleware?
// - Separates validation logic from business logic
// - Reusable across all routes
// - Clean, readable code
// - Easy to test

console.log('✅ Validation middleware configured');

/* ============================================
   VALIDATION RULES: ADD MEMBER
   Applied to POST /api/members
   ============================================ */

const validateAddMember = [
    // NAME VALIDATION
    body('name')
        // .trim() - Remove whitespace from start and end
        // "   John Doe   " becomes "John Doe"
        // WHY? Users accidently add spaces, we clean them
        .trim()

        // .notEmpty() - Must not be empty string
        // WHY? Name is required for identification
        .notEmpty()
        .withMessage('Name is required')

        // .isLength() - Check character count
        // min: 2 - Prevents "J" (too short, probably mistake)
        // max: 100 - Prevents 1000-character attack
        // WHY? Realistic human names are 2-100 characters
        .isLength({ min: 2, max: 100})
        .withMessage('Name must be between 2 and 100 characters')

        // .matches() - Must match regex pattern
        // ^[a-zA-Z\s'-]+$ means:
        // ^ = start of string
        // [a-zA-Z] = uppercase or lowercase letters
        // \s = spaces (for "John Doe")
        // ' = apostrophes (for "O'Brian")
        // - = hyphens (for "Mary-Jane")
        // + = one or more of these characters
        // $ = end of string
        // WHY? Prevents SQL injections, XSS, weird characters
        .matches(/^[a-zA-Z\s'-]+$/)
        .withMessage('Name can only contain letters, spaces, hyphens, and apostrophes'), 

    // EMAIL VALIDATION
    body('email')
        .trim()
        .notEmpty()
        .withMessage('Email is required')

        // .isEmail() - Built-in email validator
        // Checks for: something@domain.com format
        // Handles edge case: dots, plus signs, subdomains
        // WHY? Emails must be deliverable for communication
        .isEmail()
        .withMessage('Invalid email format')

        // .normalizeEmail() - Standardizes format
        // "John.Doe@GMAIL.COM" becomes "johndoe@gmail.com"
        // WHY? Prevents duplicate accounts (John@gmail vs john@gmail)
        .normalizeEmail()

        // .custom() - Custom validation logic
        // We check if email already exists in databse
        // WHY? Each email must be unique (business rule)
        .custom(async (email) => {
            return new Promise((resolve, reject) => {
                const query = 'SELECT id FROM members WHERE email = ?';
                db.query(query, [email], (err, results) => {
                    if (err) {
                        return reject(new Error('Database error'));
                    }
                    if (results.length > 0) {
                        // Email exists - reject!
                        return reject(new Error('Email already exists'));
                    }
                    // Email is unique - accept!
                    return resolve();
                });
            });
        }),

    // PHONE VALIDATION
    body('phone')
        .trim()
        .notEmpty()
        .withMessage('Phone number is required')

        // .matches() - Must match exact phone format
        // ^\(\d{3}\) \d{3}-\d{4}$ means:
        // ^ = start
        // \( = literal opening parenthesis
        // \d{3} = exactly 3 digits (area code)
        // \) = literal closing parenthesis
        // (space)
        // \d{3} = exactly 3 digits (prefix)
        // - = literal hyphen
        // \d{4} = exactly 4 digits (line number)
        // $ = end
        // Result : (555) 123-4567
        // WHY? Consistent format makes calling easier, prevents typos
        .matches(/^\(\d{3}\) \d{3}-\d{4}$/)
        .withMessage('Phone must be in format: (555) 123-4567'),

    // EMERGENCY CONTACT VALIDATION
    body('emergency_contact')
        // .optional() - This field is not required
        // If provided, it must pass validation
        // If not provided, skip validation
        // WHY? Some people don't have emergency contacts
        .optional()
        .trim()
        .matches(/^\(\d{3}\) \d{3}-\d{4}$/)
        .withMessage('Emergency contact must be in format: (555) 123-4567'),

    // PLAN VALIDATION
    body('plan')
        .notEmpty()
        .withMessage('Plan is required')

        // .isIn() - Must be one of these exact values
        // ['Basic', 'Premium', 'Elite'] - our three plans
        // WHY? Prevents:
        // - User editing HTML to add "Free" plan
        // - Typos like "Premim" breaking reports
        // - SQL injection via plan field
        .isIn(['Basic', 'Premium', 'Elite'])
        .withMessage('Plan must be Basic, Premium, or Elite'),

    // LOCATION VALIDATION
    body('location_id')
        .notEmpty()
        .withMessage('Location is required')

        // .isInt() - Must be an integer (whole number)
        // { min: 1 } - Must be at least 1 (IDs start at 1)
        // WHY? Location IDs are integers in database
        .isInt({ min: 1 })
        .withMessage('Invalid location')
];

// SECURITY NOTE: Why validate on server even though form validates on client?
// - Client validation CAN BE BYPASSED (user edits HTML/JS)
// - Attacker can send requests directly to API (skip frontend entirely)
// - Server is the LAST LINE OF DEFENSE
// - NEVER TRUST THE CLIENT!

console.log('✅ Add member validation rules configured');

/* ============================================
   VALIDATION RULES: EDIT MEMBER
   Applied to PUT /api/members/:id
   ============================================ */

const validateEditMember = [
    // Validate the member ID in the URL
    // /api/members/123 - we validate the "123"
    param('id')
        .isInt({ min: 1 })
        .withMessage('Invalid member ID'),

    // Same validation as add member, but email uniqueness check
    // must exclude the current member (they can keep their own email)
    body('name')
        .trim()
        .notEmpty()
        .withMessage('Name is required')
        .isLength({ min: 2, max: 100 })
        .withMessage('Name must be between 2 and 100 characters')
        .matches(/^[a-zA-Z\s'-]+$/)
        .withMessage('Name can only contain letters, spaces, hyphens, and apostrophes'),

    body('email')
        .trim()
        .notEmpty()
        .withMessage('Email is required')
        .isEmail()
        .withMessage('Invalid email format')
        .normalizeEmail()
        .custom(async (email, { req }) => {
            return new Promise((resolve, reject) => {
                // Check if email exists for a DIFFERENT member
                const query = 'SELECT id FROM members WHERE email = ? AND id != ?';
                db.query(query, [email, req.params.id], (err, results) => {
                    if (err) reject(new Error('Database error'));
                    if (results.length > 0) {
                        return reject(new Error('Email already exists'));
                    }
                    return resolve();
                });
            });
        }),

    body('phone')
        .trim()
        .notEmpty()
        .withMessage('Phone number is required')
        .matches(/^\(\d{3}\) \d{3}-\d{4}$/)
        .withMessage('Phone must be in format: (555) 123-4567'),

    body('emergency_contact')
        .optional()
        .trim()
        .matches(/^\(\d{3}\) \d{3}-\d{4}$/)
        .withMessage('Emergency contact must be in format: (555) 123 4567'),

    body('plan')
        .notEmpty()
        .withMessage('Plan is required')
        .isIn(['Basic', 'Premium', 'Elite'])
        .withMessage('Plan must be Basic, Premium, or Elite'),

    body('location_id')
        .notEmpty()
        .withMessage('Location is required')
        .isInt({ min: 1 })
        .withMessage('Invalid location')
];

console.log('✅ Edit member validation rules configured');

/* ============================================
   VALIDATION RULES: RECORD PAYMENT
   Applied to POST /api/members/:id/payments
   ============================================ */

const validateRecordPayment = [
    // Validate member ID in URL
    param('id')
        .isInt({ min: 1 })
        .withMessage('Invalid member ID'),

    // AMOUNT VALIDATION
    body('amount')
        .notEmpty()
        .withMessage('Amount is required')

        // .isFloat() - Must be a decimal number
        // { min: 0.01 } - Must be at least 1 cent
        // { max: 10000 } - Cap at $10,000 (prevents accidents/attacks)
        // WHY? Prevents negative amounts, zero amounts, unrealistic amounts
        .isFloat({ min: 0.01, max: 10000 })
        .withMessage('Amount must be between $0.01 and $10,000'),

    // DATE VALIDATION
    body('payment_date')
        .notEmpty()
        .withMessage('Payment date is required')

        // isISO8601() - Must be valid date format
        // Accepts: YYYY-MM-DD, YYYY-MM-DDTHH:MM:SS
        // WHY? Consistent date formats prevents errors
        .isISO8601()
        .withMessage('Invalid date format'),

    // PAYMENT METHOD VALIDATION
    body('payment_method')
        .notEmpty()
        .withMessage('Payment method is required')

        // Whitelist of allowed payment methods
        .isIn(['Cash', 'Cheque', 'Credit Card', 'Bank Transfer', 'Other'])
        .withMessage('Invalid payment method'),

    // STATUS VALIDATION
    body('status')
        .optional()
        .isIn(['success', 'pending', 'failed', 'refunded'])
        .withMessage('Invalid payment status'),

    // NOTES VALIDATION
    body('notes')
        .optional()
        .trim()

        // Limit ntoes to 500 characters
        // WHY? Prevents database overflow, DoS attacks
        .isLength({ max: 500 })
        .withMessage('Notes must be less than 500 characters')
];

console.log('✅ Record payment validation rules configured');

/* ============================================
   VALIDATION RULES: FREEZE MEMBER
   Applied to POST /api/members/:id/freeze
   ============================================ */

const validateFreezeMember = [
    // Validate member ID in URL
    param('id')
        .isInt({ min: 1 })
        .withMessage('Invalid member ID'),

    // FREEZE START DATE VALIDATION
    body('freeze_start_date')
        .notEmpty()
        .withMessage('Freeze start date is required')

        // Must be valid ISO date format (YYYY-MM-DD)
        .isISO8601()
        .withMessage('Invalid start date format')

        // Custom validation: Must not be in the past
        // WHY? Can't freeze membership retroactively
        .custom((value) => {
            const startDate = new Date(value);
            const today = new Date();
            today.setHours(0, 0, 0, 0); // Remove time component

            if (startDate < today) {
                throw new Error('Start date cannot be in the past');
            }

            return true;
        }),

    // FREEZE END DATE VALIDATION
    body('freeze_end_date')
        .notEmpty()
        .withMessage('Freeze end date is required')

        .isISO8601()
        .withMessage('Invalid end date format')

        // Custom validation: End must be after start
        // WHY? End date before start date makes no logical sense
        .custom((value, { req }) => {
            const startDate = new Date(req.body.freeze_start_date);
            const endDate = new Date(value);

            if (endDate <= startDate) {
                throw new Error('End date must be after start date');
            }

            // Optional: Limit freeze duration to 6 months max
            // WHY? Business rule - prevents indefinite freezes
            const sixMonthsLater = new Date(startDate);
            sixMonthsLater.setMonth(sixMonthsLater.getMonth() + 6);

            if (endDate > sixMonthsLater) {
                throw new Error('Freeze period cannot exceed 6 months');
            }

            return true;
        }),

    // FREEZE REASON VALIDATION
    body('freeze_reason')
        .notEmpty()
        .withMessage('Freeze reason is required')

        // Whitelist of allowed freeze reasons
        // WHY? Standardizes data, prevents free-form text issues
        .isIn(['Medical', 'Injury', 'Travel', 'Financial', 'Personal', 'Other'])
        .withMessage('Invalid freeze reason'),

    // NOTES VALIDATION
    body('notes')
        .optional()
        .trim()

        // Limit notes length
        // WHY? Prevents database overflow, DoS attacks
        .isLength({ max: 500 })
        .withMessage('Notes must be less than 500 characters')
];

console.log('✅ Freeze member validation rules configured');

/* ============================================
   VALIDATION RULES: UNFREEZE MEMBER
   Applied to POST /api/members/:id/unfreeze
   ============================================ */

const validateUnfreezeMember = [
    // Validate member ID in URL
    param('id')
        .isInt({ min: 1 })
        .withMessage('Invalid member ID')

        // Custom validation: Member must exist and be frozen
        // WHY? Can't unfreeze someone who isn't frozen
        .custom(async (memberId) => {
            return new Promise((resolve, reject) => {
                const query = 'SELECT status FROM members WHERE id = ?';
                db.query(query, [memberId], (err, results) => {
                    if (err) {
                        return reject(new Error('Database error'));
                    }

                    if (results.length === 0) {
                        return reject(new Error('Member not found'));
                    }

                    if (results[0].status !== 'frozen') {
                        return reject(new Error('Member is not frozen'));
                    }

                    return resolve();
                });
            });
        })
];

console.log('✅ Unfreeze member validation rules configured');

/* ============================================
   VALIDATION RULES: REACTIVATE MEMBER
   Applied to POST /api/members/:id/reactivate
   ============================================ */

const validateReactivateMember = [
    // Validate member ID in URL
    param('id')
        .isInt({ min: 1 })
        .withMessage('Invalid member ID')

        // Custom validation: Member must exist and be cancelled
        // WHY? Can only reactivate cancelled members
        .custom(async (memberId) => {
            return new Promise((resolve, reject) => {
                const query = 'SELECT status FROM members WHERE id = ?';
                db.query(query, [memberId], (err, results) => {
                    if (err) {
                        return reject(new Error('Database error'));
                    }

                    if (results.length === 0) {
                        return reject(new Error('Member not found'));
                    }

                    if (results[0].status !== 'cancelled') {
                        return reject(new Error('Member is not cancelled'));
                    }

                    return resolve();
                });
            });
        }),

    // REASON FOR RETURN VALIDATION
    body('reason')
        .notEmpty()
        .withMessage('Reason for return is required')

        // Whitelist of allowed return reasons
        // Matches dropdown options from the reactivate form
        .isIn([
            'Resolved Previous Issue', 
            'Ready to Resume', 
            'Financial Situation Improved', 
            'New Fitness Goals', 
            'Missed the Gym', 
            'Special Offer', 
            'Other'
        ])
        .withMessage('Invalid reason for return'),

    // RESTART DATE VALIDATION
    body('start_date')
        .notEmpty()
        .withMessage('Restart date is required')

        .isISO8601()
        .withMessage('Invalid date format')

        // Custom validation: Must not be in past
        // WHY? Can't reactivate membership retroactively
        .custom((value) => {
            const startDate = new Date(value);
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            if (startDate < today) {
                throw new Error('Restart date cannot be in the past');
            }

            // Optional: Limit to 30 days in future max
            // WHY? Prevents scheduling reactivation too far ahead
            const thirtyDaysLater = new Date(today);
            thirtyDaysLater.setDate(thirtyDaysLater.getDate() + 30);

            if (startDate > thirtyDaysLater) {
                throw new Error('Restart date cannot be more than 30 days in the future');
            }

            return true;
        }),

    // NOTES VALIDATION
    body('notes')
        .optional()
        .trim()

        // Limit notes length
        .isLength({ max: 500 })
        .withMessage('Notes must be less than 500 characters')
];

console.log('✅ Reactivate member validation rules configured');

/* ============================================
   VALIDATION RULES: MEMBER CHECK-IN
   Applied to POST /api/members/:id/check-in
   ============================================ */

const validateCheckIn = [
    // Validate member ID in URL
    param('id')
        .isInt({ min: 1 })
        .withMessage('Invalid member ID')

        // Custom validation: Member must exist and be active
        // WHY? Can't check in if frozen/cancelled
        .custom(async (memberId) => {
            return new Promise((resolve, reject) => {
                const query = 'SELECT status FROM members WHERE id = ?';
                db.query(query, [memberId], (err, results) => {
                    if (err) {
                        return reject(new Error('Database error'));
                    }

                    if (results.length === 0) {
                        return reject(new Error('Member not found'));
                    }

                    // Only active members can check in
                    if (results[0].status !== 'active') {
                        return reject(new Error(`Cannot check in: Member is ${results[0].status}`));
                    }

                    return resolve();
                });
            });
        }),

    // LOCATION ID VALIDATION
    body('location_id')
        .notEmpty()
        .withMessage('Location is required')

        // Must be valid integer
        .isInt({ min: 1 })
        .withMessage('Invalid location')

        // Custom validation: Location must exist
        // WHY? Can't check in to non-existent location
        .custom(async (locationId) => {
            return new Promise((resolve, reject) => {
                const query = 'SELECT id FROM locations WHERE id = ?';
                db.query(query, [locationId], (err, results) => {
                    if (err) {
                        return reject(new Error('Database error'));
                    }

                    if (results.length === 0) {
                        return reject(new Error('Location not found'));
                    }

                    return resolve();
                });
            });
        }),

    // DUPLICATE CHECK-IN VALIDATION
    // Prevents checking in twice within 1 hour
    // WHY? Prevents accidents (double-click) and spam
    param('id')
        .custom(async (memberId) => {
            return new Promise((resolve, reject) => {
                // Check if member has checked in within last hour
                const query = `
                    SELECT check_in_time
                    FROM check_ins
                    WHERE member_id = ?
                        AND check_in_time > DATE_SUB(NOW(), INTERVAL 1 HOUR)
                    ORDER BY check_in_time DESC
                    LIMIT 1
                `;

                db.query(query, [memberId], (err, results) => {
                    if (err) {
                        return reject(new Error('Database error'));
                    }

                    if (results.length > 0) {
                        // Calculate minutes ago
                        const lastCheckIn = new Date(results[0].check_in_time);
                        const now = new Date();
                        const minutesAgo = Math.floor((now - lastCheckIn) / 1000 / 60);

                        return reject(new Error(`Already checked in ${minutesAgo} minutes ago. Please wait ${60 - minutesAgo} more minutes.`));
                    }

                    return resolve();
                });
            });
        })
];

console.log('✅ Check-in validation rules configured');

/* ============================================
   VALIDATION RULES: GET CHECK-IN HISTORY
   Applied to GET /api/members/:id/check-ins
   ============================================ */

const validateGetCheckIns = [
    // Validate member ID in URL
    param('id')
        .isInt({ min: 1 })
        .withMessage('Invalid member ID')
];

console.log('✅ Get check-in history validation rules configured');

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