/**
 * ============================================================================
 * GESTOR DE AUTENTICACIÓN Y BÓVEDA (login.js)
 * ============================================================================
 * Administra el registro e inicio de sesión. Garantiza que la Llave Privada 
 * nunca viaje al servidor sin antes haber sido empaquetada (cifrada) 
 * utilizando el Candado Matemático derivado de la contraseña del usuario.
 * ============================================================================
 */
const viewLogin = document.getElementById('view-login');
const viewRegister = document.getElementById('view-register');
const linkToRegister = document.getElementById('link-to-register');
const linkToLogin = document.getElementById('link-to-login');

const btnLogin = document.getElementById('btn-login');
const loginUsername = document.getElementById('login-username');
const loginPassword = document.getElementById('login-password');

const btnRegister = document.getElementById('btn-register');
const regAlias = document.getElementById('reg-alias');
const regUsername = document.getElementById('reg-username');
const regPassword = document.getElementById('reg-password');

// Switch views
linkToRegister.addEventListener('click', (e) => {
    e.preventDefault();
    viewLogin.classList.add('hidden');
    viewRegister.classList.remove('hidden');
});

linkToLogin.addEventListener('click', (e) => {
    e.preventDefault();
    viewRegister.classList.add('hidden');
    viewLogin.classList.remove('hidden');
});

// Redirigir si ya está logueado
window.addEventListener('DOMContentLoaded', () => {
    if (localStorage.getItem('e2ee_identity')) {
        window.location.href = 'chat.html';
    }
});

let currentUser = {
    id: null,
    nombre: "",
    alias_publico: "",
    llaves: null
};

// 1. REGISTRO
btnRegister.addEventListener('click', async () => {
    const alias = regAlias.value.trim();
    const nombre = regUsername.value.trim().toLowerCase();
    const password = regPassword.value.trim();
    
    if (!alias || !nombre || !password) return alert('Completa todos los campos.');

    btnRegister.disabled = true;
    btnRegister.innerText = "Procesando...";

    const llavesIdentidad = MiCifrado.generarIdentidadAleatoria();
    const llaveCandado = MiCifrado.derivarLlaveCandado(nombre, password);
    
    const bovedaCifrada = MiCifrado.empaquetarBoveda(llavesIdentidad.privada, llaveCandado);
    
    currentUser.llaves = llavesIdentidad;
    currentUser.nombre = nombre;
    
    try {
        const response = await fetch('api/registro.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                nombre: nombre,
                alias_publico: alias,
                llave_publica: llavesIdentidad.publica,
                boveda_cifrada: bovedaCifrada
            })
        });
        const result = await response.json();
        
        if (result.success) {
            currentUser.id = result.id;
            currentUser.alias_publico = alias;
            currentUser.token_sesion = result.token_sesion;
            localStorage.setItem('e2ee_identity', JSON.stringify(currentUser));
            window.location.href = 'chat.html';
        } else {
            alert('Error: ' + result.error);
            btnRegister.disabled = false;
            btnRegister.innerText = "Generar Bóveda";
        }
    } catch (e) {
        alert('Error conectando con el servidor.');
        btnRegister.disabled = false;
        btnRegister.innerText = "Generar Bóveda";
    }
});

// 2. LOGIN
btnLogin.addEventListener('click', async () => {
    const nombre = loginUsername.value.trim().toLowerCase();
    const password = loginPassword.value.trim();
    if (!nombre || !password) return alert('Ingresa usuario y contraseña.');

    btnLogin.disabled = true;
    btnLogin.innerText = "Comprobando...";
    
    try {
        const response = await fetch('api/login.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                nombre: nombre,
                llave_publica: 'auth'
            })
        });
        const result = await response.json();
        
        if (result.success) {
            const llaveCandado = MiCifrado.derivarLlaveCandado(nombre, password);
            try {
                const llavesDesempaquetadas = MiCifrado.desempaquetarBoveda(result.boveda_cifrada, llaveCandado);
                if (llavesDesempaquetadas.publica !== result.llave_publica) {
                    throw new Error("Contraseña incorrecta (la bóveda arrojó basura matemática).");
                }
                
                currentUser.id = result.id;
                currentUser.nombre = nombre;
                currentUser.alias_publico = result.alias_publico;
                currentUser.llaves = llavesDesempaquetadas;
                currentUser.token_sesion = result.token_sesion;
                
                localStorage.setItem('e2ee_identity', JSON.stringify(currentUser));
                window.location.href = 'chat.html';
            } catch (decError) {
                alert('Acceso Denegado: ' + decError.message);
                btnLogin.disabled = false;
                btnLogin.innerText = "Ingresar a Bóveda";
            }
        } else {
            alert('Acceso Denegado: ' + result.error);
            btnLogin.disabled = false;
            btnLogin.innerText = "Ingresar a Bóveda";
        }
    } catch (e) {
        alert('Error conectando con el servidor.');
        btnLogin.disabled = false;
        btnLogin.innerText = "Ingresar a Bóveda";
    }
});
