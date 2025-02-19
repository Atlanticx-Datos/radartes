// Utility functions used across modules
export const Utils = {
    normalizeText(text) {
        if (!text) return '';
        return text.normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase()
            .trim();
    },

    escapeHTML(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
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
    }
}; 