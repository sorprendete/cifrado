/**
 * ============================================================================
 * CONTROLADOR PRINCIPAL DE LA APLICACIÓN (app.js)
 * ============================================================================
 * Este archivo gestiona la interfaz de usuario, la sincronización en tiempo 
 * real (Polling) y actúa como puente entre el DOM (chat.html) y el motor 
 * matemático (crypto.js).
 * 
 * Módulos principales:
 * - Renderizado de Chat y Usuarios
 * - Polling Inteligente (Entrante y Saliente)
 * - Captura de Multimedia (Audio/Imágenes)
 * - Visualizador Criptográfico en Tiempo Real
 * ============================================================================
 */
let currentUser = null;
let currentContact = null;
let pollingInterval = null;
let userPollingInterval = null;
let lastMessageId = 0;
let unreadCounts = {}; // { userId: count }
let messagesCache = new Set();
let usersList = []; // Added to fix ReferenceError in polling

function escapeHTML(str) {
    if (!str) return '';
    return str.replace(/[&<>'"]/g, 
        tag => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            "'": '&#39;',
            '"': '&quot;'
        }[tag] || tag)
    );
}

window.addEventListener('DOMContentLoaded', () => {
    const savedIdentity = localStorage.getItem('e2ee_identity');
    if (!savedIdentity) {
        window.location.href = 'index.html';
        return;
    }
    const identity = JSON.parse(savedIdentity);
    const privada = identity.llaves?.privada;
    const tempPriv = sessionStorage.getItem('e2ee_priv_temp');
    
    if (!privada && !tempPriv) {
        localStorage.removeItem('e2ee_identity');
        window.location.href = 'index.html';
        return;
    }

    if (tempPriv && tempPriv !== "[object Object]") {
        // UX: Venimos del login/registro. No pedimos PIN ahora.
        identity.llaves.privada = tempPriv;
        iniciarApp(identity);
    } else if (typeof privada === 'object' && privada.salt) {
        // La bóveda está bloqueada con PIN
        const modal = document.getElementById('pinUnlockModal');
        modal.classList.remove('hidden');
        
        const btnUnlock = document.getElementById('btn-unlock-pin');
        const inputPin = document.getElementById('unlock-pin');
        
        btnUnlock.addEventListener('click', async () => {
            const pin = inputPin.value;
            if (pin.length < 4) return;
            
            btnUnlock.disabled = true;
            btnUnlock.innerText = "Descifrando...";
            
            const rawPriv = await CryptoUtils.unwrapPrivateKey(privada, pin);
            if (!rawPriv) {
                alert("PIN Incorrecto. La bóveda arrojó basura criptográfica.");
                btnUnlock.disabled = false;
                btnUnlock.innerText = "DESBLOQUEAR";
                inputPin.value = '';
                return;
            }
            
            // Éxito
            identity.llaves.privada = rawPriv;
            modal.classList.add('hidden');
            iniciarApp(identity);
        });
        
        inputPin.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') btnUnlock.click();
        });
        
    } else {
        // Fallback por si la sesión antigua no tenía PIN (texto plano)
        iniciarApp(identity);
    }
});

function iniciarApp(identity) {
    currentUser = identity;
    document.getElementById('my-alias').innerText = currentUser.alias_publico || currentUser.nombre;
    document.getElementById('my-public-key').innerText = `ID: ${currentUser.llaves.publica.substring(0,16)}...`;
    
    // Habilitar toggle oculto del Laboratorio Criptográfico con 5 clics en el alias
    let aliasClicks = 0;
    document.getElementById('my-alias').addEventListener('click', () => {
        aliasClicks++;
        if (aliasClicks >= 5) {
            document.getElementById('visualizer-area').classList.toggle('hidden');
            aliasClicks = 0;
        }
    });

    // Habilitar acceso oculto a la documentación con 5 clics en la llave publica
    let keyClicks = 0;
    document.getElementById('my-public-key').addEventListener('click', () => {
        keyClicks++;
        if (keyClicks >= 5) {
            window.open('docs.html', '_blank');
            keyClicks = 0;
        }
    });

    cargarUsuarios();
    iniciarPolling();
}

// --- UI ELEMENTS ---
const userList = document.getElementById('user-list');
const chatHeader = document.getElementById('chat-header');
const chatMessages = document.getElementById('chat-messages');
const messageInput = document.getElementById('message-input');
const btnSend = document.getElementById('btn-send');

const btnEmoji = document.getElementById('btn-emoji');
const fileInput = document.getElementById('file-input');
const btnAttach = document.getElementById('btn-attach');
const btnMic = document.getElementById('btn-mic');

let editMessageId = null;

// --- Funciones UI Base ---
function cargarUsuarios() {
    fetch(`api/usuarios.php?usuario_id=${currentUser.id}&token_sesion=${currentUser.token_sesion}`)
        .then(res => res.json())
        .then(result => {
            if (result.success) {
                userList.innerHTML = '';
                usersList = result.usuarios;
                result.usuarios.forEach(user => {
                    if (user.id == currentUser.id) return;
                    
                    const div = document.createElement('div');
                    div.className = 'chat-list-item user-item' + (currentContact && currentContact.id == user.id ? ' active' : '');
                    
                    const unreadCount = unreadCounts[user.id] || 0;
                    const badge = unreadCount > 0 ? `<div class="unread-badge" style="background:var(--danger); color:white; border-radius:50%; padding:2px 6px; font-size:0.7rem;">${unreadCount}</div>` : '';
                    const inicial = user.alias_publico ? user.alias_publico.charAt(0).toUpperCase() : '?';
                    const isOnline = user.online ? '<span class="online-dot"></span>' : '';
                    
                    div.innerHTML = `
                        <div class="contact-avatar">
                            ${inicial}
                            ${isOnline}
                        </div>
                        <div class="contact-info">
                            <div class="contact-name" style="display:flex; justify-content:space-between; align-items:center;">
                                ${escapeHTML(user.alias_publico)}
                                ${badge}
                            </div>
                            <div class="contact-last-msg">
                                <i class="fa-solid fa-lock"></i> Chat E2EE
                            </div>
                        </div>
                    `;
                    div.addEventListener('click', () => {
                        unreadCounts[user.id] = 0;
                        abrirChat(user);
                        if(window.innerWidth <= 768) {
                            document.querySelector('.sidebar').classList.add('mobile-hidden');
                            document.querySelector('.main-chat').classList.add('mobile-visible');
                        }
                    });
                    userList.appendChild(div);
                });
            }
        });
}

