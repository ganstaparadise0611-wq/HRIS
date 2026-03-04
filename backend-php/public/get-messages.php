<?php
// Get messages for a specific conversation
//
// GET /get-messages.php?conversation_id=123&limit=50
//
// Returns messages in descending order (newest first) for pagination

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, Accept');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'message' => 'Method not allowed']);
    exit;
}

require_once __DIR__ . '/connect.php';

$conversationId = $_GET['conversation_id'] ?? '';
$limit = (int)($_GET['limit'] ?? 50);
$offset = (int)($_GET['offset'] ?? 0);

if (empty($conversationId)) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'message' => 'Missing conversation_id']);
    exit;
}

// Fetch messages from Supabase (exclude soft-deleted)
[$status, $data, $err] = supabase_request(
    'GET',
    "rest/v1/messages?conversation_id=eq.{$conversationId}&is_deleted=eq.false&order=created_at.asc&limit={$limit}&offset={$offset}&select=*"
);

if ($err) {
    error_log("Error fetching messages: " . $err);
    http_response_code(500);
    echo json_encode(['ok' => false, 'message' => 'Database error', 'detail' => $err]);
    exit;
}

if ($status !== 200) {
    http_response_code($status);
    echo json_encode(['ok' => false, 'message' => 'Failed to fetch messages', 'status' => $status]);
    exit;
}

// Fetch sender information for each message
$messages = [];
if (is_array($data)) {
    foreach ($data as $msg) {
        // Fetch sender username
        [$senderStatus, $senderData] = supabase_request(
            'GET',
            "rest/v1/accounts?log_id=eq.{$msg['sender_id']}&select=log_id,username"
        );
        
        $sender = null;
        if ($senderStatus === 200 && is_array($senderData) && count($senderData) > 0) {
            $sender = [
                'log_id' => (string)$senderData[0]['log_id'],
                'username' => (string)$senderData[0]['username']
            ];
        }
        
        $messages[] = [
            'id' => (string)$msg['id'],
            'conversation_id' => (string)$msg['conversation_id'],
            'sender_id' => (string)$msg['sender_id'],
            'content' => $msg['content'],
            'created_at' => $msg['created_at'],
            'edited_at' => $msg['edited_at'] ?? null,
            'is_deleted' => $msg['is_deleted'] ?? false,
            'sender' => $sender
        ];
    }
}

echo json_encode([
    'ok' => true,
    'messages' => $messages,
    'count' => count($messages)
]);
