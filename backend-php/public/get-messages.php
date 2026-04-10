<?php
// Get messages for a specific conversation
//
// GET /get-messages.php?conversation_id=123&limit=50
//
// Returns messages in descending order (newest first) for pagination

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, Accept, ngrok-skip-browser-warning, Cache-Control');

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

// Step 2: Fetch sender information for all messages in BATCH (fixes N+1 query problem)
$messages = [];
if (is_array($data) && count($data) > 0) {
    // Collect unique sender IDs
    $senderIds = [];
    foreach ($data as $msg) {
        $sid = (string)$msg['sender_id'];
        if ($sid !== '') {
            $senderIds[] = $sid;
        }
    }
    
    $senderIds = array_unique($senderIds);
    $senderMap = [];
    
    if (!empty($senderIds)) {
        // Fetch all senders in ONE request
        $idList = implode(',', $senderIds);
        [$senderStatus, $senderData] = supabase_request(
            'GET', 
            "rest/v1/accounts?log_id=in.({$idList})&select=log_id,username"
        );
        
        if ($senderStatus === 200 && is_array($senderData)) {
            foreach ($senderData as $s) {
                $senderMap[(string)$s['log_id']] = [
                    'log_id' => (string)$s['log_id'],
                    'username' => (string)$s['username']
                ];
            }
        }
    }

    // Map messages back with sender info
    foreach ($data as $msg) {
        $sid = (string)$msg['sender_id'];
        $sender = $senderMap[$sid] ?? null;
        
        $messages[] = [
            'id' => (string)$msg['id'],
            'conversation_id' => (string)$msg['conversation_id'],
            'sender_id' => $sid,
            'content' => $msg['content'],
            'media_url' => $msg['media_url'] ?? null,
            'media_type' => $msg['media_type'] ?? null,
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
