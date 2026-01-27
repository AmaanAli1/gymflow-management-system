/* ============================================
   ADMIN DASHBOARD
   Populate KPIs, charts, activity feed
   ============================================ */

document.addEventListener('DOMContentLoaded', () => {
    
    /* ========================================
       MINIMAL MOCK DATA
       (Will be replaced with API calls later)
       ======================================== */
    
    const mockDashboardData = {
        // KPI Cards
        kpis: {
            totalMembers: 1284,
            monthlyRevenue: 58920,
            inventoryHealth: 92,
            activeTrainers: 18  // Fixed typo: was 'activeTraiers'
        },
        
        // Branch Performance
        branches: [
            { name: 'Downtown', members: 540, capacity: 600, status: 'Best', utilization: 90 },
            { name: 'Midtown', members: 420, capacity: 550, status: 'Stable', utilization: 76 },
            { name: 'Eastside', members: 324, capacity: 500, status: 'Growth', utilization: 65 }
        ],
        
        // Recent Activity
        recentActivity: [
            { type: 'member', message: 'New member joined Premium at Downtown', time: '5 min ago' },
            { type: 'payment', message: 'Invoice recorded for Elite plan', time: '12 min ago' },
            { type: 'stock', message: 'Reorder triggered: Cleaning Wipes', time: '1 hour ago' },
            { type: 'checkin', message: 'Peak traffic detected at Midtown 6-8pm', time: '2 hours ago' }
        ],
        
        // Charts Data
        membershipGrowth: {
            labels: ['May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct'],
            datasets: [
                {
                    label: 'Downtown',
                    data: [380, 410, 435, 460, 495, 540],
                    borderColor: '#e60030',
                    backgroundColor: 'rgba(230, 0, 48, 0.15)'
                },
                {
                    label: 'Midtown',
                    data: [310, 335, 350, 370, 390, 420],
                    borderColor: '#24c063',
                    backgroundColor: 'rgba(36, 192, 99, 0.15)'
                },
                {
                    label: 'Eastside',
                    data: [240, 260, 280, 290, 310, 324],
                    borderColor: '#3498db',
                    backgroundColor: 'rgba(52, 152, 219, 0.15)'
                }
            ]
        },
        
        revenueByLocation: {
            labels: ['Downtown', 'Midtown', 'Eastside'],
            data: [32400, 25200, 19440]
        },
        
        // Inventory Alerts
        inventoryAlerts: [
            { item: 'Protein Bars', status: 'warn', message: 'Below threshold' },
            { item: 'Dumbbells', status: 'ok', message: 'Optimal stock' },
            { item: 'Towels', status: 'ok', message: 'Restocked' },
            { item: 'Energy Drinks', status: 'warn', message: 'Reorder required' }
        ],
        
        // System Health
        systemHealth: [
            { service: 'App Server', status: 'ok', message: 'Online' },
            { service: 'Database', status: 'ok', message: 'Connected' },
            { service: 'API Response Time', status: 'ok', message: 'Stable' },
            { service: 'Scheduled Backup', status: 'warn', message: 'Due in 2 hours' }
        ]
    };

    /* ========================================
       POPULATE KPI CARDS
       ======================================== */
    
    function updateKPIs(kpis) {
        // Update each KPI card using data-metric attribute
        document.querySelector('[data-metric="totalMembers"]').textContent = 
            window.GymFlow.formatNumber(kpis.totalMembers);
        
        document.querySelector('[data-metric="monthlyRevenue"]').textContent = 
            window.GymFlow.formatCurrency(kpis.monthlyRevenue);
        
        document.querySelector('[data-metric="inventoryHealth"]').textContent = 
            `${kpis.inventoryHealth}%`;
        
        document.querySelector('[data-metric="activeTrainers"]').textContent = 
            kpis.activeTrainers;
    }
    
    /* ========================================
       POPULATE BRANCH PERFORMANCE
       ======================================== */
    
    function updateBranches(branches) {
        const container = document.getElementById('branchCards');
        
        if (!container) {
            console.warn('Branch list container not found');
            return;
        }
        
        // Clear existing content
        container.innerHTML = '';
        
        // Create list
        const list = document.createElement('ul');
        list.className = 'branch-list';
        
        // Create a list item for each branch
        branches.forEach(branch => {
            const li = document.createElement('li');
            
            li.innerHTML = `
                <span class="branch-name">${branch.name}</span>
                <span class="branch-metric">${branch.status} · ${branch.members} members · ${branch.utilization}% cap</span>
            `;
            
            list.appendChild(li);
        });
        
        container.appendChild(list);
    }
    
    /* ========================================
       POPULATE RECENT ACTIVITY FEED
       ======================================== */
    
    function updateActivity(activities) {
    const container = document.getElementById('activityFeed');
    
    if (!container) {
        console.warn('Activity feed container not found');
        return;
    }
    
    container.innerHTML = '';
    
    // Create initial activities
    activities.forEach(activity => {
        const item = document.createElement('div');
        item.className = 'activity-item';
        
        // Determine pill class based on type
        let pillClass = '';
        let pillText = '';
        switch(activity.type) {
            case 'member':
                pillClass = 'add';
                pillText = '+ Member';
                break;
            case 'payment':
                pillClass = 'pay';
                pillText = '$ Payment';
                break;
            case 'stock':
                pillClass = 'stock';
                pillText = 'Stock';
                break;
            case 'checkin':
                pillClass = 'check';
                pillText = 'Check-in';
                break;
        }
        
        item.innerHTML = `
            <span class="pill ${pillClass}">${pillText}</span> ${activity.message}
            <div class="activity-time">${activity.time}</div>
        `;
        
        container.appendChild(item);
    });
}
    
    
    /* ========================================
       CREATE CHARTS (Chart.js)
       ======================================== */
    
    // Store chart instances so we can update them later
    let membershipChartInstance = null;
    let revenueChartInstance = null;
    
    function createMembershipChart(data) {
        const canvas = document.getElementById('membershipChart');
        
        if (!canvas) {
            console.warn('Membership chart canvas not found');
            return;
        }
        
        // Check if Chart.js is loaded
        if (typeof Chart === 'undefined') {
            console.error('❌ Chart.js not loaded! Include it in HTML.');
            return;
        }

        // Destroy existing chart before recreating
        if (membershipChartInstance) {
            membershipChartInstance.destroy();
            membershipChartInstance = null;
        }

        // Safety Check: make sure data exists
        if (!data || !data.labels || !data.datasets) {
            console.error('❌ Invalid chart data:', data);
            return;
        }
        
        membershipChartInstance = new Chart(canvas, {
            type: 'line',
            data: {
                labels: data.labels,
                datasets: data.datasets.map(ds => ({
                    label: ds.label, 
                    data: ds.data, 
                    borderColor: ds.borderColor, 
                    backgroundColor: ds.backgroundColor, 
                    tension: 0.35,
                    fill: true,
                    pointRadius: 4,
                    pointHoverRadius: 6
                }))
            },
            options: {
                responsive: true, 
                maintainAspectRatio: false, 
                plugins: {
                    legend: {
                        labels: {
                            color: '#eee', 
                            font: { size: 12 }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true, 
                        ticks: { color : '#aaa' }, 
                        grid: { color: '#2a2a2a' }
                    },
                    x: {
                        ticks: { color: '#aaa' }, 
                        grid: { color: '#2a2a2a' }
                    }
                }
            }
        });
    }
    
    function createRevenueChart(data) {
        const canvas = document.getElementById('revenueChart');
        
        if (!canvas) {
            console.warn('Revenue chart canvas not found');
            return;
        }
        
        if (typeof Chart === 'undefined') {
            console.error('❌ Chart.js not loaded!');
            return;
        }

        // Destroy existing chart before recreating
        if (revenueChartInstance) {
            revenueChartInstance.destroy();
            revenueChartInstance = null;
        }
        
        revenueChartInstance = new Chart(canvas, {
            type: 'bar',
            data: {
                labels: data.labels,
                datasets: [{
                    label: 'Revenue',
                    data: data.data,
                    backgroundColor: [
                        'rgba(230, 0, 48, 0.8)',
                        'rgba(36, 192, 99, 0.8)',
                        'rgba(52, 152, 219, 0.8)'
                    ],
                    borderColor: [
                        '#e60030',
                        '#24c063',
                        '#3498db'
                    ],
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false, // Let chart fill container smoothly
                plugins: {
                    legend: {
                        display: false // Hide legend for simple bar chart
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: { 
                            color: '#aaa',
                            callback: (value) => '$' + value.toLocaleString()
                        },
                        grid: { color: '#2a2a2a' }
                    },
                    x: {
                        ticks: { color: '#aaa' },
                        grid: { display: false }
                    }
                }
            }
        });
    }
    
    /* ========================================
       POPULATE INVENTORY ALERTS
       ======================================== */
    
    function updateInventoryAlerts(alerts) {
        const container = document.getElementById('inventoryAlerts');
        
        if (!container) return;
        
        container.innerHTML = '';
        
        alerts.forEach(alert => {
            const li = document.createElement('li');

            // Determine dot class based on status
            let dotClass = 'dot-ok';    // Default green
            if (alert.status === 'low') {
                dotClass = 'dot-warn';  // yellow
            } else if (alert.status === 'critical') {
                dotClass = 'dot-critical';  // red
            }

            li.innerHTML = `
                <span class="dot dot-${alert.status}"></span>
                <strong>${alert.item}:</strong> ${alert.message}
            `;
            container.appendChild(li);
        });
    }
    
    
    /* ========================================
       POPULATE SYSTEM HEALTH
       ======================================== */
    
    function updateSystemHealth(health) {
        const container = document.getElementById('systemHealth');
        
        if (!container) return;
        
        container.innerHTML = '';
        
        health.forEach(item => {
            const li = document.createElement('li');
            li.innerHTML = `
                <span class="dot dot-${item.status}"></span>
                ${item.service}: <strong>${item.message}</strong>
            `;
            container.appendChild(li);
        });
    }
    
    
/* ========================================
   FETCH DASHBOARD DATA FROM REAL API
   ======================================== */

async function fetchDashboardData() {
    try {
        console.log('🔄 Fetching dashboard data from API...');

        // Show loading state
        document.body.style.cursor = 'wait';

        // Fetch data from backend API
        const response = await fetch('http://127.0.0.1:5000/api/dashboard');

        // Check if request was successful
        if (!response.ok) {
            throw new Error(`HTTP error! stautus: ${response.status}`);
        }

        // Parse JSON response
        const data = await response.json();

        console.log('✅ Data Received from API:', data);

        // Update all dashboard sections with REAL data
        updateKPIs(data.kpis);
        updateBranches(data.branches);
        updateActivity(mockDashboardData.recentActivity);   // Still mock for now
        createMembershipChart(data.membershipGrowth);
        createRevenueChart(data.revenueByLocation);
        updateInventoryAlerts(data.inventoryAlerts);
        updateSystemHealth(data.systemHealth);

        // Remove loading cursor
        document.body.style.cursor = 'default';

        console.log('✅ Dashboard loaded');

    } catch (error) {
        console.error('❌ Failed to load dashboard data:', error);

        // Remove loading cursor
        document.body.style.cursor = 'default';

        // Show error to user
        alert('⚠️ Could not connect to backend server. Make sure Node server is running on port 5000.');

        // Fallback to mock data
        console.log('⚠️ Using mock data as fallback');
        initDashboardWithMockData();
    }
}

/* ========================================
  FALLBACK: Use Mock Data if API Fails
  ======================================== */

function initDashboardWithMockData() {
    console.log('📦 Loading dashboard with mock data...');

    updateKPIs(mockDashboardData.kpis);
    updateBranches(mockDashboardData.branches);
    updateActivity(mockDashboardData.recentActivity);
    createMembershipChart(mockDashboardData.membershipGrowth);
    createRevenueChart(mockDashboardData.revenueByLocation);
    updateInventoryAlerts(mockDashboardData.inventoryAlerts);
    updateSystemHealth(mockDashboardData.systemHealth);

    console.log('✅ Mock data loaded');
}

/* ========================================
   INITIALIZE DASHBOARD
   Fetch from API when page loads
   ======================================== */

// Run when page loads - FETCH FROM REAL API!
fetchDashboardData();

/* ========================================
   AUTO-SCROLL ACTIVITY FEED
   Add new activity every 6 seconds
   ======================================== */

// Array of possible activities
const activityEvents = [
    { type: 'member', message: 'New Basic member joined at Eastside' },
    { type: 'payment', message: 'Annual Elite plan renewed at Downtown' },
    { type: 'stock', message: 'Protein bars reorder placed for Midtown' },
    { type: 'checkin', message: 'Peak load detected at Downtown (07:00-09:00)' },
    { type: 'member', message: 'New Premium member joined at Downtown' },
    { type: 'payment', message: 'Monthly Basic plan payment received' },
    { type: 'stock', message: 'Towels restocked at all locations' },
    { type: 'checkin', message: 'High traffic at Midtown (18:00-20:00)' },
    { type: 'member', message: 'Member upgraded to Elite plan at Midtown' },
    { type: 'stock', message: 'Dumbbells maintenance completed' }
];

function addNewActivity() {
    const container = document.getElementById('activityFeed');
    if (!container) return;
    
    // Pick random activity
    const randomActivity = activityEvents[Math.floor(Math.random() * activityEvents.length)];
    
    // Determine pill styling
    let pillClass = '';
    let pillText = '';
    switch(randomActivity.type) {
        case 'member':
            pillClass = 'add';
            pillText = '+ Member';
            break;
        case 'payment':
            pillClass = 'pay';
            pillText = '$ Payment';
            break;
        case 'stock':
            pillClass = 'stock';
            pillText = 'Stock';
            break;
        case 'checkin':
            pillClass = 'check';
            pillText = 'Check-in';
            break;
    }
    
    // Create new activity item
    const item = document.createElement('div');
    item.className = 'activity-item';
    item.style.opacity = '0';
    item.innerHTML = `
        <span class="pill ${pillClass}">${pillText}</span> ${randomActivity.message}
        <div class="activity-time">Just now</div>
    `;
    
    // Add to top of list
    container.prepend(item);
    
    // Animate in
    requestAnimationFrame(() => {
        item.style.transition = 'all 0.35s ease';
        item.style.opacity = '1';
    });
    
    // Scroll to top smoothly
    container.scrollTo({
        top: 0,
        behavior: 'smooth'
    });
    
    // Keep max 10 items
    while (container.children.length > 10) {
        container.lastElementChild.remove();
    }
    
}

// Add new activity every 6 seconds
setInterval(addNewActivity, 6000);
});