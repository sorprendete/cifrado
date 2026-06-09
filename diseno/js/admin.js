
// =============================================
// ESTRUCTURA PARA CONEXIÓN CON BACKEND
// =============================================
// Panel de administración para aprobar/rechazar usuarios.
// Conecta los endpoints correspondientes.

// --- Estado ---
let allUsers = []; // Array de usuarios: { id, name, email, initials, avatarColor, status, registeredAt }
let currentTab = 'pending';

// --- Referencias DOM ---
const usersTableBody = document.getElementById('usersTableBody');
const emptyTableMsg = document.getElementById('emptyTableMsg');
const statPending = document.getElementById('statPending');
const statApproved = document.getElementById('statApproved');
const statRejected = document.getElementById('statRejected');
const statTotal = document.getElementById('statTotal');
const toastContainer = document.getElementById('toastContainer');
const tabButtons = document.querySelectorAll('.tab-btn');

const avatarColors = [
    'linear-gradient(135deg, #1a4a6e, #0d3050)',
    'linear-gradient(135deg, #4a1a6e, #300d50)',
    'linear-gradient(135deg, #1a6e4a, #0d5030)',
    'linear-gradient(135deg, #6e4a1a, #50300d)',
    'linear-gradient(135deg, #6e1a4a, #500d30)',
    'linear-gradient(135deg, #1a6e6e, #0d5050)',
    'linear-gradient(135deg, #4a4a6e, #303050)',
];

// --- Funciones ---

function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = 'toast toast-' + type;
    toast.innerHTML =
        `<i class="fa-solid fa-${type === 'success' ? 'circle-check' : 'circle-exclamation'}"></i> ${message}`;
    toastContainer.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(20px)';
        toast.style.transition = 'all 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 2800);
}

function updateStats() {
    const pending = allUsers.filter(u => u.status === 'pending').length;
    const approved = allUsers.filter(u => u.status === 'approved').length;
    const rejected = allUsers.filter(u => u.status === 'rejected').length;
    statPending.textContent = pending;
    statApproved.textContent = approved;
    statRejected.textContent = rejected;
    statTotal.textContent = allUsers.length;
}

