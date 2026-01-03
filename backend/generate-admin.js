/* ============================================
   ADMIN PASSWORD HASH GENERATOR

   PURPOSE: Generate a secure bcrypt hash of a password

   WHY DO WE NEED THIS?
   - We NEVER store passwords as plain text in the database
   - If database is hacked, attackers get gibberish, not real passwords
   - Bcrypt is a one-way encryption (can't be reversed)
   - Even if two users have the same password, hashes are different (salt)

   WHAT IS BCRYPT?
   - Industry-standard password hashing algorithm
   - Designed to be slow (prevents brute-force attacks)
   - Automatically adds "salt" (random data) to make each hash unique

   EXAMPLE:
   Password: "Admin123!"
   Hash: "$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy"

   Even if attacker sees the hash, they can't get "Admin123!" back!
   ============================================ */

// Import bcrypt library for password hashing
// Already installed in package.json
const bcrypt = require('bcrypt');

/* ========================================
   GENERATE ADMIN FUNCTION
   Creates a bcrypt hash from a plain text password
   ======================================== */

async function generateAdmin() {

    // ===== STEP 1: Define the password =====
    const password = "Admin123!";   // Change THIS to desired admin password

    // ===== STEP 2: Set salt rounds =====
    const saltRounds = 10;

    // WHAT IS SALT ROUNDS?
    // - Number of times bcrypt processes the password
    // - Higher = more secure but slower
    // - 10 rounds = industry standard (takes ~100ms)
    // - 12 rounds = very secure (takes ~400ms)
    //
    // WHY 10?
    // - Good balance of security and speed
    // - Recommended by bcrypt documentation

    // ===== STEP 3: Generate the hash =====
    const hash = await bcrypt.hash(password, saltRounds);

    // WHAT HAPPENS HERE?
    // 1. Bcrypt generates random "salt" (random characters)
    // 2. Combines password + salt
    // 3. Runs it through hashing algorithm 10 times (saltRounds)
    // 4. Returns a long string that looks like:
    //      ""$2b$10$abc123xyz...random characters..."
    //
    // IMPORTANT: This is async (takes time), so we use 'await'

    // ===== STEP 4: Display the results =====
    console.log('========================================');
    console.log('Admin Password Hash Generated');
    console.log('========================================');
    console.log('Username: admin');
    console.log('Password', password);                  // Original password (for reference)
    console.log('Hash:', hash);                         // The hash to put in database
    console.log('========================================');
    console.log('\nUse this hash in your SQL INSERT statement');
    console.log('Copy the hash value and paste it into the password_hash field');
}

/* ========================================
   RUN THE FUNCTION
   ======================================== */

// Execute the function to generate the hash
generateAdmin();

/* ========================================
   HOW PASSWORD VERIFICATION WORKS
   ======================================== */

// When user logs in:
// 1. User enters : "Admin123!"
// 2. Backend retrieves hash from database
// 3. Backend runs: bcrypt.compare("Admin123!", hash)
// 4. Bcrypt applies same algorithm and checks if they match
// 5. Returns true/false
//
// Even though the hash can't be reversed,
// bcrypt can still verify if a password is correct!