<?php
// api/borrar_mensaje.php
require 'db.php';
require 'auth.php';
header('Content-Type: application/json');

$data = json_decode(file_get_contents('php://input'), true);

if (!isset($data['usuario_id']) || !isset($data['token_sesion']) || !isset($data['mensaje_id'])) {
    echo json_encode(['error' => 'Datos incompletos']);
    exit;
}

$usuario_id = (int)$data['usuario_id'];
$token_sesion = trim($data['token_sesion']);
$mensaje_id = (int)$data['mensaje_id'];

// 1. Validar sesión
validar_sesion($usuario_id, $token_sesion, $pdo);

try {
    // 2. Buscar el mensaje y verificar pertenencia
    $stmt = $pdo->prepare("SELECT de_usuario_id, para_usuario_id FROM mensajes WHERE id = ?");
    $stmt->execute([$mensaje_id]);
    $msg = $stmt->fetch();
    
    // Si no existe, simulamos éxito para evitar enumeración (IDOR prevention)
    if (!$msg) {
        echo json_encode(['success' => true]);
        exit;
    }
    
    // Validar que el usuario que intenta borrar sea el emisor o el receptor
    $de_dec = (int)$msg['de_usuario_id'];
    $para_dec = (int)$msg['para_usuario_id'];
    
    // En Sealed Sender, 'de_usuario_id' es 0, así que el receptor (para_dec) o el remitente (si es su copia de_dec == auth_id) puede borrarlo.
    if ($de_dec != $usuario_id && $para_dec != $usuario_id) {
        // Simulamos éxito para evitar enumeración, pero no borramos nada
        echo json_encode(['success' => true]);
        exit;
    }
    
    // 3. Eliminar físicamente el mensaje
    $stmt_del = $pdo->prepare("DELETE FROM mensajes WHERE id = ?");
    $stmt_del->execute([$mensaje_id]);
    
    echo json_encode(['success' => true]);
} catch (PDOException $e) {
    // Errores de BD reales
    echo json_encode(['success' => true]); // Ocultar también errores internos
}
?>
