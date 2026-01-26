// routes/inventory.js

/* ============================================
   INVENTORY ROUTES
   All endpoints related to inventory management
   ============================================ */

const express = require('express');
const router = express.Router();

// Import database
const db = require('../config/database');

// ============================================
// CATEGORY PREFIX MAPPING
// Maps category IDs to SKU prefixes
// Centralized, used by multiple routes
// ============================================

const CATEGORY_PREFIXES = {
    1: 'SUPP',      // Supplements
    2: 'BEV',       // Beverages
    3: 'MERCH',     // Merchandise
    4: 'EQUIP',     // Equipment
    5: 'SUPPLY',    // Supplies
};

/* ============================================
   GET /api/inventory/stats
   Get KPI statistics for inventory dashboard
   ============================================ */

router.get('/stats', (req, res) => {
    // Query to get all stats in one go
    const statsQuery = `
        SELECT
            -- Total unique products
            (SELECT COUNT(*) FROM products WHERE status = 'active') as total_products,
            
            -- Total stock value (quantity * unit_price across all locations)
            (SELECT COALESCE(SUM(s.quantity * p.unit_price), 0)
             FROM inventory_stock s
             JOIN products p ON s.product_id = p.id
             WHERE p.status = 'active') as total_stock_value,
            
            -- Low stock count (products where total stock < reorder_point)
            (SELECT COUNT(DISTINCT p.id)
             FROM products p
             JOIN (
                SELECT product_id, SUM(quantity) as total_qty
                FROM inventory_stock
                GROUP BY product_id
             ) stock_totals ON p.id = stock_totals.product_id
             WHERE p.status = 'active'
             AND stock_totals.total_qty <= p.reorder_point
             AND stock_totals.total_qty > 0) as low_stock_count,
             
            -- Out of stock count (products with zero total quantity)
            (SELECT COUNT(DISTINCT p.id)
             FROM products p
             JOIN (
                SELECT product_id, SUM(quantity) as total_qty
                FROM inventory_stock
                GROUP BY product_id
             ) stock_totals ON p.id = stock_totals.product_id
              WHERE p.status = 'active'
              AND stock_totals.total_qty = 0) as out_of_stock_count,
              
            -- Pending reorder requests
            (SELECT COUNT(*) FROM reorder_requests WHERE status = 'pending') as pending_reorders
    `;

    db.query(statsQuery, (err, results) => {
        if (err) {
            console.error('Stats query error:', err);
            return res.status(500).json({ error: 'Failed to fetch inventory stats' });
        }

        const stats = results[0];

        // Format currency values
        stats.total_stock_value = parseFloat(stats.total_stock_value) || 0;

        res.json(stats);
    });
});

/* ============================================
   GET /api/inventory/categories
   Get all product categories
   ============================================ */

router.get('/categories', (req, res) => {
    
    const query = `
        SELECT
            c.*,
            COUNT(p.id) as product_count
        FROM inventory_categories c
        LEFT JOIN products p ON c.id = p.category_id AND p.status = 'active'
        GROUP BY c.id
        ORDER BY c.name
    `;

    db.query(query, (err, results) => {
        if (err) {
            console.error('Categories query error:', err);
            return res.status(500).json({ error: 'Failed to fetch categories' });
        }

        res.json(results);
    });
});

/* ============================================
   GET /api/inventory/products
   Get all products with stock levels
   ============================================ */

router.get('/products', (req, res) => {
    // Get query parameters for filtering
    const { category, location, status, search, stock_status } = req.query;

    // STEP 1: Get products with total stock
    let query = `
        SELECT
            p.*,
            c.name as category_name,
            c.icon as category_icon,
            COALESCE(stock_totals.total_quantity, 0) as total_quantity
        FROM products p
        JOIN inventory_categories c ON p.category_id = c.id
        LEFT JOIN (
            SELECT product_id, SUM(quantity) as total_quantity
            FROM inventory_stock
            GROUP BY product_id
        ) stock_totals ON p.id = stock_totals.product_id
        WHERE 1=1
    `;

    const params = [];

    // Apply filters
    if (category && category !== 'all') {
        query += ` AND p.category_id = ?`;
        params.push(category);
    }

    if (status && status !== 'all') {
        query += ` AND p.status = ?`;
        params.push(status);
    }

    if (search) {
        query += ` AND (p.name LIKE ? OR p.sku LIKE ? OR p.description LIKE ?)`;
        const searchPattern = `%${search}%`;
        params.push(searchPattern, searchPattern, searchPattern);
    }

    // Stock status filter
    if (stock_status === 'low') {
        query += ` AND COALESCE(stock_totals.total_quantity, 0) <= p.reorder_point AND COALESCE(stock_totals.total_quantity, 0) > 0`;
    } else if (stock_status === 'out') {
        query += ` AND COALESCE(stock_totals.total_quantity, 0) = 0`;
    } else if (stock_status === 'in_stock') {
        query += ` AND COALESCE(stock_totals.total_quantity, 0) > p.reorder_point`;
    }

    // Location filter
    if (location && location !== 'all') {
        query += ` AND EXISTS (
            SELECT 1 FROM inventory_stock
            WHERE product_id = p.id AND location_id = ?
        )`;
        params.push(location);
    }

    query += ` ORDER BY c.name, p.name`;

    db.query(query, params, (err, products) => {
        if (err) {
            console.error('Products query error:', err);
            return res.status(500).json({ error: 'Failed to fetch products' });
        }

        // If no product, return empty array
        if (products.length === 0) {
            return res.json({ products: [] });
        }

        // STEP 2: Get stock by location for all products in one query
        const productIds = products.map(p => p.id);

        const stockQuery = `
            SELECT
                s.product_id,
                s.location_id,
                s.quantity,
                s.last_restocked,
                l.name as location_name
            FROM inventory_stock s
            JOIN locations l ON s.location_id = l.id
            WHERE s.product_id IN (?)
            ORDER BY s.product_id, l.name
        `;

        db.query(stockQuery, [productIds], (err, stockResults) => {
            if (err) {
                console.error('Stock query error:', err);
                // Return products without stock breakdown if this fails
                return res.json({
                    products: products.map(p => ({ ...p, stock_by_location: [] }))
                });
            }

            // Group stock results by product_id
            const stockByProduct = {};
            stockResults.forEach(stock => {
                if (!stockByProduct[stock.product_id]) {
                    stockByProduct[stock.product_id] = [];
                }

                stockByProduct[stock.product_id].push({
                    location_id: stock.location_id, 
                    location_name: stock.location_name, 
                    quantity: stock.quantity, 
                    last_restocked: stock.last_restocked
                });
            });

            // Attach stock data to each product
            const productsWithStock = products.map(product => ({
                ...product, 
                stock_by_location: stockByProduct[product.id] || []
            }));

            res.json({ products: productsWithStock});
        });
    });
});

