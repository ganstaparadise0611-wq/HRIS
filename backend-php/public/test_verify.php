<?php
// Test verify.php directly to see errors
error_reporting(E_ALL);
ini_set('display_errors', 1);

echo "Testing verify.php...\n\n";

// Simulate POST request
$_SERVER['REQUEST_METHOD'] = 'POST';
$_POST = [];
$_FILES = [];

// Capture output
ob_start();
try {
    include 'verify.php';
} catch (Throwable $e) {
    echo "ERROR: " . $e->getMessage() . "\n";
    echo "File: " . $e->getFile() . "\n";
    echo "Line: " . $e->getLine() . "\n";
    echo "Trace:\n" . $e->getTraceAsString() . "\n";
}
$output = ob_get_clean();

echo "Output:\n";
echo $output;
echo "\n\n";