function abrirChat(user) {
    currentContact = user;
    
    // Generar llave compartida para este contacto
    const sharedKey = MiCifrado.derivarLlaveCompartida(currentUser.llaves.privada, currentContact.llave_publica);
    currentContact.rootKey = sharedKey; // En una versión avanzada aquí usaríamos KDF y ratcheting
    
    // Update UI headers
    document.querySelectorAll('.user-item').forEach(el => el.classList.remove('active'));
    
    if (user.eliminado == 1) {
        chatHeader.innerHTML = `
            <div style="display: flex; align-items: center; gap: 10px;">
                <button id="btn-back-mobile" class="btn-secondary" style="padding: 5px 10px; border: none; border-radius: 8px; background: transparent;"><svg class="ui-icon-svg" style="width:20px;height:20px;" viewBox="0 0 24 24"><path d="M19 12H5M12 19l-7-7 7-7"/></svg></button>
                <div>
                    <h3>Usuario Eliminado</h3>
                    <span class="status-badge" style="background: rgba(255, 68, 68, 0.1); color: #ff4444; border: 1px solid rgba(255, 68, 68, 0.3);"><svg class="ui-icon-svg" style="width:14px;height:14px;" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line></svg> No puedes responder a esta conversación</span>
                </div>
            </div>
        `;
        messageInput.disabled = true;
        btnSend.disabled = true;
        if(btnEmoji) btnEmoji.disabled = true;
        if(btnAttach) btnAttach.disabled = true;
        if(btnMic) btnMic.disabled = true;
        messageInput.placeholder = "El usuario eliminó su cuenta.";
    } else {
        chatHeader.innerHTML = `
            <button class="back-btn" id="btn-back-mobile" title="Volver a lista">
                <i class="fa-solid fa-arrow-left"></i>
            </button>
            <div class="avatar">
                <span>${escapeHTML(user.alias_publico.charAt(0).toUpperCase())}</span>
            </div>
            <div class="chat-contact-info">
                <div class="chat-contact-name">
                    <span id="current-contact-name">${escapeHTML(user.alias_publico)}</span>
                    <span class="encryption-indicator" style="display:flex;">
                        <i class="fa-solid fa-lock"></i> E2EE Seguro
                    </span>
                </div>
                <div class="chat-contact-status">Conectado</div>
            </div>
              <div class="chat-actions">
                  <div class="ephemeral-control" title="Autodestrucción de mensajes">
                      <select id="ephemeral-select" class="neon-select">
                          <option value="0">∞</option>
                          <option value="30">30s</option>
                          <option value="60">1m</option>
                          <option value="300">5m</option>
                      </select>
                  </div>
              </div>
        `;
        messageInput.disabled = false;
        btnSend.disabled = false;
        if(btnEmoji) btnEmoji.disabled = false;
        if(btnAttach) btnAttach.disabled = false;
        if(btnMic) btnMic.disabled = false;
        messageInput.placeholder = "Escribe un mensaje seguro...";
    }

    // Re-bindear eventos del nuevo header dinámico
    const btnBackMobile = document.getElementById('btn-back-mobile');
    if (btnBackMobile) {
        btnBackMobile.addEventListener('click', () => {
            document.querySelector('.sidebar').classList.remove('mobile-hidden');
            document.querySelector('.main-chat').classList.remove('mobile-visible');
        });
    }

    chatMessages.innerHTML = '';
    if (user.eliminado != 1) messageInput.focus();
    
    cargarHistorial();
}

async function cargarHistorial(isPolling = false) {
    if (!currentContact) return;
    try {
        const response = await fetch(`api/historial.php?usuario_id=${currentUser.id}&contacto_id=${currentContact.id}&token_sesion=${currentUser.token_sesion}`);
        const result = await response.json();
        
        if (result.success) {
            if (isPolling && result.mensajes.length === messagesCache.size) return;
            
            if (!isPolling) {
                chatMessages.innerHTML = '';
                messagesCache.clear();
            }
            
            result.mensajes.forEach(msg => {
                if (messagesCache.has(msg.id)) return;
                
                let realSenderId = msg.de_usuario_id;
                let decResult = null;
                let payloadCipher = msg.payload_cifrado;
                let tipo = "them";

                if (realSenderId == currentUser.id) {
                    // Es un mensaje saliente (mi copia propia)
                    tipo = "me";
                    // En el nuevo formato "Sealed Sender dual", el payload viene como "contactId::cifrado"
                    const delimiterIndex = payloadCipher.indexOf('::');
                    if (delimiterIndex > -1) {
                        const targetId = parseInt(payloadCipher.substring(0, delimiterIndex));
                        if (targetId != currentContact.id) return; // No es para este chat
                        payloadCipher = payloadCipher.substring(delimiterIndex + 2);
                    }
                    decResult = MiCifrado.descifrarFinal(payloadCipher, currentContact.rootKey, () => {});
                } else if (realSenderId == 0) {
                    // Mensaje entrante anónimo
                    decResult = MiCifrado.descifrarFinal(payloadCipher, currentContact.rootKey, () => {});
                    if (!decResult.valido) return; // Si no es válido con la llave de este contacto, es porque no lo envió él
                } else if (realSenderId == currentContact.id) {
                    // Mensaje entrante legacy
                    decResult = MiCifrado.descifrarFinal(payloadCipher, currentContact.rootKey, () => {});
                } else {
                    return; // No pertenece a esta conversación (legacy)
                }
                
                messagesCache.add(msg.id);
                
                if (decResult && decResult.valido) {
                    procesarMensajeDescifrado(msg.id, decResult.texto, msg.creado_en, tipo);
                } else {
                    procesarMensajeDescifrado(msg.id, `[Bloqueado: Paquete corrupto]`, msg.creado_en, tipo);
                }
            });
        }
    } catch (e) {
        console.error('Error al cargar historial', e);
    }
}

