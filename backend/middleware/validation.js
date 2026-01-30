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

/* ============================================
   VALIDATION RULES: ADD SHIFT
   Applied to POST /api/shifts
   ============================================ */

const validateAddShift = [
    // STAFF ID VALIDATION
    body('staff_id')
        .notEmpty()
        .withMessage('Staff member is required')
        .isInt({ min: 1 })
        .withMessage('Invalid staff member')

        // Custom validation: Staff must exist and be active
        .custom(async (staffId) => {
            return new Promise((resolve, reject) => {
                const query = 'SELECT status FROM staff WHERE id = ?';
                db.query(query, [staffId], (err, results) => {
                    if (err) {
                        return reject(new Error('Database error'));
                    }

                    if (results.length === 0) {
                        return reject(new Error('Staff member not found'));
                    }

                    if (results[0].status !== 'active') {
                        return reject(new Error('Cannot assign shifts to inactive staff'));
                    }

                    return resolve();
                });
            });
        }),

    // LOCATION ID VALIDATION
    body('location_id')
        .notEmpty()
        .withMessage('Location is required')
        .isInt({ min: 1 })
        .withMessage('Invalid location')

        // Custom validation: Location must exist
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

    // SHIFT DATE VALIDATION
    body('shift_date')
        .notEmpty()
        .withMessage('Shift date is required')
        .isISO8601()
        .withMessage('Invalid date format')

        // Can't creae shifts too far in past
        .custom((value) => {
            const shiftDate = new Date(value);
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

            if (shiftDate < thirtyDaysAgo) {
                throw new Error('Cannot create shifts more than 30 days in the past');
            }

            return true;
        }),

    // START TIME VALIDATION
    body('start_time')
        .notEmpty()
        .withMessage('Start time is required')

        // Must match HH:MM format
        .matches(/^([01]\d|2[0-3]):([0-5]\d)$/)
        .withMessage('Start time must be in HH:MM format (00:00 to 23:59'),

    // END TIME VALIDATION
    body('end_time')
        .notEmpty()
        .withMessage('End time is required')

        // Must match HH:MM format
        .matches(/^([01]\d|2[0-3]):([0-5]\d)$/)
        .withMessage('End time must be in HH:MM format (00:00 to 23:59)')

        // Custom validation: End must be after start
        .custom((endTime, { req }) => {
            const startTime = req.body.start_time;

            if (!startTime) {
                return true;    // Let start_time validator handle missing value
            }

            // Convert times to comparable numbers (minutes since midnight)
            const [startHour, startMin] = startTime.split(':').map(Number);
            const [endHour, endMin] = endTime.split(':').map(Number);

            const startMinutes = startHour * 60 + startMin;
            const endMinutes = endHour * 60 + endMin;

            if (endMinutes <= startMinutes) {
                throw new Error('End time must be after start time');
            }

            // Limit shift length to 12 hours
            const shiftDuration = endMinutes - startMinutes;
            if (shiftDuration > 720) {  // 12 hours = 720 minutes
                throw new Error('Shift duration cannot exceed 12 hours');
            }

            return true;
        }), 

    // ROLE VALIDATION
    body('role')
        .notEmpty()
        .withMessage('Role is required')
        .isIn(['Front Desk CSR', 'Sales', 'Operations', 'Manager', 'Admin', 'Trainer'])
        .withMessage('Invalid role'), 

    // NOTES VALIDATION (Optional)
    body('notes')
        .optional({ nullable: true, checkFalsy: true })
        .trim()
        .isLength({ max: 500 })
        .withMessage('Notes must be less than 500 characters'), 

    // BUSINESS LOGIC: Check for overlapping shifts
    body('staff_id')
        .custom(async (staffId, { req }) => {
            return new Promise((resolve, reject) => {
                const { shift_date, start_time, end_time } = req.body;

                if (!shift_date || !start_time || !end_time) {
                    return resolve();   // Let other validators handle missing fields
                }

                // Check if staff already has a shift that overlaps
                const query = `
                    SELECT id, start_time, end_time
                    FROM shifts
                    WHERE staff_id = ?
                        AND shift_date = ?
                        AND (
                            -- New shift starts during existing shift
                            (? >= start_time AND ? < end_time)
                            OR
                            -- New shift ends during existing shift
                            (? > start_time AND ? <= end_time)
                            OR
                            -- New shift completely contains existing shift
                            (? <= start_time AND ? >= end_time)
                        )
                `;

                db.query(query, [
                    staffId, 
                    shift_date, 
                    start_time, start_time, 
                    end_time, end_time, 
                    start_time, end_time
                ], (err, results) => {
                    if (err) {
                        return reject(new Error('Database error'));
                    }

                    if (results.length > 0) {
                        return reject(new Error(
                            `Staff member already has a shift from ${results[0].start_time} to ${results[0].end_time} on this date`
                        ));
                    }

                    return resolve();
                });
            });
        })
];

