<?php
$config = @include 'config.php';
if (!$config) {
    $config = [
        'db_host' => '127.0.0.1',
        'db_name' => 'db_mensajeria',
        'db_user' => 'root',
        'db_pass' => '',
        'encryption_key' => 'unsm_seguridad_secreta_2026_fallback_solo_desarrollo'
    ];
}

$host = $config['db_host'];
$db   = $config['db_name'];
$user = $config['db_user'];
$pass = $config['db_pass'];
$charset = 'utf8mb4';

header("Strict-Transport-Security: max-age=31536000; includeSubDomains");
header("X-Content-Type-Options: nosniff");
header("X-Frame-Options: DENY");
header("X-XSS-Protection: 1; mode=block");

$dsn = "mysql:host=$host;dbname=$db;charset=$charset";
$options = [
    PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    PDO::ATTR_EMULATE_PREPARES   => false,
];

try {
    $pdo = new PDO($dsn, $user, $pass, $options);
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS rate_limits (
            ip VARCHAR(64) NOT NULL,
            endpoint VARCHAR(50) NOT NULL,
            intentos INT DEFAULT 1,
            ultimo_intento TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (ip, endpoint)
        )
    ");
} catch (\PDOException $e) {
    // Si la base de datos no existe, intentamos crearla
    if (strpos($e->getMessage(), 'Unknown database') !== false) {
        try {
            $pdo_init = new PDO("mysql:host=$host;charset=$charset", $user, $pass, $options);
            $pdo_init->exec("CREATE DATABASE IF NOT EXISTS `$db` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
            $pdo_init->exec("USE `$db`");
            $pdo_init->exec("
                CREATE TABLE IF NOT EXISTS usuarios (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    nombre VARCHAR(50) NOT NULL UNIQUE,
                    alias_publico VARCHAR(50) NOT NULL,
                    llave_publica TEXT NOT NULL,
                    boveda_cifrada TEXT NOT NULL,
                    rol ENUM('usuario', 'admin') DEFAULT 'usuario',
                    eliminado TINYINT(1) DEFAULT 0,
                    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            ");
            $pdo_init->exec("
                CREATE TABLE IF NOT EXISTS sesiones (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    usuario_id INT NOT NULL,
                    token_sesion VARCHAR(255) NOT NULL UNIQUE,
                    dispositivo VARCHAR(255) DEFAULT 'Desconocido',
                    ip VARCHAR(64) DEFAULT '0.0.0.0',
                    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    ultimo_acceso TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
                )
            ");
            $pdo_init->exec("
                CREATE TABLE IF NOT EXISTS mensajes (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    de_usuario_id INT NOT NULL,
                    para_usuario_id INT NOT NULL,
                    payload_cifrado TEXT NOT NULL,
                    entregado TINYINT(1) DEFAULT 0,
                    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (de_usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
                    FOREIGN KEY (para_usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
                )
            ");
            $pdo_init->exec("
                CREATE TABLE IF NOT EXISTS rate_limits (
                    ip VARCHAR(64) NOT NULL,
                    endpoint VARCHAR(50) NOT NULL,
                    intentos INT DEFAULT 1,
                    ultimo_intento TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    PRIMARY KEY (ip, endpoint)
                )
            ");
            $pdo = new PDO($dsn, $user, $pass, $options);
        } catch (\PDOException $e2) {
            throw new \PDOException($e2->getMessage(), (int)$e2->getCode());
        }
    } else {
        throw new \PDOException($e->getMessage(), (int)$e->getCode());
    }
}

// Helpers para ofuscación (AES-256-CBC dinámico con IV incluido)
// Nota: La base de datos ahora almacena los IDs reales (INT) por integridad referencial.
// Estas funciones se mantienen por si se requiere ofuscar IDs hacia el frontend en el futuro.
define('ID_ENCRYPTION_KEY', hash('sha256', $config['encryption_key'], true));

function ofuscar_id($id) {
    if (empty($id)) return '';
    $method = 'AES-256-CBC';
    $iv_length = openssl_cipher_iv_length($method);
    $iv = openssl_random_pseudo_bytes($iv_length);
    $encrypted = openssl_encrypt((string)$id, $method, ID_ENCRYPTION_KEY, OPENSSL_RAW_DATA, $iv);
    return base64_encode($iv . $encrypted);
}

function desofuscar_id($cifrado) {
    if (empty($cifrado)) return 0;
    $method = 'AES-256-CBC';
    $data = base64_decode($cifrado);
    $iv_length = openssl_cipher_iv_length($method);
    if (strlen($data) <= $iv_length) return 0;
    $iv = substr($data, 0, $iv_length);
    $encrypted = substr($data, $iv_length);
    $decrypted = openssl_decrypt($encrypted, $method, ID_ENCRYPTION_KEY, OPENSSL_RAW_DATA, $iv);
    return $decrypted !== false ? (int)$decrypted : 0;
}

// ofuscar_id_dinamico se unifica con ofuscar_id, ya que AES-256-CBC con IV ya es dinámico.
function ofuscar_id_dinamico($id) {
    return ofuscar_id($id);
}

function desofuscar_id_dinamico($cifrado) {
    return desofuscar_id($cifrado);
}

// Función para prevenir Fuerza Bruta y Scraping (Rate Limiter)
function check_rate_limit($pdo, $endpoint, $max_attempts, $window_seconds) {
    $ip = isset($_SERVER['REMOTE_ADDR']) ? $_SERVER['REMOTE_ADDR'] : '0.0.0.0';
    $ip_hash = hash('sha256', $ip);
    
    // Limpiar registros viejos para mantener la tabla ligera
    $stmt = $pdo->prepare("DELETE FROM rate_limits WHERE ultimo_intento < DATE_SUB(NOW(), INTERVAL ? SECOND)");
    $stmt->execute([$window_seconds]);

    // Verificar intentos actuales
    $stmt = $pdo->prepare("SELECT intentos FROM rate_limits WHERE ip = ? AND endpoint = ?");
    $stmt->execute([$ip_hash, $endpoint]);
    $row = $stmt->fetch();

    if ($row) {
        if ($row['intentos'] >= $max_attempts) {
            return false; // Bloqueado
        }
        $stmt = $pdo->prepare("UPDATE rate_limits SET intentos = intentos + 1, ultimo_intento = NOW() WHERE ip = ? AND endpoint = ?");
        $stmt->execute([$ip_hash, $endpoint]);
    } else {
        $stmt = $pdo->prepare("INSERT INTO rate_limits (ip, endpoint, intentos, ultimo_intento) VALUES (?, ?, 1, NOW())");
        $stmt->execute([$ip_hash, $endpoint]);
    }
    return true; // Permitido
}
?>
