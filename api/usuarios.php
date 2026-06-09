<?php
require 'db.php';
require 'auth.php';
header('Content-Type: application/json');

$usuario_id = $_GET['usuario_id'] ?? null;
$token_sesion = $_GET['token_sesion'] ?? null;

// Proteger el listado de usuarios con autenticaci\u00f3n obligatoria
if (!$usuario_id) {
    echo json_encode(['error' => 'No autenticado']);
    exit;
}
validar_sesion($usuario_id, $token_sesion, $pdo);

try {
    if ($usuario_id) {
        $usuario_id = (int)$usuario_id;
        // Obtener todos los usuarios activos
        $stmt_act = $pdo->query("SELECT id, nombre, alias_publico, llave_publica, rol, eliminado FROM usuarios WHERE eliminado = 0");
        $activos = $stmt_act->fetchAll();
        $activos_ids = array_column($activos, 'id');
        
        // Obtener mensajes donde el usuario es el destinatario (para buscar remitentes de cuentas que quizás se eliminaron)
        $stmt_msg = $pdo->prepare("SELECT de_usuario_id FROM mensajes WHERE para_usuario_id = ?");
        $stmt_msg->execute([ofuscar_id($usuario_id)]);
        $mensajes_recibidos = $stmt_msg->fetchAll();
        
        $chat_ids = [];
        foreach ($mensajes_recibidos as $msg) {
            $sender = desofuscar_id_dinamico($msg['de_usuario_id']);
            if ($sender > 0 && !in_array($sender, $activos_ids)) {
                $chat_ids[] = $sender;
            }
        }
        
        // Si hay IDs con los que conversamos pero están eliminados, los cargamos
        if (count($chat_ids) > 0) {
            $chat_ids = array_unique($chat_ids);
            $in  = str_repeat('?,', count($chat_ids) - 1) . '?';
            $stmt_del = $pdo->prepare("SELECT id, nombre, alias_publico, llave_publica, rol, eliminado FROM usuarios WHERE id IN ($in)");
            $stmt_del->execute($chat_ids);
            $eliminados_chateados = $stmt_del->fetchAll();
            $usuarios = array_merge($activos, $eliminados_chateados);
        } else {
            $usuarios = $activos;
        }
        
        // Ordenar alfabéticamente por nombre
        usort($usuarios, function($a, $b) {
            return strcmp($a['nombre'], $b['nombre']);
        });
    } else {
        $stmt = $pdo->query("SELECT id, nombre, alias_publico, llave_publica, rol, eliminado FROM usuarios WHERE eliminado = 0 ORDER BY nombre ASC");
        $usuarios = $stmt->fetchAll();
    }
    echo json_encode(['success' => true, 'usuarios' => $usuarios]);
} catch (PDOException $e) {
    echo json_encode(['error' => $e->getMessage()]);
}
?>
