<?php
require 'db.php';
header('Content-Type: application/json');

$data = json_decode(file_get_contents('php://input'), true);

if (!isset($data['nombre']) || !isset($data['llave_publica'])) {
    echo json_encode(['error' => 'Faltan datos']);
    exit;
}

$nombre = trim($data['nombre']);
$llave_publica = trim($data['llave_publica']);

try {
    $stmt = $pdo->prepare("SELECT id, alias_publico, boveda_cifrada, rol, llave_publica as db_llave FROM usuarios WHERE nombre = ?");
    $stmt->execute([$nombre]);
    $user = $stmt->fetch();
    
    if ($user) {
        $token_sesion = bin2hex(random_bytes(32));
        
        $dispositivo = isset($_SERVER['HTTP_USER_AGENT']) ? substr($_SERVER['HTTP_USER_AGENT'], 0, 250) : 'Desconocido';
        $ip = isset($_SERVER['REMOTE_ADDR']) ? $_SERVER['REMOTE_ADDR'] : '0.0.0.0';

        $stmt_sesion = $pdo->prepare("INSERT INTO sesiones (usuario_id, token_sesion, dispositivo, ip) VALUES (?, ?, ?, ?)");
        $stmt_sesion->execute([$user['id'], $token_sesion, $dispositivo, $ip]);

        echo json_encode([
            'success' => true, 
            'id' => $user['id'],
            'alias_publico' => $user['alias_publico'],
            'llave_publica' => $user['db_llave'],
            'boveda_cifrada' => $user['boveda_cifrada'],
            'rol' => $user['rol'],
            'token_sesion' => $token_sesion
        ]);
    } else {
        echo json_encode(['error' => 'Usuario no encontrado']);
    }
} catch (PDOException $e) {
    echo json_encode(['error' => $e->getMessage()]);
}
?>
