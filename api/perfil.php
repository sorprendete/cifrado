<?php
require 'db.php';
header('Content-Type: application/json');

$data = json_decode(file_get_contents('php://input'), true);

if (!isset($data['id'])) {
    echo json_encode(['error' => 'ID no proporcionado']);
    exit;
}

$id = (int)$data['id'];

try {
    if (isset($data['alias_publico']) && !isset($data['boveda_cifrada'])) {
        // Solo actualizar alias
        $stmt = $pdo->prepare("UPDATE usuarios SET alias_publico = ? WHERE id = ?");
        $stmt->execute([trim($data['alias_publico']), $id]);
        echo json_encode(['success' => true]);
    } else if (isset($data['boveda_cifrada'])) {
        // Actualizar bóveda (y alias si viene)
        $alias = isset($data['alias_publico']) ? trim($data['alias_publico']) : null;
        if ($alias) {
            $stmt = $pdo->prepare("UPDATE usuarios SET alias_publico = ?, boveda_cifrada = ? WHERE id = ?");
            $stmt->execute([$alias, trim($data['boveda_cifrada']), $id]);
        } else {
            $stmt = $pdo->prepare("UPDATE usuarios SET boveda_cifrada = ? WHERE id = ?");
            $stmt->execute([trim($data['boveda_cifrada']), $id]);
        }
        echo json_encode(['success' => true]);
    } else {
        echo json_encode(['error' => 'Nada que actualizar']);
    }
} catch (PDOException $e) {
    echo json_encode(['error' => $e->getMessage()]);
}
?>
