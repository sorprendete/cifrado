
// =============================================
// ESTRUCTURA PARA CONEXIÓN CON BACKEND
// =============================================
// Este script prepara la interfaz y los event listeners.
// NO simula funcionalidad real de mensajería.
// Debes conectar cada sección con tu API.

// --- Referencias DOM ---
const sidebar = document.getElementById('sidebar');
const sidebarOverlay = document.getElementById('sidebarOverlay');
const btnBack = document.getElementById('btnBack');
const chatList = document.getElementById('chatList');
const messagesArea = document.getElementById('messagesArea');
const emptyState = document.getElementById('emptyState');
const messageInput = document.getElementById('messageInput');
const btnSend = document.getElementById('btnSend');
const activeChatName = document.getElementById('activeChatName');
const activeChatStatus = document.getElementById('activeChatStatus');
const activeChatAvatar = document.getElementById('activeChatAvatar');
const encryptionIndicator = document.getElementById('encryptionIndicator');
const searchChat = document.getElementById('searchChat');
const btnLogout = document.getElementById('btnLogout');
const btnSettings = document.getElementById('btnSettings');
const btnContactInfo = document.getElementById('btnContactInfo');
const currentUserName = document.getElementById('currentUserName');
const currentUserInitials = document.getElementById('currentUserInitials');

// --- Estado local (placeholders) ---
let currentUser = {
    id: null,
    name: 'Tú',
    initials: 'TU',
    email: '',
    isApproved: false
};

let activeChatId = null;
let contacts = []; // Array de { id, name, initials, avatarColor, online, lastMessage, lastTime, unread }

// --- Colores de avatar predefinidos ---
const avatarColors = [
    'linear-gradient(135deg, #1a4a6e, #0d3050)',
    'linear-gradient(135deg, #4a1a6e, #300d50)',
    'linear-gradient(135deg, #1a6e4a, #0d5030)',
    'linear-gradient(135deg, #6e4a1a, #50300d)',
    'linear-gradient(135deg, #6e1a4a, #500d30)',
    'linear-gradient(135deg, #1a6e6e, #0d5050)',
    'linear-gradient(135deg, #4a4a6e, #303050)',
    'linear-gradient(135deg, #6e2a1a, #50200d)',
];

// --- Funciones de UI ---

/** Carga los contactos aprobados desde el backend */
function loadContacts() {
    // --- AQUÍ CONECTAS CON TU BACKEND ---
    // fetch('/api/contacts', {
    //     headers: { 'Authorization': 'Bearer ' + token }
    // })
    // .then(res => res.json())
    // .then(data => {
    //     contacts = data.contacts;
    //     renderChatList();
    // })
    // .catch(err => console.error('Error cargando contactos:', err));

    console.log('[Chat] Cargar contactos aprobados - conecta tu endpoint aquí.');
    renderChatList();
}

/** Renderiza la lista de conversaciones */
function renderChatList(filterText = '') {
    chatList.innerHTML = '';
    const filtered = contacts.filter(c =>
        c.name.toLowerCase().includes(filterText.toLowerCase())
    );

    if (filtered.length === 0 && contacts.length === 0) {
        chatList.innerHTML = `
                        <div style="text-align:center;padding:30px 16px;color:var(--text-muted);">
                            <i class="fa-solid fa-users-slash" style="font-size:2rem;opacity:0.4;margin-bottom:8px;display:block;"></i>
                            <span style="font-size:0.82rem;">No hay conversaciones aún</span>
                            <p style="font-size:0.7rem;margin-top:4px;">Los usuarios aprobados aparecerán aquí</p>
                        </div>`;
        return;
    }
    if (filtered.length === 0 && filterText) {
        chatList.innerHTML = `
                        <div style="text-align:center;padding:24px;color:var(--text-muted);font-size:0.82rem;">
                            Sin resultados para "${filterText}"
                        </div>`;
        return;
    }

    filtered.forEach(contact => {
        const item = document.createElement('div');
        item.className = 'chat-list-item' + (contact.id === activeChatId ? ' active' : '');
        item.dataset.contactId = contact.id;
        item.innerHTML = `
                        <div class="contact-avatar" style="background:${contact.avatarColor || avatarColors[0]};">
                            ${contact.initials}
                            ${contact.online ? '<span class="online-dot"></span>' : ''}
                        </div>
                        <div class="contact-info">
                            <div class="contact-name">${escapeHtml(contact.name)}</div>
                            <div class="contact-last-msg">
                                <i class="fa-solid fa-lock"></i>
                                ${contact.lastMessage ? escapeHtml(contact.lastMessage) : 'Chat cifrado'}
                            </div>
                        </div>
                        <div class="contact-time">${contact.lastTime || ''}</div>
                    `;
        item.addEventListener('click', () => openChat(contact));
        chatList.appendChild(item);
    });
}

