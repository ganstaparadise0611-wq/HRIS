<?php
// Get all conversations for a user
//
// GET /get-conversations.php?user_id=123
//
// Returns list of conversations with last message and unread count

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
            
            // Step 3: Fetch last message
            [$msgStatus, $msgData] = supabase_request(
                'GET',
                "rest/v1/messages?conversation_id=eq.{$convId}&order=created_at.desc&limit=1&select=content,created_at,sender_id"
            );
            
            $lastMessage = null;
            $lastMessageTime = null;
            if ($msgStatus === 200 && is_array($msgData) && count($msgData) > 0) {
                $lastMsg = $msgData[0];
                
                // Fetch sender username
                [$senderStatus, $senderData] = supabase_request(
                    'GET',
                    "rest/v1/accounts?log_id=eq.{$lastMsg['sender_id']}&select=username"
                );
                
                $senderName = 'Unknown';
                if ($senderStatus === 200 && is_array($senderData) && count($senderData) > 0) {
                    $senderName = $senderData[0]['username'];
                }
                
                $lastMessage = ($conv['type'] === 'channel' ? '' : $senderName . ': ') . $lastMsg['content'];
                $lastMessageTime = $lastMsg['created_at'];
            }
            
            $conversations[] = [
                'id' => $conv['id'],
                'name' => $conv['name'],
                'type' => $conv['type'],
                'last_message' => $lastMessage,
                'last_message_time' => $lastMessageTime,
                'unread_count' => 0 // TODO: Implement unread count
            ];
        }
    }
}

echo json_encode([
    'ok' => true,
    'conversations' => $conversations
]);
