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
// 2. LOGIN CON PROTOCOLO CHALLENGE-RESPONSE ZERO-KNOWLEDGE
btnLogin.addEventListener('click', async () => {
    const nombre = loginUsername.value.trim().toLowerCase();
    const password = loginPassword.value.trim();
    if (!nombre || !password) return alert('Ingresa usuario y contraseña.');

    btnLogin.disabled = true;
    btnLogin.innerText = "Solicitando desafío...";
    
    try {
        // Paso 1: Solicitar desafío y datos de bóveda
        const resChallenge = await fetch('api/login.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'get_challenge',
                nombre: nombre
            })
        });
        const challengeResult = await resChallenge.json();
        
        if (!challengeResult.success) {
            alert('Acceso Denegado: ' + challengeResult.error);
            btnLogin.disabled = false;
            btnLogin.innerText = "Ingresar a Bóveda";
            return;
        }

        btnLogin.innerText = "Desbloqueando bóveda local...";
        
        // Paso 2: Derivar llave de bóveda y descifrar
        const llaveCandado = MiCifrado.derivarLlaveCandado(nombre, password);
        const llavesDesempaquetadas = MiCifrado.desempaquetarBoveda(challengeResult.boveda_cifrada, llaveCandado);
        
        if (llavesDesempaquetadas.publica !== challengeResult.llave_publica) {
            alert('Acceso Denegado: Contraseña incorrecta (la bóveda arrojó basura matemática).');
            btnLogin.disabled = false;
            btnLogin.innerText = "Ingresar a Bóveda";
            return;
        }
        
        btnLogin.innerText = "Resolviendo prueba ZK...";
        
        // Paso 3: Calcular la prueba de conocimiento cero usando el primer exponente del vector privado
        const s_vector = llavesDesempaquetadas.privada.split(',').map(Number);
        const s_0 = s_vector[0];
        const modulo = 9999991;
        
        // S = T^s_0 (mod modulo)
        const S = modExp(challengeResult.desafio, s_0, modulo);
        // prueba = sha256(S)
        const prueba = sha256(S.toString());
        
        btnLogin.innerText = "Validando firma en servidor...";
        
        // Paso 4: Enviar la prueba de conocimiento cero para obtener el token de sesión
        const resLogin = await fetch('api/login.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'login',
                nombre: nombre,
                prueba: prueba
            })
        });
        const loginResult = await resLogin.json();
        
        if (loginResult.success) {
            currentUser.id = loginResult.id;
            currentUser.nombre = nombre;
            currentUser.alias_publico = loginResult.alias_publico;
            currentUser.llaves = llavesDesempaquetadas;
            currentUser.token_sesion = loginResult.token_sesion;
            
            localStorage.setItem('e2ee_identity', JSON.stringify(currentUser));
            window.location.href = 'chat.html';
        } else {
            alert('Acceso Denegado: ' + loginResult.error);
            btnLogin.disabled = false;
            btnLogin.innerText = "Ingresar a Bóveda";
        }
        
    } catch (e) {
        alert('Error conectando con el servidor.');
        btnLogin.disabled = false;
        btnLogin.innerText = "Ingresar a Bóveda";
    }
});