/** Abre una conversación */
function openChat(contact) {
    activeChatId = contact.id;
    activeChatName.textContent = contact.name;
    activeChatStatus.textContent = contact.online ? 'En línea' : 'Desconectado';
    activeChatAvatar.querySelector('span').textContent = contact.initials;
    activeChatAvatar.style.background = contact.avatarColor || avatarColors[0];
    encryptionIndicator.style.display = 'inline-flex';
    messageInput.disabled = false;
    btnSend.disabled = false;
    messageInput.focus();

    // Actualizar clase activa en la lista
    document.querySelectorAll('.chat-list-item').forEach(el => el.classList.remove('active'));
    const activeItem = document.querySelector(`.chat-list-item[data-contact-id="${contact.id}"]`);
    if (activeItem) activeItem.classList.add('active');

    // Ocultar estado vacío
    emptyState.style.display = 'none';

    // --- AQUÍ CONECTAS CON TU BACKEND ---
    // fetch(`/api/messages/${contact.id}`, {
    //     headers: { 'Authorization': 'Bearer ' + token }
    // })
    // .then(res => res.json())
    // .then(data => {
    //     renderMessages(data.messages);
    // })
    // .catch(err => console.error('Error cargando mensajes:', err));

    console.log('[Chat] Abrir conversación con:', contact.name, '(ID:', contact.id, ')');
    console.log('[Chat] Conecta aquí la carga de mensajes.');

    // Placeholder: limpiar mensajes anteriores
    const existingMessages = messagesArea.querySelectorAll('.message');
    existingMessages.forEach(m => m.remove());

    // Cerrar sidebar en móvil
    closeSidebar();
}

/** Renderiza mensajes en el área de chat */
function renderMessages(messages) {
    // Eliminar mensajes existentes (excepto emptyState)
    const existing = messagesArea.querySelectorAll('.message');
    existing.forEach(m => m.remove());

    if (!messages || messages.length === 0) {
        emptyState.style.display = 'flex';
        emptyState.querySelector('h3').textContent = 'Sin mensajes aún';
        emptyState.querySelector('p').textContent = 'Envía el primer mensaje cifrado.';
        return;
    }

    emptyState.style.display = 'none';
    messages.forEach(msg => {
        appendMessageToUI(msg);
    });
    scrollToBottom();
}

/** Añade un mensaje al UI */
function appendMessageToUI(msg) {
    const div = document.createElement('div');
    div.className = 'message ' + (msg.sentByMe ? 'sent' : 'received');
    div.innerHTML = `
                    ${msg.encrypted ? '<span class="msg-encrypted-tag"><i class="fa-solid fa-lock"></i> Descifrado</span>' : ''}
                    <span>${escapeHtml(msg.content)}</span>
                    <div class="msg-time">
                        ${msg.time || ''}
                        ${msg.sentByMe ? '<i class="fa-solid fa-check-double"></i>' : ''}
                    </div>
                `;
    messagesArea.appendChild(div);
}

