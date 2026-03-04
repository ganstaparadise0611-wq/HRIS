<?php
/**
 * Record attendance (clock-in / clock-out) into Supabase `attendance` table.
 *
 * POST JSON: { "user_id": "<log_id>", "action": "clock_in" | "clock_out" }
 * - clock_in: inserts row with emp_id, timein, date, timeout=NULL
 * - clock_out: updates today's row for emp_id (where timeout IS NULL) with timeout=now()
 */

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, Accept');
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'message' => 'Method not allowed']);
    exit;
}

require_once __DIR__ . '/connect.php';

$raw = file_get_contents('php://input') ?: '';
$body = json_decode($raw, true);
if (!is_array($body)) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'message' => 'Invalid JSON body']);
    exit;
}

$userId = isset($body['user_id']) ? trim((string)$body['user_id']) : '';
$action = isset($body['action']) ? trim((string)$body['action']) : '';

if ($userId === '' || !in_array($action, ['clock_in', 'clock_out'], true)) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'message' => 'Missing or invalid user_id or action (use clock_in or clock_out)']);
    exit;
}

// Resolve log_id (user_id) to emp_id via employees table
[$status, $empData, $err] = supabase_request(
    'GET',
    "rest/v1/employees?log_id=eq." . urlencode($userId) . "&select=emp_id"
);
if ($err) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'message' => 'Database error', 'detail' => $err]);
    exit;
}
if ($status !== 200 || !is_array($empData) || count($empData) === 0) {
    http_response_code(404);
    echo json_encode(['ok' => false, 'message' => 'Employee not found for this user']);
    exit;
}
$emp_id = (int)$empData[0]['emp_id'];
$today = date('Y-m-d');
$nowTime = date('H:i:s');

if ($action === 'clock_in') {
    [$status, $result, $err] = supabase_insert('attendance', [
        'emp_id' => $emp_id,
        'timein' => $nowTime,
        'timeout' => null,
        'date'   => $today,
    ]);
    if ($err) {
        http_response_code(500);
        echo json_encode(['ok' => false, 'message' => 'Failed to record clock-in', 'detail' => $err]);
        exit;
    }
    if ($status < 200 || $status >= 300) {
        http_response_code($status);
        echo json_encode(['ok' => false, 'message' => 'Failed to record clock-in', 'status' => $status]);
        exit;
    }
    echo json_encode([
        'ok' => true,
        'message' => 'Clock-in recorded',
        'emp_id' => $emp_id,
        'date' => $today,
        'timein' => $nowTime,
    ]);
    exit;
}

// clock_out: find today's row for this emp with timeout IS NULL, then set timeout
[$status, $rows, $err] = supabase_request(
    'GET',
    "rest/v1/attendance?emp_id=eq.{$emp_id}&date=eq.{$today}&timeout=is.null&order=att_id.desc&limit=1&select=att_id"
);
if ($err) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'message' => 'Database error', 'detail' => $err]);
    exit;
}
if ($status !== 200 || !is_array($rows) || count($rows) === 0) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'message' => 'No clock-in found for today to clock out']);
    exit;
}
$att_id = (int)$rows[0]['att_id'];

[$status, $result, $err] = supabase_request(
    'PATCH',
    "rest/v1/attendance?att_id=eq.{$att_id}",
    ['timeout' => $nowTime],
    ['Prefer: return=representation']
);
if ($err) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'message' => 'Failed to record clock-out', 'detail' => $err]);
    exit;
}
if ($status < 200 || $status >= 300) {
    http_response_code($status);
    echo json_encode(['ok' => false, 'message' => 'Failed to record clock-out', 'status' => $status]);
    exit;
}
echo json_encode([
    'ok' => true,
    'message' => 'Clock-out recorded',
    'emp_id' => $emp_id,
    'date' => $today,
    'timeout' => $nowTime,
]);
exit;
