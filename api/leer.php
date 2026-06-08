<?php
require 'db.php';
require 'auth.php';
header('Content-Type: application/json');

$usuario_id = $_GET['usuario_id'] ?? null;
$token_sesion = $_GET['token_sesion'] ?? null;

if (!$usuario_id) {
    echo json_encode(['error' => 'Falta usuario_id']);
    exit;
}

validar_sesion($usuario_id, $token_sesion, $pdo);

try {
    $stmt = $pdo->prepare("
        SELECT id, de_usuario_id, payload_cifrado, creado_en 
        FROM mensajes 
        WHERE para_usuario_id = ? AND entregado = 0
    ");
    $stmt->execute([ofuscar_id($usuario_id)]);
    $mensajes = $stmt->fetchAll();

    if (count($mensajes) > 0) {
        $ids = array_column($mensajes, 'id');
        $placeholders = str_repeat('?,', count($ids) - 1) . '?';
        $updateStmt = $pdo->prepare("UPDATE mensajes SET entregado = 1 WHERE id IN ($placeholders)");
        $updateStmt->execute($ids);
    }

    foreach ($mensajes as &$msg) {
        $msg['de_usuario_id'] = desofuscar_id_dinamico($msg['de_usuario_id']);
    }

    echo json_encode(['success' => true, 'mensajes' => $mensajes]);
} catch (PDOException $e) {
    echo json_encode(['error' => $e->getMessage()]);
}
?>
