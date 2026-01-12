// js/shared.js

/* ============================================
   SHARED/UNIVERSAL FUNCTIONALITY
   Handles modals and features accessible from ANY page
   ============================================ */

// API Base URL
const API_BASE_URL = 'http://localhost:5000/api';


/* ============================================
   POPULATE LOCATION DROPDOWNS
   Universal - populates location dropdowns in all modals
   ============================================ */

 async function populateLocationDropdowns() {
        // Fetch locations from database via members query
        // For now, hardcode (we can create /api/locations later)
        const locations = [
            { id: 1, name: 'Downtown' },
            { id: 2, name: 'Midtown' },
            { id: 3, name: 'Eastside' }
        ];
        
        // Populate ALL modal location dropdowns across all pages
        // WHY querySelectorAll? Different pages have different modals
        const modalLocationSelects = document.querySelectorAll(
            '#memberLocation, #checkinLocation, #editLocation, #staffLocation, #editStaffLocation'
        );

        modalLocationSelects.forEach(select => {
            // Clear existing options first (prevent duplicates)
            select.innerHTML = '<option value="">Select Location</option>';

            // Add location options
            locations.forEach(loc => {
                const option = document.createElement('option');
                option.value = loc.id;
                option.textContent = loc.name;
                select.appendChild(option);
            });
        });

        // Populate filter dropdown (only exists on members/staff pages)
        const locationFilter = document.getElementById('locationFilter');
        if (locationFilter) {
            // Clear and add "All locations" option
            locationFilter.innerHTML = '<option value="">All Locations</option>';

            locations.forEach(loc => {
                const option = document.createElement('option');
                option.value = loc.id;
                option.textContent = loc.name;
                locationFilter.appendChild(option);
            });
        }
    }

/* ============================================
   AUTO-FORMAT PHONE NUMBERS
   Formats phone input to (XXX) XXX-XXXX as user types
   ============================================ */

function setupPhoneFormatting() {
    // Find all phone input fields
    const phoneInputs = document.querySelectorAll('input[type="tel"]');

    phoneInputs.forEach(input => {
        input.addEventListener('input', (e) => {
            // Get only numbers from input
            let value = e.target.value.replace(/\D/g, '');

            // Limit to 10 digits
            if (value.length > 10) {
                value = value.slice(0, 10);
            }

            // Format as (XXX) XXX-XXXX
            let formatted = '';
            if (value.length > 0) {
                formatted = '(' + value.substring(0, 3);
            }
            if (value.length >= 4) {
                formatted += ') ' + value.substring(3, 6);
            }
            if (value.length >= 7) {
                formatted += '-' + value.substring(6, 10);
            }

            // Update input value
            e.target.value = formatted;
        });
    });
}

/* ============================================
   1. ADD MEMBER FORM MODAL HANDLER
   Universal - accessible from sidebar on all pages
   ============================================ */

const addMemberForm = document.getElementById('addMemberForm');
    
    if (addMemberForm) {
        addMemberForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            // Get form data
            const formData = new FormData(addMemberForm);
            const memberData = {
                name: formData.get('name'),
                email: formData.get('email'),
                phone: formData.get('phone'), 
                emergency_contact: formData.get('emergency_contact') || null, 
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
                if (typeof fetchMembers === 'function' && typeof fetchStats === 'function') {
                    fetchMembers();
                    fetchStats();
                }
                
            } catch (error) {
                console.error('❌ Failed to create member:', error);
            }
        });
    }

/* ============================================
   2. MEMBER CHECK-IN MODAL HANDLER
   Universal - accessible from sidebar on all pages
   ============================================ */

// Store all members for autocomplete (will be populated on page load)
let allMembers = [];

/* ============================================
   FETCH ALL MEMBERS FOR CHECK-IN SEARCH
   Called on page load to populate autocomplete
   ============================================ */

async function fetchAllMembersForCheckIn() {
    try {
        const response = await fetch(`${API_BASE_URL}/members`);
        const data = await response.json();
        allMembers = data.members || [];
        console.log(`✅ Loaded ${allMembers.length} members for check-in search`);
    } catch {
        console.error('❌ Failed to fetch members for check-in:', error);
    }
}

