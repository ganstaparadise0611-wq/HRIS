<?php
// Save or update an Expo push token for a user
//
// POST /save-push-token.php
// Body: JSON { "user_id": "123", "push_token": "ExponentPushToken[xxx]" }

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, Accept, ngrok-skip-browser-warning, Cache-Control');

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

$raw  = file_get_contents('php://input') ?: '';
$body = json_decode($raw, true);

if (!is_array($body)) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'message' => 'Invalid JSON body']);
    exit;
}

$userId    = $body['user_id']    ?? '';
$pushToken = $body['push_token'] ?? '';

if (empty($userId) || empty($pushToken)) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'message' => 'Missing user_id or push_token']);
    exit;
}

// Upsert: if a row for this user already exists, update the token
// Supabase REST upsert: send POST with Prefer: resolution=merge-duplicates
[$status, $data, $err] = supabase_request(
    'POST',
    'rest/v1/push_tokens',
    [
        'user_id'    => (int)$userId,
        'push_token' => $pushToken,
        'updated_at' => date('c'), // ISO 8601
    ],
    [
        'Prefer: resolution=merge-duplicates',
        'Prefer: return=representation',
    ]
);

if ($err) {
    error_log("save-push-token error: $err");
    http_response_code(500);
    echo json_encode(['ok' => false, 'message' => 'Database error', 'detail' => $err]);
    exit;
}

if ($status < 200 || $status >= 300) {
    http_response_code($status);
    echo json_encode(['ok' => false, 'message' => 'Failed to save push token', 'status' => $status]);
    exit;
}

echo json_encode(['ok' => true, 'message' => 'Push token saved']);
