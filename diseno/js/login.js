
// --- Estructura para conexión con backend ---
// Esta sección contiene los event listeners y placeholders.
// NO simula funcionalidad real, solo prepara la estructura.

const loginForm = document.getElementById('loginForm');
const alertError = document.getElementById('alertError');
const alertErrorMessage = document.getElementById('alertErrorMessage');
const btnLogin = document.getElementById('btnLogin');

/**
 * Muestra un mensaje de error en el formulario.
 * @param {string} message - Mensaje a mostrar.
 */
function showError(message) {
    alertErrorMessage.textContent = message;
    alertError.style.display = 'flex';
    alertError.style.animation = 'none';
    alertError.offsetHeight; // Reflow para reiniciar animación
    alertError.style.animation = 'fadeSlideIn 0.4s ease-out';
}

/**
 * Oculta el mensaje de error.
 */
function hideError() {
    alertError.style.display = 'none';
}

// Evento de envío del formulario
loginForm.addEventListener('submit', function (e) {
    e.preventDefault();
    hideError();

    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;

    // Validación básica de campos
    if (!email || !password) {
        showError('Por favor, completa todos los campos.');
        return;
    }

    // --- AQUÍ CONECTAS CON TU BACKEND ---
    // Descomenta y adapta según tu lógica:
    //
    // btnLogin.disabled = true;
    // btnLogin.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Verificando...';
    //
    // fetch('/api/auth/login', {
    //     method: 'POST',
    //     headers: { 'Content-Type': 'application/json' },
    //     body: JSON.stringify({ email, password })
    // })
    // .then(response => response.json())
    // .then(data => {
    //     if (data.success) {
    //         // Guardar token/sesión
    //         // Redirigir según estado del usuario:
    //         //   - Si está aprobado → chat.html
    //         //   - Si está pendiente → pending-approval.html
    //         //   - Si es admin → admin.html
    //         window.location.href = data.redirect || 'chat.html';
    //     } else {
    //         showError(data.message || 'Credenciales incorrectas.');
    //     }
    // })
    // .catch(err => {
    //     showError('Error de conexión. Intenta de nuevo.');
    // })
    // .finally(() => {
    //     btnLogin.disabled = false;
    //     btnLogin.innerHTML = '<i class="fa-solid fa-right-to-bracket"></i> Iniciar Sesión';
    // });

    // Placeholder visual (quitar en producción):
    console.log('[Login] Datos enviados:', { email, passwordLength: password.length });
    console.log('[Login] Conecta aquí tu endpoint de autenticación.');
});

// Ocultar error al empezar a escribir
document.querySelectorAll('input').forEach(input => {
    input.addEventListener('input', hideError);
});