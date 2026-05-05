<?php
// Send a new message to a conversation
//
// POST /send-message.php
// Body: JSON { "conversation_id": "123", "sender_id": "456", "content": "Hello!" }

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
$mediaUrl = $body['media_url'] ?? null;
$mediaType = $body['media_type'] ?? null;
$replyToId = $body['reply_to_id'] ?? null;

// Allow empty content if there is a media attachment
if (empty($conversationId) || empty($senderId) || (empty($content) && empty($mediaUrl))) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'message' => 'Missing required fields or attachment']);
    exit;
}

// Build insert payload
$insertPayload = [
    'conversation_id' => (int)$conversationId,
    'sender_id' => (int)$senderId,
    'content' => $content,
    'media_url' => $mediaUrl,
    'media_type' => $mediaType,
];

if (!empty($replyToId)) {
    $insertPayload['reply_to_id'] = (int)$replyToId;
}

// Insert message into Supabase
[$status, $data, $err] = supabase_insert('messages', $insertPayload);

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

// --- Push notification: alert other members of this conversation ---
// Fetch sender's username (if not provided in body)
$senderName = $body['sender_name'] ?? null;
if (!$senderName) {
    [$uStatus, $uData] = supabase_request('GET', "rest/v1/accounts?log_id=eq.{$senderId}&select=username");
    $senderName = 'Someone';
    if ($uStatus === 200 && is_array($uData) && count($uData) > 0) {
        $senderName = $uData[0]['username'] ?? 'Someone';
    }
}

// Fetch all participants in the conversation
[$pStatus, $pData] = supabase_request('GET', "rest/v1/conversation_participants?conversation_id=eq.{$conversationId}&select=user_id");
if ($pStatus === 200 && is_array($pData)) {
    $recipientIds = [];
    foreach ($pData as $p) {
        $pid = (int)($p['user_id'] ?? 0);
        if ($pid > 0 && $pid !== (int)$senderId) {
            $recipientIds[] = $pid;
        }
    }
    if (!empty($recipientIds)) {
        notify_users(
            $recipientIds,
            $senderName,
            $content,
            ['type' => 'chat', 'conversation_id' => $conversationId]
        );
    }
}

echo json_encode([
    'ok' => true,
    'message' => 'Message sent successfully',
    'data' => $messageData
]);
