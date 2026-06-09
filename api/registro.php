<?php
require 'db.php';
header('Content-Type: application/json');

// Bloquear registros abusivos: Máximo 5 registros por hora por IP
if (!check_rate_limit($pdo, 'registro', 5, 3600)) {
    http_response_code(429);
    echo json_encode(['error' => 'Demasiados registros desde esta IP. Intenta más tarde.']);
    exit;
}

$data = json_decode(file_get_contents('php://input'), true);

if (!isset($data['nombre']) || !isset($data['llave_publica']) || !isset($data['boveda_cifrada']) || !isset($data['alias_publico'])) {
    echo json_encode(['error' => 'Faltan datos']);
    exit;
}

$nombre = trim($data['nombre']);
$alias_publico = trim($data['alias_publico']);
$llave_publica = trim($data['llave_publica']);
$boveda_cifrada = trim($data['boveda_cifrada']);

// Validación estricta para evitar choques con el cliente antiguo (Diffie-Hellman en Caché)
if (strpos($llave_publica, ',') === false) {
    echo json_encode(['error' => 'VECTORES_REQUERIDOS: Tu navegador tiene guardada una versión antigua de la aplicación. Por favor presiona Ctrl + F5 para limpiar la memoria caché y recargar el nuevo sistema vectorial.']);
    exit;
}

// Si el primer usuario es registrado, hacerlo admin
$stmt_count = $pdo->query("SELECT COUNT(*) FROM usuarios");
$count = $stmt_count->fetchColumn();
$rol = ($count == 0) ? 'admin' : 'usuario';

try {
    $pdo->beginTransaction();

    $token_sesion = bin2hex(random_bytes(32));

    $stmt = $pdo->prepare("INSERT INTO usuarios (nombre, alias_publico, llave_publica, boveda_cifrada, rol) VALUES (?, ?, ?, ?, ?)");
    $stmt->execute([$nombre, $alias_publico, $llave_publica, $boveda_cifrada, $rol]);
    $nuevo_id = $pdo->lastInsertId();

    $dispositivo = isset($_SERVER['HTTP_USER_AGENT']) ? substr($_SERVER['HTTP_USER_AGENT'], 0, 250) : 'Desconocido';
    $ip = isset($_SERVER['REMOTE_ADDR']) ? $_SERVER['REMOTE_ADDR'] : '0.0.0.0';

    $ip_hash = hash('sha256', $ip);
    $stmt_sesion = $pdo->prepare("INSERT INTO sesiones (usuario_id, token_sesion, dispositivo, ip) VALUES (?, ?, ?, ?)");
    $stmt_sesion->execute([$nuevo_id, $token_sesion, $dispositivo, $ip_hash]);

    $pdo->commit();
    echo json_encode(['success' => true, 'id' => $nuevo_id, 'rol' => $rol, 'token_sesion' => $token_sesion]);
} catch (Exception $e) {
    $pdo->rollBack();
    echo json_encode(['error' => $e->getMessage()]);
}
?>