function procesarMensajeDescifrado(msgId, textoDescifrado, timestamp, type) {
    if (textoDescifrado.startsWith('__CTRL_DEL__')) {
        const targetId = textoDescifrado.split('__')[2];
        const msgDiv = document.querySelector(`.message[data-id="${targetId}"]`);
        if (msgDiv) {
            msgDiv.classList.add('deleted');
            msgDiv.querySelector('.text').innerHTML = '<i style="display:flex;align-items:center;gap:5px;opacity:0.7;"><svg class="ui-icon-svg" style="width:14px;height:14px;" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line></svg> Este mensaje fue eliminado</i>';
            const actions = msgDiv.querySelector('.message-actions');
            if (actions) actions.remove();
        }
        return;
    }

    let isEdit = false;
    let actualText = textoDescifrado;
    if (textoDescifrado.startsWith('__CTRL_EDIT__')) {
        isEdit = true;
        const parts = textoDescifrado.split('__');
        const targetId = parts[2];
        actualText = parts.slice(3).join('__');
        
        const msgDiv = document.querySelector(`.message[data-id="${targetId}"]`);
        if (msgDiv) {
            msgDiv.querySelector('.text').innerText = actualText;
            if (!msgDiv.querySelector('.edit-tag')) {
                msgDiv.querySelector('.text').innerHTML += ' <span class="edit-tag">(editado)</span>';
            }
        }
        return; // No renderizamos un nuevo globo, ya modificamos el existente
    }

    let isEphemeral = false;
    let ephemeralDuration = 0;
    if (textoDescifrado.startsWith('__EFIMERO__')) {
        const parts = textoDescifrado.split('__');
        ephemeralDuration = parseInt(parts[2]);
        actualText = parts.slice(3).join('__');
        isEphemeral = true;
    }

    mostrarMensajeUI(actualText, timestamp, type, msgId, isEphemeral, ephemeralDuration);
}

