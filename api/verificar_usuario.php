<?php
require 'db.php';
header('Content-Type: application/json');

$nombre = trim(strtolower($_GET['nombre'] ?? ''));

// Validar longitud y formato para prevenir enumeraci\u00f3n masiva (fuzzing)
if (empty($nombre) || strlen($nombre) > 50 || !preg_match('/^[a-z0-9_]+$/', $nombre)) {
    echo json_encode(['success' => true, 'existe' => false]);
    exit;
}

try {
    $stmt = $pdo->prepare("SELECT COUNT(*) FROM usuarios WHERE nombre = ? AND eliminado = 0");
    $stmt->execute([$nombre]);
    $existe = $stmt->fetchColumn() > 0;
    
    echo json_encode(['success' => true, 'existe' => $existe]);
} catch (Exception $e) {
    echo json_encode(['error' => $e->getMessage()]);
}
?>