/* ============================================
   SUBMIT CHECK-IN
   Handles member check-in form modal
   ============================================ */

async function submitCheckIn(memberId, locationId) {
        console.log(`🏋️ Checking in member ${memberId} at location ${locationId}`);

        try {
            // Call check-in API
            const response = await fetch(`${API_BASE_URL}/members/${memberId}/check-in`, {
                method: 'POST', 
                headers: {
                    'Content-Type': 'application/json'
                }, 
                body: JSON.stringify({
                    location_id: locationId
                })
            });

            const data = await response.json();

            // Handle validation errors (429, 400, etc)
            if (!response.ok) {
                if (data.error === 'Validation failed') {
                    // Show validation errors
                    const errorMsg = data.details.map(d => d.msg).join('\n');
                    showNotification(`Check-in failed: ${errorMsg}`, 'error');
                } else {
                    showNotification(data.error || 'Check-in failed', 'error');
                }

                return false;
            }

            // Success!
            console.log('✅ Check-in successful:', data.check_in);

            // Show success notification card
            showCheckInNotification(data.check_in);

            // Close the modal
            closeCheckInModal();

            // If member panel is open, update the count
            const panelMemberId = document.getElementById('editMemberBtn')?.dataset.memberId;
            if (panelMemberId == memberId && typeof updateCheckInCount === 'function') {
                updateCheckInCount(memberId);
            }

            return true;

        } catch (error) {
            console.error('❌ Check-in error:', error);
            showNotification('Network error. Please try again.', 'error');
            return false;
        }
    }

/* ========================================
   SHOW CHECK-IN NOTIFICATION
   Displays a notification card when member checks in
   ======================================== */

function showCheckInNotification(checkIn) {

        // Format time (e.g., "10:30 AM")
        const checkInTime = new Date(checkIn.check_in_time);
        const timeString = checkInTime.toLocaleTimeString('en-US', {
            hour: 'numeric', 
            minute: '2-digit', 
            hour12: true
        });

        // Create notification element
        const notification = document.createElement('div');
        notification.className = 'check-in-notification success';
        notification.innerHTML = `
            <div class="notification-header">
                <div class="notification-icon">
                    <i class="fa-solid fa-check"></i>
                </div>
                <div class="notification-title">Check-In Successful</div>
            </div>
            <div class="notification-body">
                <div class="notification-member">${checkIn.member_name}</div>
                <div class="notification-details">
                    <div class="notification-time">
                        <i class="fa-regular fa-clock"></i>
                        <span>${timeString}</span>
                    </div>
                    <div class="notification-location">
                        <i class="fa-solid fa-location-dot"></i>
                        <span>${checkIn.location_name}</span>
                    </div>
                </div>
            </div>
        `;

        // Add to container
        const container = document.getElementById('checkInNotifications');
        container.appendChild(notification);

        // Auto-dismiss after 4 seconds
        setTimeout(() => {
            notification.classList.add('fade-out');

            // Remove from DOM after animation
            setTimeout(() => {
                notification.remove();
            }, 500);    // Match fadeOut animation duration
        }, 6000);
    }

