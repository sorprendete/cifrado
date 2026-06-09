<?php
// api/login.php
require 'db.php';
header('Content-Type: application/json');

// Bloquear intentos abusivos: Máximo 20 intentos por minuto por IP
if (!check_rate_limit($pdo, 'login', 20, 60)) {
    http_response_code(429);
    echo json_encode(['error' => 'Demasiados intentos. Bloqueado temporalmente.']);
    exit;
}

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

// Constantes criptográficas compartidas con crypto.js (RFC 3526 Group 14 - 2048 bits)
$q = '323170060713110073003389139264238282488179412411402391128420097514007417066343542226196894173635693471179017379097041917546058732091950288537589861856221532121754125149017745202702357960782362488842461894775876411059286460994117232454266225221932305409190376805242355191256797158701170010580558776510388618472802579760549035697325615261670813393617995413364765591603683178967290731783845896822632202455852206771142568603095697369324864197994462102148782061291147513360098939626359300588523315758066270566418854721495034612808798938928421880942428581694665422784566373756281728103358045615579976378518903588931103756919';
$g = '2';

// Función auxiliar de exponenciación modular segura
function modExp($base, $exp, $mod) {
    if (function_exists('bcpowmod')) {
        return bcpowmod((string)$base, (string)$exp, (string)$mod);
    }
    // Fallback puro en PHP
    $res = '1';
    $base = bcmod((string)$base, (string)$mod);
    $exp = (string)$exp;
    while (bccomp($exp, '0') > 0) {
        if (bcmod($exp, '2') === '1') {
            $res = bcmod(bcmul($res, $base), (string)$mod);
        }
        $base = bcmod(bcmul($base, $base), (string)$mod);
        $exp = bcdiv($exp, '2');
    }
    return $res;
}

function hexToDec($hex) {
    $dec = '0';
    $len = strlen($hex);
    for ($i = 0; $i < $len; $i++) {
        $dec = bcadd(bcmul($dec, '16'), (string)hexdec($hex[$i]));
    }
    return $dec;
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
        // Generar un exponente secreto de 256 bits
        $r = hexToDec(bin2hex(random_bytes(32)));
        // T = g^r (mod q)
        $T = modExp($g, $r, $q);

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
        $S_verify = modExp($Y_0, $r, $q);

        // Validar la prueba hash: sha256(S_verify)
        $prueba_servidor = hash('sha256', (string)$S_verify);

        if ($prueba_cliente === $prueba_servidor) {
            // LOGIN CORRECTO - Generar token de sesión
            $token_sesion = bin2hex(random_bytes(32));
            $dispositivo = isset($_SERVER['HTTP_USER_AGENT']) ? substr($_SERVER['HTTP_USER_AGENT'], 0, 250) : 'Desconocido';
            $ip = isset($_SERVER['REMOTE_ADDR']) ? $_SERVER['REMOTE_ADDR'] : '0.0.0.0';

            // Registrar sesión (IP hasheada por privacidad)
            $ip_hash = hash('sha256', $ip);
            $stmt_sesion = $pdo->prepare("INSERT INTO sesiones (usuario_id, token_sesion, dispositivo, ip) VALUES (?, ?, ?, ?)");
            $stmt_sesion->execute([$user['id'], $token_sesion, $dispositivo, $ip_hash]);

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
