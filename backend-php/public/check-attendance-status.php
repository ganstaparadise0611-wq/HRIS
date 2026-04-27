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
if (!$userId) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'message' => 'Missing user_id']);
    exit;
}

[$status, $empData, $err] = supabase_request('GET', "rest/v1/employees?log_id=eq." . urlencode($userId) . "&select=emp_id");
if ($err || $status !== 200 || empty($empData)) {
    http_response_code(404);
    echo json_encode(['ok' => false, 'message' => 'Employee not found']);
    exit;
}
$emp_id = (int)$empData[0]['emp_id'];

date_default_timezone_set('Asia/Manila');
$today = date('Y-m-d');

// Check if there is a clock-in today without a clock-out
[$status, $rows, $err] = supabase_request(
    'GET',
    "rest/v1/attendance?emp_id=eq.{$emp_id}&date=eq.{$today}&timeout=is.null&order=att_id.desc&limit=1&select=timein"
);

if ($err || $status !== 200) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'message' => 'Database error', 'detail' => $err]);
    exit;
}

if (!empty($rows)) {
    echo json_encode([
        'ok' => true,
        'clocked_in' => true,
        'timein' => $rows[0]['timein']
    ]);
} else {
    echo json_encode([
        'ok' => true,
        'clocked_in' => false
    ]);
}
