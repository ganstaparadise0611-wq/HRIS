<?php
// get-shift.php – Returns the employee's assigned shift schedule
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, Accept, ngrok-skip-browser-warning');
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

require_once __DIR__ . '/connect.php';

$emp_id = isset($_GET['emp_id']) ? trim((string)$_GET['emp_id']) : '';

if ($emp_id === '') {
    echo json_encode(['ok' => false, 'message' => 'Missing emp_id parameter']);
    exit;
}

// 1. Try to get a shift assigned to this employee
[$status, $rows, $err] = supabase_request(
    'GET',
    "rest/v1/shift_schedules?emp_id=eq.{$emp_id}&select=shift_name,start_time,end_time,grace_period_minutes&limit=1"
);

if ($status === 200 && is_array($rows) && count($rows) > 0) {
    echo json_encode([
        'ok'    => true,
        'shift' => $rows[0],
    ]);
    exit;
}

// 2. Fallback: try a default/company-wide shift (emp_id IS NULL)
[$status2, $rows2, $err2] = supabase_request(
    'GET',
    "rest/v1/shift_schedules?emp_id=is.null&select=shift_name,start_time,end_time,grace_period_minutes&limit=1"
);

if ($status2 === 200 && is_array($rows2) && count($rows2) > 0) {
    echo json_encode([
        'ok'    => true,
        'shift' => $rows2[0],
    ]);
    exit;
}

// 3. Return a sensible hardcoded default so the app always shows something
echo json_encode([
    'ok'    => true,
    'shift' => [
        'shift_name'             => 'Regular',
        'start_time'             => '08:00:00',
        'end_time'               => '17:00:00',
        'grace_period_minutes'   => 0,
    ],
]);
?>