function mostrarMensajeUI(text, timestamp, type, msgId, isEphemeral = false, ephemeralDuration = 0) {
    if (document.querySelector(`.message[data-id="${msgId}"]`)) return;

    const div = document.createElement('div');
    const cssClass = type === 'me' ? 'sent' : 'received';
    div.className = `message ${cssClass}`;
    if (msgId) div.setAttribute('data-id', msgId);
    
    const time = new Date(timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    
    let actionsHtml = '';
    if (type === 'me') {
        actionsHtml = `
            <div class="message-actions" style="position: absolute; right: 100%; top: 50%; transform: translateY(-50%); display: none; gap: 4px; padding-right: 8px;">
                <button class="icon-btn btn-edit" title="Editar" style="width: 24px; height: 24px; font-size: 0.7rem;"><i class="fa-solid fa-pen"></i></button>
                <button class="icon-btn btn-delete" title="Borrar" style="width: 24px; height: 24px; font-size: 0.7rem; color: var(--danger);"><i class="fa-solid fa-trash"></i></button>
            </div>
        `;
    }

    let innerContent = '';
    let nodeToAppend = null;
    
    if (text.startsWith('__IMG__')) {
        const base64 = text.substring(7);
        if (base64.startsWith('data:image/')) {
            nodeToAppend = document.createElement('img');
            nodeToAppend.src = base64;
            nodeToAppend.className = 'chat-image';
        } else {
            innerContent = '[Imagen bloqueada por seguridad]';
        }
    } else if (text.startsWith('__AUDIO__')) {
        const base64 = text.substring(9);
        if (base64.startsWith('data:audio/')) {
            nodeToAppend = document.createElement('audio');
            nodeToAppend.src = base64;
            nodeToAppend.controls = true;
            nodeToAppend.className = 'chat-audio';
        } else {
            innerContent = '[Audio bloqueado por seguridad]';
        }
    } else {
        innerContent = typeof DOMPurify !== 'undefined' ? DOMPurify.sanitize(text) : escapeHTML(text);
    }

    let timerHtml = '';
    if (isEphemeral) {
        timerHtml = ` <span class="ephemeral-timer" style="color: var(--danger-color); font-size: 0.75rem; margin-left: 8px; font-weight: bold;">[ ${ephemeralDuration}S ]</span>`;
    }

    let avatarHtml = '';
    // NeonVault no requiere avatar dentro de la burbuja, pero mantendremos acciones.
    
    div.innerHTML = `
        <span class="msg-encrypted-tag"><i class="fa-solid fa-lock"></i> E2E</span>
        ${actionsHtml}
        <div class="text"></div>
        <div class="msg-time">
            ${time}${timerHtml}
            ${type === 'me' ? '<i class="fa-solid fa-check-double"></i>' : ''}
        </div>
    `;
    
    const textDiv = div.querySelector('.text');
    if (nodeToAppend) {
        textDiv.appendChild(nodeToAppend);
    } else {
        textDiv.innerHTML = innerContent;
    }

    if (isEphemeral && msgId) {
        let timeLeft = ephemeralDuration;
        const interval = setInterval(async () => {
            timeLeft--;
            const timerSpan = div.querySelector('.ephemeral-timer');
            if (timerSpan) {
                timerSpan.innerText = `[ ${timeLeft}S ]`;
            }
            if (timeLeft <= 0) {
                clearInterval(interval);
                div.style.transition = "opacity 0.5s ease, transform 0.5s ease";
                div.style.opacity = "0";
                div.style.transform = "scale(0.9)";
                setTimeout(() => {
                    div.remove();
                }, 500);
                
                if (type === 'them' && !msgId.toString().startsWith('temp_')) {
                    try {
                        await fetch('api/borrar_mensaje.php', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                usuario_id: currentUser.id,
                                token_sesion: currentUser.token_sesion,
                                mensaje_id: msgId
                            })
                        });
                    } catch (e) {
                        console.error('Error al borrar mensaje efímero', e);
                    }
                }
            }
        }, 1000);
    }
    
    if (type === 'me' && msgId && !msgId.toString().startsWith('temp_')) {
        const btnEdit = div.querySelector('.btn-edit');
        const btnDel = div.querySelector('.btn-delete');
        
        if (btnEdit) {
            btnEdit.addEventListener('click', () => {
                document.querySelectorAll('.message').forEach(m => m.classList.remove('editing-mode'));
                div.classList.add('editing-mode');
                messageInput.value = div.querySelector('.text').innerText.replace('(editado)', '').trim();
                messageInput.dispatchEvent(new Event('input'));
                messageInput.focus();
                editMessageId = msgId;
                btnSend.innerHTML = '<i class="fa-solid fa-check"></i>';
            });
        }
        
        if (btnDel) {
            btnDel.addEventListener('click', () => {
                mostrarConfirmacionSegura({
                    tipo: 'warning',
                    titulo: 'Borrar Mensaje',
                    mensaje: '¿Estás seguro de que quieres borrar este mensaje para todos? Esta acción es irreversible.',
                    textoConfirmar: 'Sí, borrar',
                    textoCancelar: 'Cancelar'
                }).then((result) => {
                    if (result.isConfirmed) {
                        enviarComandoControl(`__CTRL_DEL__${msgId}`, msgId);
                    }
                });
            });
        }
    }
    
    chatMessages.appendChild(div);
    chatMessages.scrollTop = chatMessages.scrollHeight; // Auto-scroll
}

async function enviarComandoControl(comando, targetMsgId) {
    if (!currentContact) return;
    
    // Actualizar UI local inmediatamente
    procesarMensajeDescifrado(null, comando, new Date().toISOString(), 'me');
    
    // Cifrar comando
    const vizBlock = iniciarBloqueVisualizador("Control (Oculto)", "me");
    const onLog = (etiqueta, datos) => agregarPasoVisualizador(vizBlock, etiqueta, datos);
    const payloadCifrado = MiCifrado.cifrarFinal(comando, currentContact.rootKey, onLog);
    
    const payloadPropio = currentContact.id + "::" + payloadCifrado; // Para historial propio
    
    try {
        await fetch('api/enviar.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                de_usuario_id: 0,
                auth_usuario_id: currentUser.id,
                para_usuario_id: currentContact.id,
                payload_cifrado: payloadCifrado,
                payload_propio: payloadPropio,
                token_sesion: currentUser.token_sesion
            })
        });
    } catch (e) {
        console.error('Error enviando comando de control');
    }
}

// --- VISUALIZADOR ---
const vizContent = document.getElementById('viz-content');

function limpiarVisualizador() {
    if (vizContent) vizContent.innerHTML = '';
}

function iniciarBloqueVisualizador(titulo, tipo) {
    if (!vizContent) return document.createElement('div');
    const block = document.createElement('div');
    block.className = `viz-block ${tipo}`;
    block.innerHTML = `<h4>${titulo}</h4>`;
    vizContent.prepend(block); // Mostrar arriba
    return block;
}

function agregarPasoVisualizador(block, etiqueta, datos) {
    // Retirado para UI limpia de Messenger
}

