<?php
require 'db.php';
header('Content-Type: application/json');

$usuario_id = $_GET['usuario_id'] ?? null;
$token_sesion = $_GET['token_sesion'] ?? null;

if (!$usuario_id) {
    echo json_encode(['error' => 'Falta usuario_id']);
    exit;
}

try {
    // Validar token en la tabla sesiones
    if ($token_sesion) {
        $stmt_sesion = $pdo->prepare("SELECT id FROM sesiones WHERE usuario_id = ? AND token_sesion = ?");
        $stmt_sesion->execute([$usuario_id, $token_sesion]);
        if (!$stmt_sesion->fetch()) {
            echo json_encode(['error' => 'sesion_invalida']);
            exit;
        }
        
        // Opcional: Actualizar ultimo_acceso para saber si está online (se comenta para no saturar la DB, pero lo haremos cada cierto tiempo)
        // $pdo->prepare("UPDATE sesiones SET ultimo_acceso = CURRENT_TIMESTAMP WHERE token_sesion = ?")->execute([$token_sesion]);
    }

    $stmt = $pdo->prepare("
        SELECT id, de_usuario_id, payload_cifrado, creado_en 
        FROM mensajes 
        WHERE para_usuario_id = ? AND entregado = 0
    ");
    $stmt->execute([$usuario_id]);
    $mensajes = $stmt->fetchAll();

    if (count($mensajes) > 0) {
        $ids = array_column($mensajes, 'id');
        $placeholders = str_repeat('?,', count($ids) - 1) . '?';
        $updateStmt = $pdo->prepare("UPDATE mensajes SET entregado = 1 WHERE id IN ($placeholders)");
        $updateStmt->execute($ids);
    }

    echo json_encode(['success' => true, 'mensajes' => $mensajes]);
} catch (PDOException $e) {
    echo json_encode(['error' => $e->getMessage()]);
}
?>