/* ============================================
   GET /api/inventory/products/:id
   Get single product with full details
   ============================================ */

router.get('/products/:id', (req, res) => {
    const productId = req.params.id;

    const query = `
        SELECT
            p.*,
            c.name as category_name,
            c.icon as category_icon
        FROM products p
        JOIN inventory_categories c ON p.category_id = c.id
        WHERE p.id = ?
    `;

    db.query(query, [productId], (err, productResults) => {
        if (err) {
            console.error('Product query error:', err);
            return res.status(500).json({ error: 'Failed to fetch product' });
        }

        if (productResults.length === 0) {
            return res.status(404).json({ error: 'Product not found' });
        }

        const product = productResults[0];

        // Get stock levels for each location
        const stockQuery = `
            SELECT
                s.*,
                l.name as location_name
            FROM inventory_stock s
            JOIN locations l on s.location_id = l.id
            WHERE s.product_id = ?
            ORDER BY l.name
        `;

        db.query(stockQuery, [productId], (err, stockResults) => {
            if (err) {
                console.error('Stock query error:', err);
                return res.status(500).json({ error: 'Failed to fetch stock levels' });
            }

            product.stock_by_location = stockResults;
            product.total_quantity = stockResults.reduce((sum, s) => sum + s.quantity, 0);

            res.json(product);
        });
    });
});

/* ============================================
   POST /api/inventory/products
   Create new product
   ============================================ */

router.post('/products', (req, res) => {
    const {
        name, 
        description, 
        category_id, 
        unit_price, 
        cost_price, 
        reorder_point, 
        reorder_quantity
    } = req.body;

    // Validate required fields
    if (!name || !category_id) {
        return res.status(404).json({
            error: 'Missing required fields', 
            required: ['name', 'category_id']
        });
    }

    // STEP 1: Generate SKU based on category
    const prefix = CATEGORY_PREFIXES[category_id];

    if (!prefix) {
        return res.status(400).json({ error: 'Invalid category' });
    }

    // Find the highest existing SKU number for this prefix
    const getMaxSkuQuery = `
        SELECT MAX(CAST(SUBSTRING(sku, LENGTH(?) + 2) AS UNSIGNED)) as max_num
        FROM products
        WHERE sku LIKE ?
    `;

    db.query(getMaxSkuQuery, [prefix, `${prefix}-%`], (err, results) => {
        if (err) {
            console.error('Error generating SKU:', err);
            return res.status(500).json({ error: 'Database error' });
        }

        // Generate next SKU
        const nextNum = (results[0].max_num || 0) + 1;
        const sku = `${prefix}-${String(nextNum).padStart(3, '0')}`;

        // STEP 2: Insert the product
        const insertQuery = `
            INSERT INTO products (
                sku, name, description, category_id,
                unit_price, cost_price, reorder_point, reorder_quantity
            )
            VALUES (?, ?, ?, ?, ?, ?, ? , ?)
        `;

        const values = [
            sku, 
            name, 
            description || null, 
            category_id, 
            unit_price || 0, 
            cost_price || 0, 
            reorder_point || 10, 
            reorder_quantity || 25
        ];

        db.query(insertQuery, values, (err, result) => {
            if (err) {
                console.error('Insert error:', err);
                return res.status(500).json({ error: 'Failed to create product' });
            }

            const newProductId = result.insertId;

            // STEP 3: Create stock records for each location (starting at 0)
            // auto-create: Ensures every product has stock records at all locations
            const stockInsertQuery = `
                INSERT INTO inventory_stock (product_id, location_id, quantity)
                SELECT ?, id, 0 FROM locations
            `;

            db.query(stockInsertQuery, [newProductId], (err) => {
                if (err) {
                    console.error('Stock initialization error:', err);
                    // Product created but stock records failed - not critical
                }

                // Fetch and return the created product
                const fetchQuery = `
                    SELECT p.*, c.name as category_name, c.icon as category_icon
                    FROM products p
                    JOIN inventory_categories c ON p.category_id = c.id
                    WHERE p.id = ?
                `;

                db.query(fetchQuery, [newProductId], (err, product) => {
                    if (err) {
                        console.error('Fetch error:', err);
                        return res.status(500).json({ error: 'Product created but failed to fetch' });
                    }

                    res.status(201).json({
                        success: true, 
                        sku: sku, 
                        message: 'Product created successfully', 
                        product: product[0]
                    });
                });
            });
        });
    });
});

/* ============================================
   PUT /api/inventory/products/:id
   Update product details
   ============================================ */

