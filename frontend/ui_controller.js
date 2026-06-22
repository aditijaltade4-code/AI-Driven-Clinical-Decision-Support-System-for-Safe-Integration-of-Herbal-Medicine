/**
 * Clinical Intelligence Portal - UI Controller
 * Manages view switching, theme toggling, and state transitions.
 */

document.addEventListener('DOMContentLoaded', () => {
    // Check for saved theme preference
    const savedTheme = localStorage.getItem('clinical-theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeIcon(savedTheme);

    // Initialize View Navigation
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const viewId = item.getAttribute('data-view');
            switchView(viewId);
            
            // Update active state in nav
            navItems.forEach(i => i.classList.remove('active'));
            item.classList.add('active');
        });
    });

    // Removed login screen requirement
    const loginScreen = document.getElementById('login-screen');
    if (loginScreen) {
        loginScreen.style.display = 'none';
    }
    
    // Default to analysis view immediately
    switchView('analysis');
});

/**
 * Handle Login Transition
 */
function handleLogin() {
    const loginScreen = document.getElementById('login-screen');
    const passcode = document.querySelector('input[type="password"]').value;
    
    // Simple mock authentication
    if (passcode.length >= 4) {
        loginScreen.style.opacity = '0';
        loginScreen.style.transform = 'scale(1.1)';
        
        setTimeout(() => {
            loginScreen.style.display = 'none';
            localStorage.setItem('isLoggedIn', 'true');
            
            // Force default view to analysis (Herb-Drug Interactions) on login
            switchView('analysis');
            const navItems = document.querySelectorAll('.nav-item');
            navItems.forEach(i => {
                if (i.getAttribute('data-view') === 'analysis') {
                    i.classList.add('active');
                } else {
                    i.classList.remove('active');
                }
            });
            
            // Trigger initial view logic if needed
            if (window.cy) window.cy.resize();
        }, 600);
    } else {
        alert("Please enter a valid clinical passcode (min 4 characters).");
    }
}

/**
 * Switch between view containers
 */
function switchView(viewId) {
    const views = document.querySelectorAll('.view-container');
    const targetView = document.getElementById(`view-${viewId}`);

    if (!targetView) return;

    // Fade out all views
    views.forEach(view => {
        view.classList.remove('active');
    });

    // Fade in target view
    targetView.classList.add('active');

    // Handle Component Resizing
    if (viewId === 'graph') {
        setTimeout(() => {
            if (typeof window.loadGraph === 'function') {
                window.loadGraph();
            }
            if (window.cy) {
                window.cy.resize();
                window.cy.fit();
                window.cy.center();
            }
        }, 300);
    }

    if (viewId === 'dashboard') {
        setTimeout(() => {
            if (typeof window.loadDashboard === 'function') {
                window.loadDashboard();
            }
            window.dispatchEvent(new Event('resize'));
        }, 300);
    }
    
    // Update URL Hash for bookmarking/history
    window.location.hash = viewId;
}

/**
 * Dark/Light Mode Toggle
 */
function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('clinical-theme', newTheme);
    updateThemeIcon(newTheme);
}

function updateThemeIcon(theme) {
    const icon = document.querySelector('.theme-toggle i');
    if (!icon) return;
    
    if (theme === 'dark') {
        icon.className = 'fas fa-sun';
    } else {
        icon.className = 'fas fa-moon';
    }
}

/**
 * Logout Utility
 */
function logout() {
    localStorage.removeItem('isLoggedIn');
    location.reload();
}
