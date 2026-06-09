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
let messagesCache = new Set();
let unreadCounts = {}; 

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
    const privada = sessionStorage.getItem('e2ee_priv');
    
    if (!privada) {
        // La memoria RAM (sessionStorage) se borró, requiere desbloquear bóveda de nuevo
        localStorage.removeItem('e2ee_identity');
        window.location.href = 'index.html';
        return;
    }
    
    identity.llaves = identity.llaves || {};
    identity.llaves.privada = privada;
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
});

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
                result.usuarios.forEach(user => {
                    if (user.id == currentUser.id) return;
                    
                    const div = document.createElement('div');
                    div.className = 'user-item' + (currentContact && currentContact.id == user.id ? ' active' : '');
                    
                    const unreadCount = unreadCounts[user.id] || 0;
                    const badge = unreadCount > 0 ? `<span class="unread-badge">${unreadCount}</span>` : '';
                    
                    div.innerHTML = `
                        <strong>${escapeHTML(user.alias_publico)}</strong><br>
                        <small style="color:var(--text-secondary)">ID: ${escapeHTML(user.llave_publica.substring(0,16))}...</small>
                        ${badge}
                    `;
                    div.addEventListener('click', () => {
                        unreadCounts[user.id] = 0;
                        abrirChat(user);
                        if(window.innerWidth <= 768) {
                            document.querySelector('.sidebar').classList.add('mobile-hidden');
                            document.querySelector('.chat-area').classList.add('mobile-visible');
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
            <div style="display: flex; align-items: center; gap: 10px;">
                <button id="btn-back-mobile" class="btn-secondary" style="padding: 5px 10px; border: none; border-radius: 8px; background: transparent;"><svg class="ui-icon-svg" style="width:20px;height:20px;" viewBox="0 0 24 24"><path d="M19 12H5M12 19l-7-7 7-7"/></svg></button>
                <div>
                    <h3>${escapeHTML(user.alias_publico)}</h3>
                    <span class="status-badge status-secure"><svg class="ui-icon-svg" style="width:14px;height:14px;" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg> Conexión E2EE Establecida</span>
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

    document.getElementById('btn-back-mobile').addEventListener('click', () => {
        document.querySelector('.sidebar').classList.remove('mobile-hidden');
        document.querySelector('.chat-area').classList.remove('mobile-visible');
    });

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
                messagesCache.add(msg.id);
                const isMe = msg.de_usuario_id == currentUser.id;
                const tipo = isMe ? "me" : "them";
                
                // Descifrar silenciosamente para historial
                const resultado = MiCifrado.descifrarFinal(msg.payload_cifrado, currentContact.rootKey, () => {});
                
                if (resultado.valido) {
                    procesarMensajeDescifrado(msg.id, resultado.texto, msg.creado_en, tipo);
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
    div.className = `message ${type}`;
    if (msgId) div.setAttribute('data-id', msgId);
    
    const time = new Date(timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    
    let actionsHtml = '';
    if (type === 'me') {
        actionsHtml = `
            <div class="message-actions">
                <button class="action-btn btn-edit" title="Editar"><svg class="ui-icon-svg" style="width:16px;height:16px;" viewBox="0 0 24 24"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg></button>
                <button class="action-btn btn-delete" title="Borrar"><svg class="ui-icon-svg" style="width:16px;height:16px;" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg></button>
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
    if (type === 'them' && currentContact) {
        let inicial = (currentContact.alias_publico || currentContact.nombre).charAt(0).toUpperCase();
        avatarHtml = `<div class="avatar-circle">${inicial}</div>`;
        div.classList.add('has-avatar');
    }

    div.innerHTML = `
        ${avatarHtml}
        <div class="message-content">
            ${actionsHtml}
            <div class="text"></div>
            <div class="time">${time}${timerHtml}</div>
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
                messageInput.focus();
                editMessageId = msgId;
                btnSend.innerHTML = 'GUARDAR';
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
    
    try {
        await fetch('api/enviar.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                de_usuario_id: currentUser.id,
                para_usuario_id: currentContact.id,
                payload_cifrado: payloadCifrado,
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
    btnSend.innerHTML = 'ENVIAR';
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

    try {
        const response = await fetch('api/enviar.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                de_usuario_id: currentUser.id,
                para_usuario_id: currentContact.id,
                payload_cifrado: payloadCifrado,
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
                    messageInput.focus();
                    editMessageId = result.id;
                    btnSend.innerHTML = 'GUARDAR';
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
                messagesCache.add(msg.id);
                
                if (currentContact && msg.de_usuario_id == currentContact.id) {
                    const vizBlock = iniciarBloqueVisualizador("Descifrando (Recepción)", "them");
                    const onLog = (etiqueta, datos) => agregarPasoVisualizador(vizBlock, etiqueta, datos);

                    const resultado = MiCifrado.descifrarFinal(msg.payload_cifrado, currentContact.rootKey, onLog);
                    
                    if (resultado.valido) {
                        procesarMensajeDescifrado(msg.id, resultado.texto, resultado.timestamp, 'them');
                    } else {
                        procesarMensajeDescifrado(msg.id, `[Bloqueado: ${resultado.error}]`, new Date().toISOString(), 'them');
                        console.error("Ataque interceptado:", resultado.error);
                    }
                } else {
                    if (!unreadCounts[msg.de_usuario_id]) unreadCounts[msg.de_usuario_id] = 0;
                    unreadCounts[msg.de_usuario_id]++;
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
if(messageInput) messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); enviarMensaje(); }
});

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
                div.style = "background: rgba(255,255,255,0.05); padding: 8px; border-radius: 8px; margin-bottom: 5px; display: flex; justify-content: space-between; align-items: center;";
                
                const htmlInfo = `
                    <div>
                        <strong style="color: ${isCurrent ? 'var(--accent-color)' : '#fff'};">${s.dispositivo} ${isCurrent ? '(Actual)' : ''}</strong><br>
                        <small style="color: var(--text-secondary);">IP: ${s.ip} | Acceso: ${new Date(s.ultimo_acceso).toLocaleString()}</small>
                    </div>
                `;
                
                let htmlAction = '';
                if (!isCurrent) {
                    htmlAction = `<button class="btn-revoke-session" data-id="${s.id}" style="background: var(--danger-color); color: #fff; border: none; padding: 5px 10px; border-radius: 6px; cursor: pointer;">Cerrar</button>`;
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
                        usuario_id: currentUser.id,
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
if(btnMic) {
  btnMic.addEventListener('mousedown', async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder = new MediaRecorder(stream);
      mediaRecorder.ondataavailable = e => audioChunks.push(e.data);
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
    } catch(err) { showToast('Permiso de micrófono denegado.', 'error'); }
  });
  const stopRecording = () => {
    if(mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.stop();
      btnMic.classList.remove('recording');
      mediaRecorder.stream.getTracks().forEach(t => t.stop());
    }
  };
  btnMic.addEventListener('mouseup', stopRecording);
  btnMic.addEventListener('mouseleave', stopRecording);
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

