<?php
$host = '127.0.0.1';
$db   = 'db_mensajeria';
$user = 'root';
$pass = '';
$charset = 'utf8mb4';

$dsn = "mysql:host=$host;dbname=$db;charset=$charset";
$options = [
    PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    PDO::ATTR_EMULATE_PREPARES   => false,
];

try {
    $pdo = new PDO($dsn, $user, $pass, $options);
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
                    ip VARCHAR(45) DEFAULT '0.0.0.0',
                    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    ultimo_acceso TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
                )
            ");
            $pdo_init->exec("
                CREATE TABLE IF NOT EXISTS mensajes (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    de_usuario_id VARCHAR(255) NOT NULL,
                    para_usuario_id VARCHAR(255) NOT NULL,
                    payload_cifrado LONGTEXT NOT NULL,
                    entregado TINYINT(1) DEFAULT 0,
                    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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

// Helpers para ofuscación transparente de IDs de usuario en base de datos
define('ID_ENCRYPTION_KEY', 'unsm_seguridad_secreta_2026');

function ofuscar_id($id) {
    if (empty($id)) return '';
    $method = 'AES-128-ECB';
    return base64_encode(openssl_encrypt((string)$id, $method, ID_ENCRYPTION_KEY, OPENSSL_RAW_DATA));
}

function desofuscar_id($cifrado) {
    if (empty($cifrado)) return 0;
    $method = 'AES-128-ECB';
    $decrypted = openssl_decrypt(base64_decode($cifrado), $method, ID_ENCRYPTION_KEY, OPENSSL_RAW_DATA);
    return $decrypted !== false ? (int)$decrypted : 0;
}

// Cifrado no-determinista (AES-128-CBC con IV aleatorio) para evitar análisis de tráfico del remitente
function ofuscar_id_dinamico($id) {
    if (empty($id)) return '';
    $method = 'AES-128-CBC';
    $iv_length = openssl_cipher_iv_length($method);
    $iv = openssl_random_pseudo_bytes($iv_length);
    $encrypted = openssl_encrypt((string)$id, $method, ID_ENCRYPTION_KEY, OPENSSL_RAW_DATA, $iv);
    return base64_encode($iv . $encrypted);
}

function desofuscar_id_dinamico($cifrado) {
    if (empty($cifrado)) return 0;
    $method = 'AES-128-CBC';
    $data = base64_decode($cifrado);
    $iv_length = openssl_cipher_iv_length($method);
    if (strlen($data) <= $iv_length) return 0;
    $iv = substr($data, 0, $iv_length);
    $encrypted = substr($data, $iv_length);
    $decrypted = openssl_decrypt($encrypted, $method, ID_ENCRYPTION_KEY, OPENSSL_RAW_DATA, $iv);
    return $decrypted !== false ? (int)$decrypted : 0;
}
?>
