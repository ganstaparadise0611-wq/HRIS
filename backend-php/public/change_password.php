<?php
// Change password endpoint for the Expo app.
//
// POST /change_password.php
// Body: JSON { "user_id": 123, "old_password": "...", "new_password": "..." }
//
// Security:
// - Verifies old password before allowing change
// - Hashes new password using PHP password_hash()
// - Requires user_id to prevent unauthorized changes

set_time_limit(10);
ini_set('max_execution_time', 10);
ini_set('display_errors', 0);
ini_set('log_errors', 1);
error_reporting(E_ALL);

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, Accept');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

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

$userId = isset($body['user_id']) ? (int)$body['user_id'] : 0;
$oldPassword = (string)($body['old_password'] ?? '');
$newPassword = (string)($body['new_password'] ?? '');

if ($userId <= 0) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'message' => 'Invalid user ID']);
    exit;
}

if ($oldPassword === '' || $newPassword === '') {
    http_response_code(400);
    echo json_encode(['ok' => false, 'message' => 'Old password and new password are required']);
    exit;
}

// Validate new password strength (minimum 6 characters)
if (strlen($newPassword) < 6) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'message' => 'New password must be at least 6 characters long']);
    exit;
}

// Fetch the account by user_id
[$status, $data, $err] = supabase_request(
    'GET', 
    "rest/v1/accounts?log_id=eq.{$userId}&select=log_id,username,password"
);

if ($err) {
    http_response_code(500);
    error_log("Change password error - Supabase connection failed: " . $err);
    echo json_encode([
        'ok' => false, 
        'message' => 'Database connection error. Please check server configuration.',
        'detail' => $err
    ]);
    exit;
}

if ($status !== 200) {
    http_response_code(500);
    error_log("Change password error - Supabase returned status $status");
    echo json_encode([
        'ok' => false, 
        'message' => 'Database error. Unable to connect to Supabase.',
        'status' => $status
    ]);
    exit;
}

if (!is_array($data) || count($data) === 0) {
    http_response_code(404);
    echo json_encode(['ok' => false, 'message' => 'User account not found']);
    exit;
}

$account = $data[0];
$storedPassword = (string)($account['password'] ?? '');

// Verify old password
$isHash = str_starts_with($storedPassword, '$2y$') || str_starts_with($storedPassword, '$2a$') || str_starts_with($storedPassword, '$argon2');
$validOldPassword = $isHash ? password_verify($oldPassword, $storedPassword) : hash_equals($storedPassword, $oldPassword);

if (!$validOldPassword) {
    http_response_code(401);
    echo json_encode(['ok' => false, 'message' => 'Current password is incorrect']);
    exit;
}

// Prevent using the same password
if ($isHash) {
    if (password_verify($newPassword, $storedPassword)) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'message' => 'New password must be different from current password']);
        exit;
    }
} else {
    if (hash_equals($storedPassword, $newPassword)) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'message' => 'New password must be different from current password']);
        exit;
    }
}

// Hash the new password using bcrypt
$hashedPassword = password_hash($newPassword, PASSWORD_BCRYPT);

if ($hashedPassword === false) {
    http_response_code(500);
    error_log("Change password error - Failed to hash password");
    echo json_encode(['ok' => false, 'message' => 'Failed to process password. Please try again.']);
    exit;
}

// Update the password in Supabase using PATCH
[$updateStatus, $updateData, $updateErr] = supabase_request(
    'PATCH',
    "rest/v1/accounts?log_id=eq.{$userId}",
    ['password' => $hashedPassword],
    [
        'Prefer: return=minimal',
    ]
);

if ($updateErr) {
    http_response_code(500);
    error_log("Change password error - Failed to update password: " . $updateErr);
    echo json_encode([
        'ok' => false, 
        'message' => 'Failed to update password. Please try again.',
        'detail' => $updateErr
    ]);
    exit;
}

if ($updateStatus !== 204 && $updateStatus !== 200) {
    http_response_code(500);
    error_log("Change password error - Supabase update returned status $updateStatus");
    echo json_encode([
        'ok' => false, 
        'message' => 'Failed to update password. Please try again.',
        'status' => $updateStatus
    ]);
    exit;
}

// Password changed successfully
echo json_encode([
    'ok' => true,
    'message' => 'Password changed successfully'
]);
