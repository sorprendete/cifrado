<?php
require __DIR__ . '/../api/db.php';

$original_id = 5;
$encrypted = ofuscar_id_dinamico($original_id);
$decrypted = desofuscar_id_dinamico($encrypted);

echo "Original ID: " . $original_id . "\n";
echo "Encrypted Base64: " . $encrypted . "\n";
echo "Decrypted ID: " . $decrypted . "\n";
if ($original_id === $decrypted) {
    echo "SUCCESS: Cryptography matches!\n";
} else {
    echo "ERROR: Cryptography mismatch!\n";
}
?>
