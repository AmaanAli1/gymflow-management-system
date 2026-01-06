/* ============================================
   MEMBERS PAGE JAVASCRIPT
   Handles member list, filters, search, CRUD operations
   ============================================ */

document.addEventListener('DOMContentLoaded', () => {
    
    /* ========================================
       API CONFIGURATION
       ======================================== */
    
    const API_BASE_URL = 'http://127.0.0.1:5000/api';
    
    
    /* ========================================
       STATE MANAGEMENT
       Track current filters and search
       ======================================== */
    
    let currentFilters = {
        location: '',
        plan: '',
        status: '',
        search: ''
    };
    
    let allMembers = []; // Store ALL members (never filtered)
    let filteredMembers = []; // Current filtered/searched results
    let currentDisplayedMembers =[];

    // Sort state
    let currentSortColumn = null;
    let currentSortDirection = 'asc';
    
    
    /* ========================================
       DOM ELEMENTS
       ======================================== */
    
    const membersTableBody = document.getElementById('membersTableBody');
    const searchInput = document.getElementById('searchInput');
    const locationFilter = document.getElementById('locationFilter');
    const planFilter = document.getElementById('planFilter');
    const statusFilter = document.getElementById('statusFilter');
    
    
    /* ========================================
       FETCH MEMBERS FROM API
       ======================================== */
    
    async function fetchMembers() {
        try {
            console.log('🔄 Fetching members from API...');
            
            // Build query string from filters
            const params = new URLSearchParams();
            
            if (currentFilters.location) params.append('location', currentFilters.location);
            if (currentFilters.plan) params.append('plan', currentFilters.plan);
            if (currentFilters.status) params.append('status', currentFilters.status);
            if (currentFilters.search) params.append('search', currentFilters.search);
            
            const queryString = params.toString();
            const url = `${API_BASE_URL}/members${queryString ? '?' + queryString : ''}`;
            
            console.log('📡 Fetching:', url);
            
            // Fetch from API
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            
            console.log(`✅ Received ${data.members.length} members`);
            
            // Store filtered members for display
            allMembers = data.members;

            // If no filters applied, also update allMembers
            if (!currentFilters.location && !currentFilters.plan && !currentFilters.status && !currentFilters.search) {
                allMembers = data.members;
            }

            currentDisplayedMembers = data.members;
            populateMembersTable(data.members);
            
        } catch (error) {
            console.error('❌ Failed to fetch members:', error);
            
            // Show error message in table
            membersTableBody.innerHTML = `
                <tr>
                    <td colspan="8" class="table-empty">
                        <i class="fa-solid fa-exclamation-triangle" style="color: #e74c3c;"></i>
                        <p>Failed to load members</p>
                        <p style="font-size: 0.8rem; margin-top: 8px;">
                            Make sure the backend server is running on port 5000
                        </p>
                    </td>
                </tr>
            `;
        }
    }
    
    
    /* ========================================
       FETCH MEMBER STATS
       ======================================== */
    
    async function fetchStats() {
        try {
            console.log('📊 Fetching member stats...');
            
            const response = await fetch(`${API_BASE_URL}/members/stats`);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const stats = await response.json();
            
            console.log('✅ Stats received:', stats);
            
            updateStats(stats);
            
        } catch (error) {
            console.error('❌ Failed to fetch stats:', error);
        }
    }
    
    
    /* ========================================
       UPDATE KPI STATS
       ======================================== */
    
    function updateStats(stats) {
        document.querySelector('[data-stat="activeMembers"]').textContent = stats.activeMembers;
        document.querySelector('[data-stat="newThisMonth"]').textContent = stats.newThisMonth;
        document.querySelector('[data-stat="frozenMembers"]').textContent = stats.frozenMembers;
        document.querySelector('[data-stat="cancelledMembers"]').textContent = stats.cancelledMembers;
        
        console.log('✅ Member stats updated');
    }
    
    
    /* ========================================
       POPULATE MEMBERS TABLE
       ======================================== */
    
    function populateMembersTable(members) {
        // Clear table
        membersTableBody.innerHTML = '';
        
        // Check if no members
        if (members.length === 0) {
            membersTableBody.innerHTML = `
                <tr>
                    <td colspan="8" class="table-empty">
                        <i class="fa-solid fa-users-slash"></i>
                        <p>No members found</p>
                        <p style="font-size: 0.8rem; margin-top: 8px;">Try adjusting your filters or search terms</p>
                    </td>
                </tr>
            `;
            return;
        }
        
        // Create table rows
        members.forEach(member => {
            const row = document.createElement('tr');
            
            // Determine status pill class
            let statusClass = 'check'; // default green for active
            if (member.status === 'frozen') statusClass = 'stock'; // yellow
            if (member.status === 'cancelled') statusClass = 'pill'; // gray
            if (member.status === 'inactive') statusClass = 'pill'; // gray
            
            // Determine plan pill class
            let planClass = 'add'; // default red for Basic
            if (member.plan === 'Premium') planClass = 'pay'; // green
            if (member.plan === 'Elite') planClass = 'stock'; // yellow
            
            // Format join date
            const joinDate = new Date(member.created_at).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            });
            
            row.innerHTML = `
                <td>${member.member_id}</td>
                <td>${member.name}</td>
                <td class="truncate">${member.email}</td>
                <td>${member.location_name || 'Unknown'}</td>
                <td><span class="pill ${planClass}">${member.plan}</span></td>
                <td><span class="pill ${statusClass}">${member.status}</span></td>
                <td>${joinDate}</td>
                <td>
                    <div class="table-actions">
                        <button class="table-action-btn view" 
                                data-member-id="${member.id}"
                                title="View details">
                            <i class="fa-solid fa-eye"></i>
                        </button>
                        <button class="table-action-btn edit" 
                                data-member-id="${member.id}"
                                title="Edit member">
                            <i class="fa-solid fa-pen"></i>
                        </button>
                        <button class="table-action-btn payment"
                                data-member-id="${member.id}"
                                title="Manage payments">
                            <i class="fa-solid fa-dollar-sign"></i>
                        </button>
                        <button class="table-action-btn delete" 
                                data-member-id="${member.id}"
                                title="Delete member">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </div>
                </td>
            `;
            
            membersTableBody.appendChild(row);
        });
        
        // Add event listeners to action buttons
        attachTableActionListeners();
        
        console.log(`✅ Populated table with ${members.length} members`);
    }

    /* ========================================
       SORT MEMBERS TABLE
       ======================================== */

    function sortMembersTable(column) {
        console.log(`🔄 Sorting by: ${column}`);

        // Toggle direction if clicking same column
        if (currentSortColumn === column) {
            currentSortDirection = currentSortDirection === 'asc' ? 'desc' : 'asc';
        } else {
            currentSortColumn = column;
            currentSortDirection = 'asc';
        }

        // Sort the displayed members array
        const sortedMembers = [...currentDisplayedMembers].sort((a, b) => {
            let valueA, valueB;

            switch(column) {
                case 'id': 
                    valueA = parseInt(a.member_id.replace('M-', ''));
                    valueB = parseInt(b.member_id.replace('M-', ''));
                    break;
                case 'name': 
                    valueA = a.name.toLowerCase();
                    valueB = b.name.toLowerCase();
                    break;
                case 'email': 
                    valueA = a.email.toLowerCase();
                    valueB = b.email.toLowerCase();
                    break;
                case 'location': 
                    valueA = (a.location_name || '').toLowerCase();
                    valueB = (b.location_name || '').toLowerCase();
                    break;
                case 'plan': 
                    const planOrder = { 'Basic': 1, 'Premium': 2, 'Elite': 3 };
                    valueA = planOrder[a.plan] || 0;
                    valueB = planOrder[b.plan] || 0;
                    break;
                case 'status': 
                    const statusOrder = { 'active': 1, 'frozen': 2,'cancelled': 3 };
                    valueA = statusOrder[a.status] || 0;
                    valueB = statusOrder[b.status] || 0;
                    break;
                case 'join_date': 
                    valueA = new Date(a.created_at).getTime();
                    valueB = new Date(b.created_at).getTime();
                    break;
                default: 
                    return 0;
            }

            // Compare values
            if (valueA < valueB) return currentSortDirection === 'asc' ? -1 : 1;
            if (valueA > valueB) return currentSortDirection === 'asc' ? 1 : -1;
            return 0;
        });

        // Update sort indicators
        updateSortIndicators(column);

        // Re-populate table with sorted data
        populateMembersTable(sortedMembers);

        console.log(`✅ Sorted ${sortedMembers.length} members by ${column} (${currentSortDirection})`);
    }

    /* ========================================
       UPDATE SORT INDICATORS
       ======================================== */

    function updateSortIndicators(activeColumn) {
        // Remove active class from all headers
        document.querySelectorAll('.sortable').forEach(th => {
            th.classList.remove('sorted-asc', 'sorted-desc');
        });

        // Add active class to current column
        const activeHeader = document.querySelector(`th[data-sort="${activeColumn}"]`);

        if (!activeHeader) {
            console.error(`❌ Could not find header with data-sort="${activeColumn}"`);
            return;
        }

        const className = currentSortDirection === 'asc' ? 'sorted-asc' : 'sorted-desc';
        activeHeader.classList.add(className);

        console.log(`✅ Sort indicator updated: ${activeColumn} (${currentSortDirection})`);
    }
    
    
    /* ========================================
       ATTACH EVENT LISTENERS TO TABLE ACTIONS
       ======================================== */
    
    function attachTableActionListeners() {
        // View buttons
        document.querySelectorAll('.table-action-btn.view').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const memberId = e.currentTarget.dataset.memberId;
                viewMemberDetails(memberId);
            });
        });
        
        // Edit buttons
        document.querySelectorAll('.table-action-btn.edit').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const memberId = e.currentTarget.dataset.memberId;
                editMember(memberId);
            });
        });

        // Payment buttons
        document.querySelectorAll('.table-action-btn.payment').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const memberId = e.currentTarget.dataset.memberId;

                // Find member and open payment modal
                const member = allMembers.find(m => m.id == memberId);
                if (member) {
                    openPaymentModal(member);
                }
            });
        })
        
        // Delete buttons
        document.querySelectorAll('.table-action-btn.delete').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const memberId = e.currentTarget.dataset.memberId;
                
                // Find member and open delete mode in slide panel
                const member = allMembers.find(m => m.id == memberId);
                if (member) {
                    openMemberPanel(member);
                    setTimeout(() => {
                        switchToDeleteMode(member);
                    }, 100);
                }
            });
        });
    }
    
    
    /* ========================================
       EVENT LISTENERS: Filters and Search
       ======================================== */
    
    // Location filter
    locationFilter.addEventListener('change', (e) => {
        currentFilters.location = e.target.value;
        fetchMembers(); // Re-fetch with new filter
    });
    
    // Plan filter
    planFilter.addEventListener('change', (e) => {
        currentFilters.plan = e.target.value;
        fetchMembers(); // Re-fetch with new filter
    });
    
    // Status filter
    statusFilter.addEventListener('change', (e) => {
        currentFilters.status = e.target.value;
        fetchMembers(); // Re-fetch with new filter
    });
    
    // Search input (with debounce)
    let searchTimeout;
    searchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            currentFilters.search = e.target.value;
            fetchMembers(); // Re-fetch with search term
        }, 500); // Wait 500ms after user stops typing
    });
    
    
    /* ========================================
       CRUD OPERATIONS
       ======================================== */
    
    function viewMemberDetails(memberId) {
        console.log('👁️ View member:', memberId);
        
        // Find member in allMembers array
        const member = allMembers.find(m => m.id == memberId);
        
        if (member) {
            // Open slide panel with member data
            openMemberPanel(member);
        } else {
            console.error('Member not found:', memberId);
        }
    }

    /* ========================================
       OPEN MEMBER DETAILS PANEL
       ======================================== */
    
    function openMemberPanel(member) {
        console.log('📋 Opening panel for:', member.name);

        // Populate header
        document.getElementById('panelMemberName').textContent = member.name;
        document.getElementById('panelMemberId').textContent = `ID: ${member.member_id}`;

        // Populate details
        document.getElementById('panelMemberEmail').textContent = member.email;
        document.getElementById('panelMemberLocation').textContent = member.location_name || 'Unknown';
        document.getElementById('panelMemberPlan').textContent = member.plan;

        // Format join date
        const joinDate = new Date(member.created_at).toLocaleDateString('en-US', {
            year: 'numeric', 
            month: 'long', 
            day: 'numeric'
        });
        document.getElementById('panelMemberJoinDate').textContent = joinDate;

        // Populate status with colored pill
        const statusElement = document.getElementById('panelMemberStatus');
        let statusClass = 'check';  // default green
        if (member.status === 'frozen') statusClass = 'stock';  // yellow
        if (member.status === 'cancelled') statusClass = 'pill';    //gray
        if (member.status === 'inactive') statusClass = 'pill';     // gray

        statusElement.innerHTML = `<span class="pill ${statusClass}">${member.status}</span>`;

        // Populate stats (placeholder for now)
        // TODO: These would come from a seperate API call for member activity
        document.getElementById('panelStatCheckins').textContent = '--';
        document.getElementById('panelStatDaysActive').textContent = calculateDaysActive(member.created_at);
        document.getElementById('panelStatLastVisit').textContent = 'N/A';

        // Notes (placeholder)
        document.getElementById('panelMemberNotes').textContent = 'No notes available for this member.'

        // Store member ID on buttons for actions
        document.getElementById('editMemberBtn').dataset.memberId = member.id;
        document.getElementById('deleteMemberBtn').dataset.memberId = member.id;

        // Update first button dynamically based on member status
        const firstBtn = document.getElementById('freezeMemberBtn');

        if (member.status === 'cancelled') {
            // CANCELLED -> Show Reactivate button (green)
            firstBtn.innerHTML = '<i class="fa-solid fa-rotate-right"></i> Reactivate';
            firstBtn.className = 'btn ghost success';   // Green styling
            firstBtn.dataset.memberId = member.id;
            firstBtn.onclick = null;    // Use event listener


        } else if (member.status === 'frozen') {
            // FROZEN -> Show Unfreeze button (orange/fire)
            firstBtn.innerHTML = '<i class="fa-solid fa-fire"></i> Unfreeze';
            firstBtn.className = 'btn ghost freeze';    // Yellow/organce styling
            firstBtn.dataset.memberId = member.id;
            firstBtn.onclick = (e) => {
                e.stopPropagation();
                unfreezeMember(member.id);
            };

        } else {
            // ACTIVE -> Show Freeze button (blue/snowflake)
            firstBtn.innerHTML = '<i class="fa-solid fa-snowflake"></i> Freeze';
            firstBtn.className = 'btn ghost freeze';    // Blue styling
            firstBtn.dataset.memberId = member.id;
            firstBtn.onclick = null;    // Use event listener
        }

        // Show the panel
        document.getElementById('memberDetailPanel').classList.add('active');

        console.log('✅ Panel opened');

    }

    /* ========================================
       CLOSE MEMBER DETAILS PANEL
       ======================================== */

    function closeMemberPanel() {
        document.getElementById('memberDetailPanel').classList.remove('active');

        // Reset to view mode when closing
        switchToViewMode();

        console.log('✅ Panel closed');
    }

    /* Helper: Calculate days since joining */
    function calculateDaysActive(joinDate) {
        const join = new Date(joinDate);
        const today = new Date();
        const diffTime = Math.abs(today - join);
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        return diffDays;
    }
    
    function editMember(memberId) {
        console.log('✏️ Edit member:', memberId);
        
        // Find member in allMembers array
        const member = allMembers.find(m => m.id == memberId);

        if (member) {
            // First, open the panel with member details (if not already open)
            openMemberPanel(member);

            // Then switch to edit mode
            setTimeout(() => {
                switchToEditMode(member);
            }, 100);    // Small delay to ensure panel is rendered
        } else {
            console.error('Member not found', memberId);
        }
    }

    /* ========================================
       SWITCH TO EDIT MODE
       ======================================== */
    
    function switchToEditMode(member) {
        console.log('✏️ Switching to edit mode for:', member.name);

        // Add edit-mode class to panel
        document.querySelector('.slide-panel').classList.add('edit-mode');

        // Hide view buttons, show edit buttons
        document.getElementById('viewModeButtons').style.display = 'none';
        document.getElementById('editModeButtons').style.display = 'flex';

        // Pre-fill form with current member data
        document.getElementById('editMemberId').value = member.member_id;
        document.getElementById('editName').value = member.name;
        document.getElementById('editEmail').value = member.email;
        document.getElementById('editPhone').value = member.phone || '';
        document.getElementById('editEmergencyContact').value = member.emergency_contact || '';
        document.getElementById('editLocation').value = member.location_id;
        document.getElementById('editPlan').value = member.plan;
        document.getElementById('editStatus').value = member.status;
        document.getElementById('editNotes').value = member.notes || '';

        // Format and set join date (read-only)
        const joinDate = new Date(member.created_at).toLocaleDateString('en-US', {
            year: 'numeric', 
            month: 'long', 
            day: 'numeric'
        });
        document.getElementById('editJoinDate').value = joinDate;

        // Store member ID for saving later
        document.getElementById('editMemberForm').dataset.memberId = member.id;

        // Hide any previous error/success messages
        document.getElementById('editErrorMessage').style.display = 'none';
        document.getElementById('editSuccessMessage').style.display = 'none';

        console.log('✅ Switched to edit mode');
    }

    /* ========================================
       SWITCH TO VIEW MODE
       ======================================== */

    function switchToViewMode() {
        console.log('👁️ Switching to view mode');

        // Remove ALL mode classes from panel
        const panel = document.querySelector('.slide-panel');
        panel.classList.remove('edit-mode');
        panel.classList.remove('freeze-mode');
        panel.classList.remove('delete-mode');
        panel.classList.remove('reactivate-mode');

        // Show view buttons ONLY
        document.getElementById('viewModeButtons').style.display = 'flex';
        document.getElementById('editModeButtons').style.display = 'none';
        document.getElementById('freezeModeButtons').style.display = 'none';
        document.getElementById('deleteModeButtons').style.display = 'none';
        document.getElementById('reactivateModeButtons').style.display = 'none';

        // Hide error/success messages
        document.getElementById('editErrorMessage').style.display = 'none';
        document.getElementById('editSuccessMessage').style.display = 'none';
        document.getElementById('freezeErrorMessage').style.display = 'none';
        document.getElementById('freezeSuccessMessage').style.display = 'none';
        document.getElementById('deleteErrorMessage').style.display = 'none';
        document.getElementById('deleteSuccessMessage').style.display = 'none';
        document.getElementById('reactivateErrorMessage').style.display = 'none';
        document.getElementById('reactivateSuccessMessage').style.display = 'none';

        console.log('✅ Switched to view mode');
    }

    /* ========================================
       SWITCH TO FREEZE MODE
       ======================================== */

    function switchToFreezeMode(member) {
        console.log('❄️ Switching to freeze mode for:', member.name);

        // Add freeze-mode class to panel
        document.querySelector('.slide-panel').classList.add('freeze-mode');

        // Hide view buttons, show freeze buttons
        document.getElementById('viewModeButtons').style.display = 'none';
        document.getElementById('freezeModeButtons').style.display = 'flex';

        // Populate member info
        document.getElementById('freezeMemberName').textContent = member.name;
        document.getElementById('freezeMemberId').textContent = member.member_id;

        // Set start date to today
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('freezeStartDate').value = today;

        // Clear form
        document.getElementById('freezeDuration').value = '';
        document.getElementById('freezeEndDate').value = '';
        document.getElementById('freezeReason').value = '';
        document.getElementById('freezeNotes').value = '';

        // Hide summary initially
        document.getElementById('freezeSummary').style.display = 'none';

        // Store member ID for later
        document.getElementById('freezeMemberForm').dataset.memberId = member.id;

        // Hide error/success messages
        document.getElementById('freezeErrorMessage').style.display = 'none';
        document.getElementById('freezeSuccessMessage').style.display = 'none';

        console.log ('❄️ Switched to freeze mode');
    }

    /* ========================================
       CALCULATE FREEZE END DATE
       ======================================== */

    function calculateFreezeEndDate() {
        const duration = document.getElementById('freezeDuration').value;
        const startDate = document.getElementById('freezeStartDate').value;

        if (!duration || !startDate) {
            document.getElementById('freezeSummary').style.display = 'none';
            return;
        }

        // If custom, make end date editable
        if (duration === 'custom') {
            document.getElementById('freezeEndDate').removeAttribute('readonly');
            document.getElementById('freezeSummary').style.display = 'none';
            return;
        }

        // Calculate end date based on duration
        const start = new Date(startDate);
        const days = parseInt(duration);
        const end = new Date(start);
        end.setDate(end.getDate() + days);

        // Set end date (read-only)
        const endDateString = end.toISOString().split('T')[0];
        document.getElementById('freezeEndDate').value = endDateString;
        document.getElementById('freezeEndDate').setAttribute('readonly', true);

        // Update summary display
        updateFreezeSummary(start, end, days);
    }

    /* ========================================
       UPDATE FREEZE SUMMARY DISPLAY
       ======================================== */

    function updateFreezeSummary(startDate, endDate, days) {
        // Format dates
        const startFormatted = startDate.toLocaleDateString('en-US', {
            month: 'short', 
            day: 'numeric', 
            year: 'numeric'
        });

        const endFormatted = endDate.toLocaleDateString('en-US', {
            month: 'short', 
            day: 'numeric', 
            year: 'numeric'
        });

        // Update display
        document.getElementById('freezeDurationDisplay').textContent = `${days} days`;
        document.getElementById('freezeDateDisplay').textContent = `${startFormatted} → ${endFormatted}`;

        // Show summary
        document.getElementById('freezeSummary').style.display = 'flex';
    }

    /* ========================================
       FREEZE MEMBER (Submit to API)
       ======================================== */

    async function freezeMember(e) {
        e.preventDefault();

        const form = document.getElementById('freezeMemberForm');
        const memberId = form.dataset.memberId;

        // Get form data
        const formData = new FormData(form);
        const freezeData = {
            freeze_start_date: formData.get('start_date'), 
            freeze_end_date: formData.get('end_date'), 
            freeze_reason: formData.get('reason') || null, 
            notes: formData.get('notes') || null
        };

        console.log('❄️ Freezing member:', freezeData);

        // Hide previous messages
        document.getElementById('freezeErrorMessage').style.display = 'none';
        document.getElementById('freezeSuccessMessage').style.display = 'none';

        try {
            const response = await fetch(`${API_BASE_URL}/members/${memberId}/freeze`, {
                method: 'POST', 
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(freezeData)
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Failed to freeze member');
            }

            console.log('❄️ Member frozen:', result);

            // Show success message
            const successMsg = document.getElementById('freezeSuccessMessage');
            successMsg.textContent = ' Member frozen successfully!';
            successMsg.style.display = 'block';

            // Update the member in allMembers array
            const index = allMembers.findIndex(m => m.id == memberId);
            if (index !== -1) {
                allMembers[index] = result.member;
            }

            // Wait 1 second, then switch back to view mode with updated data
            setTimeout(() => {
                openMemberPanel(result.member);
                switchToViewMode();
            }, 1000);

            // Refresh the table and stats
            fetchMembers();
            fetchStats();

        } catch (error) {
            console.error('❌ Failed to freeze member:', error);

            // Show error message
            const errorMsg = document.getElementById('freezeErrorMessage');
            errorMsg.textContent = ` ${error.message}`;
            errorMsg.style.display = 'block';
        }
    }

    /* ========================================
       UNFREEZE MEMBER
       ======================================== */

    let unfreezeTargetMemberId = null;

    async function unfreezeMember(memberId) {
        console.log('🔥 Unfreezing member:', memberId);

        // Find member info
        const member = allMembers.find(m => m.id == memberId);
        if (!member) return;

        // Store member ID for confirmation
        unfreezeTargetMemberId = memberId;

        // Update modal with member info
        document.getElementById('unfreezeMemberInfo').textContent = 
            `${member.name} (${member.member_id}) will be reactivated.`;

        // Show confirmation modal
        document.getElementById('unfreezeModalOverlay').classList.add('active');
    }

    async function confirmUnfreezeAction() {
        if (!unfreezeTargetMemberId) return;

        console.log('🔥 Confirming unfreeze:', unfreezeTargetMemberId);

        try {
            const response = await fetch(`${API_BASE_URL}/members/${unfreezeTargetMemberId}/unfreeze`, {
                method: 'POST'
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Failed to unfreeze member');
            }

            console.log('✅ Member unfrozen:', result);

            // Update the member in allMembers array
            const index = allMembers.findIndex(m => m.id == unfreezeTargetMemberId);
            if (index !== -1) {
                allMembers[index] = result.member;
            }

            // Close modal
            closeUnfreezeModal();

            // Refresh panel and table
            openMemberPanel(result.member);
            fetchMembers();
            fetchStats();

        } catch (error) {
            console.error('❌ Failed to unfreeze member:', error);
        }
    }

    function closeUnfreezeModal() {
        document.getElementById('unfreezeModalOverlay').classList.remove('active');
        unfreezeTargetMemberId = null;
    }

    /* ============================================ 
       SWITCH TO REACTIVATE MODE
       ============================================ */

    function switchToReactivateMode(member) {
        console.log('🔄 Switching to reactivate mode for:', member.name);

        // Set current payment member for payment modal access
        currentPaymentMember = member;

        // Remove all other mode classes first
        const panel = document.querySelector('.slide-panel');
        panel.classList.remove('edit-mode', 'freeze-mode', 'delete-mode');

        // Add reactivate-mode class to panel
        panel.classList.add('reactivate-mode');

        // Hide ALL other mode buttons first
        document.getElementById('viewModeButtons').style.display = 'none';
        document.getElementById('editModeButtons').style.display = 'none';
        document.getElementById('freezeModeButtons').style.display = 'none';
        document.getElementById('deleteModeButtons').style.display = 'none';
        document.getElementById('reactivateModeButtons').style.display = 'flex';

        // Populate member info
        document.getElementById('reactivateMemberName').textContent = member.name;

        // Set today as default restart date
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('reactivateStartDate').value = today;

        // Clear form
        document.getElementById('reactivateReason').value = '';
        document.getElementById('reactivateNotes').value = '';
        document.getElementById('reactivateConfirmCheckbox').checked = false;

        // Disable button initially
        document.getElementById('confirmReactivateBtn').disabled = true;

        // Store member ID for later
        document.getElementById('reactivateMemberForm').dataset.memberId = member.id;

        // Load payment method
        loadReactivatePaymentMethod(member.id);

        // Hide error/success messages
        document.getElementById('reactivateErrorMessage').style.display = 'none';
        document.getElementById('reactivateSuccessMessage').style.display = 'none';

        console.log('✅ Switched to reactivate mode');
    }

    /* ============================================ 
       LOAD PAYMENT METHOD FOR REACTIVATION
       ============================================ */

    async function loadReactivatePaymentMethod(memberId) {
        const display = document.getElementById('reactivatePaymentDisplay');

        try {
            const response = await fetch(`${API_BASE_URL}/members/${memberId}/payment-method`);
            const data = await response.json();

            if (!data.payment_method) {
                display.innerHTML = `
                    <div class="no-payment-method-reactivate">
                        <i class="fa-solid fa-credit-card"></i>
                        <p>No payment method on file</p>
                    </div>
                `;
                return;
            }

            const method = data.payment_method;

            // Card icon based on type
            let cardIcon = 'fa-credit-card';
            if (method.card_type === 'Visa') cardIcon = 'fa-cc-visa';
            if (method.card_type === 'Mastercard') cardIcon = 'fa-cc-mastercard';
            if (method.card_type === 'Amex') cardIcon = 'fa-cc-amex';
            if (method.card_type === 'Discover') cardIcon = 'fa-cc-discover';

            display.innerHTML = `
                <div class="reactivate-card-display">
                    <i class="fa-brands ${cardIcon}"></i>
                    <div class="reactivate-card-info">
                        <div class="reactivate-card-type">${method.card_type} •••• ${method.last_four}</div>
                        <div class="reactivate-card-expiry">Expires: ${String(method.expiry_month).padStart(2, '0')}/${method.expiry_year}</div>
                    </div>
                </div>
            `;

            console.log('✅ Loaded payment method for reactivation');

        } catch (error) {
            console.error('❌ Failed to load payment method:', error);
            display.innerHTML = `
                <div class="no-payment-method-reactivate">
                    <i class="fa-solid fa-exclamation-triangle"></i>
                    <p>Failed to load payment method</p>
                </div>
            `;
        }
    }

    /* ========================================
       SUBMIT REACTIVATION
       ======================================== */

    async function submitReactivation(e) {
        e.preventDefault();

        const form = document.getElementById('reactivateMemberForm');
        const memberId = form.dataset.memberId;

        // Get form data
        const formData = new FormData(form);
        const reactivateData = {
            reason: formData.get('reason'), 
            start_date: formData.get('start_date'), 
            notes: formData.get('notes') || null
        };

        console.log('🔄 Reactivating member:', reactivateData);

        // Hide previous messages
        document.getElementById('reactivateErrorMessage').style.display = 'none';
        document.getElementById('reactivateSuccessMessage').style.display = 'none';

        try {
            const response = await fetch(`${API_BASE_URL}/members/${memberId}/reactivate`, {
                method: 'POST', 
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(reactivateData)
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Failed to reactivate member');
            }

            console.log('✅ Member reactivated:', result);

            // Show success message
            const successMsg = document.getElementById('reactivateSuccessMessage');
            successMsg.textContent = '✅ Member reactivated successfully!';
            successMsg.style.display = 'block';

            // Update the member in allMembers array
            const index = allMembers.findIndex(m => m.id == memberId);
            if (index !== -1) {
                allMembers[index] = result.member;
            }

            // Wait 1.5 seconds, then switch back to view mode with updated data
            setTimeout(() => {
                openMemberPanel(result.member);
                switchToViewMode();
            }, 1500);

            // Refresh the table and stats
            fetchMembers();
            fetchStats();

        } catch (error) {
            console.log('❌ Failed to reactivate member:', error);

            // Show error message
            const errorMsg = document.getElementById('reactivateErrorMessage');
            errorMsg.textContent = `❌ ${error.message}`;
            errorMsg.style.display = 'block';
        }
    }

    /* ========================================
       TOGGLE REACTIVATE BUTTON
       Enable/Disable based on checkbox
       ======================================== */

    function toggleReactivateButton() {
        const checkbox = document.getElementById('reactivateConfirmCheckbox');
        const reactivateBtn = document.getElementById('confirmReactivateBtn');

        // Enable button only if checkbox is checked
        reactivateBtn.disabled = !checkbox.checked;

        if (checkbox.checked) {
            console.log('✅ Reactivate button enabled');
        } else {
            console.log('❌ Reactivate button disabled');
        }
    }

    /* ========================================
       SWITCH TO DELETE MODE
       ======================================== */

    function switchToDeleteMode(member) {
        console.log('🗑️ Switching to delete mode for:', member.name);

        // Add delete-mode class to panel
        document.querySelector('.slide-panel').classList.add('delete-mode');

        // Hide view buttons, show delete buttons
        document.getElementById('viewModeButtons').style.display = 'none';
        document.getElementById('deleteModeButtons').style.display = 'flex';

        // Populate member info
        document.getElementById('deleteMemberName').textContent = member.name;
        document.getElementById('deleteMemberId').textContent = member.member_id;
        document.getElementById('deleteMemberDetails').textContent = 
            `${member.email} • ${member.location_name} • ${member.plan}`;
        
        // Clear form
        document.getElementById('deleteReason').value = '';
        document.getElementById('deleteNotes').value = '';
        document.getElementById('deleteAdminUsername').value = 'admin';
        document.getElementById('deleteAdminPassword').value = '';
        document.getElementById('deleteConfirmCheckbox').checked = false;

        // Disable delete button initially
        document.getElementById('confirmDeleteBtn').disabled = true;

        // Store member ID for later
        document.getElementById('deleteMemberForm').dataset.memberId = member.id;

        // Hide error/success messages
        document.getElementById('deleteErrorMessage').style.display = 'none';
        document.getElementById('deleteSuccessMessage').style.display = 'none';

        console.log('✅ Switched to delete mode');
    }

    /* ========================================
       DELETE MEMBER (Submit to API)
       With admin password verification
       ======================================== */

    async function deleteMember(e) {
        e.preventDefault();

        const form = document.getElementById('deleteMemberForm');
        const memberId = form.dataset.memberId;

        // Get form data
        const formData = new FormData(form);
        const deleteData = {
            reason: formData.get('reason'), 
            notes: formData.get('notes') || null, 
            admin_username: formData.get('admin_username'), 
            admin_password: formData.get('admin_password')
        };

        console.log('🗑️ Attempting to delete member:', memberId);

        // ========== VALIDATION BLOCK ==========

        // Validate required fields
        if (!deleteData.reason) {
            const errorMsg = document.getElementById('deleteErrorMessage');
            errorMsg.textContent = ' Please select a reason for cancellation';
            errorMsg.style.display = 'block';
            return;
        }

        if (!deleteData.admin_username || !deleteData.admin_password) {
            const errorMsg = document.getElementById('deleteErrormessage');
            errorMsg.textContent = ' Please enter admin username and password';
            errorMsg.style.display = 'block';
            return;
        }

        if (!document.getElementById('deleteConfirmCheckbox'). checked) {
            const errorMsg = document.getElementById('deleteErrorMessage');
            errorMsg.textContent = ' Please check the confirmation checkbox';
            errorMsg.style.display = 'block';
            return;
        }

        // ========== END VALIDATION BLOCK ==========

        // Hide previous messages
        document.getElementById('deleteErrorMessage').style.display = 'none';
        document.getElementById('deleteSuccessMessage').style.display = 'none';

        try {
            // STEP 1: Verify admin password
            console.log('🔐 Verifying admin credentials...');

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

            console.log('✅ Admin verified');

            // STEP 2: Delete the member (soft delete)
            console.log('🗑️ Deleting member...');

            const deleteResponse = await fetch(`${API_BASE_URL}/members/${memberId}`, {
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
                throw new Error(deleteResult.error || 'Failed to delete member');
            }

            console.log('✅ Member deleted:', deleteResult);

            // Show success message
            const successMsg = document.getElementById('deleteSuccessMessage');
            successMsg.textContent = '✅ Member cancelled successfully!';
            successMsg.style.display = 'block';

            // Update the member in allMembers array
            const index = allMembers.findIndex(m => m.id == memberId);
            if (index !== -1) {
                allMembers[index].status = 'cancelled';
            }

            // Wait 1.5 seconds, then close panel and refresh
            setTimeout(() => {
                closeMemberPanel();
                fetchMembers();     // Refresh table (will hide cancelled by default)
                fetchStats();       // Update stats
            }, 1500);

        } catch (error) {
            console.error('❌ Failed to delete member:', error);

            // Show error message
            const errorMsg = document.getElementById('deleteErrorMessage');
            errorMsg.textContent = `❌ ${error.message}`;
            errorMsg.style.display = 'block';
        }
    }

    /* ========================================
       ENABLE/DISABLE DELETE BUTTON
       ======================================== */

    function toggleDeleteButton() {
        const checkbox = document.getElementById('deleteConfirmCheckbox');
        const deleteBtn = document.getElementById('confirmDeleteBtn');

        // Enable button only if checkbox is checked
        deleteBtn.disabled = !checkbox.checked;

        if (checkbox.checked) {
            console.log('✅ Delete button enabled');
        } else {
            console.log('❌ Delete button disabled');
        }
    }


    /* ========================================
       PAYMENT MODAL FUNCTIONS
       ======================================== */

    let currentPaymentMember = null;

    /* ========================================
       OPEN PAYMENT MODAL
       ======================================== */

    async function openPaymentModal(member) {
        console.log('💰 Opening payment modal for:', member.name);

        currentPaymentMember = member;

        // Set member name in header
        document.getElementById('paymentModalMemberName').textContent = `${member.name} (${member.member_id})`;

        // Load payment data
        await loadPaymentSummary(member);
        await loadPaymentHistory(member.id);
        await loadPaymentMethod(member.id);

        // Show modal
        document.getElementById('paymentModalOverlay').classList.add('active');

        console.log('✅ Payment modal opened');
    }

    /* ========================================
       CLOSE PAYMENT MODAL
       ======================================== */

    function closePaymentModal() {
        document.getElementById('paymentModalOverlay').classList.remove('active');
        currentPaymentMember = null;
        console.log('✅ Payment modal closed');
    }

    /* ========================================
       LOAD PAYMENT SUMMARY
       ======================================== */

    async function loadPaymentSummary(member) {
        // Set plan
        const planCosts = { 'Basic': 30, 'Premium': 50, 'Elite': 75 };
        const monthlyCost = planCosts[member.plan] || 0;
        document.getElementById('summaryPlan').textContent = `${member.plan} - $${monthlyCost}/mo`;

        // Fetch payments to calculate next due date
        try {
            const response = await fetch(`${API_BASE_URL}/members/${member.id}/payments`);
            const data = await response.json();

            if (data.payments && data.payments.length > 0) {
                // Sort by date (most recent first)
                const payments = data.payments.sort((a, b) => new Date(b.payment_date) - new Date(a.payment_date));
                const lastPayment = payments[0];

                // Calculate next due date (last + 1 month)
                const lastPaymentDate = new Date(lastPayment.payment_date);
                const nextDue = new Date(lastPaymentDate);
                nextDue.setMonth(nextDue.getMonth() + 1);

                const nextDueFormatted = nextDue.toLocaleDateString('en-US', {
                    month: 'short', 
                    day: 'numeric', 
                    year: 'numeric'
                });

                document.getElementById('summaryNextDue').textContent = nextDueFormatted;

                // Last payment
                const lastPaymentFormatted = lastPaymentDate.toLocaleDateString('en-US', {
                    month: 'short', 
                    day: 'numeric', 
                    year: 'numeric'
                });
                document.getElementById('summaryLastPayment').textContent = 
                    `${lastPaymentFormatted} - $${parseFloat(lastPayment.amount).toFixed(2)}`;
                
                // Check if overdue (more than 35 days since last payment)
                const daysSincePayment = Math.floor((new Date() - lastPaymentDate) / (1000 * 60 * 60 * 24));

                if (daysSincePayment > 35) {
                    document.getElementById('summaryStatus').innerHTML = '<span class="pill add">Overdue</span>';
                    document.getElementById('summaryBalance').textContent = `$${monthlyCost.toFixed(2)}`;
                } else {
                    document.getElementById('summaryStatus').innerHTML = '<span class="pill check">Current</span>';
                    document.getElementById('summaryBalance').textContent = '$0.00';
                }

            } else {
                // No payments yet
                document.getElementById('summaryNextDue').textContent = 'Not set';
                document.getElementById('summaryLastPayment').textContent = 'No payments recorded';
                document.getElementById('summaryStatus').innerHTML = '<span class="pill pill">New Member</span>';
                document.getElementById('summaryBalance').textContent = '$0.00';
            }

        } catch (error) {
            console.error('❌ Failed to load payment summary', error);
        }
    }

    /* ========================================
       LOAD PAYMENT HISTORY
       ======================================== */

    async function loadPaymentHistory(memberId) {
        try {
            const response = await fetch(`${API_BASE_URL}/members/${memberId}/payments`);
            const data = await response.json();

            const tbody = document.getElementById('paymentHistoryTableBody');

            if (!data.payments || data.payments.length === 0) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="5" class="table-empty">
                            <i class="fa-solid fa-receipt"></i>
                            <p>No payment history</p>
                        </td>
                    </tr>
                `;
                return;
            }

            // Sort by date (most recent first)
            const payments = data.payments.sort((a, b) => new Date(b.payment_date) - new Date(a.payment_date));

            tbody.innerHTML = payments.map(payment => {
                const date = new Date(payment.payment_date).toLocaleDateString('en-US', {
                    month: 'short', 
                    day: 'numeric', 
                    year: 'numeric'
                });

                const amount = `$${parseFloat(payment.amount).toFixed(2)}`;

                // Status pill
                let statusClass = 'check';  // green for success
                if (payment.status === 'failed') statusClass = 'add';    // red
                if (payment.status === 'pending') statusClass = 'stock';  // yellow
                if (payment.status === 'refunded') statusClass = 'pill'; // gray

                const notes = payment.notes || '-';

                return `
                    <tr>
                        <td>${date}</td>
                        <td>${amount}</td>
                        <td>${payment.payment_method}</td>
                        <td><span class="pill ${statusClass}">${payment.status}</span></td>
                        <td>${notes}</td>
                    </tr>
                `;
            }).join('');

            console.log(`✅ Loaded ${payments.length} payments`);

        } catch (error) {
            console.error('❌ Failed to load payment history:', error);
        }
    }

    /* ========================================
       LOAD PAYMENT METHOD ON FILE
       ======================================== */

    async function loadPaymentMethod(memberId) {
        try {
            const response = await fetch(`${API_BASE_URL}/members/${memberId}/payment-method`);
            const data = await response.json();

            const display = document.getElementById('paymentMethodDisplay');

            if (!data.payment_method) {
                display.innerHTML = `
                    <div class="no-payment-method">
                        <i class="fa-solid fa-credit-card"></i>
                        <p>No payment method on file</p>
                        <button class="btn primary small" id="addPaymentMethodBtn">
                            <i class="fa-solid fa-plus"></i>
                            Add Payment Method
                        </button>
                    </div>
                `;

                // Add event listener to the dynamically created button
                document.getElementById('addPaymentMethodBtn').addEventListener('click', openUpdatePaymentMethodModal);

                return;
            }

            const method = data.payment_method;

            // Card icon based on type
            let cardIcon = 'fa-credit-card';
            if (method.card_type === 'Visa') cardIcon = 'fa-cc-visa';
            if (method.card_type === 'Mastercard') cardIcon = 'fa-cc-mastercard';
            if (method.card_type === 'Amex') cardIcon = 'fa-cc-amex';
            if (method.card_type === 'Discover') cardIcon = 'fa-cc-discover';

            display.innerHTML = `
                <div class="card-display">
                    <i class="fa-brands ${cardIcon} card-icon"></i>
                    <div class="card-details">
                        <div class="card-type-number">${method.card_type} •••• ${method.last_four}</div>
                        <div class="card-expiry">Expires: ${String(method.expiry_month).padStart(2, '0')}/${method.expiry_year}</div>
                        <div class="card-name">${method.cardholder_name}</div>
                    </div>
                </div>
            `;

            console.log('✅ Loaded payment method');

        } catch (error) {
            console.error('❌ Failed to load payment method:', error);
        }
    }

    /* ========================================
       OPEN RECORD PAYMENT MODAL
       ======================================== */

    function openRecordPaymentModal() {
        console.log('📝 Opening record payment modal');

        // Set today's date as default
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('paymentDate').value = today;

        // Clear form
        document.getElementById('recordPaymentForm').reset();
        document.getElementById('paymentDate').value = today;
        document.getElementById('paymentStatus').value = 'success';

        // Hide message
        document.getElementById('recordPaymentError').style.display = 'none';
        document.getElementById('recordPaymentSuccess').style.display = 'none';

        // Show modal
        document.getElementById('recordPaymentModalOverlay').classList.add('active');

        console.log('✅ Record payment modal opened');
    }

    /* ========================================
       CLOSE RECORD PAYMENT MODAL
       ======================================== */

    function closeRecordPaymentModal() {
        document.getElementById('recordPaymentModalOverlay').classList.remove('active');
        console.log('✅ Record payment modal closed');
    }

    /* ========================================
       SUBMIT RECORD PAYMENT
       ======================================== */

    async function submitRecordPayment(e) {
        e.preventDefault();

        if (!currentPaymentMember) {
            console.error('❌ No member selected');
            return;
        }

        const form = document.getElementById('recordPaymentForm');
        const formData = new FormData(form);

        const paymentData = {
            amount: formData.get('amount'), 
            payment_date: formData.get('payment_date'), 
            payment_method: formData.get('payment_method'), 
            status: formData.get('status') || 'success', 
            notes: formData.get('notes') || null
        };

        console.log('💰 Submitting payment:', paymentData);

        // Hide previous message
        document.getElementById('recordPaymentError').style.display = 'none';
        document.getElementById('recordPaymentSuccess').style.display = 'none';

        try {
            const response = await fetch(`${API_BASE_URL}/members/${currentPaymentMember.id}/payments`, {
                method: 'POST', 
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(paymentData)
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Failed to record payment');
            }

            console.log('✅ Payment recorded:', result);

            // Show success message
            const successMsg = document.getElementById('recordPaymentSuccess');
            successMsg.textContent = '✅ Payment recorded successfully!';
            successMsg.style.display = 'block';

            // Wait 1 second, then close and refresh
            setTimeout(async () => {
                closeRecordPaymentModal();

                // Refresh payment modal data
                await loadPaymentSummary(currentPaymentMember);
                await loadPaymentHistory(currentPaymentMember.id);
            }, 1000);

        } catch (error) {
            console.error('❌ Failed to record payment:', error);

            // Show error message
            const errorMsg = document.getElementById('recordPaymentError');
            errorMsg.textContent = `❌ ${error.message}`;
            errorMsg.style.display = 'block';
        }
    }

    /* ========================================
       OPEN UPDATE PAYMENT METHOD MODAL
       ======================================== */

    async function openUpdatePaymentMethodModal() {
        console.log('💳 Opening update payment method modal');

        // Populate year dropdown (current year + 10 years)
        const yearSelect = document.getElementById('expiryYear');
        const currentYear = new Date().getFullYear();

        yearSelect.innerHTML = '<option value="">Year</option>';
        for (let i = 0; i < 15; i++) {
            const year = currentYear + i;
            yearSelect.innerHTML += `<option value="${year}">${year}</option>`;
        }

        // Load existing payment method if available
        if (currentPaymentMember) {
            try {
                const response = await fetch(`${API_BASE_URL}/members/${currentPaymentMember.id}/payment-method`);
                const data = await response.json();

                if (data.payment_method) {
                    const method = data.payment_method;

                    // Pre-fill form with existing data
                    document.getElementById('cardholderName').value = method.cardholder_name;
                    document.getElementById('cardType').value = method.card_type;
                    document.getElementById('lastFour').value = method.last_four;
                    document.getElementById('expiryMonth').value = method.expiry_month;
                    document.getElementById('expiryYear').value = method.expiry_year;
                    document.getElementById('billingZip').value = method.billing_zip || '';
                } else {
                    // No existing method - clear form
                    document.getElementById('updatePaymentMethodForm').reset();
                }

            } catch (error) {
                console.error('❌ Failed to load payment method:', error);
                // Continue anyway - they can still add a new one
                document.getElementById('updatePaymentMethodForm').reset();
            }
        }

        // Hide messages
        document.getElementById('updatePaymentMethodError').style.display = 'none';
        document.getElementById('updatePaymentMethodSuccess').style.display = 'none';

        // Show modal
        document.getElementById('updatePaymentMethodModalOverlay').classList.add('active');

        console.log('✅ Update payment method modal opened');
    }

    /* ========================================
       CLOSE UPDATE PAYMENT METHOD MODAL
       ======================================== */

    function closeUpdatePaymentMethodModal() {
        document.getElementById('updatePaymentMethodModalOverlay').classList.remove('active');
        console.log('✅ Update payment method modal closed');
    }

    /* ========================================
       SUBMIT UPDATE PAYMENT METHOD
       ======================================== */

    async function submitUpdatePaymentMethod(e) {
        e.preventDefault();

        if (!currentPaymentMember) {
            console.error('❌ No member selected');
            return;
        }

        const form = document.getElementById('updatePaymentMethodForm');
        const formData = new FormData(form);

        const methodData = {
            card_type: formData.get('card_type'), 
            last_four: formData.get('last_four'), 
            expiry_month: parseInt(formData.get('expiry_month')), 
            expiry_year: parseInt(formData.get('expiry_year')), 
            cardholder_name: formData.get('cardholder_name'), 
            billing_zip: formData.get('billing_zip') || null
        };

        console.log('💳 Submitting payment method:', methodData);

        // Hide previous messages
        document.getElementById('updatePaymentMethodError').style.display = 'none';
        document.getElementById('updatePaymentMethodSuccess').style.display = 'none';

        try {
            const response = await fetch(`${API_BASE_URL}/members/${currentPaymentMember.id}/payment-method`, {
                method: 'PUT', 
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(methodData)
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Failed to update payment method');
            }

            console.log('✅ Payment method updated:', result);

            // Show success message
            const successMsg = document.getElementById('updatePaymentMethodSuccess');
            successMsg.textContent = `✅ Payment method updated successfully!`;
            successMsg.style.display = 'block';

            // Wait 1 second, then close and refresh
            setTimeout(async () => {
                closeUpdatePaymentMethodModal();

                // Refresh payment method display
                await loadPaymentMethod(currentPaymentMember.id);
            }, 1000);

        } catch (error) {
            console.error('❌ Failed to update payment method:', error);

            // Show error message
            const errorMsg = document.getElementById('updatePaymentMethodError');
            errorMsg.textContent = `❌ ${error.message}`;
            errorMsg.style.display = 'block';
        }
    }


    /* ========================================
       SAVE MEMBER CHANGES
       ======================================== */

    async function saveMemberChanges(e) {
        e.preventDefault(); // Prevent form submission

        const form = document.getElementById('editMemberForm');
        const memberId = form.dataset.memberId;

        // Get form data
        const formData = new FormData(form);
        const memberData = {
            name: formData.get('name'), 
            email: formData.get('email'), 
            phone: formData.get('phone') || null, 
            emergency_contact: formData.get('emergency_contact') || null, 
            location_id: parseInt(formData.get('location_id')), 
            plan: formData.get('plan'), 
            notes: formData.get('notes') || null
        };

        console.log('💾 Saving member changes:', memberData);

        // Hide previous messages
        document.getElementById('editErrorMessage').style.display = 'none';
        document.getElementById('editSuccessMessage').style.display = 'none';

        try {
            const response = await fetch(`${API_BASE_URL}/members/${memberId}`, {
                method: 'PUT', 
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(memberData)
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Failed to update member');
            }

            console.log('✅ Member updated:', result);

            // Show success message
            const successMsg = document.getElementById('editSuccessMessage');
            successMsg.textContent = '✅ Member updated successfully!';
            successMsg.style.display = 'block';

            // Update the member in allMembers array
            const index = allMembers.findIndex(m => m.id == memberId);
            if (index !== -1) {
                allMembers[index] = result.member;
            }

            // Wait 1 second, then switch back to view mode with updated data
            setTimeout(() => {
                openMemberPanel(result.member);
                switchToViewMode();
            }, 1000);

            // Refresh the table to show updated data
            fetchMembers();

        } catch (error) {
            console.error('❌ Failed to save changed:', error);

            // Show error message
            const errorMsg = document.getElementById('editErrorMessage');
            errorMsg.textContent = `❌ ${error.message}`;
            errorMsg.style.display = 'block';
        }
    }

    
    /* ========================================
       ADD MEMBER FORM SUBMISSION
       ======================================== */
    
    const addMemberForm = document.getElementById('addMemberForm');
    
    if (addMemberForm) {
        addMemberForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            // Get form data
            const formData = new FormData(addMemberForm);
            const memberData = {
                name: formData.get('name'),
                email: formData.get('email'),
                location_id: parseInt(formData.get('location_id')),
                plan: formData.get('plan')
            };
            
            console.log('📝 Submitting new member:', memberData);
            
            try {
                const response = await fetch(`${API_BASE_URL}/members`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(memberData)
                });
                
                if (!response.ok) {
                    const error = await response.json();
                    throw new Error(error.error || 'Failed to create member');
                }
                
                const result = await response.json();
                
                console.log('✅ Member created:', result);
                
                // Close modal
                document.getElementById('add-member-modal').classList.remove('show');
                
                // Reset form
                addMemberForm.reset();
                
                // Refresh table and stats
                fetchMembers();
                fetchStats();
                
            } catch (error) {
                console.error('❌ Failed to create member:', error);
            }
        });
    }
    
    
    /* ========================================
       POPULATE LOCATION DROPDOWNS
       ======================================== */
    
    async function populateLocationDropdowns() {
        // Fetch locations from database via members query
        // For now, hardcode (we can create /api/locations later)
        const locations = [
            { id: 1, name: 'Downtown' },
            { id: 2, name: 'Midtown' },
            { id: 3, name: 'Eastside' }
        ];
        
        // Populate filter dropdown
        locations.forEach(loc => {
            const option = document.createElement('option');
            option.value = loc.id;
            option.textContent = loc.name;
            locationFilter.appendChild(option);
        });
        
        // Populate modal dropdowns
        const modalLocationSelects = document.querySelectorAll('#memberLocation, #checkinLocation, #editLocation');
        modalLocationSelects.forEach(select => {
            locations.forEach(loc => {
                const option = document.createElement('option');
                option.value = loc.id;
                option.textContent = loc.name;
                select.appendChild(option);
            });
        });
    }
    

    /* ========================================
       SLIDE PANEL EVENT LISTENERS
       ======================================== */

    // Close button
    document.getElementById('closeMemberPanel').addEventListener('click', closeMemberPanel);

    // Click overlay to close
    document.getElementById('memberDetailPanel').addEventListener('click', (e) => {
        // Only close if clicking the overlay itself, not the panel
        if (e.target.id === 'memberDetailPanel') {
            closeMemberPanel();
        }
    });

    // Freeze button
    document.getElementById('freezeMemberBtn').addEventListener('click', (e) => {
        const memberId = e.currentTarget.dataset.memberId;
        const member = allMembers.find(m => m.id == memberId);
        
        if (member) {
            switchToFreezeMode(member);
        }
    });

    // Cancel delete button
    document.getElementById('cancelDeleteBtn').addEventListener('click', () => {
        console.log(' Canceling delete');
        switchToViewMode();
    });

    // Confirm delete button
    document.getElementById('confirmDeleteBtn').addEventListener('click', deleteMember);

    // Also handle form submission
    document.getElementById('deleteMemberForm').addEventListener('submit', deleteMember);

    // Checkbox toggle - enable/disable delete button
    document.getElementById('deleteConfirmCheckbox').addEventListener('change', toggleDeleteButton);

    // Edit button
    document.getElementById('editMemberBtn').addEventListener('click', (e) => {
        const memberId = e.currentTarget.dataset.memberId;
        console.log('✏️ Edit member:', memberId);
        editMember(memberId);
    });

    // Delete button from panel
    document.getElementById('deleteMemberBtn').addEventListener('click', (e) => {
        const memberId = e.currentTarget.dataset.memberId;
        const member = allMembers.find(m => m.id == memberId);

        if (member) {
            switchToDeleteMode(member);
        }
    });

    // Escape key to close
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const panel = document.getElementById('memberDetailPanel');
            if (panel.classList.contains('active')) {
                closeMemberPanel();
            }
        }
    });

    // Cancel edit button
    document.getElementById('cancelEditBtn').addEventListener('click', () => {
        console.log('❌ Cancelling edit');
        switchToViewMode();
    });

    // Save changes button
    document.getElementById('saveEditBtn').addEventListener('click', saveMemberChanges);

    // Also handle form submission (pressing Enter in input)
    document.getElementById('editMemberForm').addEventListener('submit', saveMemberChanges);

    // Cancel freeze button
    document.getElementById('cancelFreezeBtn').addEventListener('click', () => {
        console.log(' Canceling freeze');
        switchToViewMode();
    });

    // Confirm freeze button
    document.getElementById('confirmFreezeBtn').addEventListener('click', freezeMember);

    // Also handle form submission
    document.getElementById('freezeMemberForm').addEventListener('submit', freezeMember);

    // Duration dropdown change - calculate end date
    document.getElementById('freezeDuration').addEventListener('change', calculateFreezeEndDate);

    // Start date change - recalculate end date
    document.getElementById('freezeStartDate').addEventListener('change', calculateFreezeEndDate);

    // Reactivate button (in view mode - dynamically set)
    document.getElementById('freezeMemberBtn').addEventListener('click', (e) => {
        const memberId = e.currentTarget.dataset.memberId;
        const member = allMembers.find(m => m.id == memberId);

        if (member) {
            // Check status and act accordingly
            if (member.status === 'cancelled') {
                e.stopPropagation();
                e.preventDefault();
                switchToReactivateMode(member);
            } else if (member.status === 'frozen') {
                // Handled by onclick (unfreeze modal)
            } else {
                // ACTIVE member - open freeze mode
                e.stopPropagation();
                e.preventDefault();
                switchToFreezeMode(member);
            }
        }
    });

    // Cancel reactivate button
    document.getElementById('cancelReactivateBtn').addEventListener('click', () => {
        console.log('❌ Cancelling reactivate');
        switchToViewMode();
    });

    // Confirm reactivate button
    document.getElementById('confirmReactivateBtn').addEventListener('click', submitReactivation);

    // Also handle form submission
    document.getElementById('reactivateMemberForm').addEventListener('submit', submitReactivation);

    // Checkbox toggle - enable/disable reactivate button
    document.getElementById('reactivateConfirmCheckbox').addEventListener('change', toggleReactivateButton);

    // Update payment method before reactivate
    document.getElementById('updatePaymentBeforeReactivate').addEventListener('click', () => {
        // Open payment method modal
        if (currentPaymentMember) {
            openUpdatePaymentMethodModal();
        } else {
            console.error('❌ No current payment member set');
        }
    });

    /* ========================================
       PAYMENT MODAL EVENT LISTENERS
       ======================================== */

    // Close main payment modal
    document.getElementById('closePaymentModal').addEventListener('click', closePaymentModal);

    // Close payment modal when clicking overlay
    document.getElementById('paymentModalOverlay').addEventListener('click', (e) => {
        if (e.target.id === 'paymentModalOverlay') {
            closePaymentModal();
        }
    });

    // Record Payment button
    document.getElementById('recordPaymentBtn').addEventListener('click', openRecordPaymentModal);

    // Update Payment Method button (in main modal)
    document.getElementById('updatePaymentMethodBtn').addEventListener('click', openUpdatePaymentMethodModal);

    // Close record payment modal
    document.getElementById('closeRecordPaymentModal').addEventListener('click', closeRecordPaymentModal);
    document.getElementById('cancelRecordPayment').addEventListener('click', closeRecordPaymentModal);

    // Submit record payment
    document.getElementById('submitRecordPayment').addEventListener('click', submitRecordPayment);
    document.getElementById('recordPaymentForm').addEventListener('submit', submitRecordPayment);

    // Close record payment modal when clicking overlay
    document.getElementById('recordPaymentModalOverlay').addEventListener('click', (e) => {
        if (e.target.id === 'recordPaymentModalOverlay') {
            closeRecordPaymentModal();
        }
    });

    // Close update payment method modal
    document.getElementById('closeUpdatePaymentMethodModal').addEventListener('click', closeUpdatePaymentMethodModal);
    document.getElementById('cancelUpdatePaymentMethod').addEventListener('click', closeUpdatePaymentMethodModal);

    // Submit update payment method
    document.getElementById('submitUpdatePaymentMethod').addEventListener('click', submitUpdatePaymentMethod);
    document.getElementById('updatePaymentMethodForm').addEventListener('submit', submitUpdatePaymentMethod);

    // Close update payment method modal when clicking overlay
    document.getElementById('updatePaymentMethodModalOverlay').addEventListener('click', (e) => {
        if (e.target.id === 'updatePaymentMethodModalOverlay') {
            closeUpdatePaymentMethodModal();
        }
    });

    // Unfreeze confirmation moda
    document.getElementById('closeUnfreezeModal').addEventListener('click', closeUnfreezeModal);
    document.getElementById('cancelUnfreeze').addEventListener('click', closeUnfreezeModal);
    document.getElementById('confirmUnfreeze').addEventListener('click', confirmUnfreezeAction);

    // Close unfreeze modal when clicking overlay
    document.getElementById('unfreezeModalOverlay').addEventListener('click', (e) => {
        if (e.target.id === 'unfreezeModalOverlay') {
            closeUnfreezeModal();
        }
    });

    // Table sorting
    document.querySelectorAll('.sortable').forEach(th => {
        th.addEventListener('click', () => {
            const column = th.dataset.sort;
            sortMembersTable(column);
        });
    });

    
    /* ========================================
       INITIALIZE PAGE
       Load data from API
       ======================================== */
    
    async function initMembersPage() {
        console.log('🔄 Initializing members page...');
        
        // Populate location dropdowns
        await populateLocationDropdowns();
        
        // Fetch stats
        await fetchStats();
        
        // Fetch and display members
        await fetchMembers();
        
        console.log(`✅ Members page initialized with real data! (${allMembers.length} total members)`);
    }
    
    // Run initialization
    initMembersPage();
});