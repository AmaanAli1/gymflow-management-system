/* ============================================
   SETTINGS.JS
   Handles settings page functionality
   Fetches and updates system preferences
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
       DOM ELEMENTS
       Cache frequently used elements
       ============================================ */

    const settingsForm = document.getElementById('settingsForm');
    const saveBtn = document.getElementById('saveSettingsBtn');

    // Form inputs
    const currencySymbolInput = document.getElementById('currencySymbol');
    const dateFormatInput = document.getElementById('dateFormat');
    const lowInventoryInput = document.getElementById('lowInventoryThreshold');
    const capacityWarningInput = document.getElementById('capacityWarning');

    /* ============================================
       INITIALIZATION
       Run when page loads
       ============================================ */

    await fetchSettings();
    setupEventListeners();

    console.log('Settings page initialized');

    /* ============================================
       FETCH SETTINGS
       Load current settings from backend
       ============================================ */

    async function fetchSettings() {
        try {
            const response = await fetch(`${API_BASE_URL}/settings`);

            if (!response.ok) {
                throw new Error('Failed to fetch settings');
            }

            const settings = await response.json();

            // Populate form fields with current values
            currencySymbolInput.value = settings.currency_symbol || '$';
            dateFormatInput.value = settings.date_format || 'MM/DD/YYYY';
            lowInventoryInput.value = settings.low_inventory_threshold || 10;
            capacityWarningInput.value = settings.capacity_warning_percent || 85;

        } catch (error) {
            console.error('Failed to fetch settings:', error);
            showError('Failed to load settings. Please refresh the page');
        }
    }

    /* ============================================
       SETUP EVENT LISTENERS
       Handle form submission
       ============================================ */

    function setupEventListeners() {
        settingsForm.addEventListener('submit', handleSaveSettings);
    }

    /* ============================================
       HANDLE SAVE SETTINGS
       Update settings via PUT request
       ============================================ */

    async function handleSaveSettings(e) {
        e.preventDefault();       // Prevent default form submission

        // Handle previous messages
        hideMessages();

        // Get form values
        const currencySymbol = currencySymbolInput.value.trim();
        const dateFormat = dateFormatInput.value.trim();
        const lowInventoryThreshold = parseInt(lowInventoryInput.value);
        const capacityWarningPercent = parseInt(capacityWarningInput.value);

        // Client-side validation
        if (!currencySymbol || !dateFormat) {
            showError('Currency symbol and date format are required');
            return;
        }

        if (lowInventoryThreshold < 1) {
            showError('Low inventory threshold must be at least 1');
            return;
        }

        if (capacityWarningPercent < 1 || capacityWarningPercent > 100) {
            showError('Capacity warning must be between 1-100%');
            return;
        }

        // Show loading state
        const originalBtnText = saveBtn.innerHTML;
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';

        // Add loading class to form
        settingsForm.classList.add('loading');

        try {
            const response = await fetch(`${API_BASE_URL}/settings`, {
                method: 'PUT', 
                headers: { 'Content-Type': 'application/json' }, 
                body: JSON.stringify({
                    currency_symbol: currencySymbol, 
                    date_format: dateFormat, 
                    low_inventory_threshold: lowInventoryThreshold, 
                    capacity_warning_percent: capacityWarningPercent
                })
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Failed to update settings');
            }

            // Show success message
            showSuccess('Settings updated successfully!');

            // Scroll to top to see success message
            window.scrollTo({ top: 0, behavior: 'smooth' });

        } catch (error) {
            console.error('Failed to update settings:', error);
            showError(error.message || 'Failed to save settings. Please try again.');
        } finally {
            // Reset button state
            saveBtn.disabled = false;
            saveBtn.innerHTML = originalBtnText;

            // Remove loading class
            settingsForm.classList.remove('loading');
        }
    }

    /* ============================================
       HELPER: Show Error Message
       Display error in error div
       ============================================ */

    function showError(message) {
        const errorDiv = document.getElementById('settingsError');
        if (!errorDiv) return;

        errorDiv.textContent = message;
        errorDiv.style.display = 'flex';

        // Auto-hide after 5 seconds
        setTimeout(() => {
            errorDiv.style.display = 'none';
        }, 5000);
    }

    /* ============================================
       HELPER: Show Success Message
       Display success in success div
       ============================================ */

    function showSuccess(message) {
        const successDiv = document.getElementById('settingsSuccess');
        if (!successDiv) return;

        successDiv.textContent = message;
        successDiv.style.display = 'flex';
        successDiv.classList.add('show');

        // Auto-hide after 3 seconds
        setTimeout(() => {
            successDiv.style.display = 'none';
            successDiv.classList.remove('show');
        }, 3000);
    }

    /* ============================================
       HELPER: Hide All Messages
       Clear error and success messages
       ============================================ */

    function hideMessages() {
        const errorDiv = document.getElementById('settingsError');
        const successDiv = document.getElementById('settingsSuccess');

        if (errorDiv) {
        errorDiv.style.display = 'none';
        }
        if (successDiv) {
        successDiv.style.display = 'none';
        }
    }
});