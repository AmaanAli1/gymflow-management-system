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
                        <i class="fa-solid fa-pen"></i>
                     </button>
                     <button class="table-action-btn delete" data-staff-id="${staff.id}" title="Delete staff">
                        <i class="fa-solid fa-trash"></i>
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

      // View, Edit, and Delete button clicks (event delegation)
      const tbody = document.getElementById('staffTableBody');
      tbody.addEventListener('click', (e) => {
         // Check if clicked element is a view button (or its icon)
         const viewBtn = e.target.closest('.table-action-btn.view');
         const editBtn = e.target.closest('.table-action-btn.edit');
         const deleteBtn = e.target.closest('.table-action-btn.delete');

         if (viewBtn) {
            const staffId = viewBtn.dataset.staffId;
            viewStaff(staffId);
         } else if (editBtn) {
            const staffId = editBtn.dataset.staffId;
            editStaff(staffId);
         } else if (deleteBtn) {
            const staffId = deleteBtn.dataset.staffId;
            const staff = allStaff.find(s => s.id === parseInt(staffId));
            if (staff) {
               // Open panel first
               viewStaff(staffId);
               // Then switch to delete mode
               switchToDeleteMode(staff);
            }
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
      saveBtn.disabled = false;
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
      SWITCH TO DELETE MODE
      Show delete confirmation form
      ============================================ */

   function switchToDeleteMode(staff) {

      // Hide view and edit sections
      document.querySelector('.slide-panel-view').style.display = 'none';
      document.querySelector('.slide-panel-edit').style.display = 'none';

      // Show delete section
      document.querySelector('.slide-panel-delete').style.display = 'block';

      // Hide view/edit buttons, show delete buttons
      document.getElementById('viewModeButtons').style.display = 'none';
      document.getElementById('editModeButtons').style.display = 'none';
      document.getElementById('deleteModeButtons').style.display = 'flex';

      // Populate delete info
      document.getElementById('deleteStaffName').textContent = staff.name;
      document.getElementById('deleteStaffEmail').textContent = staff.email;
      document.getElementById('deleteStaffDetails').textContent = `${staff.role} • ${staff.location_name || 'Unknown Location'}`;

      // Store staff ID in form
      document.getElementById('deleteStaffForm').dataset.staffId = staff.id;

      // Reset form
      document.getElementById('deleteStaffForm').reset();
      document.getElementById('deleteConfirmCheckbox').checked = false;
      document.getElementById('confirmDeleteBtn').disabled = true;

      // Hide any previous messages
      const deleteError = document.getElementById('deleteErrorMessage');
      const deleteSuccess = document.getElementById('deleteSuccessMessage');
      if (deleteError) deleteError.style.display = 'none';
      if (deleteSuccess) deleteSuccess.style.display = 'none';

   }

   /* ============================================
      ENABLE/DISABLE DELETE BUTTON
      Checkbox toggle
      ============================================ */

   function toggleDeleteButton() {
      const checkbox = document.getElementById('deleteConfirmCheckbox');
      const deleteBtn = document.getElementById('confirmDeleteBtn');

      // Enable button only if checkbox is checked
      deleteBtn.disabled = !checkbox.checked;
   }

   /* ============================================
      DELETE STAFF
      Submit delete request with admin verification
      ============================================ */

   async function deleteStaff(e) {
      e.preventDefault();

      const form = document.getElementById('deleteStaffForm');
      const staffId = form.dataset.staffId;

      // Get form data
      const formData = new FormData(form);
      const deleteData = {
         reason: formData.get('reason'), 
         notes: formData.get('notes') || null, 
         admin_username: formData.get('admin_username'), 
         admin_password: formData.get('admin_password')
      };

      // ========== VALIDATION BLOCK ==========

      // Validate required fields
      if (!deleteData.reason) {
         const errorMsg = document.getElementById('deleteErrorMessage');
         errorMsg.textContent = ' Please select a reason for removal';
         errorMsg.style.display = 'block';
         return;
      }

      if (!deleteData.admin_username || !deleteData.admin_password) {
         const errorMsg = document.getElementById('deleteErrorMessage');
         errorMsg.textContent = ' Please enter admin username and password';
         errorMsg.style.display = 'block';
         return;
      }

      if (!document.getElementById('deleteConfirmCheckbox').checked) {
         const errorMsg = document.getElementById('deleteErrorMessage');
         errorMsg.textContent = ' Please check the confirmation checkbox';
         errorMsg.style.display = 'block';
         return;
      }

      // ========== END VALIDATION BLOCK ==========

      // Hide previous messages
      document.getElementById('deleteErrorMessage').style.display = 'none';
      document.getElementById('deleteSuccessMessage').style.display = 'none';

      // Disable delete button with loading state
      const deleteBtn = document.getElementById('confirmDeleteBtn');
      const originalBtnText = deleteBtn.innerHTML;
      deleteBtn.disabled = true;
      deleteBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Deleting...';

      try {
         // STEP 1: Verify admin password
         console.log(' Verifying admin credentials...');

         const verifyResponse = await fetch(`${API_BASE_URL}/admin/verify-password`, {
            method: 'POST', 
            headers: {
               'Content-Type': 'application/json'
            }, 
            body: JSON.stringify({
               username: deleteData.admin_username, 
               password: deleteData.admin_password
            })
         });

         const verifyResult = await verifyResponse.json();

         if (!verifyResult.verified) {
            throw new Error('Invalid admin credentials. Please check your username and password.');
         }

         console.log(' Admin verified');

         // STEP 2: Delete the staff member (soft delete)
         console.log(' Deleting staff member...');

         const deleteResponse = await fetch(`${API_BASE_URL}/staff/${staffId}`, {
            method: 'DELETE', 
            headers: {
               'Content-Type': 'application/json'
            }, 
            body: JSON.stringify({
               reason: deleteData.reason, 
               notes: deleteData.notes
            })
         });

         const deleteResult = await deleteResponse.json();

         if (!deleteResponse.ok) {
            throw new Error(deleteResult.error || 'Failed to delete staff member');
         }

         console.log(' Staff member deleted', deleteResult);

         // Show success message
         const successMsg = document.getElementById('deleteSuccessMessage');
         successMsg.textContent = ' Staff member removed successfully!';
         successMsg.style.display = 'block';

         // Update the staff in allStaff array (set status to terminated)
         const index = allStaff.findIndex(s => s.id == staffId);
         if (index !== -1) {
            allStaff[index].status = 'terminated';
         }

         // Wait 1.5 seconds, then close the panel and refresh
         setTimeout(() => {
            // Close the panel
            document.getElementById('staffDetailPanel').classList.remove('active');
            switchToViewMode();  // Reset to view mode

            // Refresh table and stats
            fetchStaff();
            fetchStats();

            // Show toast notification
            showNotification('Staff member removed successfully', 'success');

         }, 1500);

      } catch (error) {
         console.error(' Failed to delete staff member:', error);

         // Show error message
         const errorMsg = document.getElementById('deleteErrorMessage');
         errorMsg.textContent = ` ${error.message}`;
         errorMsg.style.display = 'block';

         // Re-enable button
         deleteBtn.disabled = false;
         deleteBtn.innerHTML = originalBtnText;
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
      DELETE MODE EVENT LISTENERS
      ============================================ */

   // Delete button (in panel footer)
   document.getElementById('deleteStaffBtn')?.addEventListener('click', () => {
      const staffId = document.getElementById('deleteStaffBtn').dataset.staffId;

      console.log('Delete button clicked');
      console.log('Staff ID from dataset:', staffId);
      console.log('All staff array:', allStaff);

      const staff = allStaff.find(s => s.id === parseInt(staffId));
      console.log('Found staff:', staff);

      if (staff) {
         switchToDeleteMode(staff);
      } else {
         console.error('Staff not found with ID:', staffId);
      }

   });

   // Cancel delete button
   document.getElementById('cancelDeleteBtn')?.addEventListener('click', () => {
      switchToViewMode();
   });

   // Confirm delete button
   document.getElementById('confirmDeleteBtn')?.addEventListener('click', deleteStaff);

   // Also handle form submission
   document.getElementById('deleteStaffForm')?.addEventListener('submit', deleteStaff);

   // Checkbox toggle - enable/disable delete button
   document.getElementById('deleteConfirmCheckbox')?.addEventListener('change', toggleDeleteButton);

   /* ============================================
      SCHEDULE MODAL EVENT LISTENERS
      ============================================ */

   // Open Schedule Overview (global view)
   document.getElementById('scheduleOverviewBtn')?.addEventListener('click', () => {
      openScheduleModal('global');
   });

   // Open Manage Schedule (individual staff)
   document.getElementById('manageScheduleBtn')?.addEventListener('click', () => {
      const staffId = document.getElementById('editStaffBtn').dataset.staffId;
      openScheduleModal('individual', staffId);
   });

   // Close Schedule Modal
   document.getElementById('closeScheduleModal')?.addEventListener('click', () => {
      document.getElementById('scheduleModal').classList.remove('active');
   });

   // Close modal when clicking outside (on overlay)
   document.getElementById('scheduleModal')?.addEventListener('click', (e) => {
      // Only close if clicking the overlay itself, not the modal container
      if (e.target.id === 'scheduleModal') {
         document.getElementById('scheduleModal').classList.remove('active');
      }
   });

   // Open Add Shift Modal
   document.getElementById('addShiftBtn')?.addEventListener('click', () => {
      openShiftFormModal();
   });

   // Close Shift Form Modal
   document.getElementById('closeShiftFormModal')?.addEventListener('click', () => {
      document.getElementById('shiftFormModal').classList.remove('active');
   });

   // Close shift form when clicking outside
   document.getElementById('shiftFormModal')?.addEventListener('click', (e) => {
      if (e.target.id === 'shiftFormModal') {
         document.getElementById('shiftFormModal').classList.remove('active');
      }
   });

   // Cancel Shift Button
   document.getElementById('cancelShiftBtn')?.addEventListener('click', () => {
      document.getElementById('shiftFormModal').classList.remove('active');
   });

   // Week navigation buttons
   document.getElementById('prevWeek')?.addEventListener('click', goToPreviousWeek);
   document.getElementById('nextWeek')?.addEventListener('click', goToNextWeek);
   document.getElementById('todayBtn')?.addEventListener('click', goToToday);

   // Filter change handlers
   document.getElementById('scheduleStaffFilter')?.addEventListener('change', loadShifts);
   document.getElementById('scheduleLocationFilter')?.addEventListener('change', loadShifts);

   // Close Shift Detail Modal
   document.getElementById('closeShiftDetailModal')?.addEventListener('click', () => {
      document.getElementById('shiftDetailModal').classList.remove('active');
   });

   // Close when clicking outside
   document.getElementById('shiftDetailModal')?.addEventListener('click', (e) => {
      if (e.target.id === 'shiftDetailModal') {
         document.getElementById('shiftDetailModal').classList.remove('active');
      }
   });

   // Close button in footer
   document.getElementById('closeShiftDetailBtn')?.addEventListener('click', () => {
      document.getElementById('shiftDetailModal').classList.remove('active');
   });

   // Edit button - close detail, open edit form
   document.getElementById('editShiftFormDetailBtn')?.addEventListener('click', () => {
      document.getElementById('shiftDetailModal').classList.remove('active');
      openShiftFormModal(currentShift.id);
   });

   // Delete button - will implement later!
   document.getElementById('deleteShiftFormDetailBtn')?.addEventListener('click', () => {
      // TODO: Implement delete
      console.log('Delete shift:', currentShift.Id);
   });

   /* ============================================
      SCHEDULE MODAL FUNCTIONS (Placeholder)
      ============================================ */

   function openScheduleModal(mode, staffId = null) {

      // Initialize week if not already set
      if (!currentWeekStart) {
         initializeWeek();
      }
      
      // Update modal title based on mode
      if (mode === 'global') {
         document.getElementById('scheduleModalTitle').textContent = 'Schedule Overview';
         document.getElementById('scheduleModalSubtitle').textContent = 'Mange staff shifts and coverage';
         document.getElementById('scheduleStaffFilter').style.display = 'block';
      } else {
         const staff = allStaff.find(s => s.id === parseInt(staffId));
         if (staff) {
            document.getElementById('scheduleModalTitle').textContent = `${staff.name}'s Schedule`;
            document.getElementById('scheduleModalSubtitle').textContent = `Mange shifts for ${staff.role}`;
            document.getElementById('scheduleStaffFilter').style.display = 'none';
            document.getElementById('scheduleStaffFilter').value = staffId;
         }
      }

      // Update week display
      updateWeekDisplay();

      // Generate calendar grid
      generateCalendarGrid();

      // Load shifts data
      loadShifts();

      // Populate filter dropdowns
      populateScheduleFilters();

      // Show modal
      document.getElementById('scheduleModal').classList.add('active');
   }

   // Populate staff and location filters
   async function populateScheduleFilters() {
      // Populate staff filter
      const staffFilter = document.getElementById('scheduleStaffFilter');
      staffFilter.innerHTML = '<option value="all">All Staff</option>';

      allStaff.forEach(staff => {
         const option = document.createElement('option');
         option.value = staff.id;
         option.textContent = staff.name;
         staffFilter.appendChild(option);
      });

      // Populate location filter
      try {
         const response = await fetch (`${API_BASE_URL}/locations`);
         const locations = await response.json();

         const locationFilter = document.getElementById('scheduleLocationFilter');
         locationFilter.innerHTML = '<option value="all">All Locations</option>';

         locations.forEach(location => {
            const option = document.createElement('option');
            option.value = location.id;
            option.textContent = location.name;
            locationFilter.appendChild(option);
         });
      } catch (error) {
         console.error('❌ Failed to load locations:', error);
      }
   }

   function openShiftFormModal(shiftId = null) {

      if (shiftId) {
         document.getElementById('shiftFormTitle').textContent = 'Edit Shift';
         // TODO: Load shift data
      } else {
         document.getElementById('shiftFormTitle').textContent = 'Add Shift';
         document.getElementById('shiftForm').reset();
      }

      // Show modal
      document.getElementById('shiftFormModal').classList.add('active');

      // TODO: Populate dropdowns
   }

   /* ============================================
      CALENDAR GENERATION & RENDERING
      ============================================ */

   // Store current week being viewed
   let currentWeekStart = null;

   // Initialize current week to today
   function initializeWeek() {
      const today = new Date();
      // Get Monday of current week
      const dayOfWeek = today.getDay();
      const diff = today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
      currentWeekStart = new Date(today.setDate(diff));
      currentWeekStart.setHours(0, 0, 0, 0); // Reset time to midnight
   }

   // Format date as YYYY-MM-DD for API calls
   function formatDateForApi(date) {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
   }

   // Format date for display (e.g., "Jan 20")
   function formatDateForDisplay(date) {
      const options = { month: 'short', day: 'numeric' };
      return date.toLocaleDateString('en-US', options);
   }

   // Update week display text
   function updateWeekDisplay() {
      const weekEnd = new Date(currentWeekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);

      const weekText = `Week of ${formatDateForDisplay(currentWeekStart)} - ${formatDateForDisplay(weekEnd)}, ${currentWeekStart.getFullYear()}`;
      document.getElementById('currentWeekDisplay').textContent = weekText;
   }

   // Navigate to previous week
   function goToPreviousWeek() {
      currentWeekStart.setDate(currentWeekStart.getDate() - 7);
      updateWeekDisplay();
      loadShifts();
   }

   // Navigate to next week
   function goToNextWeek() {
      currentWeekStart.setDate(currentWeekStart.getDate() + 7);
      updateWeekDisplay();
      loadShifts();
   }

   // Jump to current week
   function goToToday() {
      initializeWeek();
      updateWeekDisplay();
      loadShifts();
   }

   // Generate calendar grid with time slots
   function generateCalendarGrid() {
      const calendarBody = document.getElementById('scheduleCalendarBody');

      // Time slots (6 AM to 10 PM in 1-hour increments)
      const timeSlots = [];
      for (let hour = 6; hour <= 22; hour++) {
         const displayHour = hour > 12 ? hour - 12 : hour;
         const ampm = hour >= 12 ? 'PM' : 'AM';
         const displayTime = `${displayHour} ${ampm}`;
         timeSlots.push({ hour, displayTime });
      }

      // Build grid HTML
      let html = '';

      timeSlots.forEach(slot => {
         html += `
            <div class="calendar-row">
               <div class="time-cell">${slot.displayTime}</div>
         `;

         // 7 day cells (Monday - Sunday)
         for (let day = 0; day < 7; day ++) {
            const cellDate = new Date(currentWeekStart);
            cellDate.setDate(cellDate.getDate() + day);
            const dateStr = formatDateForApi(cellDate);

            html += `
               <div class="day-cell"
                  data-date="${dateStr}"
                  data-hour="${slot.hour}">
               </div>
            `;
         }

         html += `</div>`;
      });

      calendarBody.innerHTML = html;
   }

   // Fetch shifts from API
   async function loadShifts() {
      try {
         // Calculate date range (current week)
         const startDate = formatDateForApi(currentWeekStart);

         const endDate = new Date(currentWeekStart);
         endDate.setDate(endDate.getDate() + 6);
         const endDateStr = formatDateForApi(endDate);

         // Get filter values
         const staffFilter = document.getElementById('scheduleStaffFilter').value;
         const locationFilter = document.getElementById('scheduleLocationFilter').value;

         // Build query string
         let queryParams = `start_date=${startDate}&end_date=${endDateStr}`;

         if (staffFilter && staffFilter !== 'all') {
            queryParams += `&staff_id=${staffFilter}`;
         }

         if (locationFilter && locationFilter !== 'all') {
            queryParams += `&location_id=${locationFilter}`;
         }

         // Fetch from API
         const response = await fetch(`${API_BASE_URL}/shifts?${queryParams}`);

         if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
         }

         const data = await response.json();

         // Render shifts on calendar
         renderShifts(data.shifts);

         // Update coverage stats
         updateCoverageStats(data.shifts);

      } catch (error) {
         console.error('❌ Failed to load shifts:', error);

         // Show error in calendar
         const calendarBody = document.getElementById('scheduleCalendarBody');
         calendarBody.innerHTML = `
            <div class="calendar-empty">
               <i class="fa-solid fa-exclamation-triangle"></i>
               <p>Failed to load shifts. Please try again.</p>
            </div>
         `;
      }
   }

   // Render shifts onto the calendar grid
   function renderShifts(shifts) {
      // First, clear all existing shift cards
      document.querySelectorAll('.shift-card').forEach(card => card.remove());

      // If no shifts, show empty state
      if (shifts.length === 0) {
         const calendarBody = document.getElementById('scheduleCalendarBody');
         calendarBody.innerHTML = `
            <div class="calendar-empty">
               <i class="fa-solid fa-calendar-xmark"></i>
               <p>No shifts scheduled for this week</p>
            </div>
         `;
         return;
      }

      // Regenerate grid (in case it was replaced by empty state)
      generateCalendarGrid();

      // Place each shift in the correct cell
      shifts.forEach(shift => {
         // Parse shift date and time
         const shiftDate = new Date(shift.shift_date);
         const dateStr = formatDateForApi(shiftDate);

         // Extract hour from start_time (format: "HH:MM:SS")
         const startHour = parseInt(shift.start_time.split(':')[0]);

         // Find the matching cell
         const cell = document.querySelector(
            `.day-cell[data-date="${dateStr}"][data-hour="${startHour}"]`
         );

         if (cell) {
            // Create shift card
            const shiftCard = document.createElement('div');
            shiftCard.className = 'shift-card';
            shiftCard.dataset.shiftId = shift.id;

            // Format time display (e.g., "9:00 AM - 5:00 PM")
            const formatTime = (timeStr) => {
               const [hours, minutes] = timeStr.split(':');
               const hour = parseInt(hours);
               const displayHour = hour > 12 ? hour - 12 : hour;
               const ampm = hour >= 12 ? 'PM' : 'AM';
               return `${displayHour}:${minutes} ${ampm}`;
            };

            const timeDisplay = `${formatTime(shift.start_time)} - ${formatTime(shift.end_time)}`;

            shiftCard.innerHTML = `
               <div class="shift-card-time">${timeDisplay}</div>
               <div class="shift-card-staff">${shift.staff_name}</div>
               <div class="shift-card-location">${shift.location_name}</div>
            `;

            // Add click handler to edit shift
            shiftCard.addEventListener('click', () => {
               viewShiftDetails(shift);
            });

            // Add to cell
            cell.appendChild(shiftCard);
         }
      });
   }

   // Update coverage statistics
   function updateCoverageStats(shifts) {
      // For now, just show total shifts
      // TODO: Calculate actual coverage based on requirements

      document.getElementById('totalShifts').textContent = shifts.length;
      document.getElementById('fullyCoveredShifts').textContent = '0';
      document.getElementById('understaffedShifts').textContent = '0';
      document.getElementById('noCoverageShifts').textContent = '0';
   }

   /* ============================================
      SHIFT DETAIL FUNCTIONS
      ============================================ */

   // Store current shift being viewed
   let currentShift = null;

   // View shift details
   function viewShiftDetails(shift) {

      // Store shift for edit/delete operations
      currentShift = shift;

      // Format date (e.g., "Monday, January 20, 2026")
      const shiftDate = new Date(shift.shift_date);
      const dateOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
      const formattedDate = shiftDate.toLocaleDateString('en-US', dateOptions);

      // Format time and calculate duration
      const formatTime = (timeStr) => {
         const [hours, minutes] = timeStr.split(':');
         const hour = parseInt(hours);
         const displayHour = hour > 12 ? hour - 12 : (hour === 0 ? 12 : hour);
         const ampm = hour >= 12 ? 'PM' : 'AM';
         return `${displayHour}:${minutes} ${ampm}`;
      };

      const startTime = formatTime(shift.start_time);
      const endTime = formatTime(shift.end_time);

      // Calculate duration in hours
      const [startHour, startMin] = shift.start_time.split(':').map(Number);
      const [endHour, endMin] = shift.end_time.split(':').map(Number);
      const durationHours = (endHour + endMin/60) - (startHour + startMin/60);
      const durationText = `${durationHours} hour${durationHours !== 1 ? 's' : ''}`;

      // Populate modal
      document.getElementById('shiftDetailDate').textContent = formattedDate;
      document.getElementById('shiftDetailTime').textContent = `${startTime} - ${endTime} (${durationText})`;
      document.getElementById('shiftDetailStaff').textContent = shift.staff_name;
      document.getElementById('shiftDetailRole').textContent = shift.role;
      document.getElementById('shiftDetailLocation').textContent = shift.location_name;

      // Status with pill
      const statusElement = document.getElementById('shiftDetailStatus');
      let statusClass = 'success';
      let statusText = 'Scheduled';

      if (shift.status === 'completed') {
         statusClass = 'info';
         statusText = 'Completed';
      } else if (shift.status === 'cancelled') {
         statusClass = 'danger';
         statusText = 'Cancelled';
      }

      statusElement.innerHTML = `<span class="pill ${statusClass}">${statusText}</span>`;

      // Notes
      document.getElementById('shiftDetailNotes').textContent = shift.notes || '';
      
      // Show modal
      document.getElementById('shiftDetailModal').classList.add('active');
   }


   /* ============================================
      MAKE FUNCTIONS GLOBALLY ACCESSIBLE
      ============================================ */

   window.viewStaff = viewStaff;
   window.editStaff = editStaff;
   window.fetchStaff = fetchStaff;
   window.fetchStats = fetchStats;

});