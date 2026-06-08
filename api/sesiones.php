<?php
require 'db.php';
require 'auth.php';
header('Content-Type: application/json');

$method = $_SERVER['REQUEST_METHOD'];
$data = json_decode(file_get_contents('php://input'), true);

if ($method === 'POST') {
    $action = $data['action'] ?? null;
    $usuario_id = $data['usuario_id'] ?? null;
    $token_sesion = $data['token_sesion'] ?? null;

    if (!$usuario_id) {
        echo json_encode(['error' => 'Falta usuario_id']);
        exit;
    }

    validar_sesion($usuario_id, $token_sesion, $pdo);


    if ($action === 'list') {
        try {
            $stmt = $pdo->prepare("SELECT id, dispositivo, ip, creado_en, ultimo_acceso, token_sesion FROM sesiones WHERE usuario_id = ? ORDER BY ultimo_acceso DESC");
            $stmt->execute([$usuario_id]);
            $sesiones = $stmt->fetchAll();
            echo json_encode(['success' => true, 'sesiones' => $sesiones]);
        } catch (PDOException $e) {
            echo json_encode(['error' => $e->getMessage()]);
        }
    } elseif ($action === 'revoke') {
        $sesion_id = $data['sesion_id'] ?? null;
        if (!$sesion_id) {
            echo json_encode(['error' => 'Falta sesion_id']);
            exit;
        }

        try {
            $stmt = $pdo->prepare("DELETE FROM sesiones WHERE id = ? AND usuario_id = ?");
            $stmt->execute([$sesion_id, $usuario_id]);
            echo json_encode(['success' => true]);
        } catch (PDOException $e) {
            echo json_encode(['error' => $e->getMessage()]);
        }
    } else {
        echo json_encode(['error' => 'Acción no válida']);
    }
} else {
    echo json_encode(['error' => 'Método no permitido']);
}
?>
