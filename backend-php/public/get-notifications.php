<?php
// get-notifications.php
// Fetches the notification history for a specific user ID
header('Content-Type: application/json');

require 'connect.php';

$userId = isset($_GET['user_id']) ? intval($_GET['user_id']) : 0;

if ($userId <= 0) {
    echo json_encode(['success' => false, 'message' => 'Valid user_id required']);
    exit;
}

// Fetch notifications descending by date
[$status, $data, $err] = supabase_request(
    'GET', 
    "rest/v1/notifications?user_id=eq.{$userId}&order=created_at.desc"
);

if ($status === 200) {
    echo json_encode(['success' => true, 'notifications' => $data]);
} else {
    echo json_encode(['success' => false, 'message' => $err ?? 'Failed to fetch notifications']);
}
?>
