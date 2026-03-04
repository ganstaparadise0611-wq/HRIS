<?php
// Send a new message to a conversation
//
// POST /send-message.php
// Body: JSON { "conversation_id": "123", "sender_id": "456", "content": "Hello!" }

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

if (!is_array($body)) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'message' => 'Invalid JSON body']);
    exit;
}

$conversationId = $body['conversation_id'] ?? '';
$senderId = $body['sender_id'] ?? '';
$content = trim($body['content'] ?? '');

if (empty($conversationId) || empty($senderId) || empty($content)) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'message' => 'Missing required fields']);
    exit;
}

// Insert message into Supabase (created_at defaults in DB if not sent)
[$status, $data, $err] = supabase_insert('messages', [
    'conversation_id' => (int)$conversationId,
    'sender_id' => (int)$senderId,
    'content' => $content,
]);

if ($err) {
    error_log("Error sending message: " . $err);
    http_response_code(500);
    echo json_encode(['ok' => false, 'message' => 'Database error']);
    exit;
}

if ($status !== 201) {
    http_response_code($status);
    echo json_encode(['ok' => false, 'message' => 'Failed to send message', 'status' => $status]);
    exit;
}

$messageData = is_array($data) ? $data[0] : $data;
if (is_array($messageData)) {
    $messageData['id'] = (string)($messageData['id'] ?? '');
    $messageData['sender_id'] = (string)($messageData['sender_id'] ?? '');
    $messageData['conversation_id'] = (string)($messageData['conversation_id'] ?? '');
}

echo json_encode([
    'ok' => true,
    'message' => 'Message sent successfully',
    'data' => $messageData
]);
