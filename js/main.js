/* ============================================
   MAIN.JS - Entry Point
   Shared utilities and initialization
   ============================================ */

window.dismissDemoBanner = () => {
    
    const banner = document.getElementById('demoBanner');
    
    if (banner) {
        banner.style.display = 'none';
        sessionStorage.setItem('demoBannerDismissed', 'true');
        document.body.style.paddingTop = '0';
    } 
};


document.addEventListener('DOMContentLoaded', () => {
    console.log('✅ GymFlow initialized');
    
    /* ========================================
       GLOBAL UTILITIES
       Helper functions used across the app
       ======================================== */
    
    // Make utilities available globally
    window.GymFlow = {
        
        /**
         * Format number with commas (1234 → 1,234)
         */
        formatNumber: (num) => {
            return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
        },
        
        /**
         * Format currency ($1234 → $1,234.00)
         */
        formatCurrency: (amount) => {
            return new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency: 'USD'
            }).format(amount);
        },
        
        /**
         * Format date (2025-12-31 → Dec 31, 2025)
         */
        formatDate: (dateString) => {
            const date = new Date(dateString);
            return date.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric'
            });
        },
        
        /**
         * Get relative time (2 hours ago, 3 days ago)
         */
        getRelativeTime: (dateString) => {
            const date = new Date(dateString);
            const now = new Date();
            const diffMs = now - date;
            const diffMins = Math.floor(diffMs / 60000);
            const diffHours = Math.floor(diffMs / 3600000);
            const diffDays = Math.floor(diffMs / 86400000);
            
            if (diffMins < 1) return 'Just now';
            if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? 's' : ''} ago`;
            if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
            if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
            return date.toLocaleDateString();
        },
        
        /**
         * Show loading state on element
         */
        showLoading: (element) => {
            element.classList.add('loading');
            element.style.pointerEvents = 'none';
        },
        
        /**
         * Hide loading state
         */
        hideLoading: (element) => {
            element.classList.remove('loading');
            element.style.pointerEvents = '';
        }
    };
    
    /* ========================================
       NOTIFICATION SYSTEM (Simple Toast)
       ======================================== */
    
    /**
     * Show toast notification
     * @param {string} message - Message to display
     * @param {string} type - 'success', 'error', 'warning', 'info'
     */
    window.GymFlow.showNotification = (message, type = 'info') => {
        // Create toast element
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        
        // Add to body
        document.body.appendChild(toast);
        
        // Animate in
        setTimeout(() => toast.classList.add('show'), 10);
        
        // Auto-remove after 3 seconds
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    };

    /* ========================================
       DEMO BANNER - ATTACH CLOSE BUTTON
       ======================================== */
    
    const closeBannerBtn = document.getElementById('closeBannerBtn');
    if (closeBannerBtn) {
        closeBannerBtn.addEventListener('click', () => {
            window.dismissDemoBanner();
        });
    }

    /* ========================================
       DEMO BANNER FUNCTIONALITY
       Handle banner dismissal and countdown
       ======================================== */

    /**
     * Check if banner was dismissed this session
     */

    const wasDismissed = sessionStorage.getItem('demoBannerDismissed');
    if (wasDismissed) {
        const banner = document.getElementById('demoBanner');
        if (banner) {
            banner.style.display = 'none';
            document.body.style.paddingTop = '0';
        }
    }
    
    /**
     * Update countdown timer showing time until next reset
     * Resets daily at 3:00 AM EST
     */
    function updateResetCountdown() {
        const nextResetElement = document.getElementById('nextReset');
        
        // Only run if element exists on page
        if (!nextResetElement) return;
        
        // Get current time in EST
        const now = new Date();
        
        // Create next reset time (3:00 AM EST today)
        const nextReset = new Date();
        nextReset.setHours(3, 0, 0, 0);
        
        // If it's already past 3 AM today, show tomorrow's reset
        if (now.getHours() >= 3) {
            nextReset.setDate(nextReset.getDate() + 1);
        }
        
        // Calculate time difference
        const diff = nextReset - now;
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        
        // Update countdown display
        nextResetElement.textContent = `(Resets in ${hours}h ${minutes}m)`;
    }
    
    // Update countdown immediately on page load
    updateResetCountdown();
    
    // Update countdown every minute
    setInterval(updateResetCountdown, 60000);

});