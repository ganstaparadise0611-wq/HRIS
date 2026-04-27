<?php
// Remove user from conversation (Bypasses RLS with RPC)
//
// POST /delete-conversation.php
// Body: JSON { "user_id": 123, "conversation_id": 456 }

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, Accept, ngrok-skip-browser-warning, Cache-Control');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

header('Content-Type: application/json');

require_once __DIR__ . '/connect.php';

$raw = file_get_contents('php://input') ?: '';
$body = json_decode($raw, true);

$userId = isset($body['user_id']) ? (int)$body['user_id'] : 0;
$conversationId = isset($body['conversation_id']) ? (int)$body['conversation_id'] : 0;

if ($userId === 0 || $conversationId === 0) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'message' => "Invalid input. User: $userId, Conv: $conversationId"]);
    exit;
}

// Logic: Use the RPC function we just created (SECURITY DEFINER)
// to bypass RLS restrictions safely.
[$status, $data, $err] = supabase_request(
    'POST',
    "rest/v1/rpc/leave_conversation",
    [
        'p_user_id' => $userId,
        'p_conv_id' => $conversationId
    ]
);

// RPC usually returns 200 or 204 for VOID functions
if ($status >= 200 && $status < 300) {
    echo json_encode([
        'ok' => true, 
        'message' => 'Conversation removed successfully via Admin command'
    ]);
} else {
    http_response_code($status ?: 500);
    echo json_encode([
        'ok' => false, 
        'message' => 'Failed to remove conversation via Master Command', 
        'status' => $status,
        'detail' => $err,
        'hint' => 'Make sure you ran the SQL to create the leave_conversation function.'
    ]);
}
