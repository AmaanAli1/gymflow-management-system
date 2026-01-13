/* ============================================
   STAFF.JS
   Handles all staff management functionality
   ============================================ */

document.addEventListener('DOMContentLoaded', async () => {

   /* ========================================
       API CONFIGURATION
       ======================================== */
    
   const API_BASE_URL = 'http://127.0.0.1:5000/api';

   /* ============================================
      GLOBAL VARIABLES
      ============================================ */

      // Store all staff data globally (so we can filter/sort without re-fetching)
      let allStaff = [];

      // Store current sort table
      let currentSort = {
         column: 'name',   // Which column we're sorting by
         direction: 'asc'  // 'asc' or 'desc'
      };

   /* ============================================
      INITIALIZATION
      Run when page loads
      ============================================ */

      // Fetch and display data
      await fetchStats();        // Get KPI numbers
      await fetchStaff();        // Get all staff members
      await populateLocationFilter();  // Populate location dropdown

      // Set up event listeners
      setupEventListeners();

      console.log('✅ Staff page initialized!');
   

   /* ============================================
      FETCH STATS FROM API
      Populate the KPI cards at the top
      ============================================ */

   async function fetchStats() {

      try {
         // Call the stats endpoint
         const response = await fetch(`${API_BASE_URL}/staff/stats`);

         if (!response.ok) {
         throw new Error(`HTTP error! status: ${response.status}`);
         }

         const stats = await response.json();
         console.log('✅ Stats received:', stats);

         // Update KPI cards using data-stat attributes
         document.querySelector('[data-stat="totalStaff"]').textContent = stats.total || 0;
         document.querySelector('[data-stat="activeStaff"]').textContent = stats.active || 0;
         document.querySelector('[data-stat="newThisMonth"]').textContent = stats.newThisMonth || 0;

         // For "By Role" - show the most common role and its count
         const byRoleElement = document.querySelector('[data-stat="cancelledStaff"]');
         if (stats.byRoleName && stats.byRole) {
         byRoleElement.textContent = `${stats.byRoleName} (${stats.byRole})`;
         } else {
            byRoleElement.textContent = 'N/A';
         }

      } catch (error) {
         console.error('❌ Failed to fetch stats:', error);
         // Show fallback values
         document.querySelector('[data-stat="totalStaff"]').textContent = '---';
         document.querySelector('[data-stat="activeStaff"]').textContent = '---';
         document.querySelector('[data-stat="newThisMonth"]').textContent = '---';
         document.querySelector('[data-stat="cancelledStaff"]').textContent = '---';
      }
   }

   /* ============================================
      FETCH ALL STAFF FROM API
      Get the staff data and store it globally
      ============================================ */

   async function fetchStaff() {

      try {
         // Call the staff endpoint
         const response = await fetch(`${API_BASE_URL}/staff`);

         if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
         }

         const data = await response.json();

         // API returns
         allStaff = data.staff || [];

         console.log(`✅ Received ${allStaff.length} staff members`);

         // Display them in the table
         populateTable(allStaff);

      } catch (error) {
         console.error('❌ Failed to fetch staff:', error);

         // Show error in table
         const tbody = document.getElementById('staffTableBody');
         tbody.innerHTML = `
            <tr>
               <td colspan="9" class="table-error">
                  <i class="fa-solid fa-exclamation-triangle"></i>
                  <p>Failed to load staff. Please refresh the page.</p>
               </td>
            </tr>
         `;
      }
   }

   /* ============================================
      POPULATE STAFF TABLE
      Display staff data in the table
      ============================================ */

   function populateTable(staffArray) {
      const tbody = document.getElementById('staffTableBody');

      // If no staff, show empty state
      if (staffArray.length === 0) {
         tbody.innerHTML = `
            <tr>
               <td colspan="9" class="table-empty">
                  <i class="fa-solid fa-user-slash"></i>
                  <p>No staff members found</p>
               </td>
            </tr>
         `;
         return;
      }

      // Build table rows
      // WHY map? Creates array of HTML strings, then join into one string
      const rows = staffArray.map(staff => {
         // Format hire date
         const hireDate = new Date(staff.hire_date).toLocaleDateString('en-US', {
            year: 'numeric', 
            month: 'short', 
            day: 'numeric'
         });

         // Determine status pill class
         // Different colors for different statuses
         let statusClass = 'success';
         if (staff.status === 'on_leave') statusClass = 'warning';
         if (staff.status === 'terminated') statusClass = 'danger';
         if (staff.status === 'inactive') statusClass = 'inactive';

         // Format status text
         let statusText = staff.status;
         if (staff.status === 'on_leave') statusText = 'On Leave';

         return `
            <tr data-staff-id="${staff.id}">
               <td>${staff.staff_id || 'N/A'}</td>
               <td>${staff.name}</td>
               <td>${staff.email}</td>
               <td>${staff.phone || 'N/A'}</td>
               <td>${staff.role}</td>
               <td>${staff.location_name || 'N/A'}</td>
               <td>${hireDate}</td>
               <td><span class="pill ${statusClass}">${statusText}</span></td>
               <td>
                  <button class="table-action-btn view" data-staff-id="${staff.id}" title="View details">
                     <i class="fa-solid fa-eye"></i>
                  </button>
               </td>
            </tr>
         `;
      }).join('');

      tbody.innerHTML = rows;
   }

   /* ============================================
      POPULATE LOCATION FILTER DROPDOWN
      Get locations from API and populate filter
      ============================================ */

   async function populateLocationFilter() {
      try {
         // Fetch locations from API
         const response = await fetch(`${API_BASE_URL}/locations`);
         const locations = await response.json();

         // Get the filter dropdown
         const filterDropdown = document.getElementById('filterLocation');

         // Add location options
         locations.forEach(location => {
            const option = document.createElement('option');
            option.value = location.id;
            option.textContent = location.name;
            filterDropdown.appendChild(option);
         });

      } catch (error) {
         console.error('❌ Failed to load locations:', error);
      }
   }

   /* ============================================
      EVENT LISTENERS
      Set up all interactive elements
      ============================================ */

   function setupEventListeners() {

      // Search input
      // WHY 'input' event? Fires as user types (real-time search)
      const searchInput = document.getElementById('searchStaff');
      searchInput.addEventListener('input', handleSearch);

      // Filter dropdowns
      document.getElementById('filterRole').addEventListener('change', applyFilters);
      document.getElementById('filterLocation').addEventListener('change', applyFilters);
      document.getElementById('filterStatus').addEventListener('change', applyFilters);

      // Table header sorting
      // WHY querySelectorAll? Select all sortable column headers
      const sortableHeaders = document.querySelectorAll('.sortable');
      sortableHeaders.forEach(header => {
         header.addEventListener('click', () => {
            const column = header.dataset.sort;
            handleSort(column);
         });
      });

      // View button clicks (event delegation)
      const tbody = document.getElementById('staffTableBody');
      tbody.addEventListener('click', (e) => {
         // Check if clicked element is a view button (or its icon)
         const viewBtn = e.target.closest('.table-action-btn.view');
         if (viewBtn) {
            const staffId = viewBtn.dataset.staffId;
            viewStaff(staffId);
         }
      });
   }

   /* ============================================
      SEARCH FUNCTIONALITY
      Filter staff by search query
      ============================================ */

   function handleSearch(e) {
      const query = e.target.value.toLowerCase().trim();

      // If empty, show all staff
      if (query === '') {
         applyFilters();
         return;
      }

      // Filter staff by name, email, role, or staff_id
      // WHY includes? Checks if string contains the search query
      const filtered = allStaff.filter(staff => {
         return staff.name.toLowerCase().includes(query) || 
               staff.email.toLowerCase().includes(query) || 
               staff.role.toLowerCase().includes(query) || 
               (staff.staff_id && staff.staff_id.toLowerCase().includes(query));
      });
      populateTable(filtered);
   }

   /* ============================================
      APPLY FILTERS
      Filter staff by role, location, status
      ============================================ */

   function applyFilters() {
      // Get current filter values
      const roleFilter = document.getElementById('filterRole').value;
      const locationFilter = document.getElementById('filterLocation').value;
      const statusFilter = document.getElementById('filterStatus').value;
      const searchQuery = document.getElementById('searchStaff').value.toLowerCase().trim();

      // Start with all staff
      let filtered = [...allStaff];

      // Apply role filter
      // WHY 'all' check? Empty string or 'all' means no filter
      if (roleFilter && roleFilter !== 'all') {
         filtered = filtered.filter(staff => staff.role === roleFilter);
      }

      // Apply location filter
      if (locationFilter && locationFilter !== 'all') {
         // Convert to number because location_id is an integer
         filtered = filtered.filter(staff => staff.location_id === parseInt(locationFilter));
      }

      // Apply status filter
      if (statusFilter && statusFilter !== 'all') {
         filtered = filtered.filter(staff => staff.status === statusFilter);
      }

      // Apply search if there's a query
      if (searchQuery) {
         filtered = filtered.filter(staff => {
            return staff.name.toLowerCase().includes(searchQuery) || 
                  staff.email.toLowerCase().includes(searchQuery) || 
                  staff.role.toLowerCase().includes(searchQuery) || 
                  (staff.staff_id && staff.staff_id.toLowerCase().includes(searchQuery));
         });
      }
      populateTable(filtered);
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

      // Sort the allStaff array
      // WHY sort in place? Modifies the original array
      allStaff.sort((a, b) => {
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
      // Remove all sort classes first
      document.querySelectorAll('.sortable').forEach(header => {
         header.classList.remove('sort-asc', 'sort-desc');
      });

      // Add class to current sorted column
      const currentHeader = document.querySelector(`[data-sort="${column}"]`);
      if (currentHeader) {
         currentHeader.classList.add(`sort-${currentSort.direction}`);
      }

      // Re-apply filters (which will use the sorted array)
      applyFilters();
   }

   /* ============================================
      VIEW STAFF DETAILS
      Open slide panel with staff info
      ============================================ */

   function viewStaff(staffId) {

      // Find the staff member in our array
      const staff = allStaff.find(s => s.id === parseInt(staffId));

      if (!staff) {
         console.error(`❌ Staff ${staffId} not found`);
         return;
      }

      // Populate slide panel with staff data
      document.getElementById('panelStaffName').textContent = staff.name;
      document.getElementById('panelStaffID').textContent = `ID: ${staff.staff_id}`;
      document.getElementById('panelStaffPhone').textContent = staff.phone || 'N/A';
      document.getElementById('panelStaffRole').textContent = staff.role;
      document.getElementById('panelStaffLocation').textContent = staff.location_name || 'N/A';
      document.getElementById('panelStaffEmailAddress').textContent = staff.email;

      // Format hire date
      const hireDate = new Date(staff.hire_date).toLocaleDateString('en-US', {
         year: 'numeric', 
         month: 'long', 
         day: 'numeric'
      });
      document.getElementById('panelStaffHireDate').textContent = hireDate;

      // Format status with pill
      const statusElement = document.getElementById('panelStaffStatus');
      let statusClass = 'success';
      let statusText = staff.status;

      if (staff.status === 'on_leave') {
         statusClass = 'warning';
         statusText = 'On Leave';
      } else if (staff.status === 'terminated') {
         statusClass = 'danger';
         statusText = 'Terminated';
      } else if (staff.status === 'inactive') {
         statusClass = 'inactive';
         statusText = 'Inactive';
      }

      statusElement.innerHTML = `<span class="pill ${statusClass}">${statusText}</span>`;

      // Calculate employment duration
      const hireDateTime = new Date(staff.hire_date);
      const now = new Date();
      const diffTime = Math.abs(now - hireDateTime);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      const years = Math.floor(diffDays / 365);
      const months = Math.floor((diffDays % 365) / 30);

      let durationText = '';
      if (years > 0) durationText += `${years} year${years > 1 ? 's' : ''}`;
      if (months > 0) {
         if (durationText) durationText += ', ';
         durationText += `${months} month${months > 1 ? 's' : ''}`;
      }
      if (!durationText) durationText = 'Less than a month';

      document.getElementById('panelStaffDuration').textContent = durationText;

      // Store staff ID for edit/delete operations
      document.getElementById('editStaffBtn').dataset.staffId = staff.id;
      document.getElementById('deleteStaffBtn').dataset.staffId = staff.id;

      // Show the slide panel
      document.getElementById('staffDetailPanel').classList.add('active');
   }

   // Close panel button
   document.getElementById('closeStaffPanel')?.addEventListener('click', () => {
      document.getElementById('staffDetailPanel').classList.remove('active');
   });

   // Close panel when clicking overlay
   document.getElementById('staffDetailPanel')?.addEventListener('click', (e) => {
      if (e.target.id === 'staffDetailPanel') {
         document.getElementById('staffDetailPanel').classList.remove('active');
      }
   });

   /* ============================================
      MAKE FUNCTIONS GLOBALLY ACCESSIBLE
      ============================================ */

   window.viewStaff = viewStaff;

});