/** Envía un mensaje */
function sendMessage() {
    const content = messageInput.value.trim();
    if (!content || !activeChatId) return;

    // --- AQUÍ CONECTAS CON TU BACKEND ---
    // fetch('/api/messages/send', {
    //     method: 'POST',
    //     headers: {
    //         'Content-Type': 'application/json',
    //         'Authorization': 'Bearer ' + token
    //     },
    //     body: JSON.stringify({
    //         receiverId: activeChatId,
    //         content: content
    //     })
    // })
    // .then(res => res.json())
    // .then(data => {
    //     if (data.success) {
    //         appendMessageToUI({
    //             content: content,
    //             sentByMe: true,
    //             time: new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}),
    //             encrypted: true
    //         });
    //         messageInput.value = '';
    //         messageInput.style.height = '44px';
    //         scrollToBottom();
    //     }
    // });

    console.log('[Chat] Enviar mensaje a', activeChatId, ':', content);
    console.log('[Chat] Conecta aquí el endpoint de envío.');

    // Placeholder visual (quitar al conectar backend):
    appendMessageToUI({
        content: content,
        sentByMe: true,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        encrypted: true
    });
    messageInput.value = '';
    messageInput.style.height = '44px';
    scrollToBottom();
}

function scrollToBottom() {
    messagesArea.scrollTop = messagesArea.scrollHeight;
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// --- Sidebar responsive ---
function openSidebar() {
    sidebar.classList.add('open');
    sidebarOverlay.classList.add('active');
}

function closeSidebar() {
    sidebar.classList.remove('open');
    sidebarOverlay.classList.remove('active');
}

// --- Event Listeners ---

btnBack.addEventListener('click', () => {
    activeChatId = null;
    activeChatName.textContent = 'Selecciona un chat';
    activeChatStatus.textContent = '';
    encryptionIndicator.style.display = 'none';
    messageInput.disabled = true;
    btnSend.disabled = true;
    emptyState.style.display = 'flex';
    emptyState.querySelector('h3').textContent = 'Mensajería Cifrada';
    emptyState.querySelector('p').textContent =
        'Selecciona una conversación para comenzar. Todos los mensajes viajan cifrados de extremo a extremo.';
    document.querySelectorAll('.chat-list-item').forEach(el => el.classList.remove('active'));
    const existing = messagesArea.querySelectorAll('.message');
    existing.forEach(m => m.remove());
    openSidebar();
});

sidebarOverlay.addEventListener('click', closeSidebar);

btnSend.addEventListener('click', sendMessage);

messageInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

// Auto-resize textarea
messageInput.addEventListener('input', function () {
    this.style.height = '44px';
    this.style.height = Math.min(this.scrollHeight, 100) + 'px';
});

searchChat.addEventListener('input', function () {
    renderChatList(this.value);
});

// Logout
btnLogout.addEventListener('click', function () {
    // --- AQUÍ CONECTAS CON TU BACKEND ---
    // fetch('/api/auth/logout', { method: 'POST' })
    //     .then(() => window.location.href = 'login.html');
    console.log('[Chat] Logout - conecta tu endpoint.');
    window.location.href = 'login.html';
});

btnSettings.addEventListener('click', function () {
    console.log('[Chat] Abrir configuración/perfil.');
    // Podrías redirigir a una página de perfil o abrir un modal
});

btnContactInfo.addEventListener('click', function () {
    if (activeChatId) {
        console.log('[Chat] Ver información del contacto:', activeChatId);
        // Podrías mostrar un modal con info del contacto
    }
});

// --- Inicialización ---
function init() {
    // --- AQUÍ CONECTAS CON TU BACKEND ---
    // Verificar autenticación y cargar datos del usuario:
    //
    // fetch('/api/auth/me', {
    //     headers: { 'Authorization': 'Bearer ' + token }
    // })
    // .then(res => {
    //     if (res.status === 401) window.location.href = 'login.html';
    //     return res.json();
    // })
    // .then(data => {
    //     currentUser = data.user;
    //     currentUserName.textContent = currentUser.name;
    //     currentUserInitials.textContent = currentUser.initials;
    //     if (!currentUser.isApproved) {
    //         window.location.href = 'pending-approval.html';
    //         return;
    //     }
    //     loadContacts();
    // });

    console.log('[Chat] Inicializando - verifica autenticación y carga datos del usuario.');
    console.log('[Chat] Conecta tu endpoint /api/auth/me aquí.');
    loadContacts();
}

init();