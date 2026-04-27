<?php
// Get leave balance for an employee
// Returns available leave balance by leave type from leave_policies table

// CORS headers
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, Accept');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

header('Content-Type: application/json');

require_once __DIR__ . '/connect.php';

$emp_id = $_GET['emp_id'] ?? null;

if (empty($emp_id)) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'message' => 'Missing emp_id parameter']);
    exit;
}

try {
    // Fetch leave policies from database
    [$status, $policies, $err] = supabase_request(
        'GET',
        "rest/v1/leave_policies?select=leave_type,total_days"
    );
    
    if ($err || $status < 200 || $status >= 300) {
        http_response_code(500);
        echo json_encode(['ok' => false, 'message' => 'Failed to fetch leave policies', 'detail' => $err]);
        exit;
    }
    
    if (empty($policies) || !is_array($policies)) {
        http_response_code(500);
        echo json_encode(['ok' => false, 'message' => 'No leave policies configured']);
        exit;
    }
    
    // Build leave policy map
    $leavePolicy = [];
    foreach ($policies as $policy) {
        $leaveType = $policy['leave_type'] ?? null;
        $totalDays = $policy['total_days'] ?? 0;
        if ($leaveType) {
            $leavePolicy[$leaveType] = $totalDays;
        }
    }
    
    // Get all approved/pending leave requests for this employee
    [$status, $leaveRequests, $err] = supabase_request(
        'GET',
        "rest/v1/leave_requests?emp_id=eq.{$emp_id}&select=*"
    );
    
    if ($err) {
        http_response_code(500);
        echo json_encode(['ok' => false, 'message' => 'Supabase request failed', 'detail' => $err]);
        exit;
    }
    
    if ($status < 200 || $status >= 300) {
        http_response_code($status);
        echo json_encode(['ok' => false, 'message' => 'Failed to fetch leave requests', 'status' => $status]);
        exit;
    }
    
    // Calculate used days by leave type
    $usedByType = [];
    foreach ($leavePolicy as $leaveType => $total) {
        $usedByType[$leaveType] = 0;
    }
    
    if (is_array($leaveRequests)) {
        foreach ($leaveRequests as $leave) {
            // Only count approved and pending requests
            if (in_array($leave['application_status'] ?? '', ['approved', 'pending'])) {
                $leaveType = $leave['leave_type'] ?? 'Vacation';
                
                if (isset($leave['start_date']) && isset($leave['end_date'])) {
                    $startDate = new DateTime($leave['start_date']);
                    $endDate = new DateTime($leave['end_date']);
                    
                    // Add 1 day to end date for inclusive range
                    $endDate->modify('+1 day');
                    
                    $interval = $startDate->diff($endDate);
                    $days = $interval->days;
                    
                    // Adjust for half days
                    if ($leave['is_full_day'] === false) {
                        $days = $days * 0.5;
                    }
                    
                    if (!isset($usedByType[$leaveType])) {
                        $usedByType[$leaveType] = 0;
                    }
                    $usedByType[$leaveType] += $days;
                }
            }
        }
    }
    
    // Build response with balance info
    $balanceData = [];
    foreach ($leavePolicy as $leaveType => $total) {
        $used = floor($usedByType[$leaveType] ?? 0);
        $remaining = $total - $used;
        
        $balanceData[] = [
            'leave_type' => $leaveType,
            'total' => $total,
            'used' => $used,
            'remaining' => max(0, $remaining),
        ];
    }
    
    echo json_encode([
        'ok' => true,
        'data' => $balanceData,
    ]);
    exit;
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'message' => 'Error calculating leave balance', 'detail' => $e->getMessage()]);
    exit;
}
