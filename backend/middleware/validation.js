// middle/ware/validation.js

/* ============================================
   VALIDATION MIDDLEWARE
   All express-validator rules for input validation
   ============================================ */

const { body, param, validationResult } = require('express-validator');

// Import database for async validation (checking duplicates)
const db = require('../config/database');

// WHY separate file?
// - Validation logic is reusable
// - Routes stay clean (just rotue logic)
// - Easy to test validation separately
// - Can share validators across routes


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
        .optional({ nullable: true, checkFalsy: true })
        .trim()
        .custom((value) => {
            // If provided, must match format
            if (value && value.length > 0) {
                if (!/^\(\d{3}\) \d{3}-\d{4}$/.test(value)) {
                    throw new Error('Emergency contact must be in format: (555) 123-4567');
                }
            }
            return true;
        }),

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

/* ============================================
   VALIDATION RULES: ADD STAFF
   Applied to POST /api/staff
   ============================================ */

const validateAddStaff = [
    // NAME VALIDATION
    body('name')
        .trim()
        .notEmpty()
        .withMessage('Name is required')
        .isLength({ min: 2, max: 100 })
        .withMessage('Name must be between 2 and 100 characters')
        .matches(/^[a-zA-Z\s'-]+$/)
        .withMessage('Name can only contain letters, spaces, hyphens, and apostrophes'),

    // EMAIL VALIDATION
    body('email')
        .trim()
        .notEmpty()
        .withMessage('Email is required')
        .isEmail()
        .withMessage('Invalid email format')
        .normalizeEmail()
        // Check if email already exists
        .custom(async (email) => {
            return new Promise((resolve, reject) => {
                const query = 'SELECT id FROM staff WHERE email = ?';
                db.query(query, [email], (err, results) => {
                    if (err) {
                        return reject(new Error('Database error'));
                    }

                    if (results.length > 0) {
                        return reject(new Error('Email already exists'));
                    }

                    return resolve();
                });
            });
        }),

    // PHONE VALIDATION (Optional)
    body('phone')
        .optional()
        .trim()
        .matches(/^\(\d{3}\) \d{3}-\d{4}$/)
        .withMessage('Phone must be in format: (555) 123-4567'),

    // ROLE VALIDATION
    body('role')
        .notEmpty()
        .withMessage('Role is required')
        .isIn(['Front Desk CSR', 'Sales', 'Operations', 'Manager', 'Admin'])
        .withMessage('Role must be Front Desk CSR, Sales, Operations, Manager, or Admin'),

    // LOCATION VALIDATION
    body('location_id')
        .notEmpty()
        .withMessage('Location is required')
        .isInt({ min: 1 })
        .withMessage('Invalid location'),

    // HIRE DATE VALIDATION
    body('hire_date')
        .notEmpty()
        .withMessage('Hire date is required')
        .isISO8601()
        .withMessage('Invalid date format')
];

console.log('✅ Add staff validation rules configured');

/* ============================================
   VALIDATION RULES: EDIT STAFF
   Applied to PUT /api/staff/:id
   ============================================ */

const validateEditStaff = [
    // Validate staff ID in URL
    param('id')
        .isInt({ min: 1 })
        .withMessage('Invalid staff ID'),

    // Same validation as add staff, but email check excludes current staff member
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
                // Check if email exists for a DIFFERENT staff member
                const query = 'SELECT id FROM staff WHERE email = ? AND id != ?';
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
        .optional()
        .trim()
        .matches(/^\(\d{3}\) \d{3}-\d{4}$/)
        .withMessage('Phone must be in format: (555) 123-4567'),

    body('role')
        .notEmpty()
        .withMessage('Role is required')
        .isIn(['Front Desk CSR', 'Sales', 'Operations', 'Manager', 'Admin'])
        .withMessage('Role must be Front Desk CSR, Sales, Operations, Manager, or Admin'),

    body('location_id')
        .notEmpty()
        .withMessage('Location is required')
        .isInt({ min: 1 })
        .withMessage('Invalid location'),

    body('hire_date')
        .notEmpty()
        .withMessage('Hire date is required')
        .isISO8601()
        .withMessage('Invalid date format'),

    body('status')
        .optional()
        .isIn(['active', 'inactive'])
        .withMessage('Status must be active or inactive')
];

console.log('✅ Edit staff validation rules configured');


// ============================================
// EXPORT ALL VALIDATORS
// ============================================

module.exports = {
    handleValidationErrors, 

    // Member validators
    validateAddMember, 
    validateEditMember, 
    validateRecordPayment, 
    validateFreezeMember, 
    validateUnfreezeMember, 
    validateReactivateMember, 
    validateCheckIn, 
    validateGetCheckIns, 

    // Staff validators
    validateAddStaff, 
    validateEditStaff
};