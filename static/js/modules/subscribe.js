import { Utils } from '../utils.js';

export const SubscribeModule = {
    init() {
        const form = document.getElementById('subscribe-form');
        if (form) {
            form.addEventListener('submit', this.handleSubscribe.bind(this));
        }
    },

    async handleSubscribe(e) {
        e.preventDefault();
        const emailInput = document.getElementById('subscribe-email');
        const submitButton = e.target.querySelector('button[type="submit"]');
        const email = emailInput.value.trim();

        if (!email || !this.validateEmail(email)) {
            Utils.showAlert('Por favor ingresa un email válido', 'error');
            return;
        }

        // Disable form while submitting
        submitButton.disabled = true;
        const originalText = submitButton.textContent;
        submitButton.textContent = 'Procesando...';

        try {
            const response = await fetch('/subscribe', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': document.querySelector('[name=csrf_token]').value
                },
                body: JSON.stringify({ email })
            });

            const data = await response.json();

            if (response.ok) {
                Utils.showAlert(data.message, data.already_subscribed ? 'info' : 'success');
                if (!data.already_subscribed) {
                    emailInput.value = '';
                }
                
                // If we're in the newsletter section and already subscribed,
                // update the UI to show subscribed state
                const newsletterStatus = document.getElementById('newsletter-status');
                if (newsletterStatus && data.already_subscribed) {
                    newsletterStatus.innerHTML = `
                        <h2 class="text-2xl font-bold text-white mb-2">¡Ya estás suscrito!</h2>
                        <p class="text-gray-200">
                            Recibirás actualizaciones en ${email}
                        </p>
                    `;
                }
            } else {
                throw new Error(data.error || 'Error en la suscripción');
            }
        } catch (error) {
            console.error('Subscription error:', error);
            Utils.showAlert(
                error.message || 'Error al procesar la suscripción. Por favor intenta nuevamente.', 
                'error'
            );
        } finally {
            // Re-enable form
            submitButton.disabled = false;
            submitButton.textContent = originalText;
        }
    },

    validateEmail(email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    }
}; 