<?php
// get-attendance-history.php
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
    echo json_encode(['ok' => false, 'message' => 'Missing user_id param']);
    exit;
}

// Get emp_id
[$status, $empData, $err] = supabase_request(
    'GET', "rest/v1/employees?log_id=eq." . urlencode($userId) . "&select=emp_id"
);
if ($err || $status !== 200 || !is_array($empData) || count($empData) === 0) {
    echo json_encode(['ok' => false, 'message' => 'Employee not found']);
    exit;
}
$emp_id = (int)$empData[0]['emp_id'];

// Get attendance history
[$status, $rows, $err] = supabase_request(
    'GET', "rest/v1/attendance?emp_id=eq.{$emp_id}&order=date.desc,timein.desc"
);

if ($status === 200 && is_array($rows)) {
    echo json_encode(['ok' => true, 'history' => $rows]);
} else {
    echo json_encode(['ok' => false, 'message' => 'Failed to fetch history', 'detail' => $err]);
}
?>
