/* ============================================
   LOCATIONS.JS
   Handles locations page functionality
   Fetches data, renders cards, manages charts
   ============================================ */

document.addEventListener('DOMContentLoaded', async () => {

    /* ============================================
       API CONFIGURATION
       Base URL for all API requests
       ============================================ */

    const API_BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
        ? 'http://127.0.0.1:5000/api' 
        : '/api';

    /* ============================================
       GLOBAL VARIABLES
       Store data for use across functions
       ============================================ */

    let allLocations = [];          // Stores all location data
    let comparisonChart = null;     // Radar chart instance
    let capacityChart = null;       // Bar chart instance

    /* ============================================
       INITIALIZATION
       Run when page loads
       ============================================ */

    // Fetch all data and set up the page
    await fetchStats();
    await fetchLocations();
    await initCharts();

    // Set up event listeners
    setupEventListeners();

    console.log('Locations page initialized');

    /* ============================================
       FETCH KPI STATS
       Get aggregate numbers for KPI cards
       ============================================ */

    async function fetchStats() {
        try {
            const response = await fetch(`${API_BASE_URL}/locations/stats`);

            if (!response.ok) {
                throw new Error('Failed to fetch stats');
            }

            const stats = await response.json();

            // Update KPI cards with data
            // Uses data-stat attribute to target specific cards
            document.querySelector('[data-stat="totalLocations"]').textContent = stats.total_locations || 0;
            document.querySelector('[data-stat="totalCapacity"]').textContent = stats.total_capacity || 0;
            document.querySelector('[data-stat="totalMembers"]').textContent = stats.total_members || 0;
            document.querySelector('[data-stat="avgUtilization"]').textContent = stats.avg_utilization + '%' || '0%';

        } catch (error) {
            console.error('Failed to fetch stats:', error);

            // Show fallback values on error
            document.querySelector('[data-stat="totalLocations"]').textContent = '---';
            document.querySelector('[data-stat="totalCapacity"]').textContent = '---';
            document.querySelector('[data-stat="totalMembers"]').textContent = '---';
            document.querySelector('[data-stat="avgUtilization"]').textContent = '---';
        }
    }

    /* ============================================
       FETCH LOCATIONS
       Get all locations with detailed stats
       ============================================ */

    async function fetchLocations() {
        try {
            const response = await fetch(`${API_BASE_URL}/locations/details`);

            if (!response.ok) {
                throw new Error('Failed to fetch locations');
            }

            const data = await response.json();

            // Store in global variable for later use
            allLocations = data.locations || [];

            // Render location cards
            renderLocationCards(allLocations);

        } catch (error) {
            console.error('Failed to fetch locations:', error);

            // Show error state
            const container = document.getElementById('locationCardsContainer');
            container.innerHTML = `
                <div class="locations-empty">
                    <i class="fa-solid fa-exclamation-triangle"></i>
                    <p>Failed to load locations. Please refresh the page.</p>
                </div>
            `;
        }
    }

    /* ============================================
       RENDER LOCATION CARDS
       Dynamically create 3 location cards
       ============================================ */

    function renderLocationCards(locations) {
        const container = document.getElementById('locationCardsContainer');

        container.innerHTML = '';

        // Handle empty state
        if (locations.length === 0) {
            container.innerHTML = `
                <div class="locations-empty">
                    <i class="fa-solid fa-location-dot"></i>
                    <p>No locations founds</p>
                </div>
            `;

            return;
        }
        
        // Build HTML for each location card
        const cardsHTML = locations.map(location => {
            // Calculate utilization percentage
            const utilization = location.utilization_percent || 0;

            // Determine progress bar color based on utilization
            let progressColor = 'low';          // Green (0-50%)
            if (utilization >= 80) {
                progressColor = 'high';         // Red (80%+)
            } else if (utilization >= 50) {
                progressColor = 'medium';       // Yellow (50-79%)
            }

            return `
                <div class="location-card">
                    <!-- Card Header -->
                    <div class="location-card-header">
                        <div class="location-name">
                            <i class="fa-solid fa-location-dot"></i>
                            <span>${location.name}</span>
                        </div>
                        <button class="location-edit-btn" data-location-id="${location.id}">
                            <i class="fa-solid fa-edit"></i>
                            Edit
                        </button>
                    </div>
                    
                    <!-- Capacity Display -->
                    <div class="location-capacity">
                        <div class="capacity-numbers">
                            <span class="capacity-current">${location.current_members}</span>
                            <span class="capacity-separator">/</span>
                            <span class="capacity-max">${location.capacity}</span>
                        </div>
                        <div class="capacity-label">Current Members / Total Capacity</div>
                        
                        <!-- Progress Bar -->
                        <div class="progress-bar-container">
                            <div class="progress-bar ${progressColor}" style="width: ${utilization}%"></div>
                        </div>
                        <div class="utilization-percent">${utilization}% Capacity</div>
                    </div>
                    
                    <!-- Stats Grid -->
                    <div class="location-stats">
                        <div class="location-stat-item">
                            <div class="location-stat-label">Staff Count</div>
                            <div class="location-stat-value">
                                <i class="fa-solid fa-user-tie"></i>
                                ${location.staff_count}
                            </div>
                        </div>
                        <div class="location-stat-item">
                            <div class="location-stat-label">Check-ins Today</div>
                            <div class="location-stat-value">
                                <i class="fa-solid fa-clipboard-check"></i>
                                ${location.checkins_today}
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        container.innerHTML = cardsHTML;
    }

    /* ============================================
       INITIALIZE CHARTS
       Set up Chart.js visualization
       ============================================ */

    async function initCharts() {
        // Destroy existing charts before recreating
        // Prevents "Canvas already in use" errors
        if (comparisonChart) {
            comparisonChart.destroy();
            comparisonChart = null;
        }

        if (capacityChart) {
            capacityChart.destroy();
            capacityChart = null;
        }

        await initComparisonChart();
        await initCapacityChart();
    }

    /* ============================================
       COMPARISON DOUGHNUT CHART
       Shows member distribution by location
       ============================================ */

    async function initComparisonChart() {
        try {
            const response = await fetch(`${API_BASE_URL}/locations/chart/comparison`);
            const data = await response.json();

            const ctx = document.getElementById('comparisonChart').getContext('2d');

            comparisonChart = new Chart(ctx, {
                type: 'doughnut', 
                data: data, 
                options: {
                    responsive: true, 
                    maintainAspectRatio: false, 
                    plugins: {
                        legend: {
                            position: 'bottom', 
                            labels: {
                                color: '#aaa', 
                                font: {
                                    size: 11
                                }, 
                                padding: 15
                            }
                        }
                    }, 
                    tooltip: {
                        callbacks: {
                            // Show percentage in tooltip
                            label: function(context) {
                                const label = context.label || '';
                                const value = context.parsed || 0;
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
                                return `${label}: ${value} members (${percentage}%)`;
                            }
                        }
                    }
                }
            });

        } catch (error) {
            console.error('Failed to init comparison chart', error);
        }
    }

    /* ============================================
       CAPACITY HORIZONTAL BAR CHART
       Shows filled vs available capacity
       ============================================ */

    async function initCapacityChart() {
        try {
            const response = await fetch(`${API_BASE_URL}/locations/chart/capacity`);
            const data = await response.json();

            const ctx = document.getElementById('capacityChart').getContext('2d');

            capacityChart = new Chart(ctx, {
                type: 'bar', 
                data: data, 
                options: {
                    indexAxis: 'y',         // Horizontal bars (y-axis = location names)
                    responsive: true, 
                    maintainAspectRatio: false, 
                    plugins: {
                        legend: {
                            position: 'bottom', 
                            labels: {
                                color: '#aaa', 
                                font: {
                                    size: 11
                                }, 
                                padding: 15
                            }
                        }
                    }, 
                    scales: {
                        x: {
                            // Horizontal axis (capacity numbers)
                            stacked: true,      // Stack members + available
                            grid: {
                                color: '#333'
                            }, 
                            ticks: {
                                color: '#aaa', 
                                font: {
                                    size: 10
                                }
                            }
                        }, 
                        y: {
                            // Vertical axis (location names)
                            stacked: true, 
                            grid: {
                                display: false
                            }, 
                            ticks: {
                                color: '#aaa', 
                                font: {
                                    size: 11
                                }
                            }
                        }
                    }
                }
            });

        } catch (error) {
            console.error('Failed to init capacity chart:', error);
        }
    }

    /* ============================================
       SET UP EVENT LISTENERS
       Handle user interactions
       ============================================ */

    function setupEventListeners() {
        // Edit buttons (using event delegation for dynamic elements)
        const locationCardsContainer = document.getElementById('locationCardsContainer');
        locationCardsContainer.addEventListener('click', (e) => {
            const editBtn = e.target.closest('.location-edit-btn');

            if (editBtn) {
                const locationId = editBtn.dataset.locationId;
                openEditModal(locationId);
            }
        });

        // Edit form submit
        document.getElementById('editLocationForm').addEventListener('submit', handleEditLocation);
    }

    /* ============================================
       OPEN EDIT MODAL
       Show modal to update location capacity
       ============================================ */

    async function openEditModal(locationId) {
        try {
            // Fetch location details
            const response = await fetch(`${API_BASE_URL}/locations/${locationId}`);

            if (!response.ok) {
                throw new Error('Failed to fetch location details');
            }

            const location = await response.json();

            // Populate form fields
            document.getElementById('editLocationId').value = location.id;
            document.getElementById('editLocationName').value = location.name;
            document.getElementById('editLocationCapacity').value = location.capacity;

            // Populate current stats (read-only info)
            document.getElementById('editLocationMembers').textContent = location.current_members;
            document.getElementById('editLocationStaff').textContent = location.staff_count;
            document.getElementById('editLocationUtilization').textContent = location.utilization_percent + '%';

            // Clear any error messages
            const errorDiv = document.getElementById('editLocationError');
            if (errorDiv) {
                errorDiv.style.display = 'none';
            }

            // Open modal
            const modal = document.getElementById('editLocationModal');
            modal.classList.add('show');
            modal.setAttribute('aria-hidden', 'false');
            document.body.style.overflow = 'hidden';

            // Focus capacity input for better UX
            setTimeout(() => {
                document.getElementById('editLocationCapacity').focus();
            }, 100);

        } catch (error) {
            console.error('Failed to load location details:', error);
            showNotification('Error loading location details', 'error');
        }
    }

    /* ============================================
       HANDLE EDIT LOCATION
       Submit form to update capacity
       ============================================ */

    async function handleEditLocation(e) {
        e.preventDefault();     // Prevent default form submission

        // Get location ID from hidden field
        const locationId = document.getElementById('editLocationId').value;

        // Get new capacity value
        const capacity = parseInt(document.getElementById('editLocationCapacity').value);

        // Validate capacity
        if (!capacity || capacity < 1) {
            showModalError('editLocationError', 'Capacity must be a positive number');
            return;
        }

        // Show loading state on submit button
        const submitBtn = document.getElementById('submitEditLocation');
        const originalBtnText = submitBtn.innerHTML;
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';

        try {
            const response = await fetch(`${API_BASE_URL}/locations/${locationId}`, {
                method: 'PUT', 
                headers: { 'Content-Type': 'application/json' }, 
                body: JSON.stringify({ capacity })
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Failed to update location');
            }

            // Close modal
            const modal = document.getElementById('editLocationModal');

            // Remove focus before closing (accessibility)
            document.activeElement.blur();

            modal.classList.remove('show');
            modal.setAttribute('aria-hidden', 'true');
            document.body.style.overflow = '';

            // Show success notification
            showNotification('Location updated successfully!', 'success');

            // Refresh all data to show new capacity
            await fetchStats();
            await fetchLocations();
            await initCharts();

        } catch (error) {
            console.error('Failed to update location:', error);
            showModalError('editLocationError', error.message);
        } finally {
            // Reset button state
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalBtnText;
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

});