function renderTable() {
    let filtered;
    switch (currentTab) {
        case 'pending':
            filtered = allUsers.filter(u => u.status === 'pending');
            break;
        case 'approved':
            filtered = allUsers.filter(u => u.status === 'approved');
            break;
        case 'rejected':
            filtered = allUsers.filter(u => u.status === 'rejected');
            break;
        default:
            filtered = [...allUsers];
    }

    usersTableBody.innerHTML = '';

    if (filtered.length === 0) {
        emptyTableMsg.style.display = 'block';
        usersTableBody.innerHTML = '';
    } else {
        emptyTableMsg.style.display = 'none';
        filtered.forEach(user => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                            <td>
                                <div class="user-cell">
                                    <div class="mini-avatar" style="background:${user.avatarColor || avatarColors[0]};">
                                        ${user.initials}
                                    </div>
                                    <span>${escapeHtml(user.name)}</span>
                                </div>
                            </td>
                            <td>${escapeHtml(user.email)}</td>
                            <td>${user.registeredAt || '—'}</td>
                            <td>
                                <span class="status-badge status-${user.status}">
                                    <i class="fa-solid fa-${user.status === 'pending' ? 'clock' : user.status === 'approved' ? 'check' : 'xmark'}"></i>
                                    ${user.status === 'pending' ? 'Pendiente' : user.status === 'approved' ? 'Aprobado' : 'Rechazado'}
                                </span>
                            </td>
                            <td>
                                <div class="actions-cell">
                                    ${user.status === 'pending' ? `
                                        <button class="btn btn-sm btn-approve" data-action="approve" data-user-id="${user.id}">
                                            <i class="fa-solid fa-check"></i> Aprobar
                                        </button>
                                        <button class="btn btn-sm btn-reject" data-action="reject" data-user-id="${user.id}">
                                            <i class="fa-solid fa-xmark"></i> Rechazar
                                        </button>
                                    ` : `
                                        <button class="btn btn-sm" data-action="reset" data-user-id="${user.id}" title="Volver a pendiente">
                                            <i class="fa-solid fa-rotate-left"></i> Restablecer
                                        </button>
                                    `}
                                </div>
                            </td>
                        `;
            usersTableBody.appendChild(tr);
        });

        // Event listeners para botones de acción
        usersTableBody.querySelectorAll('button[data-action]').forEach(btn => {
            btn.addEventListener('click', function () {
                const action = this.dataset.action;
                const userId = parseInt(this.dataset.userId);
                handleUserAction(userId, action);
            });
        });
    }

    updateStats();
}

function handleUserAction(userId, action) {
    const user = allUsers.find(u => u.id === userId);
    if (!user) return;

    // --- AQUÍ CONECTAS CON TU BACKEND ---
    // const endpoint = action === 'approve' ? '/api/admin/approve' :
    //                  action === 'reject' ? '/api/admin/reject' :
    //                  '/api/admin/reset';
    //
    // fetch(endpoint, {
    //     method: 'POST',
    //     headers: {
    //         'Content-Type': 'application/json',
    //         'Authorization': 'Bearer ' + adminToken
    //     },
    //     body: JSON.stringify({ userId })
    // })
    // .then(res => res.json())
    // .then(data => {
    //     if (data.success) {
    //         if (action === 'approve') user.status = 'approved';
    //         else if (action === 'reject') user.status = 'rejected';
    //         else if (action === 'reset') user.status = 'pending';
    //         renderTable();
    //         showToast(data.message || 'Acción realizada con éxito.', 'success');
    //     } else {
    //         showToast(data.message || 'Error al procesar.', 'error');
    //     }
    // })
    // .catch(() => showToast('Error de conexión.', 'error'));

    // Placeholder (quitar al conectar backend):
    console.log(`[Admin] Acción: ${action} | Usuario ID: ${userId} | Nombre: ${user.name}`);
    if (action === 'approve') user.status = 'approved';
    else if (action === 'reject') user.status = 'rejected';
    else if (action === 'reset') user.status = 'pending';
    renderTable();
    const messages = {
        approve: `Usuario "${user.name}" aprobado.`,
        reject: `Usuario "${user.name}" rechazado.`,
        reset: `Usuario "${user.name}" restablecido a pendiente.`
    };
    showToast(messages[action] || 'Acción realizada.', action === 'reject' ? 'error' : 'success');
    console.log('[Admin] Conecta aquí tus endpoints de administración.');
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// --- Tabs ---
tabButtons.forEach(btn => {
    btn.addEventListener('click', function () {
        tabButtons.forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        currentTab = this.dataset.tab;
        renderTable();
    });
});

// --- Carga inicial de usuarios ---
function loadUsers() {
    // --- AQUÍ CONECTAS CON TU BACKEND ---
    // fetch('/api/admin/users', {
    //     headers: { 'Authorization': 'Bearer ' + adminToken }
    // })
    // .then(res => {
    //     if (res.status === 401 || res.status === 403) {
    //         window.location.href = 'login.html';
    //         return;
    //     }
    //     return res.json();
    // })
    // .then(data => {
    //     allUsers = data.users.map(u => ({
    //         ...u,
    //         initials: u.name.split(' ').map(n => n[0]).join('').substring(0,2).toUpperCase(),
    //         avatarColor: avatarColors[Math.floor(Math.random() * avatarColors.length)]
    //     }));
    //     renderTable();
    // })
    // .catch(err => console.error('Error cargando usuarios:', err));

    console.log('[Admin] Cargar lista de usuarios - conecta tu endpoint aquí.');
    // Placeholder: datos de ejemplo (quitar al conectar backend)
    allUsers = [
        {
            id: 1, name: 'María García', email: 'maria@email.com', initials: 'MG', avatarColor: avatarColors[0],
            status: 'pending', registeredAt: '2026-06-08'
        },
        {
            id: 2, name: 'Carlos López', email: 'carlos@email.com', initials: 'CL', avatarColor: avatarColors[1],
            status: 'pending', registeredAt: '2026-06-07'
        },
        {
            id: 3, name: 'Ana Martínez', email: 'ana@email.com', initials: 'AM', avatarColor: avatarColors[2],
            status: 'approved', registeredAt: '2026-06-05'
        },
        {
            id: 4, name: 'Pedro Ruiz', email: 'pedro@email.com', initials: 'PR', avatarColor: avatarColors[3],
            status: 'rejected', registeredAt: '2026-06-04'
        },
    ];
    renderTable();
    console.log(
        '[Admin] Datos de ejemplo cargados. Sustitúyelos con la respuesta de tu API /api/admin/users.');
}

// Logout admin
document.getElementById('btnLogoutAdmin').addEventListener('click', function (e) {
    e.preventDefault();
    // --- AQUÍ CONECTAS CON TU BACKEND ---
    // fetch('/api/auth/logout', { method: 'POST' })
    //     .then(() => window.location.href = 'login.html');
    console.log('[Admin] Logout.');
    window.location.href = 'login.html';
});

// Inicializar
loadUsers();