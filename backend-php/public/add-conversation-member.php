<?php
// Add a member to an existing conversation (channel)
//
// POST /add-conversation-member.php
// Body: JSON { "conversation_id": "123", "user_id": "456" }
//
// Returns success status

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

$conversationId = trim((string)($body['conversation_id'] ?? ''));
$userId = trim((string)($body['user_id'] ?? ''));
$inviterId = trim((string)($body['inviter_id'] ?? ''));

if ($conversationId === '' || $userId === '') {
    http_response_code(400);
    echo json_encode(['ok' => false, 'message' => 'Missing required fields: conversation_id, user_id']);
    exit;
}

// Check if user is already a member
[$checkStatus, $existingData, $checkErr] = supabase_request(
    'GET',
    "rest/v1/conversation_participants?conversation_id=eq.{$conversationId}&user_id=eq.{$userId}"
);

if ($checkStatus === 200 && is_array($existingData) && count($existingData) > 0) {
    echo json_encode([
        'ok' => true,
        'message' => 'User is already a member of this conversation'
    ]);
    exit;
}

// Add the participant
[$status, $data, $err] = supabase_request(
    'POST',
    'rest/v1/conversation_participants',
    [
        'conversation_id' => $conversationId,
        'user_id' => $userId,
        'joined_at' => date('c')
    ],
    ['Prefer: return=representation']
);

if ($err) {
    error_log("Error adding member: " . $err);
    http_response_code(500);
    echo json_encode(['ok' => false, 'message' => 'Database error', 'detail' => $err]);
    exit;
}

if ($status !== 201) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'message' => 'Failed to add member', 'status' => $status]);
    exit;
}

// Post a system message so the app can show "Chester added you to the group" / "Chester added John to the group"
$systemMessagePosted = false;
if ($inviterId !== '') {
    $newMemberUsername = 'Someone';
    [$accStatus, $accData] = supabase_request(
        'GET',
        "rest/v1/accounts?log_id=eq.{$userId}&select=username"
    );
    if ($accStatus === 200 && is_array($accData) && count($accData) > 0) {
        $newMemberUsername = $accData[0]['username'] ?? $newMemberUsername;
    }
    $systemContent = "added __{$userId}__|{$newMemberUsername} to the channel";
    [$msgStatus, $msgResult, $msgErr] = supabase_request(
        'POST',
        'rest/v1/messages',
        [
            'conversation_id' => (int)$conversationId,
            'sender_id' => (int)$inviterId,
            'content' => $systemContent,
        ],
        ['Prefer: return=representation']
    );
    if ($msgErr) {
        error_log("Add member: system message failed: " . $msgErr);
    }
    $systemMessagePosted = ($msgStatus === 201);
}

echo json_encode([
    'ok' => true,
    'message' => 'Member added successfully',
    'participant' => is_array($data) && count($data) > 0 ? $data[0] : null,
    'system_message_posted' => $systemMessagePosted,
]);
