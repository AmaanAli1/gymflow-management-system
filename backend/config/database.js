// config/database.js
const mysql = require('mysql2');
require('dotenv').config();

// Log environment variables (for Railway debugging)
console.log('Database Config Check:');
console.log('DB_HOST:', process.env.DB_HOST ? 'Set' : 'Missing');
console.log('DB_USER:', process.env.DB_USER ? 'Set' : 'Missing');
console.log('DB_PASSWORD:', process.env.DB_PASSWORD ? 'Set' : 'Missing');
console.log('DB_NAME:', process.env.DB_NAME ? 'Set' : 'Missing');
console.log('DB_PORT:', process.env.DB_PORT ? 'Set' : 'Missing');

// Create connection pool
const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost', 
    user: process.env.DB_USER || 'root', 
    password: process.env.DB_PASSWORD || '', 
    database: process.env.DB_NAME || 'gymflow', 
    port: process.env.DB_PORT || 3306, 
    connectionLimit: 10, 
    waitForConnections: true, 
    queueLimit: 0
});

// Test connection
pool.getConnection((err, connection) => {
    if (err) {
        console.error('Database connection failed:', err.message);
        console.error('Error code:', err.code);
        console.error('Error message:', err.message);
        return;
    }
    console.log('Database connected successfully');
    console.log('Connected to:', process.env.DB_HOST);
    connection.release();
});

module.exports = pool;