

// --- Obtener email de la URL (opcional, pasado desde register) ---
const params = new URLSearchParams(window.location.search);
const emailFromUrl = params.get('email');
const emailDisplay = document.getElementById('userEmail');

if (emailFromUrl) {
    emailDisplay.textContent = emailFromUrl;
} else {
    // Si no hay email en URL, mostrar placeholder genérico
    emailDisplay.textContent = 'Tu correo registrado';
}

// --- AQUÍ CONECTAS CON TU BACKEND ---
// Podrías hacer polling para verificar si el usuario ya fue aprobado:
//
// const checkApproval = setInterval(() => {
//     fetch('/api/auth/status?email=' + encodeURIComponent(emailFromUrl))
//         .then(res => res.json())
//         .then(data => {
//             if (data.approved) {
//                 clearInterval(checkApproval);
//                 window.location.href = 'chat.html';
//             }
//         });
// }, 5000); // Cada 5 segundos

console.log('[PendingApproval] Email:', emailFromUrl || 'No especificado');
console.log('[PendingApproval] Conecta aquí la verificación de estado de aprobación.');