// --- MENSAJERIA CORE ---
async function enviarMensaje() {
    if (!currentContact) return;
    const textoRaw = messageInput.value.trim();
    if (!textoRaw) return;

    const ephemeralSelect = document.getElementById('ephemeral-select');
    const ephemeralDuration = ephemeralSelect ? parseInt(ephemeralSelect.value) : 0;

    let textoFinal = textoRaw;
    if (editMessageId) {
        textoFinal = `__CTRL_EDIT__${editMessageId}__${textoRaw}`;
    } else if (ephemeralDuration > 0) {
        textoFinal = `__EFIMERO__${ephemeralDuration}__${textoRaw}`;
    }

    messageInput.value = '';
    messageInput.style.height = '44px';
    btnSend.innerHTML = '<i class="fa-solid fa-paper-plane"></i>';
    document.querySelectorAll('.message').forEach(m => m.classList.remove('editing-mode'));
    
    let tempMsgId = 'temp_' + Date.now();
    let oldEditId = editMessageId;
    editMessageId = null; 

    // Reset selector
    if (ephemeralSelect) ephemeralSelect.value = "0";

    if (oldEditId) {
        procesarMensajeDescifrado(null, textoFinal, new Date().toISOString(), 'me');
    } else {
        if (ephemeralDuration > 0) {
            mostrarMensajeUI(textoRaw, new Date().toISOString(), 'me', tempMsgId, true, ephemeralDuration);
        } else {
            mostrarMensajeUI(textoRaw, new Date().toISOString(), 'me', tempMsgId);
        }
    }

    const vizBlock = iniciarBloqueVisualizador(oldEditId ? "Cifrando Edición" : "Cifrando (Envío)", "me");
    const onLog = (etiqueta, datos) => agregarPasoVisualizador(vizBlock, etiqueta, datos);

    const payloadCifrado = MiCifrado.cifrarFinal(textoFinal, currentContact.rootKey, onLog);
    const payloadPropio = currentContact.id + "::" + payloadCifrado; // Para historial propio

    try {
        const response = await fetch('api/enviar.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                de_usuario_id: 0, // Remitente sellado (el servidor no sabe quién lo envió)
                auth_usuario_id: currentUser.id, // Solo para validar sesión
                para_usuario_id: currentContact.id,
                payload_cifrado: payloadCifrado,
                payload_propio: payloadPropio, // Copia para el historial personal
                token_sesion: currentUser.token_sesion
            })
        });
        const result = await response.json();
        
        if (result.success && !oldEditId) {
            const div = document.querySelector(`.message[data-id="${tempMsgId}"]`);
            if (div) {
                div.setAttribute('data-id', result.id);
                const btnEdit = div.querySelector('.btn-edit');
                const btnDel = div.querySelector('.btn-delete');
                if (btnEdit) btnEdit.addEventListener('click', () => {
                    document.querySelectorAll('.message').forEach(m => m.classList.remove('editing-mode'));
                    div.classList.add('editing-mode');
                    messageInput.value = div.querySelector('.text').innerText.replace('(editado)', '').trim();
                    messageInput.dispatchEvent(new Event('input'));
                    messageInput.focus();
                    editMessageId = result.id;
                    btnSend.innerHTML = '<i class="fa-solid fa-check"></i>';
                });
                if (btnDel) btnDel.addEventListener('click', () => {
                    mostrarConfirmacionSegura({
                        tipo: 'warning',
                        titulo: 'Borrar Mensaje',
                        mensaje: '¿Estás seguro de que quieres borrar este mensaje para todos? Esta acción es irreversible.',
                        textoConfirmar: 'Sí, borrar',
                        textoCancelar: 'Cancelar'
                    }).then((result) => {
                        if (result.isConfirmed) {
                            enviarComandoControl(`__CTRL_DEL__${result.id}`, result.id);
                        }
                    });
                });
            }
        }
    } catch (e) {
        console.error('Error al enviar el mensaje cifrado al servidor.', e);
    }
}

async function procesarBuzon() {
    if (!currentUser.id) return;
    
    try {
        const response = await fetch(`api/leer.php?usuario_id=${currentUser.id}&token_sesion=${currentUser.token_sesion || ''}`);
        const result = await response.json();
        
        if (result.error === 'sesion_invalida') {
            showToast('Tu sesión se ha cerrado porque iniciaste sesión en otro dispositivo.', 'warning');
            localStorage.removeItem('e2ee_identity');
            window.location.href = 'index.html';
            return;
        }

        // Polling secundario de historial (para ver mensajes propios enviados desde otra pestaña)
        if (currentContact) {
            cargarHistorial(true);
        }

        if (result.success && result.mensajes.length > 0) {
            let actualizados = false;
            result.mensajes.forEach(msg => {
                if (messagesCache.has(msg.id)) return;
                
                let realSenderId = msg.de_usuario_id;
                let decResult = null;
                
                if (realSenderId == 0) {
                    // Sealed Sender: Probar con todos los contactos conocidos
                    for (const u of usersList) {
                        if (u.id == currentUser.id) continue;
                        const potentialKey = MiCifrado.derivarLlaveRaiz(u.llave_publica, currentUser.llaves.privada);
                        const r = MiCifrado.descifrarFinal(msg.payload_cifrado, potentialKey, () => {});
                        if (r.valido) {
                            realSenderId = u.id;
                            decResult = r;
                            break;
                        }
                    }
                } else if (realSenderId == currentUser.id) {
                    // Es nuestra copia propia, el ID del contacto está incrustado al principio
                    // payload = "to_id::cifrado" (esto no viene del servidor, lo manejamos diferente)
                    // En Sealed Sender, para_usuario_id == currentUser.id, y de_usuario_id == currentUser.id
                    // No procesamos nuestras copias propias como mensajes entrantes de notificación.
                    messagesCache.add(msg.id);
                    return; 
                } else {
                    // Legacy message
                    const u = usersList.find(x => x.id == realSenderId);
                    if (u) {
                        const potentialKey = MiCifrado.derivarLlaveRaiz(u.llave_publica, currentUser.llaves.privada);
                        decResult = MiCifrado.descifrarFinal(msg.payload_cifrado, potentialKey, () => {});
                    }
                }
                
                if (!decResult || !decResult.valido) return; // No es para nosotros o no pudimos descifrar
                
                messagesCache.add(msg.id);
                
                if (currentContact && realSenderId == currentContact.id) {
                    procesarMensajeDescifrado(msg.id, decResult.texto, decResult.timestamp || msg.creado_en, 'them');
                } else {
                    if (!unreadCounts[realSenderId]) unreadCounts[realSenderId] = 0;
                    unreadCounts[realSenderId]++;
                    actualizados = true;
                }
            });
            if (actualizados) cargarUsuarios(); // Refrescar para mostrar badges
        }
    } catch (e) {
        console.error('Error en polling', e);
    }
}

