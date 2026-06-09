<?php
require 'db.php';
require 'auth.php';
header('Content-Type: application/json');

if (!isset($_GET['usuario_id']) || !isset($_GET['contacto_id'])) {
    echo json_encode(['error' => 'Parámetros incompletos']);
    exit;
}

$mi_id = (int)$_GET['usuario_id'];
$contacto_id = (int)$_GET['contacto_id'];
$token_sesion = $_GET['token_sesion'] ?? null;

validar_sesion($mi_id, $token_sesion, $pdo);


try {
    // Buscar historial completo usando IDs reales
    $stmt = $pdo->prepare("
        SELECT id, de_usuario_id, para_usuario_id, payload_cifrado, creado_en 
        FROM mensajes 
        WHERE (de_usuario_id = ? AND para_usuario_id = ?) 
           OR (de_usuario_id = ? AND para_usuario_id = ?)
        ORDER BY creado_en ASC
    ");
    $stmt->execute([$mi_id, $contacto_id, $contacto_id, $mi_id]);
    $todos_mensajes = $stmt->fetchAll();
    
    $mensajes = [];
    foreach ($todos_mensajes as $msg) {
        unset($msg['para_usuario_id']); // Mantener idéntico el esquema de salida esperado por la UI
        $mensajes[] = $msg;
    }
    
    // Marcar como entregados los que me enviaron a mí en este historial
    if (count($mensajes) > 0) {
        $ids_a_marcar = [];
        foreach ($mensajes as $msg) {
            if ($msg['de_usuario_id'] == $contacto_id) {
                $ids_a_marcar[] = $msg['id'];
            }
        }
        
        if (count($ids_a_marcar) > 0) {
            $in  = str_repeat('?,', count($ids_a_marcar) - 1) . '?';
            $stmt_update = $pdo->prepare("UPDATE mensajes SET entregado = 1 WHERE id IN ($in)");
            $stmt_update->execute($ids_a_marcar);
        }
    }
    
    echo json_encode(['success' => true, 'mensajes' => $mensajes]);
} catch (PDOException $e) {
    echo json_encode(['error' => $e->getMessage()]);
}
?>
