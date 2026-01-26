/* ============================================
   INVENTORY-VENDORS.JS
   Handles Vendors page functionality
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

    let allVendors = [];                // All vendors from API
    let currentCategoryFilter = 'all';  // Current category filter
    let currentStatusFilter = 'all';    // Current status filter

    let currentSort = {
        column: 'vendor_name',          // Default sort by name
        direction: 'asc'                // Alphabetical ascending
    };

    /* ============================================
       CHART INSTANCES
       Store chart objects so we can update them later
       ============================================ */

    let spendingChart = null;
    let trendsChart = null;

    /* ============================================
       INITIALIATION
       Run when page loads
       ============================================ */

    // Fetch all data and set up the page
    await fetchStats();
    await fetchVendors();
    await initCharts();

    // Set up event listeners
    setupEventListeners();

    console.log('Vendors page initialized');

    /* ============================================
       FETCH KPI STATS
       Get numbers for the KPI cards
       ============================================ */

    async function fetchStats() {
        try {
            const response = await fetch(`${API_BASE_URL}/inventory/vendors/stats`);

            if (!response.ok) {
                throw new Error('Failed to fetch stats');
            }

            const stats = await response.json();

            console.log('Stats received', stats);

            // Update KPI cards with data
            // Uses data-stat attribute to target specific cards
            document.querySelector('[data-stat="totalVendors"]').textContent = stats.total_vendors || 0;
            document.querySelector('[data-stat="totalSpentMonth"]').textContent = formatCurrency(stats.total_spent_month);
            document.querySelector('[data-stat="activeOrders"]').textContent = stats.active_orders || 0;
            document.querySelector('[data-stat="topVendor"]').textContent = stats.top_vendor || 'N/A';

        } catch (error) {
            console.error('Failed to fetch stats:', error);

            // Show fallback values on error
            document.querySelector('[data-stat="totalVendors"]').textContent = '---';
            document.querySelector('[data-stat="totalSpentMonth"]').textContent = '---';
            document.querySelector('[data-stat="activeOrders"]').textContent = '---';
            document.querySelector('[data-stat="topVendor"]').textContent = '---';
        }
    }

    /* ============================================
       FETCH VENDORS
       Get all vendors and display time
       ============================================ */

    async function fetchVendors(filters = {}) {
        try {
            // Show loading state
            const tableBody = document.getElementById('vendorsTableBody');
            tableBody.innerHTML = `
                <tr>
                    <td colspan="9" style="text-align: center; padding: 3rem;">
                        <i class="fa-solid fa-spinner fa-spin"></i>
                        <p style="margin-top: 1rem; color: var(--color-text-muted);">Loading vendors...</p>
                    </td>
                </tr>
            `;

            // Build query string from filters
            const params = new URLSearchParams();

            if (filters.category && filters.category !== 'all') {
                params.append('category', filters.category);
            }

            if (filters.status && filters.status !== 'all') {
                params.append('status', filters.status);
            }

            if (filters.search) {
                params.append('search', filters.search);
            }

            const response = await fetch(`${API_BASE_URL}/inventory/vendors?${params.toString()}`);

            if (!response.ok) {
                throw new Error('Failed to fetch vendors:', error);
            }

            const data = await response.json();
            console.log('Vendors received', data);

            allVendors = data.vendors || [];

            // Display vendors in table
            renderVendors(allVendors);

        } catch (error) {
            console.error('Failed to fetch vendors:', error);

            // Show error state
            const tableBody = document.getElementById('vendorsTableBody');
            tableBody.innerHTML = `
                <tr>
                    <td colspan="9" style="text-align: center; padding: 3rem;">
                        <i class="fa-solid fa-exclamation-triangle" style="color: var(--color-danger); font-size: 2rem;"></i>
                        <p style="margin-top: 1rem; color: var(--color-text-muted);">Failed to load vendors. Please refresh the page.</p>
                    </td>
                </tr>
            `;
        }
    }

    /* ============================================
       RENDER VENDORS
       Display vendor in the table
       ============================================ */

    function renderVendors(vendors) {
        const tableBody = document.getElementById('vendorsTableBody');

        // Handle empty state
        if (vendors.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="9" style="text-align: center; padding: 3rem;">
                        <i class="fa-solid fa-inbox" style="color: var(--color-text-muted); font-size: 2rem;"></i>
                        <p style="margin-top: 1rem; color: var(--color-text-muted);">No vendors found</p>
                    </td>
                </tr>
            `;

            return;
        }

        // Build HTML for each row
        const rowsHTML = vendors.map(vendor => {
            // Format last order date
            const lastOrderDate = vendor.last_order_date 
                ? new Date(vendor.last_order_date).toLocaleDateString('en-US', {
                    month: 'short', 
                    day: 'numeric', 
                    year: 'numeric'
                })
                : 'Never';
            
            // Get status badge
            const statusBadge = getStatusBadge(vendor.status);

            return `
                <tr data-vendor-id="${vendor.id}">
                    <td>
                        <div style="font-weight: 500;">${vendor.vendor_name}</div>
                        <div style="font-size: 0.75rem; color: var(--color-text-dim);">${vendor.category}</div>
                    </td>
                    <td>${vendor.contact_person || '---'}</td>
                    <td>
                        <div>${vendor.email || '---'}</div>
                        <div style="font-size: 0.75rem; color: var(--color-text-dim);">${vendor.phone || '---'}</div>
                    </td>
                    <td>${vendor.address_city || '---'}, ${vendor.address_province || '---'}</td>
                    <td style="text-align: center;">${vendor.total_orders}</td>
                    <td>${formatCurrency(vendor.total_spent)}</td>
                    <td>${lastOrderDate}</td>
                    <td>${statusBadge}</td>
                    <td>
                        <div class="table-actions">
                            <button class="table-action-btn view btn-view" data-vendor-id="${vendor.id}" title="View Details">
                                <i class="fa-solid fa-eye"></i>
                            </button>
                            <button class="table-action-btn edit btn-edit" data-vendor-id="${vendor.id}" title="Edit">
                                <i class="fa-solid fa-edit"></i>
                            </button>
                            <button class="table-action-btn delete btn-delete" data-vendor-id="${vendor.id}" title="Delete">
                                <i class="fa-solid fa-trash"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

        tableBody.innerHTML = rowsHTML;
    }

    /* ============================================
       HELPER: Get Status Badge
       Returns HTML for colored status badge
       ============================================ */

    function getStatusBadge(status) {
        const badges = {
            'Active': '<span class="status-badge approved">Active</span>', 
            'InActive': '<span class="status-badge rejected">Inactive</span>'
        };

        return badges[status] || `<span class="status-badge">${status}</span>`;
    }

    /* ============================================
       HELPER: Format Currency
       Converts number to $XX.XX format
       ============================================ */

    function formatCurrency(amount) {
        const num = parseFloat(amount) || 0;
        return '$' + num.toLocaleString('en-US', {
            minimumFractionDigits: 2, 
            maximumFractionDigits: 2
        });
    }

    /* ============================================
       INITIALIZE CHARTS
       Set up Chart.js charts
       ============================================ */

    async function initCharts() {
        // Destroy existing charts before recreating
        // Prevents "Canvas already in use" errors
        if (spendingChart) {
            spendingChart.destroy();
            spendingChart = null;
        }

        if (trendsChart) {
            trendsChart.destroy();
            trendsChart = null;
        }

        await initSpendingChart();
        await initTrendsChart();
    }

    /* ============================================
       SPENDING BY VENDOR BAR CHART
       Shows top 5 vendors by total spending
       ============================================ */

    async function initSpendingChart() {
        try {
            const response = await fetch(`${API_BASE_URL}/inventory/vendors/chart/spending`);
            const data = await response.json();

            console.log('Spending chart data:', data);

            const ctx = document.getElementById('spendingChart').getContext('2d');

            spendingChart = new Chart(ctx, {
                type: 'bar', 
                data: {
                    labels: data.labels, 
                    datasets: [{
                        label: 'Total Spent', 
                        data: data.values, 
                        backgroundColor: 'rgba(230, 0, 48, 0.8)', 
                        borderColor: '#e60030', 
                        borderWidth: 1
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
                            beginAtZero: true, 
                            grid: {
                                color: '#333'
                            },
                            ticks: {
                                color: '#aaa', 
                                font: {
                                    size: 10
                                }, 
                                callback: (value) => '$' + value.toLocaleString()
                            }
                        }
                    }
                }
            });

        } catch (error) {
            console.error('Failed to init spending chart:', error);
        }
    }

    /* ============================================
       ORDER VOLUME TRENDS LINE CHART
       Shows orders per month over last 6 months
       ============================================ */

    async function initTrendsChart() {
        try {
            const response = await fetch(`${API_BASE_URL}/inventory/vendors/chart/trends`);
            const data = await response.json();

            console.log('Trends chart data:', data);

            const ctx = document.getElementById('trendsChart').getContext('2d');

            trendsChart = new Chart(ctx, {
                type: 'line', 
                data: {
                    labels: data.labels, 
                    datasets: [{
                        label: 'Order Placed', 
                        data: data.values, 
                        borderColor: '#e60030', 
                        backgroundColor: 'rgba(230, 0, 48, 0.1)', 
                        borderWidth: 2, 
                        tension: 0.4, 
                        fill: true, 
                        pointRadius: 4, 
                        pointHoverRadius: 6
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
                            beginAtZero: true, 
                            grid: {
                                color: '#333'
                            }, 
                            ticks: {
                                color: '#aaa', 
                                font: {
                                    size: 10
                                }, 
                                stepSize: 1
                            }
                        }
                    }
                }
            });

        } catch (error) {
            console.error('Failed to init trends chart:', error);
        }
    }

    /* ============================================
       SET UP EVENT LISTENERS
       Handle user interactions
       ============================================ */

    function setupEventListeners() {
        // Add Vendor button
        document.getElementById('addVendorBtn').addEventListener('click', openAddVendorModal);

        // Category filter dropdown
        document.getElementById('filterCategory').addEventListener('change', applyFilters);

        // Status filter dropdown
        document.getElementById('filterStatus').addEventListener('change', applyFilters);

        // Search input
        document.getElementById('searchVendors').addEventListener('input', handleSearch);

        // Table action buttons using event delegation
        const tableBody = document.getElementById('vendorsTableBody');
        tableBody.addEventListener('click', handleTableAction);

        // Table sorting
        document.querySelectorAll('.sortable').forEach(header => {
            header.addEventListener('click', () => {
                const column = header.dataset.sort;
                handleSort(column);
            });
        });

        // Add Vendor form submit
        document.getElementById('addVendorForm').addEventListener('submit', handleAddVendor);

        // Edit Vendor form submit
        document.getElementById('editVendorForm').addEventListener('submit', handleEditVendor);

        // Delete confirmation button
        document.getElementById('confirmDeleteBtn').addEventListener('click', handleDeleteVendor);
    }

    /* ============================================
       HANDLE TABLE ACTION
       Event delegation for dynamically created buttons
       ============================================ */

    function handleTableAction(e) {
        // Find which button was clicked
        const viewBtn = e.target.closest('.btn-view');
        const editBtn = e.target.closest('.btn-edit');
        const deleteBtn = e.target.closest('.btn-delete');

        // Get vendor ID from button's data attribute
        if (viewBtn) {
            const vendorId = viewBtn.dataset.vendorId;
            viewVendorDetails(vendorId);
        } else if (editBtn) {
            const vendorId = editBtn.dataset.vendorId;
            openEditVendorModal(vendorId);
        } else if (deleteBtn) {
            const vendorId = deleteBtn.dataset.vendorId;
            openDeleteModal(vendorId);
        }
    }

    /* ============================================
       APPLY FILTERS
       Filter vendors by category and status
       ============================================ */

    function applyFilters() {
        const categoryFilter = document.getElementById('filterCategory').value;
        const statusFilter = document.getElementById('filterStatus').value;
        const searchQuery = document.getElementById('searchVendors').value.toLowerCase().trim();

        // Store current filters
        currentCategoryFilter = categoryFilter;
        currentStatusFilter = statusFilter;

        // Start with all vendors
        let filtered = [...allVendors];

        // Apply category filter
        if (categoryFilter && categoryFilter !== 'all') {
            filtered = filtered.filter(v => v.category === categoryFilter);
        }

        // Apply status filter
        if (statusFilter && statusFilter !== 'all') {
            filtered = filtered.filter(v => v.status === statusFilter);
        }

        // Apply search query
        if (searchQuery) {
            filtered = filtered.filter(v => {
                return v.vendor_name.toLowerCase().includes(searchQuery) || 
                       (v.contact_person && v.contact_person.toLowerCase().includes(searchQuery)) || 
                       (v.email && v.email.toLowerCase().includes(searchQuery));
            });
        }

        //Re-render with filtered vendors
        renderVendors(filtered);
    }

    /* ============================================
       SORTING FUNCTIONALITY
       Sort table by column
       ============================================ */

    function handleSort(column) {
        // Toggle direction if same column, otherwise default to 'asc'
        if (currentSort.column === column) {
            currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
        } else {
            currentSort.column = column;
            currentSort.direction = 'asc';
        }

        // Sort the allVendors array
        allVendors.sort((a, b) => {
            let aVal = a[column];
            let bVal = b[column];

            // Handle null/undefined values
            if (aVal === null || aVal === undefined) aVal = '';
            if (bVal === null || bVal === undefined) bVal = '';

            // Convert to lowercase for string comparison
            if (typeof aVal === 'string') aVal = aVal.toLowerCase();
            if (typeof bVal === 'string') bVal = bVal.toLowerCase();

            // Compare
            if (aVal < bVal) return currentSort.direction === 'asc' ? -1 : 1;
            if (aVal > bVal) return currentSort.direction === 'asc' ? 1 : -1;
            return 0;
        });

        // Update sort indicators in table header
        document.querySelectorAll('.sortable').forEach(header => {
            header.classList.remove('sorted-asc', 'sorted-desc');
        });

        // Add class to current sorted column
        const currentHeader = document.querySelector(`[data-sort="${column}"]`);
        if (currentHeader) {
            currentHeader.classList.add(`sorted-${currentSort.direction}`);
        }

        // Re-apply filters (which will use the sorted array)
        applyFilters();
    }

    /* ============================================
       HANDLE SEARCH
       Filter vendors as user types
       ============================================ */

    function handleSearch() {
        applyFilters();
    }

    /* ============================================
       OPEN ADD VENDOR MODAL
       Show modal to create new vendor
       ============================================ */

    function openAddVendorModal() {
        // Reset form to clear any previous data
        document.getElementById('addVendorForm').reset();

        // Clear any error messages
        const errorDiv = document.getElementById('addVendorError');
        if (errorDiv) {
            errorDiv.style.display = 'none';
        }

        // Open modal
        const modal = document.getElementById('addVendorModal');
        modal.classList.add('show');
        modal.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';

        // Focus first input for better UX
        setTimeout(() => {
            document.getElementById('addVendorName').focus();
        }, 100);
    }

    /* ============================================
       HANDLE ADD VENDOR
       Submit form to create new vendor
       ============================================ */

    async function handleAddVendor(e) {
        e.preventDefault();

        // Collect form data
        const formData = {
            vendor_name: document.getElementById('addVendorName').value.trim(), 
            category: document.getElementById('addVendorCategory').value, 
            contact_person: document.getElementById('addContactPerson').value.trim(), 
            email: document.getElementById('addEmail').value.trim(), 
            phone: document.getElementById('addPhone').value.trim(), 
            address_street: document.getElementById('addAddressStreet').value.trim(), 
            address_city: document.getElementById('addAddressCity').value.trim(), 
            address_province: document.getElementById('addAddressProvince').value.trim(), 
            address_postal_code: document.getElementById('addPostalCode').value.trim(), 
            payment_terms: document.getElementById('addPaymentTerms').value.trim(), 
            tax_id: document.getElementById('addTaxId').value.trim(), 
            notes: document.getElementById('addNotes').value.trim(), 
            status: document.getElementById('addStatus').value
        };

        // Validate required field
        if (!formData.vendor_name) {
            showModalError('addVendorError', 'Vendor name is required');
            return;
        }

        // Show loading state on submit button
        const submitBtn = document.querySelector('#addVendorForm button[type="submit"]');
        const originalBtnText = submitBtn.innerHTML;
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Creating...';

        try {
            const response = await fetch(`${API_BASE_URL}/inventory/vendors`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Failed to create vendor');
            }

            // Close modal
            const modal = document.getElementById('addVendorModal');
            
            // Remove focus before closing (accessibility fix)
            document.activeElement.blur();
            
            modal.classList.remove('show');
            modal.setAttribute('aria-hidden', 'true');
            document.body.style.overflow = '';

            // Show success notification
            showNotification('Vendor created successfully!', 'success');

            // Refresh data
            await fetchVendors();
            await fetchStats();
            await initCharts();

        } catch (error) {
            console.error('Failed to create vendor:', error);
            showModalError('addVendorError', error.message);
        } finally {
            // Reset button state
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalBtnText;
        }
    }

    /* ============================================
       OPEN EDIT VENDOR MODAL
       Show modal to edit existing vendor
       ============================================ */

    async function openEditVendorModal(vendorId) {
        try {
            // Fetch vendor details
            const response = await fetch(`${API_BASE_URL}/inventory/vendors/${vendorId}`);

            if (!response.ok) {
                throw new Error('Failed to fetch vendor details');
            }

            const vendor = await response.json();

            // Populate form with vendor data
            document.getElementById('editVendorId').value = vendor.id;
            document.getElementById('editVendorName').value = vendor.vendor_name || '';
            document.getElementById('editVendorCategory').value = vendor.category || 'Supplies';
            document.getElementById('editContactPerson').value = vendor.contact_person || '';
            document.getElementById('editEmail').value = vendor.email || '';
            document.getElementById('editPhone').value = vendor.phone || '';
            document.getElementById('editAddressStreet').value = vendor.address_street || '';
            document.getElementById('editAddressCity').value = vendor.address_city || '';
            document.getElementById('editAddressProvince').value = vendor.address_province || '';
            document.getElementById('editPostalCode').value = vendor.address_postal_code || '';
            document.getElementById('editPaymentTerms').value = vendor.payment_terms || 'Net 30';
            document.getElementById('editTaxId').value = vendor.tax_id || '';
            document.getElementById('editNotes').value = vendor.notes || '';
            document.getElementById('editStatus').value = vendor.status || 'Active';

            // Clear any error messages
            const errorDiv = document.getElementById('editVendorError');
            if (errorDiv) {
                errorDiv.style.display = 'none';
            }

            // Open modal
            const modal = document.getElementById('editVendorModal');
            modal.classList.add('show');
            modal.setAttribute('aria-hidden', 'false');
            document.body.style.overflow = 'hidden';

        } catch (error) {
            console.error('Failed to load vendor details:', error);
            showNotification('Error loading vendor details', 'error');
        }
    }

    /* ============================================
       HANDLE EDIT VENDOR
       Submit form to update existing vendor
       ============================================ */

    async function handleEditVendor(e) {
        e.preventDefault();

        // Get vendor ID from hidden field
        const vendorId = document.getElementById('editVendorId').value;

        // Collect form data
        const formData = {
            vendor_name: document.getElementById('editVendorName').value.trim(),
            category: document.getElementById('editVendorCategory').value,
            contact_person: document.getElementById('editContactPerson').value.trim(),
            email: document.getElementById('editEmail').value.trim(),
            phone: document.getElementById('editPhone').value.trim(),
            address_street: document.getElementById('editAddressStreet').value.trim(),
            address_city: document.getElementById('editAddressCity').value.trim(),
            address_province: document.getElementById('editAddressProvince').value.trim(),
            address_postal_code: document.getElementById('editPostalCode').value.trim(),
            payment_terms: document.getElementById('editPaymentTerms').value.trim(),
            tax_id: document.getElementById('editTaxId').value.trim(),
            notes: document.getElementById('editNotes').value.trim(),
            status: document.getElementById('editStatus').value
        };

        // Validate required field
        if (!formData.vendor_name) {
            showModalError('editVendorError', 'Vendor name is required');
            return;
        }

        // Show loading state
        const submitBtn = document.querySelector('#editVendorForm button[type="submit"]');
        const originalBtnText = submitBtn.innerHTML;
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Updating...';

        try {
            const response = await fetch(`${API_BASE_URL}/inventory/vendors/${vendorId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Failed to update vendor');
            }

            // Close modal
            const modal = document.getElementById('editVendorModal');
            
            // Remove focus before closing
            document.activeElement.blur();
            
            modal.classList.remove('show');
            modal.setAttribute('aria-hidden', 'true');
            document.body.style.overflow = '';

            // Show success notification
            showNotification('Vendor updated successfully!', 'success');

            // Refresh data
            await fetchVendors();
            await fetchStats();
            await initCharts();

        } catch (error) {
            console.error('Failed to update vendor:', error);
            showModalError('editVendorError', error.message);
        } finally {
            // Reset button state
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalBtnText;
        }
    }

    /* ============================================
       VIEW VENDOR DETAILS
       Show modal with all vendor information
       ============================================ */

    async function viewVendorDetails(vendorId) {
        try {
            // Fetch vendor details
            const response = await fetch(`${API_BASE_URL}/inventory/vendors/${vendorId}`);

            if (!response.ok) {
                throw new Error('Failed to fetch vendor details');
            }

            const vendor = await response.json();

            // Populate vendor info section
            document.getElementById('detail-vendor-name').textContent = vendor.vendor_name;
            document.getElementById('detail-category').textContent = vendor.category;
            document.getElementById('detail-contact-person').textContent = vendor.contact_person || '---';
            document.getElementById('detail-email').textContent = vendor.email || '---';
            document.getElementById('detail-phone').textContent = vendor.phone || '---';
            
            // Format address
            const addressParts = [
                vendor.address_street,
                vendor.address_city,
                vendor.address_province,
                vendor.address_postal_code
            ].filter(part => part); // Remove null/empty values
            
            document.getElementById('detail-address').textContent = 
                addressParts.length > 0 ? addressParts.join(', ') : '---';

            document.getElementById('detail-payment-terms').textContent = vendor.payment_terms || '---';
            document.getElementById('detail-tax-id').textContent = vendor.tax_id || '---';
            document.getElementById('detail-status').innerHTML = getStatusBadge(vendor.status);

            // Show/hide notes section
            if (vendor.notes) {
                document.getElementById('detail-notes').textContent = vendor.notes;
                document.getElementById('notes-section').style.display = 'flex';
            } else {
                document.getElementById('notes-section').style.display = 'none';
            }

            // Populate performance metrics
            document.getElementById('detail-total-orders').textContent = vendor.total_orders || 0;
            document.getElementById('detail-total-spent').textContent = formatCurrency(vendor.total_spent);
            document.getElementById('detail-avg-order').textContent = formatCurrency(vendor.avg_order_value);
            
            const lastOrderDate = vendor.last_order_date
                ? new Date(vendor.last_order_date).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric'
                })
                : 'Never';
            document.getElementById('detail-last-order').textContent = lastOrderDate;

            // Open modal
            const modal = document.getElementById('viewDetailsModal');
            modal.classList.add('show');
            modal.setAttribute('aria-hidden', 'false');
            document.body.style.overflow = 'hidden';

        } catch (error) {
            console.error('Failed to view vendor details:', error);
            showNotification('Error loading vendor details', 'error');
        }
    }

    /* ============================================
       OPEN DELETE MODAL
       Show confirmation dialog before deleting
       ============================================ */

    function openDeleteModal(vendorId) {
        // Find vendor in allVendors array
        const vendor = allVendors.find(v => v.id === parseInt(vendorId));

        if (!vendor) {
            showNotification('Vendor not found', 'error');
            return;
        }

        // Store vendor ID in hidden input
        document.getElementById('deleteVendorId').value = vendorId;

        // Show vendor name in confirmation message
        document.getElementById('deleteVendorName').textContent = vendor.vendor_name;

        // Open modal
        const modal = document.getElementById('deleteVendorModal');
        modal.classList.add('show');
        modal.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';
    }

    /* ============================================
       HANDLE DELETE VENDOR
       Soft delete vendor (set status to Inactive)
       ============================================ */

    async function handleDeleteVendor() {
        const vendorId = document.getElementById('deleteVendorId').value;

        // Show loading state
        const confirmBtn = document.getElementById('confirmDeleteBtn');
        const originalBtnText = confirmBtn.innerHTML;
        confirmBtn.disabled = true;
        confirmBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Deleting...';

        try {
            const response = await fetch(`${API_BASE_URL}/inventory/vendors/${vendorId}`, {
                method: 'DELETE'
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Failed to delete vendor');
            }

            // Close modal
            const modal = document.getElementById('deleteVendorModal');
            
            // Remove focus before closing
            document.activeElement.blur();
            
            modal.classList.remove('show');
            modal.setAttribute('aria-hidden', 'true');
            document.body.style.overflow = '';

            // Show success notification
            showNotification('Vendor deactivated successfully', 'success');

            // Refresh data
            await fetchVendors();
            await fetchStats();
            await initCharts();

        } catch (error) {
            console.error('Failed to delete vendor:', error);
            showNotification(error.message, 'error');
        } finally {
            // Reset button state
            confirmBtn.disabled = false;
            confirmBtn.innerHTML = originalBtnText;
        }
    }

    /* ============================================
       HELPER: Show Modal Error
       Display error message within a modal
       ============================================ */

    function showModalError(errorElementId, message) {
        const errorDiv = document.getElementById(errorElementId);
        if (errorDiv) {
            errorDiv.textContent = message;
            errorDiv.style.display = 'block';

            // Auto-hide after 5 seconds
            setTimeout(() => {
                errorDiv.style.display = 'none';
            }, 5000);
        }
    }

})