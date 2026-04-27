<?php
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
$date = isset($_GET['date']) ? trim((string)$_GET['date']) : ''; // Format: YYYY-MM-DD

if ($userId === '' || $date === '') {
    echo json_encode(['success' => false, 'message' => 'Missing required parameters']);
    exit;
}

// 1. Fetch Projects for Dropdown
[$pStatus, $projects, $pErr] = supabase_request('GET', 'rest/v1/projects?select=id,name');

// 2. Fetch Timesheet for the user/date
[$tStatus, $timesheet, $tErr] = supabase_request(
    'GET', 
    "rest/v1/timesheets?user_id=eq.{$userId}&date=eq.{$date}&select=id,status,submitted_at,approved_at",
    null,
    ['Accept: application/vnd.pgrst.object+json']
);

$activities = [];
$sheetInfo = null;

if ($tStatus === 200 && isset($timesheet['id'])) {
    $sheetInfo = $timesheet;
    // 3. Fetch Activities for this timesheet
    [$aStatus, $rows, $aErr] = supabase_request(
        'GET', 
        "rest/v1/timesheet_activities?timesheet_id=eq.{$timesheet['id']}&select=id,project_id,start_time,end_time,remark&order=start_time.asc"
    );
    if ($aStatus === 200) $activities = $rows;
}

echo json_encode([
    'success' => true,
    'projects' => $projects ?: [],
    'timesheet' => $sheetInfo,
    'activities' => $activities
]);
?>
