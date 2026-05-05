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

$parentId = $_GET['parent_id'] ?? '';

// Build query
$query = "rest/v1/messages?conversation_id=eq.{$conversationId}&is_deleted=eq.false";
if (!empty($parentId)) {
    $query .= "&reply_to_id=eq.{$parentId}";
} else {
    // Only fetch top-level messages for the main conversation feed
    $query .= "&reply_to_id=is.null";
}
$query .= "&order=created_at.asc&limit={$limit}&offset={$offset}&select=*";

// Fetch messages from Supabase
[$status, $data, $err] = supabase_request('GET', $query);

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
        // Fetch all senders from employees table in ONE request
        $idList = implode(',', $senderIds);
        [$senderStatus, $senderData] = supabase_request(
            'GET', 
            "rest/v1/employees?log_id=in.({$idList})&select=log_id,name"
        );
        
        if ($senderStatus === 200 && is_array($senderData)) {
            foreach ($senderData as $s) {
                $senderMap[(string)$s['log_id']] = [
                    'log_id' => (string)$s['log_id'],
                    'username' => (string)$s['name'] // Mapping 'name' to 'username' for frontend compatibility
                ];
            }
        }
    }

    // Step 3: Fetch comment counts for these messages in batch
    $commentCounts = [];
    [$countStatus, $countData] = supabase_request(
        'GET',
        "rest/v1/messages?conversation_id=eq.{$conversationId}&reply_to_id=not.is.null&is_deleted=eq.false&select=reply_to_id"
    );
    
    if ($countStatus === 200 && is_array($countData)) {
        foreach ($countData as $c) {
            $rid = (string)$c['reply_to_id'];
            $commentCounts[$rid] = ($commentCounts[$rid] ?? 0) + 1;
        }
    }

    // Step 4: Fetch reactions for these messages
    $reactionsMap = [];
    $msgIds = array_column($data, 'id');
    if (!empty($msgIds)) {
        [$reactStatus, $reactData] = supabase_request(
            'GET',
            "rest/v1/reactions?message_id=in.(" . implode(',', $msgIds) . ")&select=message_id,emoji,user_id"
        );
        
        if ($reactStatus === 200 && is_array($reactData)) {
            foreach ($reactData as $r) {
                $mid = (string)$r['message_id'];
                $emoji = $r['emoji'];
                if (!isset($reactionsMap[$mid])) $reactionsMap[$mid] = [];
                if (!isset($reactionsMap[$mid][$emoji])) $reactionsMap[$mid][$emoji] = [];
                $reactionsMap[$mid][$emoji][] = (string)$r['user_id'];
            }
        }
    }

    // Map messages back with sender info, comment count, and reactions
    foreach ($data as $msg) {
        $sid = (string)$msg['sender_id'];
        $sender = $senderMap[$sid] ?? null;
        $mid = (string)$msg['id'];
        
        $messages[] = [
            'id' => $mid,
            'conversation_id' => (string)$msg['conversation_id'],
            'sender_id' => $sid,
            'content' => $msg['content'],
            'media_url' => $msg['media_url'] ?? null,
            'media_type' => $msg['media_type'] ?? null,
            'created_at' => $msg['created_at'],
            'edited_at' => $msg['edited_at'] ?? null,
            'is_deleted' => $msg['is_deleted'] ?? false,
            'sender' => $sender,
            'comment_count' => $commentCounts[$mid] ?? 0,
            'reactions' => $reactionsMap[$mid] ?? null
        ];
    }
}

echo json_encode([
    'ok' => true,
    'messages' => $messages,
    'count' => count($messages)
]);
