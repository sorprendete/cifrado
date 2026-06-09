<?php
// api/auth.php

function validar_sesion($usuario_id, $token_sesion, $pdo) {
    if (empty($usuario_id) || empty($token_sesion)) {
        header('Content-Type: application/json');
        echo json_encode(['error' => 'sesion_invalida', 'details' => 'Credenciales de sesion faltantes']);
        exit;
    }

    try {
        $stmt = $pdo->prepare("SELECT id FROM sesiones WHERE usuario_id = ? AND token_sesion = ?");
        $stmt->execute([(int)$usuario_id, trim($token_sesion)]);
        $sesion = $stmt->fetch();
        
        if (!$sesion) {
            header('Content-Type: application/json');
            echo json_encode(['error' => 'sesion_invalida']);
            exit;
        }
        
        // Actualizar ultimo_acceso de forma automatica
        $stmt_update = $pdo->prepare("UPDATE sesiones SET ultimo_acceso = CURRENT_TIMESTAMP WHERE token_sesion = ?");
        $stmt_update->execute([trim($token_sesion)]);
        
        return true;
    } catch (PDOException $e) {
        header('Content-Type: application/json');
        echo json_encode(['error' => 'db_error', 'details' => $e->getMessage()]);
        exit;
    }
}
?>