/* ============================================
   VALIDATION RULES: EDIT SHIFT
   Applied to PUT /api/shifts/:id
   ============================================ */

const validateEditShift = [
    // Validate shift ID in url
    param('id')
        .isInt({ min: 1 })
        .withMessage('Invalid shift ID'), 

    // Same validation as add shift
    body('staff_id')
        .notEmpty()
        .withMessage('Staff member is required')
        .isInt({ min: 1 })
        .withMessage('Invalid staff member')

        // Custom validation: Staff must exist and be active
        .custom(async (staffId) => {
            return new Promise((resolve, reject) => {
                const query = 'SELECT status FROM staff WHERE id = ?';
                db.query(query, [staffId], (err, results) => {
                    if (err) {
                        return reject(new Error('Database error'));
                    }

                    if (results.length === 0) {
                        return reject(new Error('Staff member not found'));
                    }

                    if (results[0].status !== 'active') {
                        return reject(new Error('Cannot assign shifts to inactive staff'));
                    }

                    return resolve();
                });
            });
        }),

    // LOCATION ID VALIDATION
    body('location_id')
        .notEmpty()
        .withMessage('Location is required')
        .isInt({ min: 1 })
        .withMessage('Invalid location')

        // Custom validation: Location must exist
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

    // SHIFT DATE VALIDATION
    body('shift_date')
        .notEmpty()
        .withMessage('Shift date is required')
        .isISO8601()
        .withMessage('Invalid date format')

        // Can't creae shifts too far in past
        .custom((value) => {
            const shiftDate = new Date(value);
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

            if (shiftDate < thirtyDaysAgo) {
                throw new Error('Cannot create shifts more than 30 days in the past');
            }

            return true;
        }),

    // START TIME VALIDATION
    body('start_time')
        .notEmpty()
        .withMessage('Start time is required')

        // Must match HH:MM format
        .matches(/^([01]\d|2[0-3]):([0-5]\d)$/)
        .withMessage('Start time must be in HH:MM format (00:00 to 23:59'),

    // END TIME VALIDATION
    body('end_time')
        .notEmpty()
        .withMessage('End time is required')

        // Must match HH:MM format
        .matches(/^([01]\d|2[0-3]):([0-5]\d)$/)
        .withMessage('End time must be in HH:MM format (00:00 to 23:59)')

        // Custom validation: End must be after start
        .custom((endTime, { req }) => {
            const startTime = req.body.start_time;

            if (!startTime) {
                return true;    // Let start_time validator handle missing value
            }

            // Convert times to comparable numbers (minutes since midnight)
            const [startHour, startMin] = startTime.split(':').map(Number);
            const [endHour, endMin] = endTime.split(':').map(Number);

            const startMinutes = startHour * 60 + startMin;
            const endMinutes = endHour * 60 + endMin;

            if (endMinutes <= startMinutes) {
                throw new Error('End time must be after start time');
            }

            // Limit shift length to 12 hours
            const shiftDuration = endMinutes - startMinutes;
            if (shiftDuration > 720) {  // 12 hours = 720 minutes
                throw new Error('Shift duration cannot exceed 12 hours');
            }

            return true;
        }), 

    // ROLE VALIDATION
    body('role')
        .notEmpty()
        .withMessage('Role is required')
        .isIn(['Front Desk CSR', 'Sales', 'Operations', 'Manager', 'Admin', 'Trainer'])
        .withMessage('Invalid role'), 

    // NOTES VALIDATION (Optional)
    body('notes')
        .optional({ nullable: true, checkFalsy: true })
        .trim()
        .isLength({ max: 500 })
        .withMessage('Notes must be less than 500 characters'), 

    // BUSINESS LOGIC: Check for overlapping shifts
    body('staff_id')
        .custom(async (staffId, { req }) => {
            return new Promise((resolve, reject) => {
                const { shift_date, start_time, end_time } = req.body;

                if (!shift_date || !start_time || !end_time) {
                    return resolve();   // Let other validators handle missing fields
                }

                const shiftId = req.params.id;

                // Check if staff already has a shift that overlaps
                const query = `
                    SELECT id, start_time, end_time
                    FROM shifts
                    WHERE staff_id = ?
                        AND shift_date = ?
                        AND (
                            -- New shift starts during existing shift
                            (? >= start_time AND ? < end_time)
                            OR
                            -- New shift ends during existing shift
                            (? >= start_time AND ? <= end_time)
                            OR
                            -- New shift completely contains existing shift
                            (? <= start_time AND ? >= end_time)
                        )
                `;

                db.query(query, [
                    staffId, 
                    shift_date,
                    shiftId, 
                    start_time, start_time, 
                    end_time, end_time, 
                    start_time, end_time
                ], (err, results) => {
                    if (err) {
                        return reject(new Error('Database error'));
                    }

                    if (results.length > 0) {
                        return reject(new Error(
                            `Staff member already has a shift from ${results[0].start_time} to ${results[0].end_time} on this date`
                        ));
                    }

                    return resolve();
                });
            });
        })
];

