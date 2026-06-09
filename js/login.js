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

// Recolector de entropía manual (Movimientos y teclado) para reemplazar Math.random()
window.manualEntropyPool = '';
window.addEventListener('mousemove', (e) => {
    if (window.manualEntropyPool.length < 1000) {
        window.manualEntropyPool += e.clientX + '-' + e.clientY + '|';
    }
});
window.addEventListener('keydown', (e) => {
    if (window.manualEntropyPool.length < 1000) {
        window.manualEntropyPool += e.key + '|';
    }
});

const btnLogin = document.getElementById('btn-login');
const loginUsername = document.getElementById('login-username');
const loginPassword = document.getElementById('login-password');

const btnRegister = document.getElementById('btn-register');
const regAlias = document.getElementById('reg-alias');
const regUsername = document.getElementById('reg-username');
const regPassword = document.getElementById('reg-password');
const usernameError = document.getElementById('username-error');

// Switch views
linkToRegister.addEventListener('click', (e) => {
    e.preventDefault();
    viewLogin.classList.add('hidden');
    viewRegister.classList.remove('hidden');
    // Limpiar campos y errores al abrir
    regAlias.value = '';
    regUsername.value = '';
    regPassword.value = '';
    if (usernameError) {
        usernameError.style.display = 'none';
    }
    btnRegister.disabled = false;
    btnRegister.style.opacity = "1";
    btnRegister.style.cursor = "pointer";
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

let checkTimeout = null;
regUsername.addEventListener('input', () => {
    const nombre = regUsername.value.trim().toLowerCase();
    
    if (!nombre) {
        usernameError.style.display = 'none';
        btnRegister.disabled = false;
        btnRegister.style.opacity = "1";
        btnRegister.style.cursor = "pointer";
        return;
    }
    
    clearTimeout(checkTimeout);
    checkTimeout = setTimeout(async () => {
        try {
            const res = await fetch(`api/verificar_usuario.php?nombre=${encodeURIComponent(nombre)}`);
            const data = await res.json();
            
            if (data.existe) {
                usernameError.innerText = "❌ Este usuario secreto ya está ocupado.";
                usernameError.style.color = "#ff4444";
                usernameError.style.display = "block";
                btnRegister.disabled = true;
                btnRegister.style.opacity = "0.6";
                btnRegister.style.cursor = "not-allowed";
            } else {
                usernameError.innerText = "✅ ¡Usuario secreto disponible!";
                usernameError.style.color = "#4caf50";
                usernameError.style.display = "block";
                btnRegister.disabled = false;
                btnRegister.style.opacity = "1";
                btnRegister.style.cursor = "pointer";
            }
        } catch (e) {
            console.error("Error validando usuario", e);
        }
    }, 400);
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
    
    const pin = document.getElementById('reg-pin').value;

    if (!nombre || !alias || !password || !pin || pin.length < 4) return showToast('Completa todos los campos, incluyendo el PIN (4 dígitos).', 'warning');

    btnRegister.disabled = true;
    btnRegister.innerText = "Generando Bóveda...";
    
    try {
        const llavesIdentidad = MiCifrado.generarIdentidadAleatoria();
        const llaveCandado = MiCifrado.derivarLlaveCandado(nombre, password);
        const bovedaCifrada = MiCifrado.empaquetarBoveda(llavesIdentidad.privada, llaveCandado);

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
            currentUser.llaves = llavesIdentidad;
            
            // KEY WRAPPING: Proteger llave privada con el PIN antes de guardarla en LocalStorage
            const wrappedPrivKey = await CryptoUtils.wrapPrivateKey(currentUser.llaves.privada, pin);
            
            const forStorage = { ...currentUser, llaves: { ...currentUser.llaves } };
            forStorage.llaves.privada = wrappedPrivKey;
            
            localStorage.setItem('e2ee_identity', JSON.stringify(forStorage));
            
            // UX: Guardar la llave plana en sessionStorage temporalmente para no pedir el PIN justo después del registro
            sessionStorage.setItem('e2ee_priv_temp', currentUser.llaves.privada);
            
            window.location.href = 'chat.html';
        } else {
            showToast('Error: ' + result.error, 'error');
            btnRegister.disabled = false;
            btnRegister.innerText = "Generar Bóveda";
        }
    } catch (e) {
        showToast('Error conectando con el servidor.', 'error');
        btnRegister.disabled = false;
        btnRegister.innerText = "Generar Bóveda";
    }
});
// 2. LOGIN CON PROTOCOLO CHALLENGE-RESPONSE ZERO-KNOWLEDGE
btnLogin.addEventListener('click', async () => {
    const nombre = loginUsername.value.trim().toLowerCase();
    const password = loginPassword.value.trim();
    if (!nombre || !password) return showToast('Ingresa usuario y contraseña.', 'warning');

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
            showToast('Acceso Denegado: ' + challengeResult.error, 'error');
            btnLogin.disabled = false;
            btnLogin.innerText = "Ingresar a Bóveda";
            return;
        }

        btnLogin.innerText = "Desbloqueando bóveda local...";
        
        // Paso 2: Derivar llave de bóveda y descifrar
        const llaveCandado = MiCifrado.derivarLlaveCandado(nombre, password);
        const llavesDesempaquetadas = MiCifrado.desempaquetarBoveda(challengeResult.boveda_cifrada, llaveCandado);
        
        if (llavesDesempaquetadas.publica !== challengeResult.llave_publica) {
            showToast('Acceso Denegado: Contraseña incorrecta (la bóveda arrojó basura matemática).', 'error');
            btnLogin.disabled = false;
            btnLogin.innerText = "Ingresar a Bóveda";
            return;
        }
        
        btnLogin.innerText = "Resolviendo prueba ZK...";
        
        // Paso 3: Calcular la prueba de conocimiento cero usando el primer exponente del vector privado
        const s_vector = llavesDesempaquetadas.privada.split(',');
        const s_0 = BigInt(s_vector[0]);
        const modulo = MiCifrado.modulo;
        const desafio = BigInt(challengeResult.desafio);
        
        // S = T^s_0 (mod modulo)
        const S = modExp(desafio, s_0, modulo);
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
            
            const pin = document.getElementById('login-pin').value;
            if (!pin || pin.length < 4) {
                showToast('Ingresa un PIN válido para cifrar tu bóveda local.', 'warning');
                btnLogin.disabled = false;
                btnLogin.innerText = "Ingresar a Bóveda";
                return;
            }

            // KEY WRAPPING: Proteger llave privada con el PIN antes de guardarla
            const wrappedPrivKey = await CryptoUtils.wrapPrivateKey(currentUser.llaves.privada, pin);
            
            const forStorage = { ...currentUser, llaves: { ...currentUser.llaves } };
            forStorage.llaves.privada = wrappedPrivKey;
            
            localStorage.setItem('e2ee_identity', JSON.stringify(forStorage));
            
            // UX: Guardar la llave plana en sessionStorage temporalmente
            sessionStorage.setItem('e2ee_priv_temp', currentUser.llaves.privada);
            
            window.location.href = 'chat.html';
        } else {
            showToast('Acceso Denegado: ' + loginResult.error, 'error');
            btnLogin.disabled = false;
            btnLogin.innerText = "Ingresar a Bóveda";
        }
        
    } catch (e) {
        showToast('Error conectando con el servidor.', 'error');
        btnLogin.disabled = false;
        btnLogin.innerText = "Ingresar a Bóveda";
    }
});

// 3. ACTIVAR CON TECLA ENTER
const triggerLoginOnEnter = (e) => {
    if (e.key === 'Enter') {
        btnLogin.click();
    }
};

loginUsername.addEventListener('keydown', triggerLoginOnEnter);
loginPassword.addEventListener('keydown', triggerLoginOnEnter);

const triggerRegisterOnEnter = (e) => {
    if (e.key === 'Enter') {
        btnRegister.click();
    }
};

regAlias.addEventListener('keydown', triggerRegisterOnEnter);
regUsername.addEventListener('keydown', triggerRegisterOnEnter);
regPassword.addEventListener('keydown', triggerRegisterOnEnter);
