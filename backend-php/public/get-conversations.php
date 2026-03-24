<?php
// Get all conversations for a user
//
// GET /get-conversations.php?user_id=123
//
// Returns list of conversations with last message and unread count

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

// Step 1: Fetch user's conversation IDs from conversation_participants
[$status, $participantData, $err] = supabase_request(
    'GET',
    "rest/v1/conversation_participants?user_id=eq.{$userId}&select=conversation_id"
);

if ($err) {
    error_log("Error fetching conversation participants: " . $err);
    http_response_code(500);
    echo json_encode(['ok' => false, 'message' => 'Database error', 'detail' => $err]);
    exit;
}

if ($status !== 200) {
    http_response_code($status);
    echo json_encode(['ok' => false, 'message' => 'Failed to fetch participants', 'status' => $status]);
    exit;
}

// Extract conversation and fetch details
$conversations = [];
if (is_array($participantData) && count($participantData) > 0) {
    foreach ($participantData as $participant) {
        $convId = $participant['conversation_id'];
        
        // Step 2: Fetch conversation details
        [$convStatus, $convData, $convErr] = supabase_request(
            'GET',
            "rest/v1/conversations?id=eq.{$convId}&select=*"
        );
        
        if ($convStatus === 200 && is_array($convData) && count($convData) > 0) {
            $conv = $convData[0];
            
            // For DMs: get the other participant's user_id (log_id) for profile picture
            $otherUserId = null;
            $dmDisplayName = null; // For DMs we show the other person's name (Messenger-style)
            if ($conv['type'] === 'dm') {
                [$partStatus, $partData] = supabase_request(
                    'GET',
                    "rest/v1/conversation_participants?conversation_id=eq.{$convId}&select=user_id"
                );
                if ($partStatus === 200 && is_array($partData) && count($partData) > 0) {
                    foreach ($partData as $p) {
                        $pid = (string)($p['user_id'] ?? '');
                        if ($pid !== '' && $pid !== (string)$userId) {
                            $otherUserId = $pid;
                            break;
                        }
                    }
                }
                // Fetch the other user's username for display name (so you see their name, not yours)
                if ($otherUserId !== null) {
                    [$unStatus, $unData] = supabase_request(
                        'GET',
                        "rest/v1/accounts?log_id=eq.{$otherUserId}&select=username"
                    );
                    if ($unStatus === 200 && is_array($unData) && count($unData) > 0) {
                        $dmDisplayName = $unData[0]['username'];
                    }
                }
            }
            
            // Step 3: Fetch last message
            [$msgStatus, $msgData] = supabase_request(
                'GET',
                "rest/v1/messages?conversation_id=eq.{$convId}&order=created_at.desc&limit=1&select=content,created_at,sender_id"
            );
            
            $lastMessage = null;
            $lastMessageTime = null;
            if ($msgStatus === 200 && is_array($msgData) && count($msgData) > 0) {
                $lastMsg = $msgData[0];
                $lastMessageTime = $lastMsg['created_at'];

                // Preview: show sender name, or "You" when the current user sent it (Messenger-style)
                $lastSenderId = (string)($lastMsg['sender_id'] ?? '');
                $isCurrentUserSender = ($lastSenderId !== '' && $lastSenderId === (string)$userId);

                if ($conv['type'] === 'channel') {
                    [$senderStatus, $senderData] = supabase_request(
                        'GET',
                        "rest/v1/accounts?log_id=eq.{$lastMsg['sender_id']}&select=username"
                    );
                    $senderName = 'Unknown';
                    if ($senderStatus === 200 && is_array($senderData) && count($senderData) > 0) {
                        $senderName = $senderData[0]['username'];
                    }
                    $lastMessage = $senderName . ': ' . $lastMsg['content'];
                } else {
                    // DM: show "You: msg" when you sent it, "TheirName: msg" when they sent it
                    if ($isCurrentUserSender) {
                        $lastMessage = 'You: ' . $lastMsg['content'];
                    } else {
                        [$senderStatus, $senderData] = supabase_request(
                            'GET',
                            "rest/v1/accounts?log_id=eq.{$lastMsg['sender_id']}&select=username"
                        );
                        $senderName = 'Unknown';
                        if ($senderStatus === 200 && is_array($senderData) && count($senderData) > 0) {
                            $senderName = $senderData[0]['username'];
                        }
                        $lastMessage = $senderName . ': ' . $lastMsg['content'];
                    }
                }
            }
            
            $convPayload = [
                'id' => $conv['id'],
                'name' => ($conv['type'] === 'dm' && $dmDisplayName !== null) ? $dmDisplayName : $conv['name'],
                'type' => $conv['type'],
                'last_message' => $lastMessage,
                'last_message_time' => $lastMessageTime,
                'unread_count' => 0 // TODO: Implement unread count
            ];
            if ($otherUserId !== null) {
                $convPayload['other_user_id'] = $otherUserId;
            }
            $conversations[] = $convPayload;
        }
    }
}

echo json_encode([
    'ok' => true,
    'conversations' => $conversations
]);