/* ========================================
   GENERIC NOTIFICATION (for errors, etc)
   Toast-style notification
   ======================================== */

 function showNotification(message, type = 'info') {
        console.log(`${type.toUpperCase()}: ${message}`);

        // Create toast notification
        const toast = document.createElement('div');
        toast.className = `toast-notification ${type}`;
        toast.innerHTML = `
            <div class=""toast-icon">
                <i class="fa-solid fa-${type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
            </div>
            <div class="toast-message">${message}</div>
        `;

        // Add to body
        document.body.appendChild(toast);

        // Trigger animation
        setTimeout(() => toast.classList.add('show'), 10);

        // Auto-dismiss after 3 seconds
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

/* ========================================
   CLOSE CHECK-IN MODAL
   ======================================== */

function closeCheckInModal() {
        // Close the modal
        const modal = document.getElementById('checkin-modal');
        if (modal) {
            modal.classList.remove('show');
        }
    }

/* ========================================
   CHECK-IN MEMBER SEARCH
   Autocomplete search for check-in modal with location auto-fill
   ======================================== */

function setupCheckInSearch() {
        const searchInput = document.getElementById('checkinSearch');
        const memberIdInput = document.getElementById('checkInMemberId');
        const memberLocationInput = document.getElementById('checkInMemberLocationId');

        if (!searchInput) return;

        // Create results dropdown
        const resultsDiv = document.createElement('div');
        resultsDiv.id = 'checkinSearchResults';
        resultsDiv.className = 'search-results.dropdown';
        searchInput.parentElement.appendChild(resultsDiv);

        // Search as user types
        searchInput.addEventListener('input', (e) => {
            const query = e.target.value.trim().toLowerCase();

            if (query.length < 2) {
                resultsDiv.style.display = 'none';
                return;
            }

            // Filter active members only
            const matches = allMembers.filter(member => {
                if (member.status !== 'active') return false;

                return member.name.toLowerCase().includes(query) || 
                       member.email.toLowerCase().includes(query) || 
                       member.member_id.toLowerCase().includes(query);
            }).slice(0, 5); // Max 5 results

            if (matches.length === 0) {
                resultsDiv.innerHTML = '<div class="search-no-results">No active members found</div>';
                resultsDiv.style.display = 'block';
                return;
            }

            // Display results
            resultsDiv.innerHTML = matches.map(member => `
                <div class="search-result-item" 
                     data-member-id="${member.id}"
                     data-location-id="${member.location_id}">
                    <div class="search-result-name">${member.name}</div>
                    <div class="search-result-details">${member.member_id} • ${member.location_name}</div>
                </div>
            `).join('');

            resultsDiv.style.display = 'block';

            // Handle result clicks
            resultsDiv.querySelectorAll('.search-result-item').forEach(item => {
                item.addEventListener('click', () => {
                    const memberId = item.dataset.memberId;
                    const memberLocationId = item.dataset.locationId;
                    const memberName = item.querySelector('.search-result-name').textContent;

                    // Set the hidden field
                    memberIdInput.value = memberId;

                    // Store original location for comparison
                    memberLocationInput.value = memberLocationId;

                    // Update search box to show selected member
                    searchInput.value = memberName;

                    // Auto-fill location dropdown
                    const locationSelect = document.getElementById('checkinLocation');
                    locationSelect.value = memberLocationId;

                    // Visual feedback (green border flash)
                    locationSelect.style.borderColor = 'var(--color-success)';
                    locationSelect.style.transition = 'border-color 0.3s ease';
                    setTimeout(() => {
                        locationSelect.style.borderColor = '';
                    }, 1500);

                    // Hide location warning (if visible from previous selection)
                    const warningDiv = document.getElementById('locationWarning');
                    if (warningDiv) {
                        warningDiv.style.display = 'none';
                    }

                    // Hide results
                    resultsDiv.style.display = 'none';
                });
            });
        });

        // Hide results when clicking outside
        document.addEventListener('click', (e) => {
            if (!searchInput.contains(e.target) && !resultsDiv.contains(e.target)) {
                resultsDiv.style.display = 'none';
            }
        });

        // Clear member ID when search is cleared
        searchInput.addEventListener('change', () => {
            if (!searchInput.value.trim()) {
                memberIdInput.value = '';
                memberLocationInput.value = '';
            }
        });
    }

/* ========================================
   SETUP LOCATION WARNING
   Warns if checking in at different location than home gym
   ======================================== */

function setupLocationWarning() {
        const locationSelect = document.getElementById('checkinLocation');
        const memberLocationInput = document.getElementById('checkInMemberLocationId');
        const warningDiv = document.getElementById('locationWarning');
    
        if (!locationSelect || !warningDiv) return;
    
        locationSelect.addEventListener('change', () => {
            const selectedLocation = locationSelect.value;
            const memberHomeLocation = memberLocationInput.value;
        
            // Only show warning if:
            // 1. A member has been selected (memberHomeLocation is set)
            // 2. Selected location is different from member's home location
            if (memberHomeLocation && selectedLocation !== memberHomeLocation) {
                warningDiv.style.display = 'flex';
            } else {
                warningDiv.style.display = 'none';
            }
        });
    }

/* ========================================
   CHECK-IN MODAL EVENT LISTENERS
   ======================================== */

document.addEventListener('DOMContentLoaded', () => {

    // Populate location dropdowns FIRST (needed for all modals)
    populateLocationDropdowns();

    // Setup phone auto-formatting
    setupPhoneFormatting();

    // Fetch members for autocomplete
    fetchAllMembersForCheckIn();

    // Setup autocomplete search
    setupCheckInSearch();

    // Setup location warning
    setupLocationWarning();

    // Confirm Check-In button
    const confirmCheckInBtn = document.getElementById('confirmCheckInBtn');
    if (confirmCheckInBtn) {
        // When user clicks "Confirm Check-In" button
        confirmCheckInBtn.addEventListener('click', async (e) => {
            e.preventDefault();

            // Get selected member ID and location ID from modal
            const memberId = document.getElementById('checkInMemberId').value;
            const locationId = document.getElementById('checkinLocation').value;

            // Validate inputs
            if (!memberId) {
                showNotification('Please select a member', 'error');
                return;
            }

            if (!locationId) {
                showNotification('Please select a location', 'error');
                return;
            }

            // Show loading state
            const btn = e.target;
            const originalText = btn.innerHTML;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Checking in...';
            btn.disabled = true;

            // Submit check-in
            const success = await submitCheckIn(memberId, locationId);

            // Restore button
            btn.innerHTML = originalText;
            btn.disabled = false;

            // Clear form if successful
            if (success) {
                document.getElementById('checkInMemberId').value = '';
                document.getElementById('checkinLocation').value = '';
            }
        });
    }
});

/* ============================================
   3. ADD STAFF MODAL HANDLER (PLACEHOLDER)
   Universal - accessible from sidebar on all pages
   ============================================ */

const addStaffForm = document.getElementById('addStaffForm');

if (addStaffForm) {
    addStaffForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // Get form data
        const formData = new FormData(addStaffForm);
        const staffData = {
            name: formData.get('name'),
            email: formData.get('email'),
            phone: formData.get('phone') || null,
            role: formData.get('role'),
            location_id: parseInt(formData.get('location_id')),
            hire_date: formData.get('hire_date')
        };
        
        console.log('📝 Submitting new staff:', staffData);
        
        try {
            const response = await fetch(`${API_BASE_URL}/staff`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(staffData)
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to create staff member');
            }
            
            const result = await response.json();
            
            console.log('✅ Staff member created:', result);
            
            // Close modal
            document.getElementById('add-staff-modal').classList.remove('show');
            
            // Reset form
            addStaffForm.reset();
            
            // If we're on staff page, refresh the data
            // WHY? fetchStaff() only exists on staff.html
            if (typeof fetchStaff === 'function') {
                fetchStaff();
                fetchStaffStats();
            }
            
            // Show success notification
            showNotification('Staff member added successfully!', 'success');
            
        } catch (error) {
            console.error('❌ Failed to create staff:', error);
            showNotification(error.message, 'error');
        }
    });
}


