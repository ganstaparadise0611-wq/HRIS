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
    $code = $input['code'] ?? '';

    if (empty($email) || empty($code)) {
        echo json_encode(['success' => false, 'message' => 'Email and code are required']);
        exit;
    }

    // 1. Find the code in password_resets table
    [$status, $data, $err] = supabase_request(
        'GET',
        '/rest/v1/password_resets?email=eq.' . urlencode($email) . 
        '&code=eq.' . urlencode($code) . 
        '&used=eq.false&select=id,user_id,expires_at&order=created_at.desc&limit=1',
        null,
        ['Prefer' => 'return=representation']
    );

    if ($err || empty($data) || !is_array($data) || count($data) === 0) {
        echo json_encode(['success' => false, 'message' => 'Invalid or expired code']);
        exit;
    }

    $resetRecord = $data[0];
    $expiresAt = strtotime($resetRecord['expires_at']);
    $now = time();

    // 2. Check if code is expired
    if ($now > $expiresAt) {
        echo json_encode(['success' => false, 'message' => 'Code has expired. Please request a new one']);
        exit;
    }

    // 3. Mark code as used
    [$updateStatus, $updateData, $updateErr] = supabase_request(
        'PATCH',
        '/rest/v1/password_resets?id=eq.' . $resetRecord['id'],
        ['used' => true],
        ['Prefer' => 'return=representation']
    );

    if ($updateStatus >= 400 || $updateErr) {
        echo json_encode(['success' => false, 'message' => 'Failed to verify code']);
        exit;
    }

    // 4. Return success
    echo json_encode([
        'success' => true,
        'message' => 'Code verified successfully',
        'resetId' => $resetRecord['id'] // Can be used for additional security
    ]);
} else {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);
}