router.put('/products/:id', (req, res) => {
    const productId = req.params.id;
    const {
        name, 
        description, 
        category_id, 
        unit_price, 
        cost_price, 
        reorder_point, 
        reorder_quantity, 
        status
    } = req.body;

    // Validate required fields
    if (!name || !category_id) {
        return res.status(400).json({
            error: 'Missing required fields', 
            required: ['name', 'category_id']
        });
    }

    const updateQuery = `
        UPDATE products
        SET
            name = ?,
            description = ?,
            category_id = ?,
            unit_price = ?,
            cost_price = ?,
            reorder_point = ?,
            reorder_quantity = ?,
            status = ?
        WHERE id = ?
    `;

    const values = [
        name, 
        description || null, 
        category_id, 
        unit_price || 0, 
        cost_price || 0, 
        reorder_point || 10, 
        reorder_quantity || 25, 
        status || 'active', 
        productId
    ];

    db.query(updateQuery, values, (err, result) => {
        if (err) {
            console.error('Update error:', err);
            return res.status(500).json({ error: 'Failed to update product' });
        }

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Product not found' });
        }

        // Fetch updated product
        const fetchQuery = `
            SELECT p.*, c.name as category_name, c.icon as category_icon
            FROM products p
            JOIN inventory_categories c ON p.category_id = c.id
            WHERE p.id = ?
        `;

        db.query(fetchQuery, [productId], (err, product) => {
            if (err) {
                console.error('Fetch error:', err);
                return res.status(500).json({ error: 'Product created but failed to fetch' });
            }

            res.json({
                success: true, 
                message: 'Product updated successfully', 
                product: product[0]
            });
        });
    });
});

/* ============================================
   PUT /api/inventory/stock/:productId/:locationId
   Update stock quantity for a specific product at a specific location
   ============================================ */

router.put('/stock/:productId/:locationId', (req, res) => {
    const { productId, locationId } = req.params;
    const { quantity, adjustment_type, adjustment_reason } = req.body;

    // Validate quantity
    if (quantity === undefined || quantity < 0) {
        return res.status(400).json({ error: 'Invalid quantity' });
    }

    const updateQuery = `
        UPDATE inventory_stock
        SET quantity = ?, updated_at = NOW()
        WHERE product_id = ? AND location_id = ?
    `;

    db.query(updateQuery, [quantity, productId, locationId], (err, result) => {
        if (err) {
            console.error('Stock update error:', err);
            return res.status(500).json({ error: 'Failed to update stock' });
        }

        if (result.affectedRows === 0) {
            // Record doesn't exist, create it
            const insertQuery = `
                INSERT INTO inventory_stock (product_id, location_id, quantity)
                VALUES (?, ?, ?)
            `;

            db.query(insertQuery, [productId, locationId, quantity], (err) => {
                if (err) {
                    console.error('Stock insert error:', err);
                    return res.status(500).json({ error: 'Failed to create stock record' });
                }

                res.json({
                    success: true, 
                    message: 'Stock record created'
                });
            });

            return;
        }

        res.json({
            success: true, 
            message: ' Stock updated successfully'
        });
    });
});

/* ============================================
   GET /api/inventory/chart/stock-health
   Get data for stock health doughnut chart
   ============================================ */

router.get('/chart/stock-health', (req, res) => {
    const query = `
        SELECT
            -- In stock (above reorder point)
            SUM(CASE
                WHEN COALESCE(stock_totals.total_qty, 0) > p.reorder_point
                THEN 1 ELSE 0
            END) as in_stock,
            
            -- Low stock (at or below reorder point, but > 0)
            SUM(CASE
                WHEN COALESCE(stock_totals.total_qty, 0) <= p.reorder_point
                AND COALESCE(stock_totals.total_qty, 0) > 0
                THEN 1 ELSE 0
            END) as low_stock,
            
            -- Out of stock (zero quantity)
            SUM(CASE
                WHEN COALESCE(stock_totals.total_qty, 0) = 0
                THEN 1 ELSE 0
            END) as out_of_stock
        
        FROM products p
        LEFT JOIN (
            SELECT product_id, SUM(quantity) as total_qty
            FROM inventory_stock
            GROUP BY product_id
        ) stock_totals ON p.id = stock_totals.product_id
        WHERE p.status = 'active'
    `;

    db.query(query, (err, results) => {
        if (err) {
            console.error('Chart query error:', err);
            return res.status(500).json({ error: 'Failed to fetch chart data' });
        }

        const data = results[0];

        res.json({
            labels: ['In Stock', 'Low Stock', 'Out of Stock'], 
            values: [
                parseInt(data.in_stock) || 0, 
                parseInt(data.low_stock) || 0, 
                parseInt(data.out_of_stock) || 0
            ], 
            colors: ['#10b981', '#f59e0b', '#ef4444']
        });
    });
});

/* ============================================
   GET /api/inventory/chart/stock-by-category
   Get data for stock by category bar chart
   ============================================ */

router.get('/chart/stock-by-category', (req, res) => {

    const query = `
        SELECT
            c.name as category,
            c.icon,
            COALESCE(SUM(s.quantity), 0) as total_quantity,
            COUNT(DISTINCT p.id) as product_count
        FROM inventory_categories c
        LEFT JOIN products p ON c.id = p.category_id AND p.status = 'active'
        LEFT JOIN inventory_stock s ON p.id = s.product_id
        GROUP BY c.id, c.name, c.icon
        ORDER BY total_quantity DESC
    `;

    db.query(query, (err, results) => {
        if (err) {
            console.error('Chart query error:', err);
            return res.status(500).json({ error: 'Failed to fetch chart data' });
        }

        res.json({
            labels: results.map(r => r.category), 
            values: results.map(r => parseInt(r.total_quantity) || 0), 
            product_counts: results.map(r => parseInt(r.product_count) || 0)
        });
    });
});

/* ============================================
   POST /api/inventory/reorder
   Create a reorder request
   ============================================ */

