/**
 * Filter Button Animations and Interactions
 * 
 * This script enhances the filter buttons with animation effects and 
 * provides functions to control their state.
 */

// Initialize when document is loaded
document.addEventListener('DOMContentLoaded', function() {
    initFilterButtons();
});

/**
 * Initialize the filter buttons with event listeners and animation effects
 */
function initFilterButtons() {
    // Add click handlers to all filter buttons
    document.querySelectorAll('.filter-btn').forEach(button => {
        button.addEventListener('click', function() {
            const isActive = this.getAttribute('data-active') === 'true';
            this.setAttribute('data-active', (!isActive).toString());
            
            // Add animation class to enhance the state change
            this.classList.add('animating');
            setTimeout(() => this.classList.remove('animating'), 600);
            
            // If there's a data-callback attribute, call that function
            const callback = this.getAttribute('data-callback');
            if (callback && typeof window[callback] === 'function') {
                window[callback](this, !isActive);
            }
            
            // Dispatch a custom event that can be listened to
            const event = new CustomEvent('filterButtonToggled', {
                bubbles: true,
                detail: {
                    button: this,
                    discipline: this.getAttribute('data-discipline-filter'),
                    isActive: !isActive
                }
            });
            this.dispatchEvent(event);
        });
    });
}

/**
 * Set all filter buttons to active or inactive
 * @param {boolean} active - Whether to set buttons as active (true) or inactive (false)
 * @param {boolean} animate - Whether to animate the state change (default: true)
 */
function setFilterButtonsState(active, animate = true) {
    const buttons = document.querySelectorAll('.filter-btn');
    
    if (animate) {
        // Add staggered animation when setting all buttons
        buttons.forEach((button, index) => {
            setTimeout(() => {
                button.setAttribute('data-active', active.toString());
                
                // Add a small animation class
                button.classList.add('animating');
                setTimeout(() => button.classList.remove('animating'), 600);
            }, index * 50); // 50ms delay between each button animation
        });
    } else {
        // Set all immediately without animation
        buttons.forEach(button => {
            button.setAttribute('data-active', active.toString());
        });
    }
}

/**
 * Set all filter buttons to active state
 * @param {boolean} animate - Whether to animate the state change (default: true)
 */
function setAllFiltersActive(animate = true) {
    setFilterButtonsState(true, animate);
}

/**
 * Set all filter buttons to inactive state
 * @param {boolean} animate - Whether to animate the state change (default: true)
 */
function setAllFiltersInactive(animate = true) {
    setFilterButtonsState(false, animate);
}

/**
 * Toggle a specific filter button by its discipline identifier
 * @param {string} discipline - The discipline identifier to toggle
 */
function toggleFilterByDiscipline(discipline) {
    const button = document.querySelector(`.filter-btn[data-discipline-filter="${discipline}"]`);
    if (button) {
        const isActive = button.getAttribute('data-active') === 'true';
        button.setAttribute('data-active', (!isActive).toString());
        
        // Add animation class
        button.classList.add('animating');
        setTimeout(() => button.classList.remove('animating'), 600);
    }
}

/**
 * Get the current state of all filter buttons
 * @returns {Array} An array of objects with discipline and active state
 */
function getFilterButtonsState() {
    const buttons = document.querySelectorAll('.filter-btn');
    return Array.from(buttons).map(button => ({
        discipline: button.getAttribute('data-discipline-filter'),
        isActive: button.getAttribute('data-active') === 'true'
    }));
} 