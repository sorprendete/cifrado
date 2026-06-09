<?php
// scratch/tests_unitarios.php
require __DIR__ . '/../api/db.php';

function run_test($name, $callback) {
    try {
        $result = $callback();
        if ($result === true) {
            echo "✅ TEST PASSED: $name\n";
        } else {
            echo "❌ TEST FAILED: $name\n";
        }
    } catch (Exception $e) {
        echo "💥 TEST ERROR ($name): " . $e->getMessage() . "\n";
    }
}

// 1. Validar cifrado y descifrado dinámico (Remitente)
run_test("Cifrado/Descifrado Dinámico del Remitente", function() {
    $original_id = 42;
    $cifrado = ofuscar_id_dinamico($original_id);
    $descifrado = desofuscar_id_dinamico($cifrado);
    
    return ($original_id === $descifrado);
});

// 2. Validar que el cifrado del remitente sea no-determinista (Cifrado Dinámico)
run_test("No-Determinismo (Evitar patrones estáticos)", function() {
    $id = 99;
    $cifrado_1 = ofuscar_id_dinamico($id);
    $cifrado_2 = ofuscar_id_dinamico($id);
    
    // Deben ser diferentes debido al IV aleatorio
    return ($cifrado_1 !== $cifrado_2);
});

// 3. Validar cifrado y descifrado determinista (Destinatario)
run_test("Cifrado/Descifrado Determinista del Destinatario", function() {
    $original_id = 7;
    $cifrado = ofuscar_id($original_id);
    $descifrado = desofuscar_id($cifrado);
    
    return ($original_id === $descifrado);
});

// 4. Validar determinismo para búsquedas indexadas (Destinatario)
run_test("Determinismo para búsquedas indexadas en BD", function() {
    $id = 15;
    $cifrado_1 = ofuscar_id($id);
    $cifrado_2 = ofuscar_id($id);
    
    // Deben ser idénticos para poder usar WHERE en la base de datos
    return ($cifrado_1 === $cifrado_2);
});
?>
