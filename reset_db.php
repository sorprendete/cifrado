<?php
try {
    $pdo = new PDO('mysql:host=127.0.0.1;charset=utf8mb4', 'root', '', [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION
    ]);
    
    // Eliminar por completo la base de datos obsoleta
    $pdo->exec("DROP DATABASE IF EXISTS `db_mensajeria`");
    echo "<h3>1. Base de datos obsoleta eliminada.</h3>";
    
    // Recrear usando la estructura correcta del repositorio db.php
    include 'api/db.php';
    echo "<h3>2. Nueva base de datos con la estructura correcta del repositorio creada con éxito.</h3>";
    echo "<p style='color: green; font-weight: bold;'>¡Base de datos regenerada con éxito! Ya puedes cerrar esta pestaña y registrar tus usuarios de nuevo.</p>";
    
} catch (Exception $e) {
    echo "<h3 style='color: red;'>Error al regenerar la base de datos:</h3>";
    echo "<pre>" . $e->getMessage() . "</pre>";
}
?>