router.post('/reorders', (req, res) => {

    const {
        product_id, 
        location_id, 
        quantity, 
        notes, 
        requested_by
    } = req.body;

    // Validate required fields
    if (!product_id || !location_id || !quantity) {
        return res.status(400).json({
            error: 'Missing required fields', 
            required: ['product_id', 'location_id', 'quantity']
        });
    }

    // STEP 1: Generate request number (RO-0001)
    const getMaxNumQuery = `
        SELECT MAX(CAST(SUBSTRING(request_number, 4) AS UNSIGNED)) as max_num
        FROM reorder_requests
    `;

    db.query(getMaxNumQuery, (err, results) => {
        if (err) {
            console.error('Error generating request number:', err);
            return res.status(500).json({ error: 'Database error' });
        }

        const nextNum = (results[0].max_num || 0) + 1;
        const request_number = `RO-${String(nextNum).padStart(4, '0')}`;

        // STEP 2: Get product cost price for total calculation
        db.query('SELECT cost_price FROM products WHERE id = ?', [product_id], (err, productResults) => {
            if (err || productResults.length === 0) {
                console.error('Product lookup error:', err);
                return res.status(500).json({ error: 'Failed to lookup product' });
            }

            const unit_cost = productResults[0].cost_price;
            const total_cost = unit_cost * quantity;

            // STEP 3: Insert reorder request
            const insertQuery = `
                INSERT INTO reorder_requests (
                    request_number, product_id, location_id,
                    quantity_requested, unit_cost, total_cost,
                    notes, requested_by
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `;

            const values = [
                request_number, 
                product_id, 
                location_id, 
                quantity, 
                unit_cost, 
                total_cost, 
                notes || null, 
                requested_by || 'System'
            ];

            db.query(insertQuery, values, (err, result) => {
                if (err) {
                    console.error('Insert error:', err);
                    return res.status(500).json({ error: 'Failed to create reorder request' });
                }

                // Fetch the created request with product and location names
                const fetchQuery = `
                    SELECT
                        r.*,
                        p.name as product_name,
                        p.sku as product_sku,
                        l.name as location_name
                    FROM reorder_requests r
                    JOIN products p ON r.product_id = p.id
                    JOIN locations l ON r.location_id = l.id
                    WHERE r.id = ?
                `;

                db.query(fetchQuery, [result.insertId], (err, request) => {
                    if (err) {
                        console.error('Fetch error:', err);
                        return res.status(500).json({ error: 'Request created but failed to fetch' });
                    }

                    res.status(201).json({
                        success: true, 
                        request_number: request_number, 
                        message: 'Reorder request created successfully', 
                        request: request[0]
                    });
                });
            });
        });
    });
});

/* ============================================
   GET /api/inventory/reorders/stats
   Get KPI statistics for reorder requests page
   ============================================ */

router.get('/reorders/stats', (req, res) => {
    // Query to calculate all stats in one database call
    // More efficient than multiple separate queries
    const statsQuery = `
        SELECT
            -- Total pending requests (needs admin action)
            (SELECT COUNT(*) FROM reorder_requests WHERE status = 'pending') as pending_count,
            
            -- Total pending value (sum of all pending request costs)
            (SELECT COALESCE(SUM(total_cost), 0) FROM reorder_requests WHERE status = 'pending') as pending_value,
            
            -- Requests completed this week (approved or received in last 7 days)
            (SELECT COUNT(*)
             FROM reorder_requests
             WHERE status IN ('approved', 'received')
             AND requested_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)) as completed_this_week,
             
            -- Total requests count (all time)
            (SELECT COUNT(*) FROM reorder_requests) as total_requests
        `;

        db.query(statsQuery, (err, results) => {
            if (err) {
                console.error('Reorder stats query error:', error);
                return res.status(500).json({ error: 'Failed to fetch reorder stats' });
            }

            const stats = results[0];

            // Format currency values to 2 decimal places
            stats.pending_value = parseFloat(stats.pending_value) || 0;

            res.json(stats);
        });
});

/* ============================================
   GET /api/inventory/reorders/chart/status-breakdown
   Get data for status breakdown doughnut chart
   Shows distribution of pending/approved/received/rejected
   ============================================ */

router.get('/reorders/chart/status-breakdown', (req, res) => {

    const query = `
        SELECT
            status,
            COUNT(*) as count
        FROM reorder_requests
        GROUP BY status
        ORDER BY status
    `;

    db.query(query, (err, results) => {
        if (err) {
            console.error('Chart query error:', err);
            return res.status(500).json({ error: 'Failed to fetch chart data' });
        }

        // Transform database results into Chart.js format
        // Need separate arrays for labels, values, and colors
        const labels = [];
        const values = [];
        const colors = [];

        // Color mapping for each status
        const statusColors = {
            'pending': '#f59e0b',       // Yellow/Orange
            'approved': '#10b981',      // Green
            'received': '#3b82f6',      // Blue
            'rejected': '#ef4444'       // Red
        };

        results.forEach(row => {
            // Capitalize first letter for display
            const label = row.status.charAt(0).toUpperCase() + row.status.slice(1);
            labels.push(label);
            values.push(parseInt(row.count));
            colors.push(statusColors[row.status] || '#6b7280');
        });

        res.json({
            labels: labels, 
            values: values, 
            colors: colors
        });
    });
});

/* ============================================
   GET /api/inventory/reorders/chart/trends
   Get data for requests over time line chart
   Shows last 7 days of request activity
   ============================================ */

router.get('/reorders/chart/trends', (req, res) => {
    // Generate last 7 days of data
    const query = `
        SELECT
            DATE(requested_at) as date,
            COUNT(*) as count
        FROM reorder_requests
        WHERE requested_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
        GROUP BY DATE(requested_at)
        ORDER BY date ASC
    `;

    db.query(query, (err, results) => {
        if (err) {
            console.error('Trends chart query error:', err);
            return res.status(500).json({ error: 'Failed to fetch trend data' });
        }

        // Format dates for display (e.g., "Jan 20")
        const labels = results.map(row => {
            const date = new Date(row.date);
            return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        });

        const values = results.map(row => parseInt(row.count));

        res.json({
            labels: labels, 
            values: values
        });
    });
});

