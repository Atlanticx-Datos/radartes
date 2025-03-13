// Utility functions used across modules
export const Utils = {
    normalizeText(text) {
        if (!text) return '';
        
        // Convert to string if not already
        const str = String(text);
        
        return str
            // Normalize Unicode characters (decompose accented characters)
            .normalize("NFD")
            // Remove diacritical marks (accents)
            .replace(/[\u0300-\u036f]/g, "")
            // Replace special characters with spaces
            .replace(/[&\/\\#,+()$~%.'":*?<>{}]/g, ' ')
            // Replace multiple spaces with a single space
            .replace(/\s+/g, ' ')
            // Convert to lowercase
            .toLowerCase()
            // Trim whitespace
            .trim();
    },

    escapeHTML(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    },

    showAlert(message, type = 'success') {
        const container = document.getElementById('alert-container');
        if (!container) return;

        // Clear previous alerts
        container.innerHTML = '';

        const alert = document.createElement('div');
        alert.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            padding: 12px 24px;
            border-radius: 4px;
            background: ${type === 'success' ? '#d1fae5' : '#fee2e2'};
            color: ${type === 'success' ? '#065f46' : '#991b1b'};
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            display: flex;
            align-items: center;
            gap: 8px;
            z-index: 9999;
        `;

        alert.innerHTML = `
            <svg style="flex-shrink:0; width:20px; height:20px;" viewBox="0 0 24 24" fill="none">
                ${type === 'success' ? `
                    <path stroke="#059669" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                ` : `
                    <path stroke="#dc2626" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                `}
            </svg>
            <span style="font-size:14px; font-weight:500;">${message}</span>
        `;

        container.appendChild(alert);

        setTimeout(() => {
            alert.remove();
        }, 3000);
    },

    toggleSpinner(show) {
        const spinner = document.getElementById('layout-spinner');
        if (spinner) {
            spinner.style.display = show ? 'block' : 'none';
        }
    },

    // Format title with vertical dash
    formatTitleWithDash(title) {
        if (!title) return '';
        
        // Define all possible separator characters
        const separators = [
            '︱', // PRESENTATION FORM FOR VERTICAL EM DASH
            '⎮', // INTEGRAL EXTENSION
            '|',  // VERTICAL LINE
            '｜', // FULLWIDTH VERTICAL LINE
            '│', // BOX DRAWINGS LIGHT VERTICAL
            '┃', // BOX DRAWINGS HEAVY VERTICAL
            '┊', // BOX DRAWINGS LIGHT QUADRUPLE DASH VERTICAL
            '┋'  // BOX DRAWINGS HEAVY QUADRUPLE DASH VERTICAL
        ];
        
        // Find the first separator that exists in the string
        let separatorIndex = -1;
        let foundSeparator = null;
        
        for (const separator of separators) {
            const index = title.indexOf(separator);
            if (index !== -1) {
                separatorIndex = index;
                foundSeparator = separator;
                break;
            }
        }
        
        // If we found a separator, split the string and format
        if (foundSeparator && separatorIndex > 0) {
            // Trim both parts to remove any existing spaces
            const category = this.escapeHTML(title.substring(0, separatorIndex).trim());
            const name = this.escapeHTML(title.substring(separatorIndex + 1).trim());
            
            // Wrap the separator in a span with specific styling for consistent spacing
            return `<span class="title-category" data-category="${category}">${category}</span><span class="separator-dash">${foundSeparator}</span> ${name}`;
        }
        
        // If no separator found, return the original title
        return this.escapeHTML(title);
    }
}; 