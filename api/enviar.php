<?php
require 'db.php';
require 'auth.php';
header('Content-Type: application/json');

$data = json_decode(file_get_contents('php://input'), true);

if (!isset($data['de_usuario_id']) || !isset($data['para_usuario_id']) || !isset($data['payload_cifrado'])) {
    echo json_encode(['error' => 'Datos incompletos']);
    exit;
}

$de = (int)$data['de_usuario_id'];
$para = (int)$data['para_usuario_id'];
$payload = trim($data['payload_cifrado']);
$token_sesion = $data['token_sesion'] ?? null;

validar_sesion($de, $token_sesion, $pdo);


try {
    $stmt = $pdo->prepare("INSERT INTO mensajes (de_usuario_id, para_usuario_id, payload_cifrado) VALUES (?, ?, ?)");
    $stmt->execute([ofuscar_id_dinamico($de), ofuscar_id($para), $payload]);
    
    $nuevo_id = $pdo->lastInsertId();
    echo json_encode(['success' => true, 'id' => $nuevo_id]);
} catch (PDOException $e) {
    echo json_encode(['error' => $e->getMessage()]);
}
?>
