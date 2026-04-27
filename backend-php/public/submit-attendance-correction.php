<?php
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, PATCH, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, Accept, ngrok-skip-browser-warning');
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

require_once __DIR__ . '/connect.php';

$raw = file_get_contents('php://input');
$data = json_decode($raw, true);

if (!is_array($data)) {
    echo json_encode(['success' => false, 'message' => 'Invalid JSON']);
    exit;
}

$action = $_GET['action'] ?? 'create';

if ($action === 'create') {
    $insertData = [
        'user_id' => $data['user_id'],
        'date' => $data['date'],
        'shift' => $data['shift'] ?? 'Regular',
        'reason' => $data['reason'],
        'before_start_time' => $data['before_start_time'] ?? null,
        'before_end_time' => $data['before_end_time'] ?? null,
        'after_start_time' => $data['after_start_time'],
        'after_end_time' => $data['after_end_time'],
        'attachment' => $data['attachment'] ?? null,
        'status' => 'Pending'
    ];

    [$status, $res, $err] = supabase_request('POST', 'rest/v1/attendance_corrections', $insertData);
    if ($status >= 200 && $status < 300) {
        echo json_encode(['success' => true]);
    } else {
        echo json_encode(['success' => false, 'message' => 'Failed to submit', 'err' => $err]);
    }
} else if ($action === 'update') {
    if (!isset($data['id'])) {
        echo json_encode(['success' => false, 'message' => 'Missing ID']);
        exit;
    }
    
    $updateData = [
        'date' => $data['date'],
        'shift' => $data['shift'] ?? 'Regular',
        'reason' => $data['reason'],
        'after_start_time' => $data['after_start_time'],
        'after_end_time' => $data['after_end_time'],
        'status' => 'Pending'
    ];
    
    if (isset($data['attachment'])) {
        $updateData['attachment'] = $data['attachment'];
    }
    
    [$status, $res, $err] = supabase_request('PATCH', "rest/v1/attendance_corrections?id=eq.{$data['id']}", $updateData);
    
    if ($status >= 200 && $status < 300) {
        echo json_encode(['success' => true]);
    } else {
        echo json_encode(['success' => false, 'message' => 'Failed to update', 'err' => $err]);
    }
} else if ($action === 'delete') {
    if (!isset($data['id'])) {
        echo json_encode(['success' => false, 'message' => 'Missing ID']);
        exit;
    }
    
    [$status, $res, $err] = supabase_request('DELETE', "rest/v1/attendance_corrections?id=eq.{$data['id']}");
    
    if ($status >= 200 && $status < 300) {
        echo json_encode(['success' => true]);
    } else {
        echo json_encode(['success' => false, 'message' => 'Failed to delete', 'err' => $err]);
    }
} else {
    echo json_encode(['success' => false, 'message' => 'Invalid action']);
}
?>
