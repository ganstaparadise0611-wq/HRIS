<?php
// Create a new conversation (channel or DM)
//
// POST /create-conversation.php
// Body: JSON { "creator_id": "123", "type": "channel|dm", "name": "...", "participant_ids": ["123", "456"] }
//
// Returns the created conversation data

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

$raw = file_get_contents('php://input') ?: '';
$body = json_decode($raw, true);

if (!is_array($body)) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'message' => 'Invalid JSON body']);
    exit;
}

$creatorId = trim((string)($body['creator_id'] ?? ''));
$type = trim((string)($body['type'] ?? ''));
$name = trim((string)($body['name'] ?? ''));
$participantIds = $body['participant_ids'] ?? [];

if ($creatorId === '' || $type === '' || $name === '') {
    http_response_code(400);
    echo json_encode(['ok' => false, 'message' => 'Missing required fields: creator_id, type, name']);
    exit;
}

if (!in_array($type, ['channel', 'dm'], true)) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'message' => 'Invalid type. Must be "channel" or "dm"']);
    exit;
}

if (!is_array($participantIds)) {
    $participantIds = [];
}

// Ensure creator is in the participant list
if (!in_array($creatorId, $participantIds, true)) {
    $participantIds[] = $creatorId;
}

// Step 1: Create the conversation
[$status, $conversation, $err] = supabase_request(
    'POST',
    'rest/v1/conversations',
    [
        'name' => $name,
        'type' => $type,
        'created_by' => $creatorId,
        'created_at' => date('c')
    ],
    ['Prefer: return=representation']
);

if ($err) {
    error_log("Error creating conversation: " . $err);
    http_response_code(500);
    echo json_encode(['ok' => false, 'message' => 'Database error', 'detail' => $err]);
    exit;
}

if ($status !== 201 || !is_array($conversation) || count($conversation) === 0) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'message' => 'Failed to create conversation', 'status' => $status]);
    exit;
}

$newConversation = $conversation[0];
$conversationId = $newConversation['id'];

// Step 2: Add participants
$participantsAdded = 0;
foreach ($participantIds as $participantId) {
    [$partStatus, $partData, $partErr] = supabase_request(
        'POST',
        'rest/v1/conversation_participants',
        [
            'conversation_id' => $conversationId,
            'user_id' => trim((string)$participantId),
            'joined_at' => date('c')
        ],
        ['Prefer: return=representation']
    );
    
    if ($partStatus === 201) {
        $participantsAdded++;
    } else {
        error_log("Failed to add participant {$participantId}: Status {$partStatus}, Error: {$partErr}");
    }
}

if ($participantsAdded === 0) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'message' => 'Conversation created but failed to add participants']);
    exit;
}

echo json_encode([
    'ok' => true,
    'message' => 'Conversation created successfully',
    'conversation' => [
        'id' => $newConversation['id'],
        'name' => $newConversation['name'],
        'type' => $newConversation['type'],
        'created_by' => $newConversation['created_by'],
        'created_at' => $newConversation['created_at'],
        'participants_added' => $participantsAdded
    ]
]);
