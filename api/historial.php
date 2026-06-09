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
    // Sealed Sender: El servidor no sabe quién es el remitente ni a quién enviamos (si es nuestra copia).
    // Por lo tanto, el servidor simplemente devuelve todo el buzón del usuario (para_usuario_id = mi_id).
    // El filtrado y descifrado por contacto se hará criptográficamente en el cliente (JS).
    
    $stmt = $pdo->prepare("
        SELECT id, de_usuario_id, para_usuario_id, payload_cifrado, creado_en 
        FROM mensajes 
        WHERE para_usuario_id = ?
        ORDER BY creado_en ASC
    ");
    $stmt->execute([$mi_id]);
    $todos_mensajes = $stmt->fetchAll();
    
    $mensajes = [];
    foreach ($todos_mensajes as $msg) {
        // En Sealed Sender, no marcamos como entregado aquí porque el servidor no sabe si es del contacto.
        // La confirmación de lectura se tendría que manejar de otra forma, pero por ahora devolvemos todo.
        $mensajes[] = $msg;
    }
    
    echo json_encode(['success' => true, 'mensajes' => $mensajes]);
} catch (PDOException $e) {
    echo json_encode(['error' => $e->getMessage()]);
}
?>
