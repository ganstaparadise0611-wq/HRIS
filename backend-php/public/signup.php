<?php
// Sign up endpoint for the Expo app.
//
// POST /signup.php
// Body: JSON { "username": "...", "password": "...", "face": "...", "qr_code": "..." }
//
// Note: This creates a new account in the `accounts` table in Supabase.

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

if (!$body) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'message' => 'Invalid JSON']);
    exit;
}

$username = trim($body['username'] ?? '');
$password = $body['password'] ?? '';
$face = $body['face'] ?? '';
$qr_code = $body['qr_code'] ?? '';

if (!$username || !$password) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'message' => 'Username and password are required']);
    exit;
}

if (!$face) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'message' => 'Face data is required']);
    exit;
}

// Check if username already exists
[$status, $data, $err] = supabase_request(
    'GET', 
    "rest/v1/accounts?username=eq." . urlencode($username)
);

// Log the request result for debugging
error_log("Username check - Status: $status, Error: " . ($err ?? 'none'));
if ($err) {
    error_log("Supabase connection error details: " . $err);
}

if ($err) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'message' => 'Database error: ' . $err]);
    exit;
}

if ($status !== 200) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'message' => 'Failed to check username availability']);
    exit;
}

if (is_array($data) && count($data) > 0) {
    http_response_code(409);
    echo json_encode(['ok' => false, 'message' => 'Username already exists']);
    exit;
}

// Create the account
// Note: In production, you should hash the password using password_hash()
[$insertStatus, $insertData, $insertErr] = supabase_insert('accounts', [
    'username' => $username,
    'password' => $password, // Consider: password_hash($password, PASSWORD_BCRYPT)
    'face' => $face,
    'qr_code' => $qr_code,
]);

if ($insertErr) {
    http_response_code(500);
    echo json_encode([
        'ok' => false, 
        'message' => 'Failed to create account: ' . $insertErr
    ]);
    exit;
}

if ($insertStatus !== 201) {
    // Extract error message from Supabase response
    $errorMessage = 'Failed to create account';
    if (is_array($insertData)) {
        $errorMessage .= ': ' . ($insertData['message'] ?? $insertData['hint'] ?? json_encode($insertData));
    } else if (is_string($insertData)) {
        $errorMessage .= ': ' . $insertData;
    }
    
    http_response_code($insertStatus);
    echo json_encode([
        'ok' => false, 
        'message' => $errorMessage
    ]);
    exit;
}

// Get the created account's log_id
$accountLogId = null;
if (is_array($insertData) && isset($insertData[0]['log_id'])) {
    $accountLogId = $insertData[0]['log_id'];
}

// Create corresponding employee record
if ($accountLogId) {
    [$empStatus, $empData, $empErr] = supabase_insert('employees', [
        'log_id' => $accountLogId,
        'name' => $username, // Default to username, user can update later
        'phone' => 0,
        'birthday' => null,
        'address' => '',
        'gender' => '',
        'role' => 'Employee',
        'dept_id' => null,
    ]);
    
    // Log if employee creation fails, but don't fail the signup
    if ($empErr || $empStatus !== 201) {
        error_log("Warning: Account created but employee record failed: " . ($empErr ?? "Status $empStatus"));
    }
}

http_response_code(201);
echo json_encode([
    'ok' => true,
    'message' => 'Account created successfully',
    'data' => $insertData
]);
