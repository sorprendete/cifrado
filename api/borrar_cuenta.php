<?php
require 'db.php';
header('Content-Type: application/json');

$data = json_decode(file_get_contents('php://input'), true);

if (!isset($data['id'])) {
    echo json_encode(['error' => 'Falta ID']);
    exit;
}

$id = (int)$data['id'];

try {
    // Soft Delete: Marcar como eliminado para conservar el historial E2EE
    $stmt = $pdo->prepare("UPDATE usuarios SET eliminado = 1 WHERE id = ?");
    $stmt->execute([$id]);
    
    echo json_encode(['success' => true]);
} catch (PDOException $e) {
    echo json_encode(['error' => $e->getMessage()]);
}
?>
