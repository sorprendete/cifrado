
// --- LÓGICA DE AUTODESTRUCCIÓN ---
const btnDeleteAccount = document.getElementById('btn-delete-account');

if (btnDeleteAccount) {
    btnDeleteAccount.addEventListener('click', async () => {
        const confirm1 = confirm("⚠️ ¿ESTÁS SEGURO? Al eliminar tu cuenta se borrarán permanentemente todos tus mensajes y no podrás recuperar nada.");
        if (!confirm1) return;
        
        const confirm2 = confirm("ESTA ACCIÓN NO SE PUEDE DESHACER. ¿Eliminar definitivamente la cuenta?");
        if (!confirm2) return;
        
        btnDeleteAccount.disabled = true;
        btnDeleteAccount.innerText = "Destruyendo bóveda...";
        
        try {
            const response = await fetch('api/borrar_cuenta.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: currentUser.id })
            });
            const result = await response.json();
            
            if (result.success) {
                alert('Tu bóveda ha sido destruida matemáticamente de los servidores.');
                localStorage.removeItem('e2ee_identity');
                window.location.href = 'index.html';
            } else {
                alert('Error al destruir cuenta: ' + result.error);
                btnDeleteAccount.disabled = false;
                btnDeleteAccount.innerText = "⚠️ Eliminar Mi Cuenta Permanentemente";
            }
        } catch (e) {
            alert('Error de conexión');
            btnDeleteAccount.disabled = false;
            btnDeleteAccount.innerText = "⚠️ Eliminar Mi Cuenta Permanentemente";
        }
    });
}
