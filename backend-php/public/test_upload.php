<?php
// Simple test to check if file uploads work through ngrok
header('Content-Type: application/json');

error_log("=== TEST_UPLOAD.PHP START ===");
error_log("REQUEST_METHOD: " . ($_SERVER['REQUEST_METHOD'] ?? 'unknown'));
error_log("CONTENT_TYPE: " . ($_SERVER['CONTENT_TYPE'] ?? 'unknown'));
error_log("HTTP_CONTENT_TYPE: " . ($_SERVER['HTTP_CONTENT_TYPE'] ?? 'unknown'));
error_log("FILES: " . json_encode($_FILES));
error_log("POST: " . json_encode($_POST));
error_log("SERVER: " . json_encode([
    'REQUEST_METHOD' => $_SERVER['REQUEST_METHOD'] ?? '',
    'CONTENT_TYPE' => $_SERVER['CONTENT_TYPE'] ?? '',
    'CONTENT_LENGTH' => $_SERVER['CONTENT_LENGTH'] ?? '',
]));

echo json_encode([
    'ok' => true,
    'request_method' => $_SERVER['REQUEST_METHOD'] ?? 'unknown',
    'content_type' => $_SERVER['CONTENT_TYPE'] ?? 'unknown',
    'files_count' => count($_FILES),
    'post_count' => count($_POST),
    'files_keys' => array_keys($_FILES),
    'post_keys' => array_keys($_POST),
]);
