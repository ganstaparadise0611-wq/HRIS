<?php
// notify-broadcast.php
// Broadcasts a push notification to ALL users in the system.
// Used by the Feeds feature (posts go directly to Supabase, so the frontend
// calls this endpoint to trigger the broadcast).
//
// POST /notify-broadcast.php
// Body: JSON { "title": "...", "body": "...", "type": "feeds" }

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
require_once __DIR__ . '/notify-helper.php';

$raw  = file_get_contents('php://input') ?: '';
$body = json_decode($raw, true);

if (!is_array($body)) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'message' => 'Invalid JSON body']);
    exit;
}

$title = trim($body['title'] ?? '');
$text  = trim($body['body']  ?? '');
$type  = trim($body['type']  ?? 'feeds');

if (empty($title) || empty($text)) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'message' => 'Missing title or body']);
    exit;
}

// Broadcast to every registered device
$result = send_expo_push(
    get_all_push_tokens(),
    $title,
    $text,
    ['type' => $type]
);

echo json_encode([
    'ok'     => true,
    'sent'   => $result['sent'],
    'errors' => $result['errors'],
]);