/* ============================================
   GET /api/inventory/reorders
   Get all reorder requests with filters
   Query params: status, location_id, date_from, date_to
   ============================================ */

router.get('/reorders', (req, res) => {
    // Extract filter parameters from query string
    const {
        status, 
        location_id, 
        date_from, 
        date_to
    } = req.query;

    // Base query joins all related tables to get full context
    let query = `
        SELECT
            r.*,
            p.name as product_name,
            p.sku as product_sku,
            c.name as category_name,
            l.name as location_name
        FROM reorder_requests r
        JOIN products p ON r.product_id = p.id
        JOIN inventory_categories c ON p.category_id = c.id
        JOIN locations l ON r.location_id = l.id
        WHERE 1=1
    `;

    const params = [];

    // Apply status filter if provided
    if (status && status !== 'all') {
        query += ` AND r.status = ?`;
        params.push(status);
    }

    // Apply location filter if provided
    if (location_id && location_id !== 'all') {
        query += ` AND r.location_id = ?`;
        params.push(location_id);
    }

    // Apply date range filters if provided
    if (date_from) {
        query += ` AND DATE(r.requested_at) >= ?`;
        params.push(date_from);
    }

    if (date_to) {
        query += ` AND DATE(r.requested_at) <= ?`;
        params.push(date_to);
    }

    // Order by most recent first, then by status priority
    // Pending requests should appear first
    query += ` ORDER BY
        CASE r.status
            WHEN 'pending' THEN 1
            WHEN 'approved' THEN 2
            WHEN 'received' THEN 3
            WHEN 'rejected' THEN 4
        END,
        r.requested_at DESC
    `;

    db.query(query, params, (err, results) => {
        if (err) {
            console.error('Reorders query error:', err);
            return res.status(500).json({ error: 'Failed to fetch reorder requests' });
        }

        res.json({ requests: results });
    });
});

/* ============================================
   GET /api/inventory/reorders/:id
   Get single reorder request with full details
   ============================================ */

router.get('/reorders/:id', (req, res) => {
    const requestId = req.params.id;

    const query = `
        SELECT
            r.*,
            p.name as product_name,
            p.sku as product_sku,
            p.unit_price,
            c.name as category_name,
            l.name as location_name
        FROM reorder_requests r
        JOIN products p ON r.product_id = p.id
        JOIN inventory_categories c ON p.category_id = c.id
        JOIN locations l ON r.location_id = l.id
        WHERE r.id = ?
    `;

    db.query(query, [requestId], (err, results) => {
        if (err) {
            console.error('Reorder query error:', err);
            return res.status(500).json({ error: 'Failed to fetch reorder request' });
        }

        if (results.length === 0) {
            return res.status(404).json({ error: 'Reorder request not found' });
        }

        res.json(results[0]);
    });
});

/* ============================================
   PUT /api/inventory/reorders/:id/approve
   Approve a pending reorder request
   Sets status to 'approved' and records who approved it
   ============================================ */

router.put('/reorders/:id/approve', (req, res) => {
    const requestId = req.params.id;
    const { approved_by } = req.body;

    // Validate that approved_by is provided
    if (!approved_by) {
        return res.status(400).json({ error: 'approved_by is required' });
    }

    // First check if request exists and is pending
    const checkQuery = `SELECT status FROM reorder_requests WHERE id = ?`;

    db.query(checkQuery, [requestId], (err, results) => {
        if (err) {
            console.error('Check query error:', err);
            return res.status(500).json({ error: 'Database error' });
        }

        if (results.length === 0) {
            return res.status(404).json({ error: 'Reorder request not found' });
        }

        if (results[0].status !== 'pending') {
            return res.status(400).json({ error: 'Only pending requests can be approved' });
        }

        // Update the request status
        const updateQuery = `
            UPDATE reorder_requests
            SET status = 'approved',
                approved_by = ?,
                approved_at = NOW()
            WHERE id = ?
        `;

        db.query(updateQuery, [approved_by, requestId], (err, result) => {
            if (err) {
                console.error('Update error:', err);
                return res.status(500).json({ error: 'Failed to approve request' });
            }

            res.json({
                success: true, 
                message: 'Reorder request approved successfully'
            });
        });
    });
});

/* ============================================
   PUT /api/inventory/reorders/:id/reject
   Reject a pending reorder request
   ============================================ */

router.put('/reorders/:id/reject', (req, res) => {
    const requestId = req.params.id;
    const {
        rejected_by, 
        rejection_reason
    } = req.body;

    // First check if request exists and is pending
    const checkQuery = `SELECT status FROM reorder_requests WHERE id = ?`;

    db.query(checkQuery, [requestId], (err, results) => {
        if (err) {
            console.error('Check query error:', err);
            return res.status(500).json({ error: 'Database error' });
        }

        if (results.length === 0) {
            return res.status(404).json({ error: 'Reorder request not found' });
        }

        if (results[0].status !== 'pending') {
            return res.status(400).json({ error: 'Only pending requests can be rejected' });
        }

        // Update the request status
        // Append rejection reason to notes field
        const updateQuery = `
            UPDATE reorder_requests
            SET status = 'rejected',
                notes = CONCAT(COALESCE(notes, ''), '\nRejected by: ', ?, '\nReason: ', ?)
            WHERE id = ?
        `;

        db.query(updateQuery, [rejected_by || 'Admin', rejection_reason || 'No reason provided', requestId], (err, result) => {
            if (err) {
                console.error('Update error:', err);
                return res.status(500).json({ error: 'Failed to reject request' });
            }

            res.json({
                success: true, 
                message: 'Reorder request rejected'
            });
        });
    });
});

