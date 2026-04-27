<?php
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, Accept, ngrok-skip-browser-warning');
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

require_once __DIR__ . '/connect.php';

$raw = file_get_contents('php://input') ?: '';
$body = json_decode($raw, true);

if (!$body) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Invalid JSON']);
    exit;
}

$userId = isset($body['user_id']) ? (string)$body['user_id'] : '';
$dates = isset($body['dates']) ? (array)$body['dates'] : []; // Array of dates: ['2026-03-25', '2026-03-26']

if ($userId === '' || empty($dates)) {
    echo json_encode(['success' => false, 'message' => 'user_id and dates are required']);
    exit;
}

// Update status to 'submitted' for all matching user/date entries
$filter = "user_id=eq.{$userId}&date=in.(" . implode(',', array_map('urlencode', $dates)) . ")";
[$sStatus, $updated, $sErr] = supabase_request(
    'PATCH', 
    "rest/v1/timesheets?{$filter}", 
    [
        'status' => 'submitted',
        'submitted_at' => date('c') // ISO 8601
    ]
);

if ($sStatus >= 200 && $sStatus < 300) {
    echo json_encode(['success' => true, 'message' => count($dates) . " timesheets submitted"]);
} else {
    echo json_encode(['success' => false, 'message' => "Submission failed", 'error' => $sErr]);
}
?>
