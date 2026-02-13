<?php
// On Duty Requests API endpoint
//
// POST /on_duty.php - Create new on duty request
// GET /on_duty.php?user_id=123 - Get user's on duty requests
// PATCH /on_duty.php?id=123 - Update on duty request (draft/pending only)
//
// Note: This handles on duty requests for the HRIS system.

set_time_limit(10);
ini_set('max_execution_time', 10);
ini_set('display_errors', 0);
ini_set('log_errors', 1);
error_reporting(E_ALL);

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PATCH, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, Accept');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

require_once __DIR__ . '/connect.php';

$method = $_SERVER['REQUEST_METHOD'];

// GET - Fetch on duty requests
if ($method === 'GET') {
    $userId = isset($_GET['user_id']) ? (int)$_GET['user_id'] : 0;
    
    if ($userId <= 0) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'message' => 'Invalid user_id']);
        exit;
    }

    [$status, $data, $err] = supabase_request(
        'GET',
        "rest/v1/on_duty_requests?user_id=eq.{$userId}&order=created_at.desc"
    );

    if ($err) {
        http_response_code(500);
        echo json_encode([
            'ok' => false,
            'message' => 'Database error: ' . $err
        ]);
        exit;
    }

    if ($status !== 200) {
        http_response_code($status);
        echo json_encode([
            'ok' => false,
            'message' => 'Failed to fetch on duty requests',
            'status' => $status
        ]);
        exit;
    }

    echo json_encode([
        'ok' => true,
        'data' => $data ?: []
    ]);
    exit;
}

// POST - Create new on duty request
if ($method === 'POST') {
    $raw = file_get_contents('php://input') ?: '';
    $body = json_decode($raw, true);

    if (!is_array($body)) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'message' => 'Invalid JSON body']);
        exit;
    }

    $userId = isset($body['user_id']) ? (int)$body['user_id'] : 0;
    $requestFor = trim($body['request_for'] ?? '');
    $onDutyType = trim($body['on_duty_type'] ?? '');
    $remark = trim($body['remark'] ?? '');
    $destination = trim($body['destination'] ?? '');
    $startDate = $body['start_date'] ?? '';
    $endDate = $body['end_date'] ?? '';
    $fullDay = isset($body['full_day']) ? (bool)$body['full_day'] : true;
    $usdAllowance = isset($body['usd_allowance']) ? (float)$body['usd_allowance'] : 0;
    $idrAllowance = isset($body['idr_allowance']) ? (float)$body['idr_allowance'] : 0;
    $attachment = trim($body['attachment'] ?? '');
    $status = trim($body['status'] ?? 'pending');

    // Validation
    if ($userId <= 0) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'message' => 'Invalid user_id']);
        exit;
    }

    if (!$requestFor || !$onDutyType) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'message' => 'Request for and On Duty Type are required']);
        exit;
    }

    if (!$startDate || !$endDate) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'message' => 'Start date and End date are required']);
        exit;
    }

    // Validate date format
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $startDate) || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $endDate)) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'message' => 'Invalid date format. Use YYYY-MM-DD']);
        exit;
    }

    // Validate status
    $validStatuses = ['pending', 'approved', 'rejected', 'draft'];
    if (!in_array($status, $validStatuses)) {
        $status = 'pending';
    }

    // Insert on duty request
    [$insertStatus, $insertData, $insertErr] = supabase_insert('on_duty_requests', [
        'user_id' => $userId,
        'request_for' => $requestFor,
        'on_duty_type' => $onDutyType,
        'remark' => $remark ?: null,
        'destination' => $destination ?: null,
        'start_date' => $startDate,
        'end_date' => $endDate,
        'full_day' => $fullDay,
        'usd_allowance' => $usdAllowance,
        'idr_allowance' => $idrAllowance,
        'attachment' => $attachment ?: null,
        'status' => $status,
    ]);

    if ($insertErr) {
        http_response_code(500);
        echo json_encode([
            'ok' => false,
            'message' => 'Failed to create on duty request: ' . $insertErr
        ]);
        exit;
    }

    if ($insertStatus !== 201) {
        http_response_code($insertStatus);
        $errorMessage = 'Failed to create on duty request';
        if (is_array($insertData)) {
            $errorMessage .= ': ' . ($insertData['message'] ?? $insertData['hint'] ?? json_encode($insertData));
        }
        echo json_encode([
            'ok' => false,
            'message' => $errorMessage,
            'status' => $insertStatus
        ]);
        exit;
    }

    http_response_code(201);
    echo json_encode([
        'ok' => true,
        'message' => 'On duty request created successfully',
        'data' => $insertData
    ]);
    exit;
}

// PATCH - Update on duty request (draft/pending only)
if ($method === 'PATCH') {
    $requestId = isset($_GET['id']) ? (int)$_GET['id'] : 0;
    
    if ($requestId <= 0) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'message' => 'Invalid request ID']);
        exit;
    }

    $raw = file_get_contents('php://input') ?: '';
    $body = json_decode($raw, true);

    if (!is_array($body)) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'message' => 'Invalid JSON body']);
        exit;
    }

    // Build update data
    $updateData = [];
    if (isset($body['on_duty_type'])) $updateData['on_duty_type'] = trim($body['on_duty_type']);
    if (isset($body['remark'])) $updateData['remark'] = trim($body['remark']);
    if (isset($body['destination'])) $updateData['destination'] = trim($body['destination']);
    if (isset($body['start_date'])) $updateData['start_date'] = $body['start_date'];
    if (isset($body['end_date'])) $updateData['end_date'] = $body['end_date'];
    if (isset($body['full_day'])) $updateData['full_day'] = (bool)$body['full_day'];
    if (isset($body['usd_allowance'])) $updateData['usd_allowance'] = (float)$body['usd_allowance'];
    if (isset($body['idr_allowance'])) $updateData['idr_allowance'] = (float)$body['idr_allowance'];
    if (isset($body['attachment'])) $updateData['attachment'] = trim($body['attachment']);
    if (isset($body['status'])) {
        $validStatuses = ['pending', 'approved', 'rejected', 'draft'];
        if (in_array($body['status'], $validStatuses)) {
            $updateData['status'] = $body['status'];
        }
    }

    if (empty($updateData)) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'message' => 'No fields to update']);
        exit;
    }

    // Update on duty request
    [$updateStatus, $updateResult, $updateErr] = supabase_request(
        'PATCH',
        "rest/v1/on_duty_requests?request_id=eq.{$requestId}",
        $updateData,
        ['Prefer: return=minimal']
    );

    if ($updateErr) {
        http_response_code(500);
        echo json_encode([
            'ok' => false,
            'message' => 'Failed to update on duty request: ' . $updateErr
        ]);
        exit;
    }

    if ($updateStatus !== 204 && $updateStatus !== 200) {
        http_response_code($updateStatus);
        echo json_encode([
            'ok' => false,
            'message' => 'Failed to update on duty request',
            'status' => $updateStatus
        ]);
        exit;
    }

    echo json_encode([
        'ok' => true,
        'message' => 'On duty request updated successfully'
    ]);
    exit;
}

// Method not allowed
http_response_code(405);
echo json_encode(['ok' => false, 'message' => 'Method not allowed']);
