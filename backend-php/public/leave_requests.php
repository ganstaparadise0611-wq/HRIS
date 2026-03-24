<?php
// Leave requests API endpoint
// Handles CREATE, GET, UPDATE, and DELETE operations for leave requests

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
require_once __DIR__ . '/notify-helper.php';

// GET endpoint - Get leave history for an employee
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $emp_id = $_GET['emp_id'] ?? null;
    
    if (empty($emp_id)) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'message' => 'Missing emp_id parameter']);
        exit;
    }
    
    [$status, $result, $err] = supabase_request(
        'GET',
        "rest/v1/leave_requests?emp_id=eq.{$emp_id}&select=*&order=created_at.desc"
    );
    
    if ($err) {
        http_response_code(500);
        echo json_encode(['ok' => false, 'message' => 'Supabase request failed', 'detail' => $err]);
        exit;
    }
    
    if ($status < 200 || $status >= 300) {
        http_response_code($status);
        echo json_encode(['ok' => false, 'message' => 'Failed to load leave history', 'status' => $status]);
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
    $leave_type = $body['leave_type'] ?? null;
    $reason = $body['reason'] ?? null;
    $start_date = $body['start_date'] ?? null;
    $end_date = $body['end_date'] ?? null;
    
    if (empty($emp_id) || empty($leave_type) || empty($reason)) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'message' => 'Missing required fields: emp_id, leave_type, reason']);
        exit;
    }
    
    $insertData = [
        'emp_id' => $emp_id,
        'leave_type' => $leave_type,
        'reason' => $reason,
    ];
    
    if ($start_date !== null) {
        $insertData['start_date'] = $start_date;
    }
    if ($end_date !== null) {
        $insertData['end_date'] = $end_date;
    }
    
    [$status, $result, $err] = supabase_request(
        'POST',
        'rest/v1/leave_requests',
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
        echo json_encode(['ok' => false, 'message' => 'Failed to create leave request', 'status' => $status, 'body' => $result]);
        exit;
    }
    
    // Push notification: confirm submission to the requesting employee
    notify_users(
        [(int)$emp_id],
        '📋 Leave Request Submitted',
        "Your {$leave_type} leave request has been submitted and is pending approval.",
        ['type' => 'leave_request']
    );

    echo json_encode([
        'ok' => true,
        'message' => 'Leave request created successfully',
        'data' => $result,
    ]);
    exit;
}

// UPDATE and DELETE require leave_id
$leave_id = $body['leave_id'] ?? null;

if (empty($leave_id) && ($action === 'update' || $action === 'delete')) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'message' => 'Missing leave_id']);
    exit;
}

// UPDATE endpoint
if ($action === 'update') {
    $leave_type = $body['leave_type'] ?? null;
    $reason = $body['reason'] ?? null;
    $start_date = $body['start_date'] ?? null;
    $end_date = $body['end_date'] ?? null;

    if (!$leave_type || !$reason) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'message' => 'Missing required fields: leave_type, reason']);
        exit;
    }

    // Only allow updating Vacation leave requests
    if ($leave_type !== 'Vacation') {
        http_response_code(403);
        echo json_encode(['ok' => false, 'message' => 'Only Vacation leave requests can be updated']);
        exit;
    }

    $updateData = [
        'leave_type' => $leave_type,
        'reason' => $reason,
    ];

    if ($start_date !== null) {
        $updateData['start_date'] = $start_date;
    }
    if ($end_date !== null) {
        $updateData['end_date'] = $end_date;
    }

    [$status, $result, $err] = supabase_request(
        'PATCH',
        "rest/v1/leave_requests?leave_id=eq.{$leave_id}",
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
        echo json_encode(['ok' => false, 'message' => 'Failed to update leave request', 'status' => $status, 'body' => $result]);
        exit;
    }

    echo json_encode([
        'ok' => true,
        'message' => 'Leave request updated successfully',
        'data' => $result,
    ]);
    exit;
}

// DELETE endpoint
if ($action === 'delete') {
    // First check if it's a Vacation leave (only Vacation can be deleted)
    [$status, $leaveData, $err] = supabase_request(
        'GET',
        "rest/v1/leave_requests?leave_id=eq.{$leave_id}&select=leave_type"
    );

    if ($err || $status < 200 || $status >= 300) {
        http_response_code(500);
        echo json_encode(['ok' => false, 'message' => 'Failed to fetch leave request']);
        exit;
    }

    if (empty($leaveData) || !is_array($leaveData) || count($leaveData) === 0) {
        http_response_code(404);
        echo json_encode(['ok' => false, 'message' => 'Leave request not found']);
        exit;
    }

    $leaveType = $leaveData[0]['leave_type'] ?? '';
    if ($leaveType !== 'Vacation') {
        http_response_code(403);
        echo json_encode(['ok' => false, 'message' => 'Only Vacation leave requests can be deleted']);
        exit;
    }

    [$status, $result, $err] = supabase_request(
        'DELETE',
        "rest/v1/leave_requests?leave_id=eq.{$leave_id}"
    );

    if ($err) {
        http_response_code(500);
        echo json_encode(['ok' => false, 'message' => 'Supabase request failed', 'detail' => $err]);
        exit;
    }

    if ($status < 200 || $status >= 300) {
        http_response_code($status);
        echo json_encode(['ok' => false, 'message' => 'Failed to delete leave request', 'status' => $status]);
        exit;
    }

    echo json_encode([
        'ok' => true,
        'message' => 'Leave request deleted successfully',
    ]);
    exit;
}

// Invalid action
http_response_code(400);
echo json_encode(['ok' => false, 'message' => 'Invalid action. Use "create", "update", or "delete"']);
exit;
