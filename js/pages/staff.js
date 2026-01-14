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
                  <div class="table-actions">
                     <button class="table-action-btn view" data-staff-id="${staff.id}" title="View details">
                        <i class="fa-solid fa-eye"></i>
                     </button>
                     <button class="table-action-btn edit" data-staff-id="${staff.id}" title="Edit staff">
                        <i class="fa-solid fa-pen"></i
                     </button>
                  </div>
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

      // View and Edit button clicks (event delegation)
      const tbody = document.getElementById('staffTableBody');
      tbody.addEventListener('click', (e) => {
         // Check if clicked element is a view button (or its icon)
         const viewBtn = e.target.closest('.table-action-btn.view');
         const editBtn = e.target.closest('.table-action-btn.edit');

         if (viewBtn) {
            const staffId = viewBtn.dataset.staffId;
            viewStaff(staffId);
         } else if (editBtn) {
            const staffId = editBtn.dataset.staffId;
            editStaff(staffId);
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
      switchToViewMode();
   });

   // Close panel when clicking overlay
   document.getElementById('staffDetailPanel')?.addEventListener('click', (e) => {
      if (e.target.id === 'staffDetailPanel') {
         document.getElementById('staffDetailPanel').classList.remove('active');
         switchToViewMode();
      }
   });

   /* ============================================
      SLIDE PANEL MODE SWITCHING
      Switch between View, Edit, Delete modes
      ============================================ */

   function switchToViewMode() {

      // Hide edit and delete sections
      document.querySelector('.slide-panel-edit').style.display = 'none';
      document.querySelector('.slide-panel-delete').style.display = 'none';

      // Show view section
      document.querySelector('.slide-panel-view').style.display = 'block';

      // Show view buttons, hide edit/delete buttons
      document.getElementById('viewModeButtons').style.display = 'flex';
      document.getElementById('editModeButtons').style.display = 'none';
      document.getElementById('deleteModeButtons').style.display = 'none';

      // Hide any error/success messages
      const editError = document.getElementById('editErrorMessage');
      const editSuccess = document.getElementById('editSuccessMessage');
      if (editError) editError.style.display = 'none';
      if (editSuccess) editSuccess.style.display = 'none';
   }

   function switchToEditMode(staff) {

      // Hide view and delete sections
      document.querySelector('.slide-panel-view').style.display = 'none';
      document.querySelector('.slide-panel-delete').style.display = 'none';

      // Show edit section
      document.querySelector('.slide-panel-edit').style.display = 'block';

      // Hide view and delete buttons, show edit buttons
      document.getElementById('viewModeButtons').style.display = 'none';
      document.getElementById('editModeButtons').style.display = 'flex';
      document.getElementById('deleteModeButtons').style.display = 'none';

      // Populate the edit form with current data
      populateEditForm(staff);
   }

   /* ============================================
      POPULATE EDIT FORM
      Fill form with current staff data
      ============================================ */

   async function populateEditForm(staff) {

      // Store staff ID in hidden field
      document.getElementById('editStaffId').value = staff.id;

      // Populate form fields
      document.getElementById('editName').value = staff.name || '';
      document.getElementById('editEmail').value = staff.email || '';
      document.getElementById('editPhone').value = staff.phone || '';
      document.getElementById('editEmergencyContact').value = staff.emergency_contact || '';
      document.getElementById('editEmergencyPhone').value = staff.emergency_phone || '';
      document.getElementById('editRole').value = staff.role || '';
      document.getElementById('editStatus').value = staff.status || 'active';
      document.getElementById('editNotes').value = staff.notes || '';

      // Format hire date for input (YYYY-MM-DD)
      if (staff.hire_date) {
         const hireDate = new Date(staff.hire_date);
         const formattedDate = hireDate.toISOString().split('T')[0];
         document.getElementById('editHireDate').value = formattedDate;
      }

      // Hourly rate
      document.getElementById('editHourlyRate').value = staff.hourly_rate || '';

      // Populate location dropdown
      await populateEditLocationDropdown();

      // Set selected location
      document.getElementById('editLocation').value = staff.location_id || '';
   }

   /* ============================================
      POPULATE EDIT LOCATION DROPDOWN
      Load locations from API for edit form
      ============================================ */

   async function populateEditLocationDropdown() {
      try {
         const response = await fetch(`${API_BASE_URL}/locations`);
         const locations = await response.json();

         const dropdown = document.getElementById('editLocation');
         dropdown.innerHTML = '<option value="">Select location...</option>';

         locations.forEach(location => {
            const option = document.createElement('option');
            option.value = location.id;
            option.textContent = location.name;
            dropdown.appendChild(option);
         });

      } catch (error) {
         console.error('❌ Failed to load locations for edit form:', error);
      }
   }

   /* ============================================
      EDIT STAFF
      Open slide panel in edit mode
      ============================================ */

   async function editStaff(staffId) {

      // Find the staff member in our array
      const staff = allStaff.find(s => s.id === parseInt(staffId));

      if (!staff) {
         console.error(`❌ Staff ${staffId} not found`);
         return;
      }

      // Open the panel first (if not already open)
      const panel = document.getElementById('staffDetailPanel');
      if (!panel.classList.contains('active')) {
         // Populate header
         document.getElementById('panelStaffName').textContent = staff.name;
         document.getElementById('panelStaffID').textContent = `ID: ${staff.staff_id}`;

         // Show panel
         panel.classList.add('active');
      }

      // Switch to edit mode
      switchToEditMode(staff);
   }

   /* ============================================
      SAVE STAFF CHANGES
      Submit edit form and update database
      ============================================ */

   async function saveStaffChanges(e) {
      e.preventDefault();  // Prevent form submission

      // Get staff ID
      const staffId = document.getElementById('editStaffId').value;

      // Get form data
      const form = document.getElementById('editStaffForm');
      const formData = new FormData(form);

      const staffData = {
         name: formData.get('name'), 
         email: formData.get('email'), 
         phone: formData.get('phone'), 
         emergency_contact: formData.get('emergency_contact') || null, 
         emergency_phone: formData.get('emergency_phone') || null, 
         role: formData.get('role'), 
         location_id: parseInt(formData.get('location_id')), 
         hire_date: formData.get('hire_date'), 
         hourly_rate: formData.get('hourly_rate') ? parseFloat(formData.get('hourly_rate')) : null, 
         status: formData.get('status'), 
         notes: formData.get('notes') || null
      };

      console.log('📤 Updated staff data:', staffData);

      // Hide previous messages
      const errorMsg = document.getElementById('editErrorMessage');
      const successMsg = document.getElementById('editSuccessMessage');
      if (errorMsg) errorMsg.style.display = 'none';
      if (successMsg) successMsg.style.display = 'none';

      // Disable save button with loading spinner
      const saveBtn = document.getElementById('saveEditBtn');
      const originalBtnText = saveBtn.innerHTML;
      saveBtn.disabled = true;
      saveBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';

      try {
         // Send PUT request to API
         const response = await fetch(`${API_BASE_URL}/staff/${staffId}`, {
            method: 'PUT', 
            headers: {
               'Content-Type': 'application/json'
            }, 
            body: JSON.stringify(staffData)
         });

         const result = await response.json();

         if (!response.ok) {
            throw new Error(result.error || 'Failed to update staff member');
         }

         console.log('✅ Staff member updated:', result);

         // Show success message
         if (successMsg) {
            successMsg.textContent = '✅ Staff member updated successfully!';
            successMsg.style.display = 'block';
         }

         // Update the staff in allStaff array
         const index = allStaff.findIndex(s => s.id == staffId);
         if (index !== -1) {
            // Merge updated data with existing data
            allStaff[index] = { ...allStaff[index], ...result.staff };
         }

         // Wait 1 second, then switch back to view mode
         setTimeout(() => {
            // Update view mode with new data
            viewStaff(staffId);

            // Switch to view mode
            switchToViewMode();

            // Hide success message
            if (successMsg) successMsg.style.display = 'none';

            // Re-enable button
            saveBtn.disabled = false;
            saveBtn.innerHTML = originalBtnText;

            // Refresh table to show updated data
            fetchStaff();
            fetchStats();
         }, 1000);

      } catch (error) {
         console.error('❌ Failed to save staff changes:', error);

         // Show error message
         if (errorMsg) {
         errorMsg.textContent = `❌ ${error.message}`;
         errorMsg.style.display = 'block';
      }

         // Re-enable button
         saveBtn.disabled = true;
         saveBtn.innerHTML = originalBtnText;

      }
   }

   /* ============================================
      SLIDE PANEL EVENT LISTENERS
      ============================================ */

   // Edit button (in panel footer)
   document.getElementById('editStaffBtn')?.addEventListener('click', () => {
      const staffId = document.getElementById('editStaffBtn').dataset.staffId;
      if (staffId) {
         editStaff(staffId);
      }
   });

   // Cancel edit button
   document.getElementById('cancelEditBtn')?.addEventListener('click', () => {
      switchToViewMode();
   });

   // Save changes button
   document.getElementById('saveEditBtn')?.addEventListener('click', saveStaffChanges);

   // Also handle form submission (pressing Enter)
   document.getElementById('editStaffForm')?.addEventListener('submit', saveStaffChanges);

   /* ============================================
      MAKE FUNCTIONS GLOBALLY ACCESSIBLE
      ============================================ */

   window.viewStaff = viewStaff;
   window.editStaff = editStaff;
   window.fetchStaff = fetchStaff;
   window.fetchStats = fetchStats;

});