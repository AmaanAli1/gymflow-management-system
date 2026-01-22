/* ============================================ 
   INVENTORY.JS
   Handles Stock Overview page functionality
   ============================================ */

document.addEventListener('DOMContentLoaded', async () => {

    /* ============================================ 
       API CONFIGURATION
       ============================================ */

    const API_BASE_URL = 'http://127.0.0.1:5000/api';

    /* ============================================ 
       GLOBAL VARIABLES
       Store data for filtering and sorting
       ============================================ */

    let allProducts = [];       // All products from API
    let allCategories = [];     // All categories for dropdowns

    /* ============================================ 
       CHART INSTANCES
       Store chart objects so we can update them later
       ============================================ */

    let stockHealthChart = null;
    let stockByCategory = null;

    /* ============================================ 
       INITIALIZATION
       Run when page loads
       ============================================ */

    // Fetch all data and set up the page
    await fetchStats();
    await fetchCategories();
    await fetchProducts();
    await initCharts();

    // Populate filter dropdowns
    populateCategoryFilter();
    populateLocationFilter();

    // Set up event listeners
    setupEventListeners();

    console.log('Inventory page initialized');

    /* ============================================ 
       FETCH KPI STATS
       Get numbers for the 4 KPI cards
       ============================================ */

    async function fetchStats() {
        try {
            const response = await fetch(`${API_BASE_URL}/inventory/stats`);

            if (!response.ok) {
                throw new Error('Failed to fetch stats');
            }

            const stats = await response.json();

            // Update KPI cards with data
            // data-stat attributes match what we set in HTML
            document.querySelector('[data-stat="totalProducts"]').textContent = stats.total_products || 0;
            document.querySelector('[data-stat="stockValue"]').textContent = formatCurrency(stats.total_stock_value);
            document.querySelector('[data-stat="lowStock"]').textContent = stats.low_stock_count || 0;
            document.querySelector('[data-stat="outOfStock"]').textContent = stats.out_of_stock_count || 0;

        } catch (error) {
            console.error('Failed to fetch stats:', error);

            // Show fallback values on error
            document.querySelector('[data-stat="totalProducts"]').textContent = '---';
            document.querySelector('[data-stat="stockValue"]').textContent = '---';
            document.querySelector('[data-stat="lowStock"]').textContent = '---';
            document.querySelector('[data-stat="outOfStock"]').textContent = '---';
        }
    }

    /* ============================================
       FETCH CATEGORIES
       Get categories for filter dropdown
       ============================================ */

    async function fetchCategories() {
        try {
            const response = await fetch(`${API_BASE_URL}/inventory/categories`);

            if (!response.ok) {
                throw new Error('Failed to fetch categories');
            }

            allCategories = await response.json();

        } catch (error) {
            console.error('Failed to fetch categories:', error);
            allCategories = [];
        }
    }

    /* ============================================
       FETCH PRODUCTS
       Get all products and display them
       ============================================ */

    async function fetchProducts() {
        try {
            // Show loading state
            const grid = document.getElementById('productsGrid');
            grid.innerHTML = `
                <div class="products-loading">
                    <i class="fa-solid fa-spinner fa-spin"></i>
                    <p>Loading products...</p>
                </div>
            `;

            const response = await fetch(`${API_BASE_URL}/inventory/products`);

            if (!response.ok) {
                throw new Error('Failed to fetch products');
            }

            const data = await response.json();
            allProducts = data.products || [];

            // Display products
            renderProducts(allProducts);

        } catch (error) {
            console.error('Failed to fetch products:', error);

            // Show error state
            const grid = document.getElementById('productsGrid');
            grid.innerHTML = `
                <div class="products-empty">
                    <i class="fa-solid fa-exclamation-triangle"></i>
                    <p>Failed to load products. Please refresh the page.</p>
                </div>
            `;
        }
    }

    /* ============================================
       RENDER PRODUCTS
       Display product cards in the grid
       ============================================ */

    function renderProducts(products) {
        const grid = document.getElementById('productsGrid');

        // Handle empty state
        if (products.length === 0) {
            grid.innerHTML = `
                <div class="products-empty">
                    <i class="fa-solid fa-box-open"></i>
                    <p>No products found</p>
                </div>
            `;

            return;
        }

        // Build HTML for each product card
        const cardsHTML = products.map(product => {
            // Calculate stock status
            const stockStatus = getStockStatus(product.total_quantity, product.reorder_point);

            // Calculate progress bar percentage
            // Cap at 100% so bar doesn't overflow
            const progressPercent = Math.min((product.total_quantity / (product.reorder_point * 2)) * 100, 100);

            // Get progress bar color class
            const progressClass = getProgressClass(stockStatus);

            // Build location breakdown HTML
            const locationHTML = buildLocationHTML(product.stock_by_location);

            return `
                <div class="product-card" data-product-id="${product.id}">
                    <!-- Header: Category + Status -->
                    <div class="product-card-header">
                        <span class="category-badge">
                            <i class="fa-solid ${product.category_icon || 'fa-box'}"></i>
                            ${product.category_name}
                        </span>
                        <span class="stock-status ${stockStatus.class}">${stockStatus.label}</span>
                    </div>
                    
                    <!-- Product Info -->
                    <div class="product-card-body">
                        <h3 class="product-name">${product.name}</h3>
                        <p class="product-sku">SKU: ${product.sku}</p>
                        
                        <!-- Stock Level Progress Bar -->
                        <div class="stock-level">
                            <div class="stock-level-header">
                                <span class="stock-level-label">Stock Level</span>
                                <span class="stock-level-value">${product.total_quantity} units</span>
                            </div>
                            <div class="stock-progress">
                                <div class="stock-progress-bar ${progressClass}"
                                    style="width: ${progressPercent}%"></div>
                                </div>
                            </div>
                            
                            <!-- Location Breakdown -->
                            <div class="location-breakdown">
                                ${locationHTML}
                            </div>
                            
                            <!-- Price -->
                            <div class="product-price">
                                <span class="price-label">Selling Price</span>
                                <span class="price-value">${formatCurrency(product.unit_price)}</span>
                            </div>
                        </div>
                        
                        <!-- Actions -->
                        <div class="product-card-actions">
                            <button class="btn ghost sm edit-product-btn" data-product-id="${product.id}">
                                <i class="fa-solid fa-pen"></i>
                                Edit
                            </button>
                            <button class="btn reorder sm reorder-btn" data-product-id="${product.id}">
                                <i class="fa-solid fa-rotate"></i>
                                Reorder
                            </button>
                        </div>
                    </div>
                `;

        }).join('');

        grid.innerHTML = cardsHTML;
    }

    /* ============================================
       HELPER: Get Stock Status
       Returns status label and CSS class
       ============================================ */

    function getStockStatus(quantity, reorderPoint) {
        if (quantity === 0) {
            return { label: 'Out of Stock', class: 'out-of-stock' };
        } else if (quantity <= reorderPoint) {
            return { label: 'Low Stock', class: 'low-stock' };
        } else {
            return { label: 'In Stock', class: 'in-stock'};
        }
    }

    /* ============================================
       HELPER: Get Progress Bar Class
       Returns CSS class for progress bar color
       ============================================ */

    function getProgressClass(stockStatus) {
        if (stockStatus.class === 'out-of-stock') {
            return 'danger';
        } else if (stockStatus.class === 'low-stock') {
            return 'warning';
        } else {
            return 'good';
        }
    }

    /* ============================================
       HELPER: Build Location HTML
       Creates the location breakdown section
       ============================================ */

    function buildLocationHTML(stockByLocation) {
        if (!stockByLocation || stockByLocation.length === 0) {
            return '<p class="no-locations">No stock data</p>';
        }

        return stockByLocation.map(loc => `
            <div class="location-stock">
                <p class="location-name">${loc.location_name}</p>
                <p class="location-qty">${loc.quantity}</p>
            </div>
        `).join('');
    }

    /* ============================================
       HELPER: Format Currency
       Converts number to $XX.XX format
       ============================================ */

    function formatCurrency(amount) {
        const num = parseFloat(amount) || 0;
        return '$' + num.toLocaleString('en-US', {
            minimumFractionDigits: 2, 
            minimumFractionDigits: 2
        });
    }

    /* ============================================
       INITIALIZE CHARTS
       Set up Chart.js charts
       ============================================ */

    async function initCharts() {
        await initStockHealthChart();
        await initStockByCategoryChart();
    }

    /* ============================================
       STOCK HEALTH DOUGHNUT CHART
       Shows in stock / low / out of stock
       ============================================ */

    async function initStockHealthChart() {
        try {
            // Fetch chart data from API
            const response = await fetch(`${API_BASE_URL}/inventory/chart/stock-health`);
            const data = await response.json();

            // Get the canvas element
            const ctx = document.getElementById('stockHealthChart').getContext('2d');

            // Create the chart
            stockHealthChart = new Chart(ctx, {
                type: 'doughnut', 
                data: {
                    labels: data.labels, 
                    datasets: [{
                        data: data.values, 
                        backgroundColor: data.colors, 
                        borderWidth: 0, 
                        hoverOffset: 4
                    }]
                }, 
                options: {
                    responsive: true, 
                    maintainAspectRatio: false, 
                    cutout: '65%', 
                    plugins: {
                        legend: {
                            position: 'bottom', 
                            labels: {
                                color: '#aaa', 
                                padding: 15, 
                                font: {
                                    size: 11
                                }
                            }
                        }
                    }
                }
            });

        } catch (error) {
            console.error('Failed to init stock health chart:', error);
        }
    }

    /* ============================================
       STOCK BY CATEGORY BAR CHART
       Shows quantity per category
       ============================================ */

    async function initStockByCategoryChart() {
        try {
            // Fetch chart data from API
            const response = await fetch(`${API_BASE_URL}/inventory/chart/stock-by-category`);
            const data = await response.json();

            // Get the canvas element
            const ctx = document.getElementById('stockByCategoryChart').getContext('2d');

            // Create the chart
            stockByCategory = new Chart(ctx, {
                type: 'bar', 
                data: {
                    labels: data.labels, 
                    datasets: [{
                        label: 'Total Quantity', 
                        data: data.values, 
                        backgroundColor: '#e60030', 
                        borderRadius: 4, 
                        borderSkipped: false
                    }]
                }, 
                options: {
                    responsive: true, 
                    maintainAspectRatio: false, 
                    plugins: {
                        legend: {
                            display: false
                        }
                    }, 
                    scales: {
                        x: {
                            grid: {
                                display: false
                            }, 
                            ticks: {
                                color: '#aaa', 
                                font: {
                                    size: 10
                                }
                            }
                        }, 
                        y: {
                            grid: {
                                color: '#333'
                            }, 
                            ticks: {
                                color: '#aaa', 
                                font: {
                                    size: 10
                                }
                            }
                        }
                    }
                }
            });

        } catch (error) {
            console.error('Failed to init stock by category chart:', error);
        }
    }

    /* ============================================
       POPULATE CATEGORY FILTER
       Fill dropdown with categories
       ============================================ */

    function populateCategoryFilter() {
        const dropdown = document.getElementById('filterCategory');

        // Keep the "All Categories" option
        dropdown.innerHTML = '<option value="all">All Categories</option>';

        // Add each category
        allCategories.forEach(category => {
            const option = document.createElement('option');
            option.value = category.id;
            option.textContent = category.name;
            dropdown.appendChild(option);
        });

        // Also populate the product modal category dropdown
        const modalDropdown = document.getElementById('productCategory');
        if (modalDropdown) {
            modalDropdown.innerHTML = '<option value="">Select category...</option>';
            allCategories.forEach(category => {
                const option = document.createElement('option');
                option.value = category.id;
                option.textContent = category.name;
                modalDropdown.appendChild(option);
            });
        }
    }

    /* ============================================
       POPULATE LOCATION FILTER
       Fill dropdown with locations
       ============================================ */

    async function populateLocationFilter() {
        try {
            const response = await fetch(`${API_BASE_URL}/locations`);
            const locations = await response.json();

            // Filter dropdown
            const filterDropdown = document.getElementById('filterLocation');
            filterDropdown.innerHTML = '<option value="all">All Locations</option>';

            locations.forEach(location => {
                const option = document.createElement('option');
                option.value = location.id;
                option.textContent = location.name;
                filterDropdown.appendChild(option);
            });

            // Reorder modal dropdown
            const reorderDropdown = document.getElementById('reorderLocation');
            if (reorderDropdown) {
                reorderDropdown.innerHTML = '<option value="">Select location...</option>';
                locations.forEach(location => {
                    const option = document.createElement('option');
                    option.value = location.id;
                    option.textContent = location.name;
                    reorderDropdown.appendChild(option);
                });
            }

        } catch (error) {
            console.error('Failed to populate location filter:', error);
        }
    }

    /* ============================================
       SET UP EVENT LISTENERS
       Handle user interactions
       ============================================ */

    function setupEventListeners() {
        // Search input
        const searchInput = document.getElementById('searchProducts');
        searchInput.addEventListener('input', handleSearch);

        // Filter dropdowns
        document.getElementById('filterCategory').addEventListener('change', applyFilters);
        document.getElementById('filterLocation').addEventListener('change', applyFilters);
        document.getElementById('filterStockStatus').addEventListener('change', applyFilters);

        // Add Product button
        document.getElementById('addProductBtn').addEventListener('click', openAddProductModal);

        // Product card actions (using event delegation)
        document.getElementById('productsGrid').addEventListener('click', handleProductCardClick);

        // Product form submission
        document.getElementById('productForm').addEventListener('submit', handleProductSubmit);

        // Reorder form submission
        document.getElementById('reorderForm').addEventListener('submit', handleReorderSubmit);
    }

    /* ============================================
       HANDLE SEARCH
       Filter products as user types
       ============================================ */

    function handleSearch(e) {
        const query = e.target.value.toLowerCase().trim();
        applyFilters();
    }

    /* ============================================
       APPLY FILTERS
       Filter products by all criteria
       ============================================ */

    function applyFilters() {
        // Get current filter values
        const categoryFilter = document.getElementById('filterCategory').value;
        const locationFilter = document.getElementById('filterLocation').value;
        const stockStatusFilter = document.getElementById('filterStockStatus').value;
        const searchQuery = document.getElementById('searchProducts').value.toLowerCase().trim();

        // Start with all products
        let filtered = [...allProducts];

        // Apply category filter
        if (categoryFilter && categoryFilter !== 'all') {
            filtered = filtered.filter(p => p.category_id == categoryFilter);
        }

        // Apply stock status filter
        if (stockStatusFilter && stockStatusFilter !== 'all') {
            filtered = filtered.filter(p => {
                const status = getStockStatus(p.total_quantity, p.reorder_point);

                if (stockStatusFilter === 'in_stock') {
                    return status.class === 'in_stock';
                } else if (stockStatusFilter === 'low') {
                    return status.class === 'low-stock';
                } else if (stockStatusFilter === 'out') {
                    return status.class === 'out-of-stock';
                }

                return true;
            });
        }

        // Apply search query
        if (searchQuery) {
            filtered = filtered.filter(p => {
                return p.name.toLowerCase().includes(searchQuery) || 
                       p.sku.toLowerCase().includes(searchQuery) || 
                       (p.description && p.description.toLowerCase().includes(searchQuery));
            });
        }

        // Re-render with filtered products
        renderProducts(filtered);
    }

    /* ============================================
       HANDLE PRODUCT CARD CLICK
       Event delegation for card buttons
       ============================================ */

    function handleProductCardClick(e) {
        // Check if Edit button was clicked
        const editBtn = e.target.closest('.edit-product-btn');
        if (editBtn) {
            const productId = editBtn.dataset.productId;
            openEditProductModal(productId);
            return;
        }

        // Check if Reorder button was clicked
        const reorderBtn = e.target.closest('.reorder-btn');
        if (reorderBtn) {
            const productId = reorderBtn.dataset.productId;
            openReorderModal(productId);
            return;
        }
    }

    /* ============================================
       OPEN ADD PRODUCT MODAL
       ============================================ */

    function openAddProductModal() {
        // Reset form
        document.getElementById('productForm').reset();
        document.getElementById('productId').value = '';

        // Update modal title and button
        document.getElementById('productModalTitle').textContent = 'Add New Product';
        document.getElementById('saveProductBtn').innerHTML = '<i class="fa-solid fa-plus"></i> Add Product';

        // Clear messages
        document.getElementById('productError').style.display = 'none';
        document.getElementById('productSuccess').style.display = 'none';

        // Show modal
        document.getElementById('product-modal').classList.add('show');
    }

    /* ============================================
       OPEN EDIT PRODUCT MODAL
       ============================================ */

    function openEditProductModal(productId) {
        // Find the product
        const product = allProducts.find(p => p.id == productId);

        if (!product) {
            console.error('Product not found:', productId);
            return;
        }

        // Populate form with product data
        document.getElementById('productId').value = product.id;
        document.getElementById('productName').value = product.name;
        document.getElementById('productCategory').value = product.category_id;
        document.getElementById('productUnitPrice').value = product.unit_price;
        document.getElementById('productCostPrice').value = product.cost_price;
        document.getElementById('productReorderPoint').value = product.reorder_point;
        document.getElementById('productReorderQty').value = product.reorder_quantity;
        document.getElementById('productDescription').value = product.description || '';

        // Update modal title and button
        document.getElementById('productModalTitle').textContent = 'Edit Product';
        document.getElementById('saveProductBtn').innerHTML = '<i class="fa-solid fa-check"></i> Save Changes';

        // Clear messages
        document.getElementById('productError').style.display = 'none';
        document.getElementById('productSuccess').style.display = 'none';

        // Show modal
        document.getElementById('product-modal').classList.add('show');
    }

    /* ============================================
       HANDLE PRODUCT FORM SUBMIT
       Create or update product
       ============================================ */

    async function handleProductSubmit(e) {
        e.preventDefault();

        const productId = document.getElementById('productId').value;
        const isEditing = productId !== '';

        // Gather form data
        const productData = {
            name: document.getElementById('productName').value, 
            category_id: parseInt(document.getElementById('productCategory').value), 
            unit_price: parseFloat(document.getElementById('productUnitPrice').value) || 0, 
            cost_price: parseFloat(document.getElementById('productCostPrice').value) || 0, 
            reorder_point: parseInt(document.getElementById('productReorderPoint').value) || 10, 
            reorder_quantity: parseInt(document.getElementById('productReorderQty').value) || 25, 
            description: document.getElementById('productDescription').value
        };

        // Hide previous messages
        document.getElementById('productError').style.display = 'none';
        document.getElementById('productSuccess').style.display = 'none';

        // Show loading state
        const saveBtn = document.getElementById('saveProductBtn');
        const originalBtnText = saveBtn.innerHTML;
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';

        try {
            let response;

            if (isEditing) {
                // Update existing product
                response = await fetch(`${API_BASE_URL}/inventory/products/${productId}`, {
                    method: 'PUT', 
                    headers: { 'Content-Type': 'application/json' }, 
                    body: JSON.stringify(productData)
                });
            } else {
                // Create new product
                response = await fetch(`${API_BASE_URL}/inventory/products`, {
                    method: 'POST', 
                    headers: { 'Content-Type': 'application/json' }, 
                    body: JSON.stringify(productData)
                });
            }

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Failed to save product');
            }

            // Show success message
            document.getElementById('productSuccess').textContent = 
                isEditing ? 'Product updated successfully!' : `Product created! SKU: ${result.sku}`;
            document.getElementById('productSuccess').style.display = 'block';

            // Refresh data after short delay
            setTimeout(async () => {
                // Close modal
                document.getElementById('product-modal').classList.remove('show');

                // Refresh products and stats
                await fetchProducts();
                await fetchStats();
                await initCharts();

                // Reset button
                saveBtn.disabled = false;
                saveBtn.innerHTML = originalBtnText;

            }, 1500);

        } catch (error) {
            console.error('Failed to save product:', error);

            // Show error message
            document.getElementById('productError').textContent = error.message;
            document.getElementById('productError').style.display = 'block';

            // Reset button
            saveBtn.disabled = false;
            saveBtn.innerHTML = originalBtnText;
        }
    }

    /* ============================================
       OPEN REORDER MODAL
       ============================================ */

    function openReorderModal(productId) {
        // Find the product
        const product = allProducts.find(p => p.id == productId);

        if (!product) {
            console.error('Product not found:', productId);
            return;
        }

        // Populate modal
        document.getElementById('reorderProductId').value = product.id;
        document.getElementById('reorderProductName').textContent = product.name;
        document.getElementById('reorderProductSku').textContent = `SKU: ${product.sku}`;
        document.getElementById('reorderQuantity').value = product.reorder_quantity;

        // Clear form
        document.getElementById('reorderLocation').value = '';
        document.getElementById('reorderNotes').value = '';

        // Clear messages
        document.getElementById('reorderError').style.display = 'none';
        document.getElementById('reorderSuccess').style.display = 'none';

        // Show modal
        document.getElementById('reorder-modal').classList.add('show');
    }

    /* ============================================
       HANDLE REORDER FORM SUBMIT
       Create reorder request
       ============================================ */

    async function handleReorderSubmit(e) {
        e.preventDefault();

        const reorderData = {
            product_id: parseInt(document.getElementById('reorderProductId').value), 
            location_id: parseInt(document.getElementById('reorderLocation').value), 
            quantity: parseInt(document.getElementById('reorderQuantity').value), 
            notes: document.getElementById('reorderNotes').value, 
            requested_by: 'Admin'
        };

        // Validate
        if (!reorderData.location_id) {
            document.getElementById('reorderError').textContent = 'Please select a location';
            document.getElementById('reorderError').style.display = 'block';
            return;
        }

        // Hide previous messages
        document.getElementById('reorderError').style.display = 'none';
        document.getElementById('reorderSuccess').style.display = 'none';

        // Show loading state
        const submitBtn = document.getElementById('submitReorderBtn');
        const originalBtnText = submitBtn.innerHTML;
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Submitting...';

        try {
            const response = await fetch(`${API_BASE_URL}/inventory/reorders`, {
                method: 'POST', 
                headers: { 'Content-Type': 'application/json' }, 
                body: JSON.stringify(reorderData)
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Failed to create reorder request');
            }

            // Show success message
            document.getElementById('reorderSuccess').textContent = 
                `Reorder request created! Request #: ${result.request_number}`;
            document.getElementById('reorderSuccess').style.display = 'block';

            // Close modal after delay
            setTimeout(() => {
                document.getElementById('reorder-modal').classList.remove('show');

                // Reset button
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalBtnText;

                // Refresh stats (pending reorders count)
                fetchStats();

            }, 1500);

        } catch (error) {
            console.error('Failed to create reorder request:', error);

            // Show error message
            document.getElementById('reorderError').textContent = error.message;
            document.getElementById('reorderError').style.display = 'block';

            // Reset button
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalBtnText;
        }
    }
});