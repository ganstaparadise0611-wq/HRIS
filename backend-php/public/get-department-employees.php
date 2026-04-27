<?php
/**
 * get-department-employees.php
 * Returns employees in the same department as the requesting user.
 *
 * GET params:
 *   user_id — the logged-in user's log_id
 */

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, Accept, ngrok-skip-browser-warning');
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

require_once __DIR__ . '/connect.php';

$userId = isset($_GET['user_id']) ? trim($_GET['user_id']) : '';
if ($userId === '') {
    echo json_encode(['ok' => false, 'message' => 'Missing user_id']);
    exit;
}

// 1. Resolve log_id -> emp record
[$s, $requesterData, $err] = supabase_request(
    'GET',
    "rest/v1/employees?log_id=eq." . urlencode($userId) . "&select=emp_id,dept_id,name,role,log_id"
);
if ($err || $s !== 200 || !is_array($requesterData) || count($requesterData) === 0) {
    echo json_encode(['ok' => false, 'message' => 'Employee not found', 'detail' => $err]);
    exit;
}

$myEmpId = (int)$requesterData[0]['emp_id'];
$myRole  = $requesterData[0]['role'] ?? null;

// 2. Fetch same-role employees
if ($myRole !== null && $myRole !== '') {
    $query = "rest/v1/employees?role=eq." . urlencode($myRole) . "&select=emp_id,log_id,name,role&order=name.asc";
} else {
    $query = "rest/v1/employees?emp_id=eq.{$myEmpId}&select=emp_id,log_id,name,role";
}

[$s, $employees, $err] = supabase_request('GET', $query);
if ($err || $s !== 200 || !is_array($employees)) {
    echo json_encode(['ok' => false, 'message' => 'Failed to fetch employees', 'detail' => $err]);
    exit;
}

// Fetch online status from accounts
$logIds = array_filter(array_column($employees, 'log_id'));
if (!empty($logIds)) {
    $idList = implode(',', array_unique($logIds));
    [$status, $accData] = supabase_request('GET', "rest/v1/accounts?log_id=in.({$idList})&select=log_id,is_online");
    if ($status === 200 && is_array($accData)) {
        $onlineMap = [];
        foreach ($accData as $acc) {
            $onlineMap[(string)$acc['log_id']] = (bool)($acc['is_online'] ?? false);
        }
        foreach ($employees as &$emp) {
            $emp['is_online'] = $onlineMap[(string)$emp['log_id']] ?? false;
        }
        unset($emp);
    }
}

echo json_encode([
    'ok'        => true,
    'employees' => $employees,
    'my_emp_id' => $myEmpId,
    'role'      => $myRole,
]);
