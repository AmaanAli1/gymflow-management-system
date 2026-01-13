/* ============================================
   SIDEBAR FUNCTIONALITY
   Pin button, dropdown menus, active states
   ============================================ */

// Wait for DOM to fully load before running code
document.addEventListener('DOMContentLoaded', () => {
    
    /* ========================================
       SIDEBAR PIN BUTTON
       Keeps sidebar expanded when clicked
       ======================================== */
    
    const sidebar = document.querySelector('.sidebar');
    const pinBtn = document.getElementById('sidebarPinBtn');
    
    // Check if elements exist (defensive programming)
    if (!sidebar || !pinBtn) {
        console.warn('Sidebar or pin button not found in DOM');
        return;
    }
    
    // Track pinned state
    let isPinned = false;
    
    // WHY track with a variable?
    // We could check sidebar.classList.contains('pinned')
    // But a boolean is faster and clearer for logic checks
    
    
    // Pin button click handler
    pinBtn.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent click from bubbling to parent elements
        
        // Toggle pinned state
        isPinned = !isPinned;
        
        if (isPinned) {
            sidebar.classList.add('pinned');
        } else {
            sidebar.classList.remove('pinned');
        }
    });
    
    /* ========================================
       DROPDOWN MENUS (Submenus)
       Open/close navigation dropdowns
       ======================================== */
    
    // Get all nav items that have submenus
    const navItemsWithSubmenu = document.querySelectorAll('.nav-item.has-sub');
    
    if (navItemsWithSubmenu.length === 0) {
        console.warn('No dropdown menu items found');
        return;
    }
    
    // Add click handler to each dropdown toggle
    navItemsWithSubmenu.forEach(navItem => {
        
        navItem.addEventListener('click', (e) => {
            e.preventDefault(); // Don't navigate (it's a button, not a link)
            
            // Only allow dropdown to open when sidebar is expanded
            // (either hovered or pinned)
            const isSidebarExpanded = sidebar.matches(':hover') || sidebar.classList.contains('pinned');
            
            if (!isSidebarExpanded) {
                return; // Don't open dropdown if sidebar is collapsed
            }

            // Check if THIS item is already open
            const isCurrentlyOpen = navItem.classList.contains('open');
            
            // Close ALL other dropdowns first
            navItemsWithSubmenu.forEach(otherItem => {
                if (otherItem !== navItem) {
                    otherItem.classList.remove('open');
                    otherItem.setAttribute('aria-expanded', 'false');
                }
            });
            
            // Toggle THIS dropdown
            if (isCurrentlyOpen) {
                // Was open, now close it
                navItem.classList.remove('open');
                navItem.setAttribute('aria-expanded', 'false');
            } else {
                // Was closed, now open it
                navItem.classList.add('open');
                navItem.setAttribute('aria-expanded', 'true');
            }
        });
    });
    
    
    /* ========================================
       AUTO-CLOSE DROPDOWNS
       Close all dropdowns when sidebar collapses
       ======================================== */
    
    // When mouse leaves sidebar, close all dropdowns (if not pinned)
    sidebar.addEventListener('mouseleave', () => {
        if (!isPinned) {
            navItemsWithSubmenu.forEach(item => {
                item.classList.remove('open');
                item.setAttribute('aria-expanded', 'false');
            });
        }
    });
    
    /* ========================================
       ACTIVE PAGE HIGHLIGHTING
       Highlight current page in navigation
       ======================================== */
    
    // Get current page filename from URL
    const currentPage = window.location.pathname.split('/').pop() || 'dashboard.html';
    
    // Find all nav links
    const navLinks = document.querySelectorAll('.nav-item[href], .submenu-item[href]');
    
    navLinks.forEach(link => {
        const linkHref = link.getAttribute('href');
        
        // Check if link points to current page
        if (linkHref && linkHref.includes(currentPage)) {
            link.classList.add('active');
            link.setAttribute('aria-current', 'page');
            
            // If it's a submenu item, also open its parent dropdown
            const parentNavItem = link.closest('.nav-group')?.querySelector('.nav-item.has-sub');
            if (parentNavItem) {
                parentNavItem.classList.add('open');
                parentNavItem.setAttribute('aria-expanded', 'true');
            }
        }
    });

    /* ========================================
       KEYBOARD NAVIGATION (Bonus Feature!)
       Allow keyboard users to navigate sidebar
       ======================================== */
    
    // Press 'P' to toggle pin (when not typing in input)
    document.addEventListener('keydown', (e) => {
        // Only if not typing in an input/textarea
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
            return;
        }
        
        if (e.key === 'p' || e.key === 'P') {
            pinBtn.click(); // Trigger pin button click
        }
    });
});