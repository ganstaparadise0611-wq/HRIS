<?php
// Get members (participants) of a conversation
//
// GET /get-conversation-members.php?conversation_id=123
//
// Returns list of members with user_id, username, joined_at

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

$conversationId = trim($_GET['conversation_id'] ?? '');

if ($conversationId === '') {
    http_response_code(400);
    echo json_encode(['ok' => false, 'message' => 'Missing conversation_id']);
    exit;
}

[$status, $participants, $err] = supabase_request(
    'GET',
    "rest/v1/conversation_participants?conversation_id=eq.{$conversationId}&select=user_id,joined_at&order=joined_at.asc"
);

if ($err) {
    error_log("Error fetching conversation participants: " . $err);
    http_response_code(500);
    echo json_encode(['ok' => false, 'message' => 'Database error', 'detail' => $err]);
    exit;
}

if ($status !== 200 || !is_array($participants)) {
    http_response_code($status !== 200 ? $status : 500);
    echo json_encode(['ok' => false, 'message' => 'Failed to fetch members', 'status' => $status]);
    exit;
}

$members = [];
foreach ($participants as $p) {
    $uid = $p['user_id'] ?? null;
    if ($uid === null) continue;
    $username = 'Unknown';
    [$accStatus, $accData] = supabase_request(
        'GET',
        "rest/v1/accounts?log_id=eq.{$uid}&select=username"
    );
    if ($accStatus === 200 && is_array($accData) && count($accData) > 0) {
        $username = (string)($accData[0]['username'] ?? 'Unknown');
    }
    $members[] = [
        'user_id' => (string)$uid,
        'username' => $username,
        'joined_at' => $p['joined_at'] ?? null,
    ];
}

echo json_encode([
    'ok' => true,
    'members' => $members,
    'count' => count($members),
]);