/* ============================================
   4. ADD TRAINER MODAL HANDLER (PLACEHOLDER)
   Universal - accessible from sidebar on all pages
   ============================================ */

const addTrainerForm = document.getElementById('addTrainerForm');

if (addTrainerForm) {
    addTrainerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // Get form data
        const formData = new FormData(addTrainerForm);
        const trainerData = {
            name: formData.get('name'),
            email: formData.get('email'),
            location: formData.get('location'),
            specialty: formData.get('specialty'),
            rate: formData.get('rate') || null,
            notes: formData.get('notes') || null
        };
        
        console.log('📝 Submitting new trainer:', trainerData);
        
        // TODO: When you create a trainers table and API endpoint, update this
        try {
            // Placeholder - you'll need to create /api/trainers endpoint
            const response = await fetch(`${API_BASE_URL}/trainers`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(trainerData)
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to add trainer');
            }
            
            const result = await response.json();
            
            console.log('✅ Trainer added:', result);
            
            // Close modal
            document.getElementById('add-trainer-modal').classList.remove('show');
            
            // Reset form
            addTrainerForm.reset();
            
            // Show success notification
            showNotification('Trainer added successfully!', 'success');
            
        } catch (error) {
            console.error('❌ Failed to add trainer:', error);
            showNotification(error.message, 'error');
        }
    });
}

console.log('✅ Shared module initialized');