function iniciarPolling() {
    if (pollingInterval) clearInterval(pollingInterval);
    if (userPollingInterval) clearInterval(userPollingInterval);
    pollingInterval = setInterval(procesarBuzon, 2000); 
    userPollingInterval = setInterval(cargarUsuarios, 3000); 
}

// Listeners
if(btnSend) btnSend.addEventListener('click', () => enviarMensaje());
if(messageInput) {
    messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) { 
            e.preventDefault(); 
            enviarMensaje(); 
        }
    });
    messageInput.addEventListener('input', function() {
        this.style.height = '44px';
        this.style.height = Math.min(this.scrollHeight, 100) + 'px';
        if (this.scrollHeight > 100) {
            this.style.overflowY = 'auto';
        } else {
            this.style.overflowY = 'hidden';
        }
    });
}

// --- GESTIÓN DE PERFIL ---
const btnProfile = document.getElementById('btn-profile');
const profileModal = document.getElementById('profile-modal');
const btnCloseProfile = document.getElementById('btn-close-profile');
const btnSaveProfile = document.getElementById('btn-save-profile');
const profileAlias = document.getElementById('profile-alias');
const profileOldPass = document.getElementById('profile-old-pass');
const profileNewPass = document.getElementById('profile-new-pass');

if (btnProfile) {
    btnProfile.addEventListener('click', () => {
        profileAlias.value = currentUser.alias_publico || currentUser.nombre;
        profileOldPass.value = '';
        profileNewPass.value = '';
        profileModal.classList.remove('hidden');
        cargarSesiones();
    });
}

async function cargarSesiones() {
    const sessionsList = document.getElementById('sessions-list');
    if (!sessionsList) return;
    
    sessionsList.innerHTML = '<p style="color:var(--text-secondary);">Cargando sesiones...</p>';
    
    try {
        const res = await fetch('api/sesiones.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'list', usuario_id: currentUser.id, token_sesion: currentUser.token_sesion })
        });
        const result = await res.json();
        
        if (result.success) {
            sessionsList.innerHTML = '';
            result.sesiones.forEach(s => {
                const isCurrent = s.token_sesion === currentUser.token_sesion;
                const div = document.createElement('div');
                div.style = "background: rgba(255,255,255,0.03); padding: 12px; border-radius: 8px; margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center; border: 1px solid rgba(255,255,255,0.05); gap: 10px;";
                
                // Formatear dispositivo para que no sea tan largo (extraer SO o Navegador si es posible, o simplemente recortar)
                let deviceStr = s.dispositivo;
                if(deviceStr.length > 40) deviceStr = deviceStr.substring(0, 40) + '...';

                const htmlInfo = `
                    <div style="flex: 1; min-width: 0;">
                        <strong style="color: ${isCurrent ? 'var(--neon-blue)' : '#fff'}; font-size: 0.85rem; display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${s.dispositivo}">
                            <i class="fa-solid ${isCurrent ? 'fa-laptop-code' : 'fa-laptop'}"></i> ${deviceStr} ${isCurrent ? '<span style="font-size:0.7rem; background:rgba(0,200,255,0.1); padding:2px 6px; border-radius:10px; margin-left:5px;">ACTUAL</span>' : ''}
                        </strong>
                        <small style="color: var(--text-muted); font-size: 0.75rem; display: block; margin-top: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">IP: ${s.ip} &bull; Acceso: ${new Date(s.ultimo_acceso).toLocaleString()}</small>
                    </div>
                `;
                
                let htmlAction = '';
                if (!isCurrent) {
                    htmlAction = `<button class="btn-revoke-session" data-id="${s.id}" style="background: rgba(255,68,119,0.1); color: var(--danger); border: 1px solid rgba(255,68,119,0.2); padding: 6px 10px; border-radius: 6px; cursor: pointer; font-size: 0.75rem; transition: all 0.2s;"><i class="fa-solid fa-xmark"></i></button>`;
                }
                
                div.innerHTML = htmlInfo + htmlAction;
                sessionsList.appendChild(div);
            });
            
            document.querySelectorAll('.btn-revoke-session').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    const sid = e.target.getAttribute('data-id');
                    mostrarConfirmacionSegura({
                        tipo: 'danger',
                        titulo: 'Cerrar sesión del dispositivo',
                        mensaje: 'La sesión seleccionada será invalidada y deberá autenticarse nuevamente para acceder.',
                        textoConfirmar: 'Cerrar sesión',
                        textoCancelar: 'Cancelar'
                    }).then(async (result) => {
                        if (result.isConfirmed) {
                            await fetch('api/sesiones.php', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ action: 'revoke', usuario_id: currentUser.id, sesion_id: sid, token_sesion: currentUser.token_sesion })
                            });
                            cargarSesiones();
                        }
                    });
                });
            });
        } else {
            sessionsList.innerHTML = `<p style="color:var(--danger-color);">Error: ${result.error}</p>`;
        }
    } catch (e) {
        sessionsList.innerHTML = `<p style="color:var(--danger-color);">Error de conexión</p>`;
    }
}

if (btnCloseProfile) {
    btnCloseProfile.addEventListener('click', () => {
        profileModal.classList.add('hidden');
    });
}

