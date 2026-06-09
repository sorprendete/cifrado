<?php
require 'db.php';
require 'auth.php';
header('Content-Type: application/json');

$data = json_decode(file_get_contents('php://input'), true);

if (!isset($data['de_usuario_id']) || !isset($data['para_usuario_id']) || !isset($data['payload_cifrado'])) {
    echo json_encode(['error' => 'Datos incompletos']);
    exit;
}

$de = (int)$data['de_usuario_id']; // En Sealed Sender será 0 (anónimo) o el id del remitente (si es copia personal)
$para = (int)$data['para_usuario_id'];
$payload = trim($data['payload_cifrado']);
$token_sesion = $data['token_sesion'] ?? null;
$auth_usuario_id = isset($data['auth_usuario_id']) ? (int)$data['auth_usuario_id'] : $de;

if (strlen($payload) > 60000) {
    echo json_encode(['error' => 'El mensaje cifrado es demasiado grande. Límite excedido.']);
    exit;
}

// 1. Mitigación DoS: Máximo 10 mensajes cada 10 segundos
if (!check_rate_limit($pdo, 'enviar_msg_' . $auth_usuario_id, 10, 10)) {
    http_response_code(429);
    echo json_encode(['error' => 'Demasiados mensajes enviados. Por favor espera unos segundos.']);
    exit;
}

// Validamos la sesión con el ID real del usuario (no con el remitente ofuscado/anónimo)
validar_sesion($auth_usuario_id, $token_sesion, $pdo);

try {
    $stmt = $pdo->prepare("INSERT INTO mensajes (de_usuario_id, para_usuario_id, payload_cifrado) VALUES (?, ?, ?)");
    $stmt->execute([$de, $para, $payload]);
    
    // Si viene una copia personal (para el historial del remitente)
    if (isset($data['payload_propio']) && $auth_usuario_id > 0) {
        $payload_propio = trim($data['payload_propio']);
        $stmt_propio = $pdo->prepare("INSERT INTO mensajes (de_usuario_id, para_usuario_id, payload_cifrado) VALUES (?, ?, ?)");
        $stmt_propio->execute([$auth_usuario_id, $auth_usuario_id, $payload_propio]);
    }
    
    $nuevo_id = $pdo->lastInsertId();
    echo json_encode(['success' => true, 'id' => $nuevo_id]);
} catch (PDOException $e) {
    echo json_encode(['error' => $e->getMessage()]);
}
?>
