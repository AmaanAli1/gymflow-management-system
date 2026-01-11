// middleware/rateLimiter.js

/* ============================================
   SECURITY: RATE LIMITING
   Prevents brute force attacks and Dos
   ============================================ */

// SECURITY: Rate limiting to prevent abuse
const rateLimit = require('express-rate-limit');

/* ============================================
   GENERAL API RATE LIMITER
   Applied to ALL /api/* routes
   ============================================ */

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

/* ============================================
   STRICT AUTH RATE LIMITER
   Applied ONLY to login/authentication routes
   ============================================ */

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

/* ============================================
   PAYMENT RATE LIMITER
   For future payment endpoints - even stricter
   ============================================ */

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

/* ============================================
   CHECK-IN RATE LIMITER
   Prevents spam check-ins from the same IP
   ============================================ */

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

// Export all limiters
module.exports = {
    apiLimiter, 
    authLimiter, 
    paymentLimiter, 
    checkInLimiter
};