/* ============================================
   INVENTORY-REORDERS.JS
   Handles Reorder Requests page functionality
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

    let allRequests = [];               // All reorder requests from API
    let currentStatusFilter = 'all';    // Current active tab

    let currentSort = {
        column: 'requested_at',         // Default sort by date
        direction: 'desc'
    };

    /* ============================================
       CHART INSTANCES
       Store chart objects so we can update them later
       ============================================ */

    let statusBreakdownChart = null;
    let trendsChart = null;

    /* ============================================
       INITIALIZATION
       Run when page loads
       ============================================ */

    // Fetch all data and set up the page
    await fetchStats();
    await fetchReorders();
    await initCharts();

    // Populate filter dropdowns
    await populateLocationFilter();

    // Set up event listeners
    setupEventListeners();

    console.log('Reorder Requests page initialized');

    /* ============================================
       FETCH KPI STATS
       Get numbers for the KPI cards
       ============================================ */

    async function fetchStats() {
        try {
            const response = await fetch(`${API_BASE_URL}/inventory/reorders/stats`);

            if (!response.ok) {
                throw new Error('Failed to fetch stats');
            }

            const stats = await response.json();

            // Update KPI cards with data
            document.querySelector('[data-stat="pendingCount"]').textContent = stats.pending_count || 0;
            document.querySelector('[data-stat="pendingValue"]').textContent = formatCurrency(stats.pending_value);
            document.querySelector('[data-stat="completedWeek"]').textContent = stats.completed_this_week || 0;
            document.querySelector('[data-stat="totalRequests"]').textContent = stats.total_requests || 0;


        } catch (error) {
            console.error('Failed to fetch stats:', error);

            // Show fallback values on error
            document.querySelector('[data-stat="pendingCount"]').textContent = '---';
            document.querySelector('[data-stat="pendingValue"]').textContent = '---';
            document.querySelector('[data-stat="completedWeek"]').textContent = '---';
            document.querySelector('[data-stat="totalRequests"]').textContent = '---';
        }
    }

    /* ============================================
       FETCH REORDERS
       Get all reorder requests and display them
       ============================================ */

    async function fetchReorders(filters = {}) {
        try {
            // Show loading state
            const tableBody = document.getElementById('reordersTableBody');
            tableBody.innerHTML = `
                <tr>
                    <td colspan="10" style="text-align: center; padding: 3rem;">
                        <i class="fa-solid fa-spinner fa-spin"></i>
                        <p style="margin-top: 1rem; color: var(--color-text-muted);">Loading requests...</p>
                    </td>
                </tr>
            `;

            // Build query string from filters
            const params = new URLSearchParams();
            if (filters.status && filters.status !== 'all') {
                params.append('status', filters.status);
            }

            if (filters.location_id && filters.location_id !== 'all') {
                params.append('location_id', filters.location_id);
            }

            const response = await fetch(`${API_BASE_URL}/inventory/reorders?${params.toString()}`);

            if (!response.ok) {
                throw new Error('Failed to fetch reorders');
            }

            const data = await response.json();
            allRequests = data.requests || [];

            // Display requests in table
            renderReorders(allRequests);

        } catch (error) {
            console.error('Failed to fetch reorders:', error);

            // Show error state
            const tableBody = document.getElementById('reordersTableBody');
            tableBody.innerHTML = `
                <tr>
                    <td colspan="10" style="text-align: center; padding: 3rem;">
                        <i class="fa-solid fa-exclamation-triangle" style="color: var(--color-danger); font-size: 2rem;"></i>
                        <p style="margin-top: 1rem; color: var(--color-text-muted);">Failed to load requests. Please refresh the page.</p>
                    </td>
                </tr>
            `;
        }
    }

    /* ============================================
       RENDER REORDERS
       Display reorder requests in the table
       ============================================ */

    function renderReorders(requests) {
        const tableBody = document.getElementById('reordersTableBody');

        // Handle empty state
        if (requests.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="10" style="text-align: center; padding: 3rem;">
                        <i class="fa-solid fa-inbox" style="color: var(--color-text-muted); font-size: 2rem;"></i>
                        <p style="margin-top: 1rem; color: var(--color-text-muted);">No reorder requests found</p>
                    </td>
                </tr>
            `;

            return;
        }

        // Build HTML for each row
        const rowsHTML = requests.map(request => {
            // Format date to be more readable
            const requestDate = new Date(request.requested_at);
            const formattedDate = requestDate.toLocaleDateString('en-US', {
                month: 'short', 
                day: 'numeric', 
                year: 'numeric'
            });

            // Get status badge HTML
            const statusBadge = getStatusBadge(request.status);

            // Get action buttons based on status
            const actionButtons = getActionButtons(request);

            return `
                <tr data-request-id="${request.id}">
                    <td>${request.request_number}</td>
                    <td>${formattedDate}</td>
                    <td>
                        <div style="font-weight: 500;">${request.product_name}</div>
                        <div style="font-size: 0.75rem; color: var(--color-text-dim);">${request.product_sku}</div>
                    </td>
                    <td>${request.category_name}</td>
                    <td>${request.location_name}</td>
                    <td style="text-align: center;">${request.quantity_requested}</td>
                    <td>${formatCurrency(request.total_cost)}</td>
                    <td>${statusBadge}</td>
                    <td>${request.requested_by}</td>
                    <td>
                        <div class="table-actions">
                            ${actionButtons}
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
            'pending': '<span class="status-badge pending">Pending</span>', 
            'approved': '<span class="status-badge approved">Approved</span>', 
            'received': '<span class="status-badge received">Received</span>', 
            'rejected': '<span class="status-badge rejected">Rejected</span>'
        };

        return badges[status] || `<span class="status-badge">${status}</span>`;
    }

    /* ============================================
       HELPER: Get Action Buttons
       Returns appropriate buttons based on request status
       ============================================ */

    function getActionButtons(request) {
        // Pending requests can be approved or rejected
        if (request.status === 'pending') {
            return `
                <button class="table-action-btn edit btn-approve" data-request-id="${request.id}" title="Approve">
                    <i class="fa-solid fa-check"></i>
                </button>
                <button class="table-action-btn delete btn-reject" data-request-id="${request.id}" title="Reject">
                    <i class="fa-solid fa-times"></i>
                </button>
                <button class="table-action-btn view btn-view" data-request-id="${request.id}" title="View Details">
                    <i class="fa-solid fa-eye"></i>
                </button>
            `;
        }

        // Approved requests can be marked as received
        if (request.status === 'approved') {
            return `
                <button class="table-action-btn edit btn-receive" data-request-id="${request.id}" title="Mark as Received">
                    <i class="fa-solid fa-box-open"></i>
                </button>
                <button class="table-action-btn view btn-view" data-request-id="${request.id}" title="View Dtails">
                    <i class="fa-solid fa-eye"></i>
                </button>
            `;
        }

        // Received and rejected requests can only be viewed
        return `
            <button class="table-action-btn view btn-view" data-request-id="${request.id}" title="View Details">
                <i class="fa-solid fa-eye"></i>
            </button>
        `;
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
        await initStatusBreakdownChart();
        await initTrendsChart();
    }

    /* ============================================
       STATUS BREAKDOWN DOUGHNUT CHART
       Shows pending/approved/received/rejected distribution
       ============================================ */

    async function initStatusBreakdownChart() {
        try {
            const response = await fetch(`${API_BASE_URL}/inventory/reorders/chart/status-breakdown`);
            const data = await response.json();

            const ctx = document.getElementById('statusBreakdownChart').getContext('2d');

            statusBreakdownChart = new Chart(ctx, {
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
            console.error('Failed to init status breakdown chart:', error);
        }
    }

    /* ============================================
       TRENDS LINE CHART
       Shows requests created over last 7 days
       ============================================ */

    async function initTrendsChart() {
        try {
            const response = await fetch(`${API_BASE_URL}/inventory/reorders/chart/trends`);
            const data = await response.json();

            const ctx = document.getElementById('trendsChart').getContext('2d');

            trendsChart = new Chart(ctx, {
                type: 'line', 
                data: {
                    labels: data.labels, 
                    datasets: [{
                        label: 'Requests Created', 
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
       POPULATION LOCATION FILTER
       Fill dropdown with locations
       ============================================ */

    async function populateLocationFilter() {
        try {
            const response = await fetch(`${API_BASE_URL}/locations`);
            const locations = await response.json();

            const filterDropdown = document.getElementById('filterLocation');
            filterDropdown.innerHTML = '<option value="all">All Locations</option>';

            locations.forEach(location => {
                const option = document.createElement('option');
                option.value = location.id;
                option.textContent = location.name;
                filterDropdown.appendChild(option);
            });

        } catch (error) {
            console.error('Failed to populate location filter:', error);
        }
    }

    /* ============================================
       SET UP EVENT LISTENERS
       Handle user interactions
       ============================================ */

    function setupEventListeners() {
        // Status table (All, Pending, Approved, etc.)
        const statusTabs = document.querySelectorAll('.status-tab');
        statusTabs.forEach(tab => {
            tab.addEventListener('click', handleStatusTabClick);
        });

        // Location filter dropdown
        document.getElementById('filterLocation').addEventListener('change', applyFilters);

        // Search Input
        document.getElementById('searchRequests').addEventListener('input', handleSearch);

        // Table action buttons using event delegation
        // Listen on the table body, check what was clicked
        const tableBody = document.getElementById('reordersTableBody');
        tableBody.addEventListener('click', handleTableAction);

        // Table sorting
        document.querySelectorAll('.sortable').forEach(header => {
            header.addEventListener('click', () => {
                const column = header.dataset.sort;
                handleSort(column);
            });
        });
    }

    /* ============================================
       HANDLE TABLE ACTION
       Event delegation for dynamically created buttons
       ============================================ */

    function handleTableAction(e) {
        // Find which button was clicked
        const approveBtn = e.target.closest('.btn-approve');
        const rejectBtn = e.target.closest('.btn-reject');
        const receiveBtn = e.target.closest('.btn-receive');
        const viewBtn = e.target.closest('.btn-view');

        // Get request ID from button's data attribute
        if (approveBtn) {
            const requestId = approveBtn.dataset.requestId;
            approveRequest(requestId);
        } else if (rejectBtn) {
            const requestId = rejectBtn.dataset.requestId;
            rejectRequest(requestId);
        } else if (receiveBtn) {
            const requestId = receiveBtn.dataset.requestId;
            receiveRequest(requestId);
        } else if (viewBtn) {
            const requestId = viewBtn.dataset.requestId;
            viewRequestDetails(requestId);
        }
    }

    /* ============================================
       HANDLE STATUS TAB CLICK
       Filter requests by status when tab is clicked
       ============================================ */

    function handleStatusTabClick(e) {
        const clickedTab = e.currentTarget;
        const status = clickedTab.dataset.status;

        // Update active tab styling
        document.querySelectorAll('.status-tab').forEach(tab => {
            tab.classList.remove('active');
        });

        clickedTab.classList.add('active');

        // Update current filter
        currentStatusFilter = status;

        // Apply filters
        applyFilters();
    }

    /* ============================================
       APPLY FILTERS
       Filter requests by status and location
       ============================================ */

    function applyFilters() {
        const locationFilter = document.getElementById('filterLocation').value;
        const searchQuery = document.getElementById('searchRequests').value.toLowerCase().trim();

        // Start with all requests
        let filtered = [...allRequests];

        // Apply status filter from active tab
        if (currentStatusFilter && currentStatusFilter !== 'all') {
            filtered = filtered.filter(r => r.status === currentStatusFilter);
        }

        // Apply location filter
        if (locationFilter && locationFilter !== 'all') {
            filtered = filtered.filter(r => r.location_id == locationFilter);
        }

        // Apply search query
        if (searchQuery) {
            filtered = filtered.filter(r => {
                return r.request_number.toLowerCase().includes(searchQuery) || 
                       r.product_name.toLowerCase().includes(searchQuery) || 
                       r.product_sku.toLowerCase().includes(searchQuery) || 
                       r.requested_by.toLowerCase().includes(searchQuery);
            });
        }

        // Re-render with filtered requests
        renderReorders(filtered);
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

        // Sort the alLRequests array
        allRequests.sort((a, b) => {
            let aVal = a[column];
            let bVal = b[column];

            // Handle null/undefined values
            if (aVal === null || aVal === undefined) aVal = '';
            if (bVal === null || bVal === undefined) bVal = '';

            // Convert to lowercase for string comparison
            if (typeof aVal === 'string') aVal = aVal.toLowerCase();
            if (typeof bVal === 'string') bVal = bVal.toLowerCase();

            // Special handling for dates
            if (column === 'requested_at') {
                aVal = new Date(aVal).getTime();
                bVal = new Date(bVal).getTime();
            }

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
       Filter requests as user types
       ============================================ */

    function handleSearch(e) {
        applyFilters();
    }

    /* ============================================
       APPROVE REQUEST
       Called when approve button is clicked
       ============================================ */

    async function approveRequest(requestId) {
        // Confirm action
        if (!confirm('Are you sure you want to approve this reorder request?')) {
            return;
        }

        try {
            const response = await fetch(`${API_BASE_URL}/inventory/reorders/${requestId}/approve`, {
                method: 'PUT', 
                headers: { 'Content-Type': 'application/json' }, 
                body: JSON.stringify({
                    approved_by: 'Admin'
                })
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Failed to approve request');
            }

            // Show success notification
            showNotification('Request approved successfully!', 'success');

            // Refresh data
            await fetchReorders({ status: currentStatusFilter });
            await fetchStats();
            await initCharts();

        } catch (error) {
            console.error('Failed to approve request:', error);
            showNotification(error.message, 'error');
        }
    };

    /* ============================================
       REJECT REQUEST
       Called when reject button is clicked
       ============================================ */

     async function rejectRequest(requestId) {
        // Get rejection reason
        const reason = prompt('Enter rejection reason (optional):');

        // User cancelled
        if (reason === null) {
            return;
        }

        try {
            const response = await fetch(`${API_BASE_URL}/inventory/reorders/${requestId}/reject`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    rejected_by: 'Admin',
                    rejection_reason: reason || 'No reason provided'
                })
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Failed to reject request');
            }

            // Show success notification
            showNotification('Request rejected', 'success');

            // Refresh data
            await fetchReorders({ status: currentStatusFilter });
            await fetchStats();
            await initCharts();

        } catch (error) {
            console.error('Failed to reject request:', error);
            showNotification(error.message, 'error');
        }
    };

    /* ============================================
       RECEIVE REQUEST
       Called when receive button is clicked
       ============================================ */

    async function receiveRequest(requestId) {
        // Get quantity received
        const quantity = prompt('Enter quantity received:');

        // User cancelled or invalid input
        if (quantity === null || quantity === '' || isNaN(quantity) || parseInt(quantity) <= 0) {
            if (quantity !== null) {
                alert('Please enter a valid quantity');
            }
            return;
        }

        try {
            const response = await fetch(`${API_BASE_URL}/inventory/reorders/${requestId}/receive`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    quantity_received: parseInt(quantity)
                })
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Failed to mark as received');
            }

            // Show success notification
            showNotification('Request marked as received and inventory updated!', 'success');

            // Refresh data
            await fetchReorders({ status: currentStatusFilter });
            await fetchStats();
            await initCharts();

        } catch (error) {
            console.error('Failed to receive request:', error);
            showNotification(error.message, 'error');
        }
    };

    /* ============================================
       VIEW REQUEST DETAILS
       Called when view details button is clicked
       ============================================ */

    async function viewRequestDetails(requestId) {
        try {
            const response = await fetch(`${API_BASE_URL}/inventory/reorders/${requestId}`);

            if (!response.ok) {
                throw new Error('Failed to fetch request details');
            }

            const request = await response.json();

            // Build details message
            const details = `
                Request Number: ${request.request_number}
                Product: ${request.product_name} (${request.product_sku})
                Category: ${request.category_name}
                Location: ${request.location_name}
                Quantity Requested: ${request.quantity_requested}
                Unit Cost: ${formatCurrency(request.unit_cost)}
                Total Cost: ${formatCurrency(request.total_cost)}
                Status: ${request.status}
                Requested By: ${request.requested_by}
                Requested At: ${new Date(request.requested_at).toLocaleString()}
                ${request.approved_by ? `Approved By: ${request.approved_by}` : ''}
                ${request.approved_at ? `Approved At: ${new Date(request.approved_at).toLocaleString()}` : ''}
                ${request.notes ? `\nNotes: ${request.notes}` : ''}
            `;

            alert(details);

        } catch (error) {
            console.error('Failed to view request details:', error);
            showNotification('Error loading request details', 'error');
        }
    };
});