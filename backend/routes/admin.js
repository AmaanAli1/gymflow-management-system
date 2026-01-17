/* ============================================
   ADMIN ROUTES
   Admin authentication and verification
   ============================================ */

const express = require('express');
const router = express.Router();
const db = require('../config/database');
const bcrypt = require('bcrypt');

/* ============================================
   POST /api/admin/verify-password
   Verify admin credentials for sensitive operations
   ============================================ */

router.post('/verify-password', async (req, res) => {
   const { username, password } = req.body;

   // Validate input
   if (!username || !password) {
      return res.status(400).json({
         verified: false,
         error: 'Username and password required'
      });
   }

   // Query admin table
   const query = 'SELECT * FROM admins WHERE username = ?';

   db.query(query, [username], async (err, results) => {
      if (err) {
         console.error('❌ Database error:', err);
         return res.status(500).json({
            verified: false,
            error: 'Database error'
         });
      }

      if (results.length === 0) {
         console.log('❌ Admin not found');
         return res.json({ verified: false });
      }

      const admin = results[0];

      try {
         // Use bcrypt to compare passwords securely
         const isMatch = await bcrypt.compare(password, admin.password_hash);

         if (isMatch) {
            console.log('✅ Admin verified');
            return res.json({ verified: true });
         } else {
            console.log('❌ Invalid password');
            return res.json({ verified: false });
         }
      } catch (error) {
         console.error('❌ Bcrypt error:', error);
         return res.status(500).json({
            verified: false,
            error: 'Password verification failed'
         });
      }
   });
});

module.exports = router;