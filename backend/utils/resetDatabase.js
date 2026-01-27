/* ============================================
   DATABASE RESET UTILITY
   Resets database to seed data for demo mode
   ============================================ */

const fs = require('fs');
const path = require('path');
const db = require('../config/database');

async function resetDatabase() {
    console.log('Starting database reset...');

    try {
        // Read the seed SQL file
        const seedFilePath = path.join(__dirname, '../database/seed.sql');

        // Check if file exists
        if (!fs.existsSync(seedFilePath)) {
            throw new Error('Seed file not found at: ' + seedFilePath);
        }

        const seedSQL = fs.readFileSync(seedFilePath, 'utf8');

        // Split by semicolon to get individual statements
        // Filter out comments and empty statements
        const statements = seedSQL
            .split(';')
            .map(stmt => stmt.trim())
            .filter(stmt => {
                // Remove empty statements
                if (stmt.length === 0) return false;
                // Remove comment-only lines
                if (stmt.startsWith('---')) return false;
                return true;
            });
        
        console.log(`Executing ${statements.length} SQL statements...`);

        // Execute each statement sequentially
        let successCount = 0;
        let errorCount = 0;

        for (let i = 0; i < statements.length; i++) {
            const statement = statements[i];

            try {
                await new Promise((resolve, reject) => {
                    db.query(statement, (err, result) => {
                        if (err) {
                            console.error(`Error on statement ${i + 1}:`, err.message);
                            reject(err);
                        } else {
                            resolve(result);
                        }
                    });
                });
                successCount++;
            } catch (err) {
                errorCount++;
                // Log error but continue with other statements
                console.error(`Statement ${i + 1} failed, continuing...`);
            }
        }

        console.log(`Database reset complete!`);
        console.log(`Success: ${successCount} | Errors: ${errorCount}`);
        console.log(`Reset at: ${new Date().toLocaleDateString('en-US', { timeZone: 'America/Toronto' })} EST`);

        return {
            success: true, 
            message: 'Database reset successfully', 
            successCount, 
            errorCount
        };

    } catch (error) {
        console.error('Database reset failed:', error);
        return {
            success: false, 
            error: error.message
        };
    }
}

module.exports = resetDatabase;