<?php
require 'db.php';
header('Content-Type: application/json');

$usuario_id = $_GET['usuario_id'] ?? null;

try {
    if ($usuario_id) {
        // Fetch active users PLUS deleted users that the current user has chatted with
        $stmt = $pdo->prepare("
            SELECT DISTINCT u.id, u.nombre, u.alias_publico, u.llave_publica, u.rol, u.eliminado 
            FROM usuarios u
            LEFT JOIN mensajes m ON (m.de_usuario_id = u.id AND m.para_usuario_id = ?) OR (m.para_usuario_id = u.id AND m.de_usuario_id = ?)
            WHERE u.eliminado = 0 OR m.id IS NOT NULL
            ORDER BY u.nombre ASC
        ");
        $stmt->execute([$usuario_id, $usuario_id]);
    } else {
        $stmt = $pdo->query("SELECT id, nombre, alias_publico, llave_publica, rol, eliminado FROM usuarios WHERE eliminado = 0 ORDER BY nombre ASC");
    }
    $usuarios = $stmt->fetchAll();
    echo json_encode(['success' => true, 'usuarios' => $usuarios]);
} catch (PDOException $e) {
    echo json_encode(['error' => $e->getMessage()]);
}
?>
