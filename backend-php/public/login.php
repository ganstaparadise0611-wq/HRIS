<?php
// Login endpoint for the Expo app.
//
// POST /login.php
// Body: JSON { "username": "...", "password": "..." }
//
// Notes:
// - This validates against the `accounts` table in Supabase via the REST API.
// - It supports either plaintext passwords (legacy) or PHP password_hash() hashes.
// - On success, returns user data and log_id for session management.

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, Accept');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'message' => 'Method not allowed']);
    exit;
}

require_once __DIR__ . '/connect.php';

$raw = file_get_contents('php://input') ?: '';
$body = json_decode($raw, true);

if (!is_array($body)) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'message' => 'Invalid JSON body']);
    exit;
}

$username = trim((string)($body['username'] ?? ''));
$password = (string)($body['password'] ?? '');

if ($username === '' || $password === '') {
    http_response_code(400);
    echo json_encode(['ok' => false, 'message' => 'Missing username or password']);
    exit;
}

// Fetch the account by username
[$status, $data, $err] = supabase_request(
    'GET', 
    "rest/v1/accounts?username=eq." . urlencode($username)
);

if ($err) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'message' => 'Database error', 'detail' => $err]);
    exit;
}

if ($status !== 200) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'message' => 'Unexpected response from database', 'status' => $status]);
    exit;
}

if (!is_array($data) || count($data) === 0) {
    http_response_code(401);
    echo json_encode(['ok' => false, 'message' => 'Invalid username or password']);
    exit;
}

$account = $data[0];
$stored = (string)($account['password'] ?? '');

// Check if password is hashed (bcrypt, argon2, etc.) or plain text
$isHash = str_starts_with($stored, '$2y$') || str_starts_with($stored, '$2a$') || str_starts_with($stored, '$argon2');
$valid = $isHash ? password_verify($password, $stored) : hash_equals($stored, $password);

if (!$valid) {
    http_response_code(401);
    echo json_encode(['ok' => false, 'message' => 'Invalid username or password']);
    exit;
}

// Login successful
echo json_encode([
    'ok' => true,
    'message' => 'Login successful',
    'user' => [
        'log_id' => $account['log_id'],
        'username' => $account['username'],
    ],
    'password_storage' => $isHash ? 'hashed' : 'plaintext',
]);