if (btnSaveProfile) {
    btnSaveProfile.addEventListener('click', async () => {
        const newAlias = profileAlias.value.trim();
        const oldPass = profileOldPass.value.trim();
        const newPass = profileNewPass.value.trim();
        
        let updateData = { id: currentUser.id, token_sesion: currentUser.token_sesion };
        let changingPass = oldPass && newPass;
        
        if (newAlias && newAlias !== currentUser.alias_publico) {
            updateData.alias_publico = newAlias;
        }
        
        if (changingPass) {
            const nuevoCandado = MiCifrado.derivarLlaveCandado(currentUser.nombre, newPass);
            const nuevaBoveda = MiCifrado.empaquetarBoveda(currentUser.llaves.privada, nuevoCandado);
            updateData.boveda_cifrada = nuevaBoveda;
        }
        
        if (!updateData.alias_publico && !updateData.boveda_cifrada) {
            return showToast('Nada que actualizar', 'info');
        }
        
        btnSaveProfile.innerText = "Guardando...";
        
        try {
            const response = await fetch('api/perfil.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updateData)
            });
            const result = await response.json();
            
            if (result.success) {
                if (updateData.alias_publico) currentUser.alias_publico = updateData.alias_publico;
                localStorage.setItem('e2ee_identity', JSON.stringify(currentUser));
                showToast('Perfil actualizado correctamente.', 'success');
                profileModal.classList.add('hidden');
            } else {
                showToast('Error al actualizar: ' + result.error, 'error');
            }
        } catch (e) {
            showToast('Error de conexión', 'error');
        }
        btnSaveProfile.innerText = "💾 Guardar";
    });
}

const btnLogoutCurrent = document.getElementById('btn-logout-current');
if (btnLogoutCurrent) {
    btnLogoutCurrent.addEventListener('click', () => {
        mostrarConfirmacionSegura({
            tipo: 'warning',
            titulo: 'Cerrar sesión actual',
            mensaje: 'Saldrás de tu bóveda en este dispositivo. Para volver a entrar, necesitarás tu usuario y contraseña secreta.',
            textoConfirmar: 'Cerrar sesión',
            textoCancelar: 'Cancelar'
        }).then((result) => {
            if (result.isConfirmed) {
                localStorage.removeItem('e2ee_identity');
                window.location.href = 'index.html';
            }
        });
    });
}

// --- LÓGICA DE AUTODESTRUCCIÓN ---
const btnDeleteAccount = document.getElementById('btn-delete-account');

if (btnDeleteAccount) {
    btnDeleteAccount.addEventListener('click', async () => {
        mostrarConfirmacionSegura({
            tipo: 'danger',
            titulo: 'Eliminar Bóveda Permanentemente',
            mensaje: 'Al eliminar tu cuenta se borrarán permanentemente todos tus mensajes y no podrás recuperar nada. Esta acción no se puede deshacer.',
            textoConfirmar: 'Eliminar definitivamente',
            textoCancelar: 'Cancelar'
        }).then(async (result) => {
            if (!result.isConfirmed) return;
            
            btnDeleteAccount.disabled = true;
            btnDeleteAccount.innerText = "Destruyendo bóveda...";
            
            try {
                const response = await fetch('api/borrar_cuenta.php', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        id: currentUser.id,
                        token_sesion: currentUser.token_sesion
                    })
                });
                
                const result_del = await response.json();
                
                if (result_del.success) {
                    showToast('Tu bóveda ha sido destruida matemáticamente de los servidores.', 'success');
                    localStorage.removeItem('e2ee_identity');
                    window.location.href = 'index.html';
                } else {
                    showToast('Error al destruir cuenta: ' + result_del.error, 'error');
                    btnDeleteAccount.disabled = false;
                    btnDeleteAccount.innerText = "ELIMINAR BÓVEDA";
                }
            } catch (e) {
                showToast('Error de conexión', 'error');
                btnDeleteAccount.disabled = false;
                btnDeleteAccount.innerText = "ELIMINAR BÓVEDA";
            }
        });
    });
}

// --- PRECARGA MULTIMEDIA Y EMOJIS ---
let pendingMediaPayload = null;
const mediaPreviewContainer = document.getElementById('media-preview-container');
const mediaPreviewContent = document.getElementById('media-preview-content');
const btnCancelMedia = document.getElementById('btn-cancel-media');
const emojiPicker = document.getElementById('emoji-picker');

// Emojis Picker
const EMOJIS = ["😀","😂","😅","😍","😎","🤔","🙄","😴","😷","🤯","🥳","😡","😭","👍","👎","❤️","🔥","✨","🎉","👏","🙌","🤝","🙏","👀","💪","👽","👾","👻","🤖","🎃"];
if (emojiPicker) {
    EMOJIS.forEach(emoji => {
        const btn = document.createElement('button');
        btn.innerText = emoji;
        btn.style = "background: none; border: none; font-size: 1.5rem; cursor: pointer;";
        btn.onclick = () => {
            messageInput.value += emoji;
            messageInput.dispatchEvent(new Event('input'));
            messageInput.focus();
        };
        emojiPicker.appendChild(btn);
    });
}
if(btnEmoji) btnEmoji.addEventListener('click', () => {
    emojiPicker.classList.toggle('hidden');
});

// Manejo de adjuntos de imagen
if(btnAttach) btnAttach.addEventListener('click', () => fileInput.click());
if(fileInput) fileInput.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const max = 800;
      let w = img.width; let h = img.height;
      if(w > max) { h *= max/w; w = max; }
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);
      const base64 = canvas.toDataURL('image/jpeg', 0.7);
      
      pendingMediaPayload = '__IMG__' + base64;
      mediaPreviewContent.innerHTML = `<img src="${base64}" style="max-width: 100%; max-height: 180px; border-radius: 8px;">`;
      mediaPreviewContainer.classList.remove('hidden');
    };
    img.src = ev.target.result;
  };
  reader.readAsDataURL(file);
});

