<?php
// api/login.php
require 'db.php';
header('Content-Type: application/json');

// Iniciar sesión de PHP para guardar el desafío de forma segura
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

$data = json_decode(file_get_contents('php://input'), true);

if (!isset($data['action']) || !isset($data['nombre'])) {
    echo json_encode(['error' => 'Faltan parámetros básicos']);
    exit;
}

$action = trim($data['action']);
$nombre = trim(strtolower($data['nombre']));

// Constantes criptográficas compartidas con crypto.js (Primo seguro de 256 bits)
$q = '115792089237316195423570985008687907853269984665640564039457584007913129639747';
$g = '735'; // Primer generador de la matriz pública

// Función auxiliar de exponenciación modular usando BC Math puro para evitar desbordamientos
function modExp($base, $exp, $mod) {
    $res = '1';
    $base = bcmod((string)$base, (string)$mod);
    $exp = (string)$exp;
    $mod = (string)$mod;
    while (bccomp($exp, '0') > 0) {
        if (bcmod($exp, '2') === '1') {
            $res = bcmod(bcmul($res, $base), $mod);
        }
        $base = bcmod(bcmul($base, $base), $mod);
        $exp = bcdiv($exp, '2', 0);
    }
    return $res;
}

try {
    $stmt = $pdo->prepare("SELECT id, alias_publico, boveda_cifrada, rol, llave_publica FROM usuarios WHERE nombre = ? AND eliminado = 0");
    $stmt->execute([$nombre]);
    $user = $stmt->fetch();

    if (!$user) {
        echo json_encode(['error' => 'Usuario no encontrado']);
        exit;
    }

    if ($action === 'get_challenge') {
        // Generar un exponente secreto temporal para el desafío del servidor
        $r = (string)random_int(100000000, 999999999);
        // T = g^r (mod q)
        if (function_exists('bcpowmod')) {
            $T = bcpowmod($g, $r, $q);
        } else {
            $T = modExp($g, $r, $q);
        }

        // Guardar el exponente secreto y el desafío en la sesión PHP
        $_SESSION['login_r_' . $nombre] = $r;
        $_SESSION['login_T_' . $nombre] = $T;

        echo json_encode([
            'success' => true,
            'desafio' => $T,
            'boveda_cifrada' => $user['boveda_cifrada'],
            'llave_publica' => $user['llave_publica']
        ]);
        exit;

    } elseif ($action === 'login') {
        if (!isset($data['prueba'])) {
            echo json_encode(['error' => 'Prueba de conocimiento cero faltante']);
            exit;
        }

        $prueba_cliente = trim($data['prueba']);
        $r = $_SESSION['login_r_' . $nombre] ?? null;

        if (!$r) {
            echo json_encode(['error' => 'Sesión expirada o desafío no solicitado']);
            exit;
        }

        // Limpiar desafío usado para mitigar ataques de repetición (Replay)
        unset($_SESSION['login_r_' . $nombre]);

        // Obtener la llave pública del usuario (primer elemento del vector)
        $public_vector = explode(',', $user['llave_publica']);
        $Y_0 = $public_vector[0];

        // Calcular S_verify = (Y_0)^r (mod q)
        if (function_exists('bcpowmod')) {
            $S_verify = bcpowmod($Y_0, $r, $q);
        } else {
            $S_verify = modExp($Y_0, $r, $q);
        }

        // Validar la prueba hash: sha256(S_verify)
        $prueba_servidor = hash('sha256', (string)$S_verify);

        if ($prueba_cliente === $prueba_servidor) {
            // LOGIN CORRECTO - Generar token de sesión
            $token_sesion = bin2hex(random_bytes(32));
            $dispositivo = isset($_SERVER['HTTP_USER_AGENT']) ? substr($_SERVER['HTTP_USER_AGENT'], 0, 250) : 'Desconocido';
            $ip = isset($_SERVER['REMOTE_ADDR']) ? $_SERVER['REMOTE_ADDR'] : '0.0.0.0';

            // Registrar sesión
            $stmt_sesion = $pdo->prepare("INSERT INTO sesiones (usuario_id, token_sesion, dispositivo, ip) VALUES (?, ?, ?, ?)");
            $stmt_sesion->execute([$user['id'], $token_sesion, $dispositivo, $ip]);

            echo json_encode([
                'success' => true,
                'id' => $user['id'],
                'alias_publico' => $user['alias_publico'],
                'llave_publica' => $user['llave_publica'],
                'rol' => $user['rol'],
                'token_sesion' => $token_sesion
            ]);
        } else {
            echo json_encode(['error' => 'Contraseña incorrecta (Fallo de prueba Zero-Knowledge)']);
        }
        exit;

    } else {
        echo json_encode(['error' => 'Acción no soportada']);
    }

} catch (Exception $e) {
    echo json_encode(['error' => 'Error de servidor: ' . $e->getMessage()]);
}
?>