/* ============================================
   PUT /api/inventory/reorders/:id/receive
   Mark an approved request as received
   Updates inventory stock when items arrive
   ============================================ */

router.put('/reorders/:id/receive', (req, res) => {
    const requestId = req.params.id;
    const { quantity_received } = req.body;

    // Validate quantity
    if (!quantity_received || quantity_received <= 0) {
        return res.status(400).json({ error: 'Valid quantity_received is required '});
    }

    // Get request details first
    const getRequestQuery = `
        SELECT product_id, location_id, quantity_requested, status
        FROM reorder_requests
        WHERE id = ?
    `;

    db.query(getRequestQuery, [requestId], (err, results) => {
        if (err) {
            console.error('Get request error:', err);
            return res.status(500).json({ error: 'Database error' });
        }

        if (results.length === 0) {
            return res.status(404).json({ error: 'Reorder request not found' });
        }

        const request = results[0];

        // Only approved requests can be marked as received
        if (request.status !== 'approved') {
            return res.status(400).json({ error: 'Only approved requests can be marked as received' });
        }

        // Start transaction to update both reorder_requests and inventory_stock
        db.beginTransaction((err) => {
            if (err) {
                console.error('Transaction error:', err);
                return res.status(500).json({ error: 'Failed to start transaction' });
            }

            // STEP 1: Update reorder request status
            const updateRequestQuery = `
                UPDATE reorder_requests
                SET status = 'received',
                    quantity_received = ?
                WHERE id = ?
            `;

            db.query(updateRequestQuery, [quantity_received, requestId], (err) => {
                if (err) {
                    return db.rollback(() => {
                        console.error('Update request error:', err);
                        res.status(500).json({ error: 'Failed to update request' });
                    });
                }

                // STEP 2: Update inventory stock
                const updateStockQuery = `
                    UPDATE inventory_stock
                    SET quantity = quantity + ?,
                        last_restocked = NOW()
                    WHERE product_id = ? AND location_id = ?
                `;

                db.query(updateStockQuery, [quantity_received, request.product_id, request.location_id], (err) => {
                    if (err) {
                        return db.rollback(() => {
                            console.error('Update stock error:', err);
                            res.status(500).json({ error: 'Failed to update stock' });
                        });
                    }

                    // Commit transaction
                    db.commit((err) => {
                        if (err) {
                            return db.rollback(() => {
                                console.error('Commit error:', err);
                                res.status(500).json({ error: 'Failed to commit changes'});
                            });
                        }

                        res.json({
                            success: true, 
                            message: 'Request marked as received and stock updated'
                        });
                    });
                });
            });
        });
    });
});

/* ============================================
   VENDORS MANAGEMENT ROUTES
   ============================================ */


/* ============================================
   GET /api/inventory/vendors/stats
   GET KPI statistics for vendors page
   ============================================ */

router.get('/vendors/stats', (req, res) => {
    // Need to calculate multiple stats in one query for efficiency
    const statsQuery = `
        SELECT
            -- Total active vendors (excludes inactive ones)
            (SELECT COUNT(*)
             FROM vendors
             WHERE status = 'Active') as total_vendors,
            
            -- Total spent this month across all vendors
            -- COALESCE returns 0 if no orders exist (prevents NULL)
            (SELECT COALESCE(SUM(rr.total_cost), 0)
             FROM reorder_requests rr
             WHERE rr.vendor_id IS NOT NULL
             AND MONTH(rr.requested_at) = MONTH(CURRENT_DATE())
             AND YEAR(rr.requested_at) = YEAR(CURRENT_DATE())) as total_spent_month,
             
            -- Count of pending orders (orders awaiting fulfillment)
            (SELECT COUNT(*)
             FROM reorder_requests
             WHERE vendor_id IS NOT NULL
             AND status IN ('pending', 'approved')) as active_orders,
             
            -- Find top vendor by total spending (lifetime)
            -- Uses a subquery to calculate spending per vendor, then picks the max
            (SELECT v.vendor_name
             FROM vendors v
             LEFT JOIN reorder_requests rr ON v.id = rr.vendor_id
             WHERE v.status = 'Active'
             GROUP BY v.id, v.vendor_name
             ORDER BY COALESCE(SUM(rr.total_cost), 0) DESC
             LIMIT 1) as top_vendor
    `;

    db.query(statsQuery, (err, results) => {
        if (err) {
            console.error('Vendors stats query error:', err);
            return res.status(500).json({ error: 'Failed to fetch vendor stats' });
        }

        const stats = results[0];

        // Format currency values to 2 decimal places
        stats.total_spent_month = parseFloat(stats.total_spent_month) || 0;

        res.json(stats);
    });
});

/* ============================================
   GET /api/inventory/vendors/chart/spending
   Get data for spending by vendor bar chart
   Shows top 5 vendors by total spending
   ============================================ */

router.get('/vendors/chart/spending', (req, res) => {
    // Join vendors with reorder_requests to calculate total spending
    // GROUP BY vendor to sum all their orders
    // ORDER BY total spending descending to get top spenders first
    // LIMIT 5 to show only top 5 vendors (keeps chart readable)
    const query = `
        SELECT
            v.vendor_name as label,
            COALESCE(SUM(rr.total_cost), 0) as value
        FROM vendors v
        LEFT JOIN reorder_requests rr ON v.id = rr.vendor_id
        WHERE v.status = 'Active'
        GROUP BY v.id, v.vendor_name
        ORDER BY value DESC
        LIMIT 5
    `;

    db.query(query, (err, results) => {
        if (err) {
            console.error('Spending chart query error:', err);
            return res.status(500).json({ error: 'Failed to fetch spending data' });
        }
    

        // Transform database results into chart.js format
        // Chart.js expects separate arrays for labels and values
        const labels = results.map(row => row.label);
        const values = results.map(row => parseFloat(row.value));

        res.json({
            labels: labels, 
            values: values
        });
    });
});

