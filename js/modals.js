/* ============================================
   MODAL SYSTEM
   Open/close modals, handle forms, validation
   ============================================ */

document.addEventListener('DOMContentLoaded', () => {
    
    /* ========================================
       OPEN MODAL FUNCTIONALITY
       ======================================== */
    
    // Get all elements that can trigger modals
    const modalTriggers = document.querySelectorAll('[data-modal]');
    
    if (modalTriggers.length === 0) {
        console.warn('No modal triggers found');
        return;
    }
    
    // Add click handler to each trigger
    modalTriggers.forEach(trigger => {
        trigger.addEventListener('click', (e) => {
            e.preventDefault(); // Don't follow href="#"
            
            // Get the modal ID from data attribute
            const modalId = trigger.getAttribute('data-modal');
            const modal = document.getElementById(modalId);
            
            if (!modal) {
                console.error(`❌ Modal not found: ${modalId}`);
                return;
            }
            
            // Open the modal
            openModal(modal);
            
            console.log(`📂 Opened modal: ${modalId}`);
        });
    });

    /* ========================================
       CLOSE MODAL FUNCTIONALITY
       ======================================== */
    
    // Get all close buttons
    const closeButtons = document.querySelectorAll('[data-close-modal]');
    
    closeButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            e.preventDefault();
            
            // Find the closest modal parent
            const modal = button.closest('.modal-overlay');
            
            if (modal) {
                closeModal(modal);
                console.log('❌ Closed modal via button');
            }
        });
    });
    
    /* ========================================
       CLOSE MODAL ON BACKDROP CLICK
       Click outside modal to close
       ======================================== */
    
    const allModals = document.querySelectorAll('.modal-overlay');
    
    allModals.forEach(modal => {
        modal.addEventListener('click', (e) => {
            // Only close if clicking the backdrop (not the modal card itself)
            if (e.target === modal) {
                closeModal(modal);
                console.log('❌ Closed modal via backdrop click');
            }
        });
    });
    
    /* ========================================
       CLOSE MODAL ON ESCAPE KEY
       Accessibility feature
       ======================================== */
    
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' || e.key === 'Esc') {
            // Find all open modals
            const openModals = document.querySelectorAll('.modal-overlay.show');
            
            // Close the most recently opened one
            if (openModals.length > 0) {
                const lastModal = openModals[openModals.length - 1];
                closeModal(lastModal);
                console.log('⌨️ Closed modal via Escape key');
            }
        }
    });
    
    /* ========================================
       HELPER FUNCTIONS
       ======================================== */
    
    /**
     * Opens a modal
     * @param {HTMLElement} modal - The modal overlay element
     */
    function openModal(modal) {
        // Add 'show' class to trigger CSS animations
        modal.classList.add('show');
        
        // Update ARIA for screen readers
        modal.setAttribute('aria-hidden', 'false');
        
        // Prevent body scroll when modal is open
        document.body.style.overflow = 'hidden';
        
        // Focus first input in modal (better UX)
        setTimeout(() => {
            const firstInput = modal.querySelector('input, textarea, select');
            if (firstInput) {
                firstInput.focus();
            }
        }, 100); // Small delay to let animation start
    }
    
    
    /**
     * Closes a modal
     * @param {HTMLElement} modal - The modal overlay element
     */
    function closeModal(modal) {
        // Remove 'show' class (triggers fade-out animation)
        modal.classList.remove('show');
        
        // Update ARIA for screen readers
        modal.setAttribute('aria-hidden', 'true');
        
        // Re-enable body scroll
        document.body.style.overflow = '';
        
        // Clear form inputs (optional - depends on your preference)
        const form = modal.querySelector('form');
        if (form) {
            form.reset();
        }
    }
    
    
    /* ========================================
       FORM SUBMISSION HANDLING
       Prevent default, show validation
       ======================================== */
    
    // Get all forms inside modals
    const modalForms = document.querySelectorAll('.modal-overlay form');
    
    modalForms.forEach(form => {
        form.addEventListener('submit', (e) => {
            e.preventDefault(); // Don't actually submit yet
            
            // Get form data
            const formData = new FormData(form);
            const data = Object.fromEntries(formData);
            
            console.log('📋 Form submitted with data:', data);
            
            // TODO: When backend is ready, send data to API
            // fetch('/api/members', {
            //     method: 'POST',
            //     headers: { 'Content-Type': 'application/json' },
            //     body: JSON.stringify(data)
            // })
            // .then(response => response.json())
            // .then(result => {
            //     console.log('✅ Member added:', result);
            //     closeModal(form.closest('.modal-overlay'));
            //     // Refresh dashboard data
            // })
            // .catch(error => {
            //     console.error('❌ Error:', error);
            //     // Show error message to user
            // });

            alert('✅ Form submitted! (No backend yet - data logged to console)');
            closeModal(form.closest('.modal-overlay'));
        });
    });

    /* ========================================
       SIMPLE FORM VALIDATION
       ======================================== */
    
    /**
     * Validates form inputs
     * @param {HTMLFormElement} form - The form to validate
     * @returns {boolean} - True if valid, false if invalid
     */
    function validateForm(form) {
        const inputs = form.querySelectorAll('[required]');
        let isValid = true;
        
        inputs.forEach(input => {
            if (!input.value.trim()) {
                // Empty required field
                input.classList.add('error');
                isValid = false;
                
                // Show error message
                let errorMsg = input.parentElement.querySelector('.error-message');
                if (!errorMsg) {
                    errorMsg = document.createElement('span');
                    errorMsg.className = 'error-message';
                    errorMsg.textContent = 'This field is required';
                    input.parentElement.appendChild(errorMsg);
                }
            } else {
                // Field is filled
                input.classList.remove('error');
                
                // Remove error message
                const errorMsg = input.parentElement.querySelector('.error-message');
                if (errorMsg) {
                    errorMsg.remove();
                }
            }
        });
        
        return isValid;
    }
    
    console.log('🎯 Modal system loaded successfully!');
});


/* ============================================
   NOTES FOR FUTURE DEVELOPMENT
   ============================================
   
   FEATURES YOU COULD ADD LATER:
   
   1. Loading state on submit:
      button.classList.add('loading');
      button.disabled = true;
   
   2. Success/error notifications:
      Show toast notification instead of alert()
   
   3. Multi-step forms:
      "Next" button advances to step 2, "Back" returns
   
   4. Autosave drafts:
      Save form data to localStorage every few seconds
   
   5. Confirmation before closing:
      "You have unsaved changes. Are you sure?"
      
   ============================================ */