<?php
require 'api/db.php';
$stmt = $pdo->query('SELECT id, nombre, llave_publica FROM usuarios');
echo json_encode($stmt->fetchAll(PDO::FETCH_ASSOC));
