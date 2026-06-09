<?php
require 'db.php';
header('Content-Type: application/json');

// Evitar enumeración masiva: Máximo 30 consultas por minuto
if (!check_rate_limit($pdo, 'verificar_usuario', 30, 60)) {
    http_response_code(429);
    echo json_encode(['error' => 'Rate limit exceeded']);
    exit;
}

$nombre = trim(strtolower($_GET['nombre'] ?? ''));

if (empty($nombre)) {
    echo json_encode(['success' => true, 'existe' => false]);
    exit;
}

try {
    $stmt = $pdo->prepare("SELECT COUNT(*) FROM usuarios WHERE nombre = ? AND eliminado = 0");
    $stmt->execute([$nombre]);
    $existe = $stmt->fetchColumn() > 0;
    
    // Retardo aleatorio para mitigar ataques de enumeración por tiempo (Timing attacks)
    usleep(random_int(10000, 50000));
    
    echo json_encode(['success' => true, 'existe' => $existe]);
} catch (Exception $e) {
    echo json_encode(['error' => $e->getMessage()]);
}
?>