/* ============================================
   GET /api/inventory/vendors/chart/trends
   Get data for order volume trends line chart
   Shows number of orders per month for last 6 months
   ============================================ */

router.get('/vendors/chart/trends', (req, res) => {
    // Count orders grouped by month
    // DATE_FORMAT extracts month name from date (e.g., "Jan", "Feb")
    // Last 6 months using DATE_SUB and INTERVAL
    const query = `
        SELECT
            DATE_FORMAT(requested_at, '%b') as month,
            COUNT(*) as count
        FROM reorder_requests
        WHERE vendor_id IS NOT NULL
        AND requested_at >= DATE_SUB(CURRENT_DATE(), INTERVAL 6 MONTH)
        GROUP BY YEAR(requested_at), MONTH(requested_at), DATE_FORMAT(requested_at, '%b')
        ORDER BY YEAR(requested_at), MONTH(requested_at)
    `;

    db.query(query, (err, results) => {
        if (err) {
            console.error('Trends chart query error:', err);
            return res.status(500).json({ error: 'Failed to fetch trend data' });
        }
    

        // Format for Chart.js
        const labels = results.map(row => row.month);
        const values = results.map(row => parseInt(row.count));

        res.json({
            labels: labels, 
            values: values
        });
    });
});

/* ============================================
   GET /api/inventory/vendors
   Get all vendors with optional filters
   Query params: category, status, search
   ============================================ */

router.get('/vendors', (req, res) => {
    // Extract filter parameters from query string
    const {
        category, 
        status, 
        search
    } = req.query;

    // Base query: Get vendors with their order statistics
    // LEFT JOIN ensures vendors with no orders still appear
    // COUNT and SUM are aggregated per vendor using GROUP BY
    let query = `
        SELECT
            v.*,
            COUNT(rr.id) as total_orders,
            COALESCE(SUM(rr.total_cost), 0) as total_spent,
            MAX(rr.requested_at) as last_order_date
        FROM vendors v
        LEFT JOIN reorder_requests rr on v.id = rr.vendor_id
        WHERE 1=1
    `;

    const params = [];

    // Apply category filter if provided
    // Only filter if user selected a specific category (not "all")
    if (category && category !== 'all') {
        query += ` AND v.category = ?`;
        params.push(category);
    }

    // Apply status filter if provided
    if (status && status !== 'all') {
        query += ` AND v.status = ?`;
        params.push(status);
    }

    // Apply search filter if provided
    // LIKE with % wildcards allows partial matching
    // Search across vendor_name, contact_person, and email
    if (search) {
        query += ` AND (
            v.vendor_name LIKE ? OR
            v.contact_person LIKE ? OR
            v.email LIKE ?
        )`;
        
        const searchPattern = `%${search}%`;
        params.push(searchPattern, searchPattern, searchPattern);
    }

    // GROUP BY is required because we're using COUNT and SUM
    // All non-aggregated columns must be in GROUP BY
    query += ` GROUP BY v.id`;

    // Order by vendor name alphabetically for consistency
    query += ` ORDER BY v.vendor_name ASC`;

    db.query(query, params, (err, results) => {
        if (err) {
            console.error('Vendors query error:', err);
            return res.status(500).json({ error: 'Failed to fetch vendors' });
        }

        // Format currency values before sending
        results.forEach(vendor => {
            vendor.total_spent = parseFloat(vendor.total_spent) || 0;
        });

        res.json({ vendors: results });
    });
});

/* ============================================
   GET /api/inventory/vendors/:id
   Get single vendor with detailed information
   ============================================ */

router.get('/vendors/:id', (req, res) => {
    const vendorId = req.params.id;

    // Fetch vendor with aggregated order statisitcs
    const query = `
        SELECT
            v.*,
            COUNT(rr.id) as total_orders,
            COALESCE(SUM(rr.total_cost), 0) as total_spent,
            COALESCE(AVG(rr.total_cost), 0) as avg_order_value,
            MAX(rr.requested_at) as last_order_date
        FROM vendors v
        LEFT JOIN reorder_requests rr ON v.id = rr.vendor_id
        WHERE v.id = ?
        GROUP BY v.id
    `;

    db.query(query, [vendorId], (err, results) => {
        if (err) {
            console.error('Vendor query error:', err);
            return res.status(500).json({ error: 'Failed to fetch vendor' });
        }

        // Check if vendor exsits
        if (results.length === 0) {
            return res.status(404).json({ error: 'Vendor not found' });
        }

        const vendor = results[0];

        // Format currency values
        vendor.total_spent = parseFloat(vendor.total_spent) || 0;
        vendor.avg_order_value = parseFloat(vendor.avg_order_value) || 0;

        res.json(vendor);
    });
});

/* ============================================
   GET /api/inventory/vendors/:id/orders
   Get order history for a specific vendor
   Used in "View Details" modal to show past orders
   ============================================ */

router.get('/vendors/:id/orders', (req, res) => {
    const vendorId = req.params.id;

    // Fetch all reorder requests for this vendor
    // JOIN with products and locations to get readable names
    const query = `
        SELECT
            rr.id,
            rr.request_number,
            rr.requested_at,
            rr.quantity_requested,
            rr.total_cost,
            rr.status,
            p.name as product_name,
            p.sku as product_sku,
            l.name as location_name
        FROM reorder_requests rr
        JOIN products p ON rr.product_id = p.id
        JOIN locations l ON rr.location_id = l.id
        WHERE rr.vendor_id = ?
        ORDER BY rr.requested_at DESC
    `;

    db.query(query, [vendorId], (err, results) => {
        if (err) {
            console.error('Vendor ordes query error:', err);
            return res.status(500).json({ error: 'Failed to fetch vendor orders' });
        }

        // Format currency valeus in each order
        results.forEach(order => {
            order.total_cost = parseFloat(order.total_cost) || 0;
        });

        res.json({ orders: results });
    });
});

