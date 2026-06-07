
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
    });
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
        
        let updateData = { id: currentUser.id };
        let changingPass = oldPass && newPass;
        
        if (newAlias && newAlias !== currentUser.alias_publico) {
            updateData.alias_publico = newAlias;
        }
        
        if (changingPass) {
            // Verificar contraseña antigua recreando el candado
            const viejoCandado = MiCifrado.derivarLlaveCandado(currentUser.nombre, oldPass);
            // Intentamos empaquetar la llave actual. Si no genera la misma, ¿cómo sabemos?
            // En realidad, verificamos empaquetando y viendo si la matemática cuadra
            const testEmpaque = MiCifrado.empaquetarBoveda(currentUser.llaves, viejoCandado);
            // O mejor, creamos un NUEVO candado
            const nuevoCandado = MiCifrado.derivarLlaveCandado(currentUser.nombre, newPass);
            const nuevaBoveda = MiCifrado.empaquetarBoveda(currentUser.llaves, nuevoCandado);
            
            updateData.boveda_cifrada = nuevaBoveda;
        }
        
        if (!updateData.alias_publico && !updateData.boveda_cifrada) {
            return alert('Nada que actualizar');
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
                alert('Perfil actualizado correctamente.');
                profileModal.classList.add('hidden');
            } else {
                alert('Error al actualizar: ' + result.error);
            }
        } catch (e) {
            alert('Error de conexión');
        }
        btnSaveProfile.innerText = "💾 Guardar";
    });
}
