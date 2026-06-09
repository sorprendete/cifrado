const registerForm = document.getElementById('registerForm');
const alertError = document.getElementById('alertError');
const alertErrorMessage = document.getElementById('alertErrorMessage');
const btnRegister = document.getElementById('btnRegister');
const passwordInput = document.getElementById('password');
const strengthBar = document.getElementById('strengthBar');
const confirmPasswordInput = document.getElementById('confirmPassword');

function showError(message) {
    alertErrorMessage.textContent = message;
    alertError.style.display = 'flex';
    alertError.style.animation = 'none';
    alertError.offsetHeight;
    alertError.style.animation = 'fadeSlideIn 0.4s ease-out';
}

function hideError() {
    alertError.style.display = 'none';
}

// Indicador de fortaleza de contraseña
passwordInput.addEventListener('input', function () {
    const val = passwordInput.value;
    strengthBar.className = 'bar';
    if (val.length === 0) {
        strengthBar.style.width = '0%';
        return;
    }
    const hasUpper = /[A-Z]/.test(val);
    const hasLower = /[a-z]/.test(val);
    const hasDigit = /\d/.test(val);
    const hasSpecial = /[^A-Za-z0-9]/.test(val);
    const score = (hasUpper ? 1 : 0) + (hasLower ? 1 : 0) + (hasDigit ? 1 : 0) + (hasSpecial ? 1 : 0) + (
        val.length >= 10 ? 1 : 0);

    if (score <= 2 || val.length < 6) {
        strengthBar.classList.add('strength-weak');
    } else if (score === 3 || (score === 4 && val.length < 8)) {
        strengthBar.classList.add('strength-medium');
    } else {
        strengthBar.classList.add('strength-strong');
    }
});

registerForm.addEventListener('submit', function (e) {
    e.preventDefault();
    hideError();

    const fullName = document.getElementById('fullName').value.trim();
    const email = document.getElementById('email').value.trim();
    const password = passwordInput.value;
    const confirmPassword = confirmPasswordInput.value;

    if (!fullName || !email || !password || !confirmPassword) {
        showError('Todos los campos son obligatorios.');
        return;
    }
    if (password.length < 8) {
        showError('La contraseña debe tener al menos 8 caracteres.');
        return;
    }
    if (password !== confirmPassword) {
        showError('Las contraseñas no coinciden.');
        return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        showError('Ingresa un correo electrónico válido.');
        return;
    }

    // --- AQUÍ CONECTAS CON TU BACKEND ---
    //
    // btnRegister.disabled = true;
    // btnRegister.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Registrando...';
    //
    // fetch('/api/auth/register', {
    //     method: 'POST',
    //     headers: { 'Content-Type': 'application/json' },
    //     body: JSON.stringify({ fullName, email, password })
    // })
    // .then(res => res.json())
    // .then(data => {
    //     if (data.success) {
    //         // Redirigir a pantalla de "pendiente de aprobación"
    //         window.location.href = 'pending-approval.html?email=' + encodeURIComponent(email);
    //     } else {
    //         showError(data.message || 'Error al registrar.');
    //     }
    // })
    // .catch(() => showError('Error de conexión.'))
    // .finally(() => {
    //     btnRegister.disabled = false;
    //     btnRegister.innerHTML = '<i class="fa-solid fa-user-check"></i> Crear Cuenta';
    // });

    console.log('[Register] Datos:', { fullName, email, passwordLength: password.length });
    console.log('[Register] Conecta aquí tu endpoint de registro.');
});

document.querySelectorAll('input').forEach(input => {
    input.addEventListener('input', hideError);
});

// register.js (añadir al final o integrar con tu lógica existente)

const pendingModal = document.getElementById('pendingModal');
const modalUserEmail = document.getElementById('modalUserEmail');
const closePendingModal = document.getElementById('closePendingModal');
const btnGoToLogin = document.getElementById('btnGoToLogin');

// Función para mostrar el modal con el email del usuario
function showPendingModal(email) {
    modalUserEmail.textContent = email;
    pendingModal.style.display = 'flex';
}

// Función para ocultar el modal
function hidePendingModal() {
    pendingModal.style.display = 'none';
}

// Event listeners para cerrar
closePendingModal.addEventListener('click', hidePendingModal);
// Opcional: cerrar al hacer clic fuera del modal
pendingModal.addEventListener('click', function(e) {
    if (e.target === pendingModal) hidePendingModal();
});

// El enlace "Volver al inicio de sesión" ya redirige, pero si quieres que primero cierre el modal y luego redirija, puedes hacer:
btnGoToLogin.addEventListener('click', function(e) {
    // No prevenimos la redirección, simplemente dejamos que navegue
});

// ---- Dentro de tu manejador de envío exitoso del formulario de registro ----
// Ejemplo de cómo integrarlo con tu fetch:
/*
fetch('/api/auth/register', { ... })
  .then(res => res.json())
  .then(data => {
      if (data.success) {
          showPendingModal(emailInput.value);  // Muestra el modal con el email
          // Limpiar formulario si quieres
          registerForm.reset();
      } else {
          showError(data.message);
      }
  })
  .catch(...)
*/

// Si tienes implementada la simulación actual, simplemente reemplaza la redirección
// por la llamada a showPendingModal(email)