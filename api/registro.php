<?php
require 'db.php';
header('Content-Type: application/json');

$data = json_decode(file_get_contents('php://input'), true);

if (!isset($data['nombre']) || !isset($data['llave_publica']) || !isset($data['boveda_cifrada']) || !isset($data['alias_publico'])) {
    echo json_encode(['error' => 'Faltan datos']);
    exit;
}

$nombre = strtolower(trim($data['nombre']));
$alias_publico = trim($data['alias_publico']);
$llave_publica = trim($data['llave_publica']);
$boveda_cifrada = trim($data['boveda_cifrada']);

// Validar longitud máxima para prevenir DoS
if (strlen($nombre) > 50 || strlen($alias_publico) > 50 || strlen($llave_publica) > 2000 || strlen($boveda_cifrada) > 4000) {
    echo json_encode(['error' => 'Datos demasiado largos']);
    exit;
}

// Validar formato del nombre (solo letras, números, guiones bajos)
if (!preg_match('/^[a-z0-9_]+$/', $nombre)) {
    echo json_encode(['error' => 'El nombre de usuario solo puede contener letras, números y guiones bajos']);
    exit;
}

// Sanitizar alias para prevenir XSS almacenado
$alias_publico = htmlspecialchars($alias_publico, ENT_QUOTES, 'UTF-8');

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

    $stmt_sesion = $pdo->prepare("INSERT INTO sesiones (usuario_id, token_sesion, dispositivo, ip) VALUES (?, ?, ?, ?)");
    $stmt_sesion->execute([$nuevo_id, $token_sesion, $dispositivo, $ip]);

    $pdo->commit();
    echo json_encode(['success' => true, 'id' => $nuevo_id, 'rol' => $rol, 'token_sesion' => $token_sesion]);
} catch (Exception $e) {
    $pdo->rollBack();
    echo json_encode(['error' => $e->getMessage()]);
}
?>
