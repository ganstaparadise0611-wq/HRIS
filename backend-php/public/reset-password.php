<?php
require_once 'connect.php';

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json');

// Handle preflight OPTIONS request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);
    $email = $input['email'] ?? '';
    $newPassword = $input['newPassword'] ?? '';

    if (empty($email) || empty($newPassword)) {
        echo json_encode(['success' => false, 'message' => 'Email and new password are required']);
        exit;
    }

    // Validate password strength (minimum 6 characters)
    if (strlen($newPassword) < 6) {
        echo json_encode(['success' => false, 'message' => 'Password must be at least 6 characters']);
        exit;
    }

    // 1. Check if there's a recently verified (used) code for this email
    [$status, $data, $err] = supabase_request(
        'GET',
        '/rest/v1/password_resets?email=eq.' . urlencode($email) . 
        '&used=eq.true&select=id,user_id,created_at&order=created_at.desc&limit=1',
        null,
        ['Prefer' => 'return=representation']
    );

    if ($err || empty($data) || !is_array($data) || count($data) === 0) {
        echo json_encode(['success' => false, 'message' => 'Please verify your code first']);
        exit;
    }

    $verifiedRecord = $data[0];
    $verifiedAt = strtotime($verifiedRecord['created_at']);
    $now = time();

    // Code must have been verified within the last 30 minutes
    if ($now - $verifiedAt > 1800) {
        echo json_encode(['success' => false, 'message' => 'Verification expired. Please request a new code']);
        exit;
    }

    // 2. Hash the new password
    $hashedPassword = password_hash($newPassword, PASSWORD_BCRYPT);

    $verifiedUserId = $verifiedRecord['user_id'];

    // 3. Update password in accounts table using user_id for better security
    [$updateStatus, $updateData, $updateErr] = supabase_request(
        'PATCH',
        '/rest/v1/accounts?log_id=eq.' . $verifiedUserId,
        ['password' => $hashedPassword],
        ['Prefer' => 'return=representation']
    );

    if ($updateStatus >= 400 || $updateErr) {
        echo json_encode(['success' => false, 'message' => 'Failed to update password']);
        exit;
    }

    // 4. Delete all password reset records for this email
    supabase_request(
        'DELETE',
        '/rest/v1/password_resets?email=eq.' . urlencode($email),
        null,
        ['Prefer' => 'return=representation']
    );

    // 5. Return success
    echo json_encode([
        'success' => true,
        'message' => 'Password reset successfully'
    ]);
} else {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);
}
