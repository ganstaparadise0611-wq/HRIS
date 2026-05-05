<?php
// Get all conversations for a user - HIGHLY OPTIMIZED with Parallel Requests
//
// GET /get-conversations.php?user_id=123
//

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

$userId = $_GET['user_id'] ?? '';

if (empty($userId)) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'message' => 'Missing user_id']);
    exit;
}

// Step 1: Fetch user's conversation IDs
[$status, $participantData, $err] = supabase_request(
    'GET',
    "rest/v1/conversation_participants?user_id=eq.{$userId}&select=conversation_id"
);

if ($err || $status !== 200) {
    http_response_code($status ?: 500);
    echo json_encode(['ok' => false, 'message' => 'Database error', 'detail' => $err]);
    exit;
}

if (!is_array($participantData) || count($participantData) === 0) {
    echo json_encode(['ok' => true, 'conversations' => []]);
    exit;
}

$convIds = array_unique(array_column($participantData, 'conversation_id'));
$idList = implode(',', $convIds);

// Step 2, 3 & 5: Fetch details, ALL participants, and LAST MESSAGES in parallel
$multiReqs = [
    'details' => ['method' => 'GET', 'path' => "rest/v1/conversations?id=in.({$idList})&select=*"],
    'participants' => ['method' => 'GET', 'path' => "rest/v1/conversation_participants?conversation_id=in.({$idList})&select=conversation_id,user_id"]
];

// Add message requests to the parallel batch
foreach ($convIds as $cid) {
    $multiReqs["msg_{$cid}"] = [
        'method' => 'GET',
        'path' => "rest/v1/messages?conversation_id=eq.{$cid}&order=created_at.desc&limit=1&select=content,created_at,sender_id,media_url"
    ];
}

$multiResults = supabase_request_multi($multiReqs);

$convDetailsMap = $multiResults['details'][1] ?? [];
$allParts = $multiResults['participants'][1] ?? [];

// Group conversations by ID
$chats = [];
if (is_array($convDetailsMap)) {
    foreach ($convDetailsMap as $c) {
        $chats[$c['id']] = $c;
    }
}

// Identify DM other participants and Sender IDs for previews
$dmOtherUserIds = [];
$convOtherUserMap = [];
if (is_array($allParts)) {
    foreach ($allParts as $p) {
        $cid = $p['conversation_id'];
        $pid = (string)$p['user_id'];
        if ($pid !== (string)$userId && isset($chats[$cid]) && $chats[$cid]['type'] === 'dm') {
            $dmOtherUserIds[] = $pid;
            $convOtherUserMap[$cid] = $pid;
        }
    }
}

$tempResults = [];
$senderIdsToFetch = [];

foreach ($convIds as $cid) {
    [$mStatus, $mData] = $multiResults["msg_{$cid}"] ?? [0, null];
    $lastMsg = ($mStatus === 200 && is_array($mData) && count($mData) > 0) ? $mData[0] : null;
    
    if ($lastMsg) {
        $senderIdsToFetch[] = (string)$lastMsg['sender_id'];
    }
    
    $otherUserId = $convOtherUserMap[$cid] ?? null;
    $chat = $chats[$cid] ?? null;
    if (!$chat) continue;
    
    $tempResults[] = [
        'id' => $chat['id'],
        'name' => $chat['name'],
        'type' => $chat['type'],
        'last_message_raw' => $lastMsg,
        'other_user_id' => $otherUserId
    ];
}

// Step 4 & 6: Fetch ALL needed user info (DMs and Senders) in a single batch
$userNamesMap = [];
$userOnlineMap = [];
$allUserIdsToFetch = array_unique(array_merge($dmOtherUserIds, $senderIdsToFetch));

if (!empty($allUserIdsToFetch)) {
    $uIdList = implode(',', $allUserIdsToFetch);
    
    // Fetch names from employees table
    [$eStatus, $eData] = supabase_request('GET', "rest/v1/employees?log_id=in.({$uIdList})&select=log_id,name");
    
    // Fetch online status from accounts table
    [$uStatus, $uData] = supabase_request('GET', "rest/v1/accounts?log_id=in.({$uIdList})&select=log_id,is_online");
    
    if ($eStatus === 200 && is_array($eData)) {
        foreach ($eData as $e) {
            $userNamesMap[(string)$e['log_id']] = (string)$e['name'];
        }
    }
    
    if ($uStatus === 200 && is_array($uData)) {
        foreach ($uData as $u) {
            $userOnlineMap[(string)$u['log_id']] = (bool)($u['is_online'] ?? false);
        }
    }
}

// Step 7: Final assembly
$finalConversations = [];
foreach ($tempResults as $res) {
    $lastMsg = $res['last_message_raw'];
    $lastMessageString = 'No messages yet';
    $lastMessageTime = null;
    
    if ($lastMsg) {
        $lastMessageTime = $lastMsg['created_at'];
        $senderId = (string)$lastMsg['sender_id'];
        $isYou = ($senderId === (string)$userId);
        $senderName = $userNamesMap[$senderId] ?? 'Unknown';
        
        $content = $lastMsg['content'];
        if (empty($content) && !empty($lastMsg['media_url'])) {
            $content = '[Attachment]';
        }
        
        if ($isYou) {
            $lastMessageString = 'You: ' . $content;
        } else {
            $lastMessageString = $senderName . ': ' . $content;
        }
    }
    
    $displayName = $res['name'];
    if ($res['type'] === 'dm' && $res['other_user_id']) {
        $displayName = $userNamesMap[$res['other_user_id']] ?? $res['name'];
    }

    $payload = [
        'id' => $res['id'],
        'name' => $displayName,
        'type' => $res['type'],
        'last_message' => $lastMessageString,
        'last_message_time' => $lastMessageTime,
        'unread_count' => 0
    ];
    if ($res['other_user_id']) {
        $payload['other_user_id'] = $res['other_user_id'];
        $payload['online'] = $userOnlineMap[$res['other_user_id']] ?? false;
    }
    $finalConversations[] = $payload;
}

echo json_encode([
    'ok' => true,
    'conversations' => $finalConversations
]);
