<?php
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, Accept, ngrok-skip-browser-warning');
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

require_once __DIR__ . '/connect.php';

$userId = isset($_GET['user_id']) ? trim((string)$_GET['user_id']) : '';
if ($userId === '') {
    echo json_encode(['success' => false, 'message' => 'Missing user_id param']);
    exit;
}

[$status, $rows, $err] = supabase_request(
    'GET', "rest/v1/attendance_corrections?user_id=eq.{$userId}&order=created_at.desc"
);

if ($status === 200 && is_array($rows)) {
    echo json_encode(['success' => true, 'corrections' => $rows]);
} else {
    echo json_encode(['success' => false, 'message' => 'Failed to fetch', 'detail' => $err]);
}
?>
