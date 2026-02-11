<?php
// Overtime requests API endpoint
// Handles CREATE, GET, UPDATE, and DELETE operations for overtime requests

// CORS headers
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, Accept');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

header('Content-Type: application/json');

require_once __DIR__ . '/connect.php';

// GET endpoint - Get overtime history for an employee
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $emp_id = $_GET['emp_id'] ?? null;
    
    if (empty($emp_id)) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'message' => 'Missing emp_id parameter']);
        exit;
    }
    
    [$status, $result, $err] = supabase_request(
        'GET',
        "rest/v1/overtime_requests?emp_id=eq.{$emp_id}&select=*&order=created_at.desc"
    );
    
    if ($err) {
        http_response_code(500);
        echo json_encode(['ok' => false, 'message' => 'Supabase request failed', 'detail' => $err]);
        exit;
    }
    
    if ($status < 200 || $status >= 300) {
        http_response_code($status);
        echo json_encode(['ok' => false, 'message' => 'Failed to load overtime history', 'status' => $status]);
        exit;
    }
    
    echo json_encode([
        'ok' => true,
        'data' => is_array($result) ? $result : [],
    ]);
    exit;
}

// POST endpoint - Handle CREATE, UPDATE, DELETE
$raw = file_get_contents('php://input') ?: '';
$body = json_decode($raw, true);

if (!is_array($body)) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'message' => 'Invalid JSON body']);
    exit;
}

$action = $body['action'] ?? '';

// CREATE endpoint
if ($action === 'create') {
    $emp_id = $body['emp_id'] ?? null;
    $date = $body['date'] ?? null;
    $start_time = $body['start_time'] ?? null;
    $end_time = $body['end_time'] ?? null;
    $reason = $body['reason'] ?? null;
    
    if (empty($emp_id) || empty($date) || empty($start_time) || empty($end_time) || empty($reason)) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'message' => 'Missing required fields: emp_id, date, start_time, end_time, reason']);
        exit;
    }
    
    // Calculate total hours
    $start = new DateTime($date . ' ' . $start_time);
    $end = new DateTime($date . ' ' . $end_time);
    
    // Handle case where end time is next day
    if ($end < $start) {
        $end->modify('+1 day');
    }
    
    $diff = $start->diff($end);
    $total_hours = $diff->h + ($diff->i / 60) + ($diff->s / 3600);
    
    $insertData = [
        'emp_id' => $emp_id,
        'date' => $date,
        'time' => $start_time . '-' . $end_time, // Store as range or separate fields if your schema requires
        'reason' => $reason,
        'status' => 'Pending',
    ];
    
    // If your schema has separate start_time and end_time columns, use those instead
    // $insertData['start_time'] = $start_time;
    // $insertData['end_time'] = $end_time;
    
    [$status, $result, $err] = supabase_request(
        'POST',
        'rest/v1/overtime_requests',
        [$insertData],
        ['Prefer: return=representation']
    );
    
    if ($err) {
        http_response_code(500);
        echo json_encode(['ok' => false, 'message' => 'Supabase request failed', 'detail' => $err]);
        exit;
    }
    
    if ($status < 200 || $status >= 300) {
        http_response_code($status);
        echo json_encode(['ok' => false, 'message' => 'Failed to create overtime request', 'status' => $status, 'body' => $result]);
        exit;
    }
    
    echo json_encode([
        'ok' => true,
        'message' => 'Overtime request created successfully',
        'data' => $result,
    ]);
    exit;
}

// UPDATE and DELETE require ovt_id
$ovt_id = $body['ovt_id'] ?? null;

if (empty($ovt_id) && ($action === 'update' || $action === 'delete')) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'message' => 'Missing ovt_id']);
    exit;
}

// UPDATE endpoint
if ($action === 'update') {
    $date = $body['date'] ?? null;
    $start_time = $body['start_time'] ?? null;
    $end_time = $body['end_time'] ?? null;
    $reason = $body['reason'] ?? null;

    if (!$date || !$start_time || !$end_time || !$reason) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'message' => 'Missing required fields: date, start_time, end_time, reason']);
        exit;
    }

    $updateData = [
        'date' => $date,
        'time' => $start_time . '-' . $end_time,
        'reason' => $reason,
    ];

    [$status, $result, $err] = supabase_request(
        'PATCH',
        "rest/v1/overtime_requests?ovt_id=eq.{$ovt_id}",
        $updateData,
        ['Prefer: return=representation']
    );

    if ($err) {
        http_response_code(500);
        echo json_encode(['ok' => false, 'message' => 'Supabase request failed', 'detail' => $err]);
        exit;
    }

    if ($status < 200 || $status >= 300) {
        http_response_code($status);
        echo json_encode(['ok' => false, 'message' => 'Failed to update overtime request', 'status' => $status, 'body' => $result]);
        exit;
    }

    echo json_encode([
        'ok' => true,
        'message' => 'Overtime request updated successfully',
        'data' => $result,
    ]);
    exit;
}

// DELETE endpoint
if ($action === 'delete') {
    [$status, $result, $err] = supabase_request(
        'DELETE',
        "rest/v1/overtime_requests?ovt_id=eq.{$ovt_id}"
    );

    if ($err) {
        http_response_code(500);
        echo json_encode(['ok' => false, 'message' => 'Supabase request failed', 'detail' => $err]);
        exit;
    }

    if ($status < 200 || $status >= 300) {
        http_response_code($status);
        echo json_encode(['ok' => false, 'message' => 'Failed to delete overtime request', 'status' => $status]);
        exit;
    }

    echo json_encode([
        'ok' => true,
        'message' => 'Overtime request deleted successfully',
    ]);
    exit;
}

// Invalid action
http_response_code(400);
echo json_encode(['ok' => false, 'message' => 'Invalid action. Use "create", "update", or "delete"']);
exit;
