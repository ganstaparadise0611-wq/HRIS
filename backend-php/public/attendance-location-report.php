<?php
/**
 * attendance-location-report.php
 *
 * Returns per-day attendance records (with geofence radius data) for a list of
 * employees, filtered by date range.
 *
 * GET params:
 *   user_id    — logged-in user's log_id (used to authorise same-dept access)
 *   emp_ids    — comma-separated emp_id values
 *   start_date — YYYY-MM-DD
 *   end_date   — YYYY-MM-DD
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

// ── Input validation ──────────────────────────────────────────────────────────
$userId    = isset($_GET['user_id'])    ? trim($_GET['user_id'])    : '';
$empIdsRaw = isset($_GET['emp_ids'])    ? trim($_GET['emp_ids'])    : '';
$startDate = isset($_GET['start_date']) ? trim($_GET['start_date']) : '';
$endDate   = isset($_GET['end_date'])   ? trim($_GET['end_date'])   : '';

if ($userId === '') {
    echo json_encode(['ok' => false, 'message' => 'Missing user_id']);
    exit;
}
if ($empIdsRaw === '') {
    echo json_encode(['ok' => false, 'message' => 'Missing emp_ids']);
    exit;
}
if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $startDate) || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $endDate)) {
    echo json_encode(['ok' => false, 'message' => 'Invalid date format. Use YYYY-MM-DD.']);
    exit;
}

// Sanitise emp_ids: allow only integers
$rawIds = explode(',', $empIdsRaw);
$empIds = [];
foreach ($rawIds as $id) {
    $id = (int)trim($id);
    if ($id > 0) $empIds[] = $id;
}
if (empty($empIds)) {
    echo json_encode(['ok' => false, 'message' => 'No valid emp_ids supplied']);
    exit;
}

// ── Fetch employee info (name, emp_number) ────────────────────────────────────
$empIdsQuery = implode(',', $empIds);
[$s, $employees, $err] = supabase_request(
    'GET',
    "rest/v1/employees?emp_id=in.({$empIdsQuery})&select=emp_id,name&order=name.asc"
);
if ($err || $s !== 200 || !is_array($employees)) {
    echo json_encode(['ok' => false, 'message' => 'Failed to fetch employees', 'detail' => $err]);
    exit;
}

// Build a map: emp_id => { name, emp_number }
$empMap = [];
foreach ($employees as $e) {
    $empMap[(int)$e['emp_id']] = [
        'name'       => $e['name']       ?? '',
        'emp_number' => $e['emp_number'] ?? (string)$e['emp_id'],
    ];
}

// ── Fetch attendance records ──────────────────────────────────────────────────
// We fetch each employee separately to avoid URL-length issues with many IDs.
// The attendance table has columns: att_id, emp_id, date, timein, timeout,
// actual_radius_in, actual_radius_out  (add these columns if missing – see README)
$allRows = [];
$no      = 1;

foreach ($empIds as $empId) {
    [$s, $rows, $err] = supabase_request(
        'GET',
        "rest/v1/attendance?emp_id=eq.{$empId}&date=gte.{$startDate}&date=lte.{$endDate}&order=date.asc&select=att_id,emp_id,date,timein,timeout,actual_radius_in,actual_radius_out,latitude_in,longitude_in,latitude_out,longitude_out"
    );
    if ($err || $s !== 200 || !is_array($rows)) continue;

    $info = $empMap[$empId] ?? ['name' => 'Unknown', 'emp_number' => (string)$empId];

    // Create a dictionary of existing records by date
    $recordMap = [];
    foreach ($rows as $row) {
        if (!empty($row['date'])) {
            $recordMap[$row['date']] = $row;
        }
    }

    $startTs = strtotime($startDate);
    $endTs   = strtotime($endDate);

    // Loop through each day in the date range
    for ($currentTs = $startTs; $currentTs <= $endTs; $currentTs = strtotime('+1 day', $currentTs)) {
        $currentDateStr = date('Y-m-d', $currentTs);
        $dateFormatted  = date('d M Y', $currentTs);

        if (isset($recordMap[$currentDateStr])) {
            $row = $recordMap[$currentDateStr];
            
            // Radius values: null → "No Data", otherwise show as string
            $radIn  = isset($row['actual_radius_in'])  && $row['actual_radius_in']  !== null
                        ? (string)$row['actual_radius_in']
                        : 'No Data';
            $radOut = isset($row['actual_radius_out']) && $row['actual_radius_out'] !== null
                        ? (string)$row['actual_radius_out']
                        : 'No Data';

            $coordsIn = 'No Data';
            if (isset($row['latitude_in']) && isset($row['longitude_in'])) {
                $coordsIn = $row['latitude_in'] . ', ' . $row['longitude_in'];
            }
            $coordsOut = 'No Data';
            if (isset($row['latitude_out']) && isset($row['longitude_out'])) {
                $coordsOut = $row['latitude_out'] . ', ' . $row['longitude_out'];
            }

            $allRows[] = [
                'no'                => $no++,
                'emp_id'            => $empId,
                'emp_number'        => $info['emp_number'],
                'name'              => $info['name'],
                'date'              => $dateFormatted,
                'date_raw'          => $row['date'],
                'timein'            => $row['timein']  ?? null,
                'timeout'           => $row['timeout'] ?? null,
                'actual_radius_in'  => $radIn,
                'actual_radius_out' => $radOut,
                'coords_in'         => $coordsIn,
                'coords_out'        => $coordsOut,
            ];
        } else {
            // Missing record day
            $allRows[] = [
                'no'                => $no++,
                'emp_id'            => $empId,
                'emp_number'        => $info['emp_number'],
                'name'              => $info['name'],
                'date'              => $dateFormatted,
                'date_raw'          => $currentDateStr,
                'timein'            => null,
                'timeout'           => null,
                'actual_radius_in'  => 'No Data',
                'actual_radius_out' => 'No Data',
                'coords_in'         => 'No Data',
                'coords_out'        => 'No Data',
            ];
        }
    }
}

echo json_encode([
    'ok'           => true,
    'report'       => $allRows,
    'generated_at' => date('Y-m-d H:i:s'),
    'total'        => count($allRows),
]);
