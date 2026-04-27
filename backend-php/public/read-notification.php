<?php
// read-notification.php
// Marks a specific notification or all user notifications as 'read'
header('Content-Type: application/json');

require 'connect.php';

$data = json_decode(file_get_contents('php://input'), true) ?? $_POST;
$notificationId = isset($data['id']) ? intval($data['id']) : 0;
$userId = isset($data['user_id']) ? intval($data['user_id']) : 0;

if ($notificationId > 0) {
    // Mark one notification read
    $payload = ['is_read' => true];
    [$status, $resp, $err] = supabase_request(
        'PATCH',
        "rest/v1/notifications?id=eq.{$notificationId}",
        $payload
    );
    echo json_encode(['success' => $status >= 200 && $status < 300]);
} else if ($userId > 0) {
    // Mark all notifications read for user
    $payload = ['is_read' => true];
    [$status, $resp, $err] = supabase_request(
        'PATCH',
        "rest/v1/notifications?user_id=eq.{$userId}",
        $payload
    );
    echo json_encode(['success' => $status >= 200 && $status < 300]);
} else {
    echo json_encode(['success' => false, 'message' => 'Valid id or user_id required']);
}
?>