// Manejo de Audio
let mediaRecorder; let audioChunks = [];
let recordingInterval; let recordingSeconds = 0;

function updateRecordingUI(isRecording) {
    const recordingUi = document.getElementById('recording-ui');
    const recordingTimeEl = document.getElementById('recording-time');
    
    if (isRecording) {
        if(btnEmoji) btnEmoji.style.display = 'none';
        if(btnAttach) btnAttach.style.display = 'none';
        if(messageInput) messageInput.style.display = 'none';
        if(recordingUi) recordingUi.classList.remove('hidden');
        
        recordingSeconds = 0;
        if(recordingTimeEl) recordingTimeEl.innerText = "00:00";
        recordingInterval = setInterval(() => {
            recordingSeconds++;
            const mins = String(Math.floor(recordingSeconds / 60)).padStart(2, '0');
            const secs = String(recordingSeconds % 60).padStart(2, '0');
            if(recordingTimeEl) recordingTimeEl.innerText = `${mins}:${secs}`;
        }, 1000);
    } else {
        clearInterval(recordingInterval);
        if(btnEmoji) btnEmoji.style.display = '';
        if(btnAttach) btnAttach.style.display = '';
        if(messageInput) messageInput.style.display = '';
        if(recordingUi) recordingUi.classList.add('hidden');
    }
}

if(btnMic) {
  const startRecording = async (e) => {
    if(e) e.preventDefault();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder = new MediaRecorder(stream);
      mediaRecorder.ondataavailable = ev => audioChunks.push(ev.data);
      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = () => {
            pendingMediaPayload = '__AUDIO__' + reader.result;
            mediaPreviewContent.innerHTML = `<audio controls src="${reader.result}"></audio>`;
            mediaPreviewContainer.classList.remove('hidden');
        };
        audioChunks = [];
      };
      mediaRecorder.start();
      btnMic.classList.add('recording');
      updateRecordingUI(true);
    } catch(err) { showToast('Permiso de micrófono denegado.', 'error'); }
  };

  const stopRecording = (e) => {
    if(e) e.preventDefault();
    if(mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.stop();
      btnMic.classList.remove('recording');
      updateRecordingUI(false);
      mediaRecorder.stream.getTracks().forEach(t => t.stop());
    }
  };

  const isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0) || (navigator.msMaxTouchPoints > 0);

  if (isTouchDevice) {
      // Móvil: Mantener presionado
      btnMic.addEventListener('touchstart', startRecording, {passive: false});
      btnMic.addEventListener('touchend', stopRecording, {passive: false});
      btnMic.addEventListener('touchcancel', stopRecording, {passive: false});
  } else {
      // Escritorio: Un clic para empezar, otro para parar
      btnMic.addEventListener('click', (e) => {
          if (mediaRecorder && mediaRecorder.state === 'recording') {
              stopRecording(e);
          } else {
              startRecording(e);
          }
      });
  }
}

if(btnCancelMedia) btnCancelMedia.addEventListener('click', () => {
    pendingMediaPayload = null;
    mediaPreviewContent.innerHTML = '';
    mediaPreviewContainer.classList.add('hidden');
    fileInput.value = '';
});

// Sobrescribir enviarMensaje original para soportar adjuntos
const oldEnviarMensaje = enviarMensaje;
enviarMensaje = async function() {
    if (!currentContact) return;
    
    // Si hay un adjunto multimedia, enviarlo PRIMERO
    if (pendingMediaPayload) {
        const ephemeralSelect = document.getElementById('ephemeral-select');
        const ephemeralDuration = ephemeralSelect ? parseInt(ephemeralSelect.value) : 0;

        let tempMsgId = 'temp_media_' + Date.now();
        let finalMediaPayload = pendingMediaPayload;
        
        if (ephemeralDuration > 0) {
            finalMediaPayload = `__EFIMERO__${ephemeralDuration}__${pendingMediaPayload}`;
            mostrarMensajeUI(pendingMediaPayload, new Date().toISOString(), 'me', tempMsgId, true, ephemeralDuration);
        } else {
            mostrarMensajeUI(pendingMediaPayload, new Date().toISOString(), 'me', tempMsgId);
        }

        // Reset selector
        if (ephemeralSelect) ephemeralSelect.value = "0";
        
        const vizBlock = iniciarBloqueVisualizador("Cifrando Adjunto", "me");
        const onLog = (etiqueta, datos) => agregarPasoVisualizador(vizBlock, etiqueta, datos);
        const cifrado = MiCifrado.cifrarFinal(finalMediaPayload, currentContact.rootKey, onLog);
        
        try {
            await fetch('api/enviar.php', { 
                method: 'POST', 
                headers: {'Content-Type':'application/json'}, 
                body: JSON.stringify({ de_usuario_id: currentUser.id, para_usuario_id: currentContact.id, payload_cifrado: cifrado, token_sesion: currentUser.token_sesion }) 
            });
            // Ocultar previsualizacion
            pendingMediaPayload = null;
            mediaPreviewContainer.classList.add('hidden');
            mediaPreviewContent.innerHTML = '';
            fileInput.value = '';
        } catch (e) {
            console.error('Error enviando adjunto', e);
        }
    }
    
    // Luego enviar el texto normal usando la función original si hay algo escrito
    if (messageInput.value.trim() !== '') {
        await oldEnviarMensaje();
    }
    
    // Ocultar emoji picker
    if(emojiPicker) emojiPicker.classList.add('hidden');
};