/* ============================================
   VALIDATION RULES: ADD TRAINER
   Applied to POST /api/trainers
   ============================================ */

const validateAddTrainer = [
    // Same as staff
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

        // Check if email already exists in staff table
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

    // PHONE VALIDATION
    body('phone')
        .trim()
        .notEmpty()
        .withMessage('Phone number is required for trainers')
        .matches(/^\(\d{3}\) \d{3}-\d{4}$/)
        .withMessage('Phone must be in format: (555) 123-4567'), 

    // EMERGENCY CONTACT NAME VALIDATION
    body('emergency_contact')
        .trim()
        .notEmpty()
        .withMessage('Emergency contact is required for trainers')
        .isLength({ min: 2, max: 100 })
        .withMessage('Emergency contact name must be between 2 and 100 characters')
        .matches(/^[a-zA-Z\s'-]+$/)
        .withMessage('Emergency contact can only contain letters, spaces, hyphens, and apostrophes'), 

    // EMERGENCY PHONE VALIDATION
    body('emergency_phone')
        .trim()
        .notEmpty()
        .withMessage('Emergency phone is required for trainers')
        .matches(/^\(\d{3}\) \d{3}-\d{4}$/)
        .withMessage('Emergency phone must be in format: (555) 123-4567'), 

    // SPECIALTY VALIDATION
    body('specialty')
        .notEmpty()
        .withMessage('Specialty is requried for trainers')
        .isIn(['Strength', 'Hypertrophy', 'Weight Loss', 'Conditioning', 'Yoga / Mobility'])
        .withMessage('Specialty must be Strength, Hypertrophy, Weight Loss, Conidtioning, or Yoga / Mobility'), 

    // LOCATION VALIDATION
    body('location_id')
        .notEmpty()
        .withMessage('Location is required')
        .isInt({ min: 1 })
        .withMessage('Invalid location')
        
        // Custom validation: Location must exist in database
        .custom(async (locationId) => {
            return new Promise((resolve, reject) => {
                const query = 'SELECT id FROM locations where id = ?';
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

    // HIRE DATE VALIDATION
    body('hire_date')
        .notEmpty()
        .withMessage('Hire date is required')
        .isISO8601()
        .withMessage('Invalid date format')

        // Custom validation: Can't hire someone in the distant future
        .custom((value) => {
            const hireDate = new Date(value);
            const oneYearFromNow = new Date();
            oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);

            if (hireDate > oneYearFromNow) {
                throw new Error('Hire date cannot be more than 1 year in the future');
            }

            return true;
        }), 

    // HOURLY RATE VALIDATION
    body('hourly_rate')
        .optional({ nullable: true, checkFalsy: true })
        .isFloat({ min: 0, max: 500 })
        .withMessage('Hourly rate must be between $0 and $500'), 

    // NOTES VALIDATION
    body('notes')
        .optional({ nullable: true, checkFalsy: true })
        .trim()
        .isLength({ max: 500 })
        .withMessage('Notes must be less than 500 characters')
];

/* ============================================
   VALIDATION RULES: ADD INVENTORY PRODUCT
   Applied to POST /api/inventory/products
   ============================================ */

const validateAddProduct = [
    // PRODUCT NAME VALIDATION
    body('product_name')
        .trim()
        .notEmpty()
        .withMessage('Product name is required')
        .isLength({ min: 3, max: 100 })
        .withMessage('Product name must be between 3 and 100 characters')

        // Custom validation: Check if product already exists
        // Prevents duplicate inventory entries
        .custom(async (productName) => {
            return new Promise((resolve, reject) => {
                const query = 'SELECT id FROM inventory_products WHERE product_name = ?';

                db.query(query, [productName], (err, results) => {
                    if (err) {
                        return reject(new Error('Database error'));
                    }

                    if (results.length > 0) {
                        return reject(new Error('Product name already exists'));
                    }

                    return resolve();
                });
            });
        }), 
    
    // CATEGORY VALIDATION
    body('category')
        .notEmpty()
        .withMessage('Category is required')
        .isIn(['Beverages', 'Equipment', 'Merchandise', 'Supplements', 'Supplies'])
        .withMessage('Category must be Beverages, Equipment, Merchandise, Supplements, or Supplies'), 

    // SELLING PRICE VALIDATION
    body('selling_price')
        .notEmpty()
        .withMessage('Selling price is required')
        .isFloat({ min: 0.01, max: 10000 })
        .withMessage('Selling price must be between $0.01 and $10,000'), 

    // COST PRICE VALIDATION
    body('cost_price')
        .notEmpty()
        .withMessage('Cost price is required')
        .isFloat({ min: 0.01, max: 10000 })
        .withMessage('Cost price must be between $0.01 and $10,000')

        // Custom validation: Cost typically should be less than selling price
        // Should NOT sell at a loss
        // Making this a warning, not a hard error (some loss leaders are intentional)
        .custom((costPrice, { req }) => {
            const sellingPrice = parseFloat(req.body.selling_price);
            const cost = parseFloat(costPrice);

            if (cost > sellingPrice) {
                // We'll allow it, but include warning in response
                req.priceWarning = 'Cost price exceeds selling price - this will result in a loss';
            }

            return true;
        }), 

    // REORDER POINT VALIDATION
    body('reorder_point')
        .notEmpty()
        .withMessage('Reorder point is required')
        .isInt({ min: 1, max: 1000 })
        .withMessage('Reorder point must be between 1 and 1,000 units'), 

    // REORDER QUANTITY VALIDATION
    body('reorder_quantity')
        .notEmpty()
        .withMessage('Reorder quantity is required')
        .isInt({ min: 1, max: 1000 })
        .withMessage('Reorder quantity must be between 1 and 1,000 units')

        // Business logic: Reorder quantity should probably be more than reorder point
        // If reorder_point = 10 and reorder_quantity = 5, you'll STILL be low after reordering
        .custom((reorderQty, { req }) => {
            const reorderPoint = parseInt(req.body.reorder_point);
            const quantity = parseInt(reorderQty);

            if (quantity <= reorderPoint) {
                req.reorderWarning = 'Reorder quantity should typically exceed reorder point';
            }

            return true;
        }), 

    // DESCRIPTION VALIDATION
    body('description')
        .optional({ nullable: true, checkFalsy: true })
        .trim()
        .isLength({ max: 500 })
        .withMessage('Description must be less than 500 characters')
];

/* ============================================
   VALIDATION RULES: EDIT INVENTORY PRODUCT
   Applied to PUT /api/inventory/products/:id
   ============================================ */

const validateEditProduct = [
    // Validate product ID in URL
    param('id')
        .isInt({ min: 1 })
        .withMessage('Invalid product ID'), 

    body('product_name')
        .trim()
        .notEmpty()
        .withMessage('Product name is required')
        .isLength({ min: 3, max: 100 })
        .withMessage('Product name must be between 3 and 100 characters')
        .custom(async (productName, { req }) => {
            return new Promise((resolve, reject) => {
                // Check if product name exists for a DIFFERENT product
                const query = 'SELECT id FROM inventory_products WHERE product_name = ? AND id != ?';
                db.query(query, [productName, req.params.id], (err, results) => {
                    if (err) {
                        return reject(new Error('Database error'));
                    }

                    if (results.length > 0) {
                        return reject(new Error('Product name already exists'));
                    }

                    return resolve();
                });
            });
        }), 
    
    body('category')
        .notEmpty()
        .withMessage('Category is required')
        .isInt(['Beverages', 'Equipment', 'Merchandise', 'Supplements', 'Supplies'])
        .withMessage('Category must be Beverages, Equipment, Merchandise, Supplements, or Supplies'), 

    body('selling_price')
        .notEmpty()
        .withMessage('Selling price is required')
        .isFloat({ min: 0.01, max: 10000 })
        .withMessage('Selling price must be between $0.01 and $10,000'), 

    body('cost_price')
        .notEmpty()
        .withMessage('Cost price is required')
        .isFloat({ min: 1, max: 10000 })
        .withMessage('Cost price must be between $0.01 and $10,000')
        .custom((costPrice, { req }) => {
            const sellingPrice = parseFloat(req.body.selling_price);
            const cost = parseFloat(costPrice);

            if (cost > sellingPrice) {
                req.priceWarning = 'Cost price exceeds selling price - this will result in a loss';
            }

            return true;
        }), 

    body('reorder_point')
        .notEmpty()
        .withMessage('Reorder point is required')
        .isInt({ min: 0, max: 1000 })
        .withMessage('Reorder point must be between 0 and 1,000 units'), 

    body('reorder_quantity')
        .notEmpty()
        .withMessage('Reorder quantity is required')
        .isInt({ min: 1, max: 1000 })
        .withMessage('Reorder quantity must be between 1 and 1,000 units')
        .custom((reorderQty, { req }) => {
            const reorderPoint = parseInt(req.body.reorder_point);
            const quantity = parseInt(reorderQty);

            if (quantity <= reorderPoint) {
                req.reorderWarning = 'Reorder quantity should typically exceed reorder point';
            }

            return true;
        }), 

    body('description')
        .optional({ nullable: true, checkFalsy: true })
        .trim()
        .isLength({ max: 500 })
        .withMessage('Description must be less than 500 characters')
];

/* ============================================
   VALIDATION RULES: CREATE REORDER REQUEST
   Applied to POST /api/inventory/products/reorder
   ============================================ */

const validateCreateReorder = [
    
    body('product_id')
        .notEmpty()
        .withMessage('Product is required')
        .isInt({ min: 1 })
        .withMessage('Invalid product')

        // Custom validation: Product must exist
        .custom(async (productId) => {
            return new Promise((resolve, reject) => {
                const query = 'SELECT id FROM inventory_products WHERE id = ?';
                db.query(query, [productId], (err, results) => {
                    if (err) {
                        return reject(new Error('Database error'));
                    }

                    if (results.length === 0) {
                        return reject(new Error('Product not found'));
                    }

                    return resolve();
                });
            });
        }), 

    // DESTINATION LOCATION VALIDATION
    body('location_id')
        .notEmpty()
        .withMessage('Destination location is required')

        // .isInt() - Location IDs are integers (1, 2, 3)
        .isInt({ min: 1, max: 3 })
        .withMessage('Invalid destination location')

        // Custom validation: Location must exist in database
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

    // QUANTITY VALIDATION
    body('quantity')
        .notEmpty()
        .withMessage('Quantity is required')
        .isInt({ min: 1, max: 1000 })
        .withMessage('Quantity must be between 1 and 1,000 units'), 

    // NOTES VALIDATION
    body('notes')
        .optional({ nullable: true, checkFalsy: true })
        .trim()
        .isLength({ max: 500 })
        .withMessage('Notes must be less than 500 characters')
];

/* ============================================
   VALIDATION RULES: UPDATE STOCK QUANTITY
   Applied to PUT /api/inventory/products/:id/stock
   ============================================ */

const validateUpdateStock = [
    // Validate product ID in URL
    param('id')
        .isInt({ min: 1 })
        .withMessage('Invalid product ID'), 
    
    // QUANTITY VALIDATION
    body('quantity')
        .notEmpty()
        .withMessage('Quantity is required')
        .isInt({ min: 0, max: 10000 })
        .withMessage('Quantity must be between 0 and 10,000 units'), 

    // ADJUSTMENT TYPE VALIDATION
    body('adjustment_type')
        .optional()
        .isIn(['set', 'add', 'subtract'])
        .withMessage('Adjustment type must be set, add, or subtract')
];

/* ============================================
   VALIDATION RULES: Reject Reorder Request
   Applied to PUT /api/inventory/reorders/:id/reject
   ============================================ */

const validateRejectRequest = [

    // NOTES VALIDATION
    body('notes')
        .optional({ nullable: true, checkFalsy: true })
        .trim()
        .isLength({ max: 500 })
        .withMessage('Notes must be less than 500 characters')
];

/* ============================================
   VALIDATION RULES: Mark Reorder as Received
   Applied to PUT /api/inventory/reorders/:id/receive
   ============================================ */

const validateReceiveReorder = [
    // Validate reorder ID in url
    param('id')
        .isInt({ min: 1 })
        .withMessage('Invalid reorder ID'), 

    // QUANTITY RECEIVED VALIDATION
    body('quantity_received')
        .notEmpty()
        .withMessage('Quantity received is required')

        // Must be at least 1
        .isInt({ min: 1, max: 10000 })
        .withMessage('Quantity received must be between 1 and 1,000 units')

        // Custom validation: Quantity received can't exceed quantity ordered
        .custom(async (quantityReceived, { req }) => {
            return new Promise((resolve, reject) => {
                const reorderId = req.params.id;

                // Fetch the original reorder request to check quantity
                const query = 'SELECT quantity FROM reorder_requests WHERE id = ?';

                db.query(query, [reorderId], (err, results) => {
                    if (err) {
                        return reject(new Error('Database error'));
                    }

                    if (results.length === 0) {
                        return reject(new Error('Reorder request not found'));
                    }

                    const quantityOrdered = results[0].quantity;
                    const received = parseInt(quantityReceived);

                    // Check if received exceeds ordered
                    if (received > quantityOrdered) {
                        return reject(new Error(
                            `Quantity received (${received}) cannot exceed quantity ordered (${quantityOrdered})`
                        ));
                    }

                    // Warn if received is significantly less than ordered
                    // Does not block the request, just adds a warning
                    if (received < quantityOrdered * 0.5) {
                        req.receiveWarning = `Warning: Received only ${received} out of ${quantityOrdered} ordered`;
                    }

                    return resolve();
                });
            });
        })
];

/* ============================================
   VALIDATION RULES: ADD VENDOR
   Applied to POST /api/inventory/vendors
   ============================================ */

const validateAddVendor = [
    // VENDOR NAME VALIDATION
    body('vendor_name')
        .trim()
        .notEmpty()
        .withMessage('Vendor name is required')
        .isLength({ min: 3, max: 100 })
        .withMessage('Vendor name must be between 3 and 100 characters')

        // Custom validation: Check if vendor already exists
        // Prevents duplicate entries
        .custom(async (vendorName) => {
            return new Promise((resolve, reject) => {
                const query = 'SELECT id FROM vendors WHERE vendor_name = ?';

                db.query(query, [vendorName], (err, results) => {
                    if (err) {
                        return reject(new Error('Database error'));
                    }

                    if (results.length > 0) {
                        return reject(new Error('Vendor name already exists'));
                    }

                    return resolve();
                });
            });
        }), 

    // CATEGORY VALIDATION
    body('category')
        .notEmpty()
        .withMessage('Category is required')
        .isIn(['Supplies', 'Equipment', 'Servies', 'Other'])
        .withMessage('Category must be Supplies, Equipment, Services, or Other'), 

    // CONTACT PERSON VALIDATION
    body('contact_person')
        .optional({ nullable: true, checkFalsy: true })
        .trim()
        .isLength({ min: 3, max: 100 })
        .withMessage('Contact person must be between 3 and 100 characters')
        .matches(/^[a-zA-Z\s'-]+$/)
        .withMessage('Contact person can only contain letters, spaces, hyphens, and apostrophes'), 

    // EMAIL VALIDATION
    body('email')
        .optional({ nullable: true, checkFalsy: true })
        .trim()
        .isEmail()
        .withMessage('Invalid email format')
        .normalizeEmail(), 

    // PHONE VALIDATION
    body('phone')
        .optional({ nullable: true, checkFalsy: true })
        .trim()
        .matches(/^\(\d{3}\) \d{3}-\d{4}$/)
        .withMessage('Phone must be in format: (555) 123-4567'), 

    // PAYMENT TERMS VALIDATION
    body('payment_terms')
        .optional({ nullable: true, checkFalsy: true })
        .trim()
        .isLength({ max: 100 })
        .withMessage('Payment terms must be less than 100 characters'), 

    // STREET ADDRESS VALIDATION
    body('street_address')
        .optional({ nullable: true, checkFalsy: true })
        .trim()
        .isLength({ max: 200 })
        .withMessage('Street address must be less than 200 characters'), 

    // CITY VALIDATION
    body('city')
        .optional({ nullable: true, checkFalsy: true })
        .trim()
        .isLength({ min: 3, max: 100 })
        .withMessage('City must be between 3 and 100 characters')
        .matches(/^[a-zA-Z\s'-]+$/)
        .withMessage('City can only contain letters, spaces, hyphens, and apostrophes'), 

    // PROVINCE VALIDATION
    body('province')
        .optional({ nullable: true, checkFalsy: true })
        .trim()
        .isLength({ min: 3, max: 100 })
        .withMessage('Provicne must be between 3 and 100 characters')
        .matches(/^[a-zA-Z\s'-]+$/)
        .withMessage('Province can only contain letters, spaces, hyphens, and apostrophes'), 

    // POSTAL CODE VALIDATION
    body('postal_code')
        .optional()
        .trim()
        .matches(/^[A-Za-z]\d[A-Za-z][ -]?\d[A-Za-z]\d$/)
        .withMessage('Postal code must be in Canadian format: A1A 1A1')

        // Normalize to uppercase with space
        // "m5v2t6" becomes M5V 2T6
        .customSanitizer(value => {
            if (value) {
                // Remove spaces/hyphens, convert to uppercase
                const cleaned = value.replace(/[\s-]/g, '').toUpperCase();
                // Add space in middle
                return cleaned.slice(0, 3) + ' ' + cleaned.slice(3);
            }

            return value;
        }), 

    // TAX ID / BUSINESS NUMBER VALIDATION
    body('tax_id')
        .optional({ nullable: true, checkFalsy: true })
        .trim()
        .isLength({ max: 50 })
        .withMessage('Tax ID / Business Number must be less than 50 characters')
        .matches(/^[a-zA-Z\s'-]+$/)
        .withMessage('Tax ID can only contain letters, spaces, hyphens, and apostrophes'), 

    // STATUS VALIDATION
    body('status')
        .notEmpty()
        .withMessage('Status is required')
        .isIn(['Active', 'Inactive'])
        .withMessage('Status must be either Active or Inactive'),

    // NOTES VALIDATION
    body('notes')
        .optional({ nullable: true, checkFalsy: true })
        .trim()
        .isLength({ max: 1000 })
        .withMessage('Notes must be less than 1000 characters')
];

/* ============================================
   VALIDATION RULES: EDIT VENDOR
   Applied to PUT /api/inventory/vendors/:id
   ============================================ */

const validateEditVendor = [
    // Validate vendor ID in URL
    param('id')
        .isInt({ min: 1 })
        .withMessage('Invalid vendor ID'), 

    // Same validation as add vendor, but vendor name uniqueness check
    // must exclude the current vendor (they can keep their own name)
    body('vendor_name')
        .trim()
        .notEmpty()
        .withMessage('Vendor name is required')
        .isLength({ min: 3, max: 100 })
        .withMessage('Vendor name must be between 3 and 100 characters')
        .custom(async (vendorName, { req }) => {
            return new Promise((resolve, reject) => {
                // Check if vendor name exists for a DIFFERENT vendor
                const query = 'SELECT id FROM vendors WHERE vendor_name = ? AND id != ?';

                db.query(err, [vendorName, req.params.id], (err, results) => {
                    if (err) {
                        return reject(new Error('Database error'));
                    }

                    if (results.length > 0) {
                        return reject(new Error('Vendor name already exists'));
                    }

                    return resolve();
                });
            }); 
        }), 

    body('category')
        .notEmpty()
        .withMessage('Category is required')
        .isIn(['Supplies', 'Equipment', 'Services', 'Other'])
        .withMessage('Category must be Supplies, Equipment, Services, or Other'),

    body('contact_person')
        .optional({ nullable: true, checkFalsy: true })
        .trim()
        .isLength({ min: 2, max: 100 })
        .withMessage('Contact person must be between 2 and 100 characters')
        .matches(/^[a-zA-Z\s'-]+$/)
        .withMessage('Contact person can only contain letters, spaces, hyphens, and apostrophes'),

    body('email')
        .optional({ nullable: true, checkFalsy: true })
        .trim()
        .isEmail()
        .withMessage('Invalid email format')
        .normalizeEmail(),

    body('phone')
        .optional({ nullable: true, checkFalsy: true })
        .trim()
        .matches(/^\(\d{3}\) \d{3}-\d{4}$/)
        .withMessage('Phone must be in format: (555) 123-4567'),

    body('payment_terms')
        .optional({ nullable: true, checkFalsy: true })
        .trim()
        .isLength({ max: 100 })
        .withMessage('Payment terms must be less than 100 characters'),

    body('street_address')
        .optional({ nullable: true, checkFalsy: true })
        .trim()
        .isLength({ max: 200 })
        .withMessage('Street address must be less than 200 characters'),

    body('city')
        .optional({ nullable: true, checkFalsy: true })
        .trim()
        .isLength({ min: 2, max: 100 })
        .withMessage('City must be between 2 and 100 characters')
        .matches(/^[a-zA-Z\s'-]+$/)
        .withMessage('City can only contain letters, spaces, hyphens, and apostrophes'),

    body('province')
        .optional({ nullable: true, checkFalsy: true })
        .trim()
        .isLength({ min: 2, max: 100 })
        .withMessage('Province must be between 2 and 100 characters')
        .matches(/^[a-zA-Z\s'-]+$/)
        .withMessage('Province can only contain letters, spaces, hyphens, and apostrophes'),

    body('postal_code')
        .optional({ nullable: true, checkFalsy: true })
        .trim()
        .matches(/^[A-Za-z]\d[A-Za-z][ -]?\d[A-Za-z]\d$/)
        .withMessage('Postal code must be in Canadian format: A1A 1A1')
        .customSanitizer(value => {
            if (value) {
                const cleaned = value.replace(/[\s-]/g, '').toUpperCase();
                return cleaned.slice(0, 3) + ' ' + cleaned.slice(3);
            }
            return value;
        }),

    body('tax_id')
        .optional({ nullable: true, checkFalsy: true })
        .trim()
        .isLength({ max: 50 })
        .withMessage('Tax ID / Business Number must be less than 50 characters')
        .matches(/^[A-Za-z0-9\s-]+$/)
        .withMessage('Tax ID can only contain letters, numbers, spaces, and hyphens'),

    body('status')
        .notEmpty()
        .withMessage('Status is required')
        .isIn(['Active', 'Inactive'])
        .withMessage('Status must be Active or Inactive'),

    body('notes')
        .optional({ nullable: true, checkFalsy: true })
        .trim()
        .isLength({ max: 1000 })
        .withMessage('Notes must be less than 1000 characters')
];

/* ============================================
   VALIDATION RULES: EDIT LOCATION
   Applied to PUT /api/location/:id
   ============================================ */

const validateEditLocation = [
    // Validate location ID in URL
    param('id')
        .isInt({ min: 1 })
        .withMessage('Invalid location ID')

        // Custom validation: Location must exist
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

    // CAPACITY VALIDATION
    body('capacity')
        .notEmpty()
        .withMessage('Capacity is required')
        .isInt({ min: 1, max: 10000 })
        .withMessage('Capacity must be between 1 and 10,000 members')

        // Custom validation: New capacity should be >= current members
        // Can't reduce capacity below current member count
        .custom(async (capacity, { req }) => {
            return new Promise((resolve, reject) => {
                const locationId = req.params.id;
                const newCapacity = parseInt(capacity);

                // Get current member count for this location
                const query = `
                    SELECT COUNT(*) as current_members
                    FROM members
                    WHERE location_id = ?
                        AND status = 'active'
                `;

                db.query(query, [locationId], (err, results) => {
                    if (err) {
                        return reject(new Error('Database error'));
                    }

                    const currentMembers = results[0].current_members;

                    // Check if new capacity is too low
                    if (newCapacity < currentMembers) {
                        return reject(new Error(
                            `Cannot reduce capacity to ${newCapacity}. Location currently has ${currentMembers} active members.` +
                            `Capacity must be at least ${currentMembers}.`
                        ));
                    }

                    // Warning if new capacity is very close to current members
                    // No error, just warning
                    if (newCapacity < currentMembers * 1.1) {
                        req.capacityWarning = `Warning: New capacity (${newCapacity}) is very close to current members (${currentMembers})`;
                    }

                    return resolve();
                });
            });
        })
];

/* ============================================
   VALIDATION RULES: UPDATE SYSTEM SETTINGS
   Applied to PUT /api/settings
   ============================================ */

const validateUpdateSettings = [
    // CURRENCY SYMBOL VALIDATION
    body('currency_symbol')
        .notEmpty()
        .withMessage('Currency symbol is required')
        .isIn(['CA$', 'US$'])
        .withMessage('Currency symbol must be CA$ or US$'), 

    // DATE FORMAT VALIDATION
    body('date_format')
        .notEmpty()
        .withMessage('Date format is required')
        .isIn(['MM/DD/YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD'])
        .withMessage('Date format must be MM/DD/YYYY, DD/MM/YYYY, or YYYY-MM-DD'), 

    // LOW INVENTORY THRESHOLD VALIDATION
    body('low_inventory_threshold')
        .notEmpty()
        .withMessage('Low inventory alert threshold is required')
        .isInt({ min: 1, max: 1000 })
        .withMessage('Low inventory threshold must be between 1 and 1,000 units'), 

    // CAPACITY WARNING LEVEL VALDIATION
    body('capacity_warning_percent')
        .notEmpty()
        .withMessage('Capacity warning level is required')
        .isInt({ min: 1, max: 100 })
        .withMessage('Capacity warning level must be between 1 and 100 percent')

        // Custom validation: Should be 50-100%
        // Will allow 1-100%, but warn if it's unusually low
        .custom((warningPercent) => {
            const percent = parseInt(warningPercent);

            // Warn if threshold is very low (but still allow it)
            if (percent < 50) {
                // Doesn't reject, just adds a warning
            }

            if (percent >= 95) {
                // Warning: Alerts will come very late (almost full)
            }

            return true;
        })
];

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
    validateEditStaff, 
    validateAddTrainer, 

    // Shift validators
    validateAddShift, 
    validateEditShift, 

    // Inventory validators
    validateAddProduct, 
    validateEditProduct, 
    validateCreateReorder, 
    validateUpdateStock, 
    validateRejectRequest, 
    validateReceiveReorder, 
    validateAddVendor, 
    validateEditVendor, 

    // Location validators
    validateEditLocation, 

    // Settings validators
    validateUpdateSettings
};