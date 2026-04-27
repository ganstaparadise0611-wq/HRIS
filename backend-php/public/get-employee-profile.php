<?php
// get-employee-profile.php
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

// Fetch employee record by log_id
[$status, $empData, $err] = supabase_request(
    'GET',
    'rest/v1/employees?log_id=eq.' . urlencode($userId) . '&select=*'
);

if ($err || $status !== 200 || !is_array($empData) || count($empData) === 0) {
    echo json_encode(['ok' => false, 'message' => 'Employee not found', 'detail' => $err]);
    exit;
}

$employee = $empData[0];

// Fetch department name if dept_id exists
if (!empty($employee['dept_id'])) {
    [$deptStatus, $deptData, $deptErr] = supabase_request(
        'GET',
        'rest/v1/departments?dept_id=eq.' . urlencode($employee['dept_id']) . '&select=name'
    );
    if ($deptStatus === 200 && is_array($deptData) && count($deptData) > 0) {
        $employee['department_name'] = $deptData[0]['name'];
    }
}

// Fetch profile picture from accounts table
[$accStatus, $accData, $accErr] = supabase_request(
    'GET',
    'rest/v1/accounts?log_id=eq.' . urlencode($userId) . '&select=profile_picture'
);
if ($accStatus === 200 && is_array($accData) && count($accData) > 0) {
    $employee['profile_picture'] = $accData[0]['profile_picture'] ?? null;
}

echo json_encode(['ok' => true, 'employee' => $employee]);
?>
