<?php
// update-online-status.php
// POST JSON: { "user_id": "...", "is_online": true/false }

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, Accept, ngrok-skip-browser-warning');

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

$raw = file_get_contents('php://input');
$body = json_decode($raw, true);

$userId = isset($body['user_id']) ? trim((string)$body['user_id']) : '';
$isOnline = isset($body['is_online']) ? (bool)$body['is_online'] : false;

if (!$userId) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'message' => 'Missing user_id']);
    exit;
}

// First update in accounts table
[$status, $res, $err] = supabase_request('PATCH', "rest/v1/accounts?log_id=eq." . urlencode($userId), ['is_online' => $isOnline]);

if ($err) {
    echo json_encode(['ok' => false, 'message' => 'Failed to update status', 'detail' => $err]);
    exit;
}

echo json_encode(['ok' => true]);
