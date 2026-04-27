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
$date = isset($body['date']) ? (string)$body['date'] : ''; // Format: YYYY-MM-DD
$activityId = isset($body['activity_id']) ? (string)$body['activity_id'] : null;
$projectId = isset($body['project_id']) ? (string)$body['project_id'] : null;
$startTime = isset($body['start_time']) ? (string)$body['start_time'] : null;
$endTime = isset($body['end_time']) ? (string)$body['end_time'] : null;
$remark = isset($body['remark']) ? (string)$body['remark'] : '';

if ($userId === '' || $date === '') {
    echo json_encode(['success' => false, 'message' => 'user_id and date are required']);
    exit;
}

// 1. Get or Create Timesheet for this user/date
[$tStatus, $timesheet, $tErr] = supabase_request(
    'GET', 
    "rest/v1/timesheets?user_id=eq.{$userId}&date=eq.{$date}&select=id",
    null,
    ['Accept: application/vnd.pgrst.object+json']
);

if ($tStatus !== 200 || !isset($timesheet['id'])) {
    // Create new timesheet entry
    [$cStatus, $newSheet, $cErr] = supabase_request('POST', 'rest/v1/timesheets', [
        'user_id' => $userId,
        'date' => $date,
        'status' => 'pending'
    ], ['Prefer: return=representation', 'Accept: application/vnd.pgrst.object+json']);
    
    // Check ID from object response
    if ($cStatus === 201 && isset($newSheet['id'])) {
        $timesheetId = $newSheet['id'];
    } else {
        error_log("Timesheet Creation Error: Status $cStatus, Body " . json_encode($newSheet) . ", Error $cErr");
        echo json_encode([
            'success' => false, 
            'message' => 'Failed to create timesheet', 
            'error' => $cErr, 
            'debug' => "Status: $cStatus - " . (is_string($newSheet) ? $newSheet : json_encode($newSheet))
        ]);
        exit;
    }
} else {
    $timesheetId = $timesheet['id'];
}

// 2. Auto-start logic: if start_time is null/empty, use current HH:mm:ss
if (empty($startTime)) {
    $startTime = date('H:i:s');
}

$activityData = [
    'timesheet_id' => $timesheetId,
    'project_id' => $projectId,
    'start_time' => $startTime,
    'end_time' => empty($endTime) ? null : $endTime,
    'remark' => $remark
];

if (!empty($activityId)) {
    // Update existing activity
    [$uStatus, $updated, $uErr] = supabase_request('PATCH', "rest/v1/timesheet_activities?id=eq.{$activityId}", $activityData);
    if ($uStatus >= 200 && $uStatus < 300) {
        echo json_encode(['success' => true, 'message' => 'Activity updated']);
    } else {
        echo json_encode(['success' => false, 'message' => 'Update failed', 'error' => $uErr]);
    }
} else {
    // Create new activity
    [$iStatus, $inserted, $iErr] = supabase_request('POST', 'rest/v1/timesheet_activities', $activityData);
    if ($iStatus === 201) {
        echo json_encode(['success' => true, 'message' => 'Activity logged']);
    } else {
        echo json_encode([
            'success' => false, 
            'message' => 'Save failed', 
            'error' => $iErr,
            'debug' => "Activity Status: $iStatus, Data: " . json_encode($activityData) . ", Error Response: " . (is_string($inserted) ? $inserted : json_encode($inserted))
        ]);
    }
}
?>