/* ============================================
   POST /api/inventory/vendors
   Create a new vendor
   ============================================ */

router.post('/vendors', (req, res) => {
    // Extract vendor data from request body
    const {
        vendor_name, 
        category, 
        contact_person, 
        email, 
        phone, 
        address_street, 
        address_city, 
        address_province, 
        address_postal_code, 
        payment_terms, 
        tax_id, 
        notes, 
        status
    } = req.body;

    // Validate required fields
    // Vendor_name is the only truly required field
    if (!vendor_name) {
        return res.status(400).json({
            error: 'Missing required field', 
            required: ['vendor_name']
        });
    }

    // Insert new vendor into database
    const insertQuery = `
        INSERT INTO vendors (
            vendor_name, category, contact_person, email, phone,
            address_street, address_city, address_province, address_postal_code,
            payment_terms, tax_id, notes, status
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ? , ?, ?)
    `;

    const values = [
        vendor_name, 
        category || 'Supplies',             // Default to 'Supplies' if not provided
        contact_person || null, 
        email || null, 
        phone || null, 
        address_street || null, 
        address_city || null, 
        address_province || null, 
        address_postal_code || null, 
        payment_terms || 'Net 30',          // Default payment terms
        tax_id || null, 
        notes || null, 
        status || 'Active'                  // Default to Active
    ];

    db.query(insertQuery, values, (err, result) => {
        if (err) {
            console.error('Insert vendor error:', err);
            return res.status(500).json({ error: 'Failed to create vendor' });
        }

        // Fetch the newly created vendor to return complete data
        // This ensures frontend gets the full vendor_object with defaults applied
        const fetchQuery = `SELECT * FROM vendors WHERE id = ?`;

        db.query(fetchQuery, [result.insertId], (err, vendor) => {
            if (err) {
                console.error('Fetch vendor error:', err);
                return res.status(500).json({ error: 'Vendor created but failed to fetch' });
            }

            res.status(201).json({
                success: true, 
                message: 'Vendor created successfully', 
                vendor: vendor[0]
            });
        });
    });
});

/* ============================================
   PUT /api/inventory/vendors/:id
   Update an existing vendor
   ============================================ */

router.put('/vendors/:id', (req, res) => {
    const vendorId = req.params.id;

    const {
        vendor_name, 
        category, 
        contact_person, 
        email, 
        phone, 
        address_street, 
        address_city, 
        address_province, 
        address_postal_code, 
        payment_terms, 
        tax_id, 
        notes, 
        status
    } = req.body;

    // Validate vendor name (required field)
    if (!vendor_name) {
        return res.status(400).json({ error: 'Vendor name is required' });
    }

    // Check if vendor exists before updating
    const checkQuery = `SELECT id FROM vendors WHERE id = ?`;

    db.query(checkQuery, [vendorId], (err, results) => {
        if (err) {
            console.error('Check vendor error:', err);
            return res.status(500).json({ error: 'Database error' });
        }

        if (results.length === 0) {
            return res.status(404).json({ error: 'Vendor not found' });
        }

        // Update vendor
        // updated_at is automatically updated by MySQL (ON UPDATE CURRENT_TIMESTAMP)
        const updateQuery = `
            UPDATE vendors
            SET vendor_name = ?,
                category = ?,
                contact_person = ?,
                email = ?,
                phone = ?,
                address_street = ?,
                address_city = ?,
                address_province = ?,
                address_postal_code = ?,
                payment_terms = ?,
                tax_id = ?,
                notes = ?,
                status = ?
            WHERE id = ?
        `;

        const values = [
            vendor_name, 
            category, 
            contact_person, 
            email, 
            phone, 
            address_street, 
            address_city, 
            address_province, 
            address_postal_code, 
            payment_terms, 
            tax_id, 
            notes, 
            status, 
            vendorId
        ];

        db.query(updateQuery, values, (err, result) => {
            if (err) {
                console.error('Update vendor error:', err);
                return res.status(500).json({ error: 'Failed to update vendor' });
            }

            // Fetch updated vendor to return complete data
            const fetchQuery = `SELECT * FROM vendors WHERE id = ?`;
            db.query(fetchQuery, [vendorId], (err, vendor) => {
                if (err) {
                console.error('Fetch vendor error:', err);
                return res.status(500).json({ error: 'Vendor updated by failed to fetch' });
            }

            res.json({
                success: true, 
                message: 'Vendor updated successfully', 
                vendor: vendor[0]
            });
        });
    });
});

/* ============================================
   DELETE /api/inventory/vendors/:id
   Soft delete a vendor (set status to Inactive)
   We use soft delete instead of hard delete to preserve order history
   ============================================ */

router.delete('/vendors/:id', (req, res) => {
    const vendorId = req.params.id;

    // Check if vendor exists
    const checkQuery = `SELECT id, vendor_name FROM vendors WHERE id = ?`;

    db.query(checkQuery, [vendorId], (err, results) => {
        if (err) {
            console.error('Check vendor error:', err);
            return res.status(500).json({ error: 'Database error' });
        }

        if (results.length === 0) {
            return res.status(404).json({ error: 'Vendor not found' });
        }

        // Soft delete: Set status to 'Inactive' instead of deleting row
        // This preserves historical data and foreign key relationships
        // If this vendor has past orders, those records remain intact
        const softDeleteQuery = `
            UPDATE vendors
            SET status = 'Inactive'
            WHERE id = ?
        `;

        db.query(softDeleteQuery, [vendorId], (err, result) => {
            if (err) {
                console.error('Delete vendor error:', err);
                return res.status(500).json({ error: 'Failed to delete vendor' });
            }

            res.json({
                success: true, 
                message: 'Vendor deactivated successfully'
            });
        });
    });
});

});

// Export router
module.exports = router;