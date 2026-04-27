<?php
/**
 * attendance-report.php
 * Generates a consolidated Attendance Report across employees for a given date range.
 * Columns match the GreatDay HRIS exact spec.
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

$userId    = isset($_GET['user_id'])    ? trim($_GET['user_id'])    : '';
$startDate = isset($_GET['start_date']) ? trim($_GET['start_date']) : '';
$endDate   = isset($_GET['end_date'])   ? trim($_GET['end_date'])   : '';
// Optional: comma-separated emp_ids to filter specific employees (e.g. "3,7,12")
$empIdsParam = isset($_GET['emp_ids']) ? trim($_GET['emp_ids']) : '';

if ($userId === '' || $startDate === '' || $endDate === '') {
    echo json_encode(['ok' => false, 'message' => 'Missing required params: user_id, start_date, end_date']);
    exit;
}

// ------------------------------------------------------------------
// 1. Validate requesting user
// ------------------------------------------------------------------
[$s, $requesterData, $err] = supabase_request(
    'GET',
    "rest/v1/employees?log_id=eq." . urlencode($userId) . "&select=emp_id,dept_id,name,role"
);
if ($err || $s !== 200 || !is_array($requesterData) || count($requesterData) === 0) {
    echo json_encode([
        'ok'      => false,
        'message' => 'Requesting employee not found',
        'detail'  => $err,
        'status'  => $s,
        'user_id' => $userId,
    ]);
    exit;
}

$requesterEmpId = (int)$requesterData[0]['emp_id'];
$myRole         = $requesterData[0]['role'] ?? null;

// ------------------------------------------------------------------
// 2. Fetch employees in the SAME role as the requester
//    Optionally filtered to only the emp_ids the user selected
// ------------------------------------------------------------------
if ($empIdsParam !== '') {
    // User selected specific employees
    $safeIds = implode(',', array_map('intval', explode(',', $empIdsParam)));
    $empQuery = "rest/v1/employees?emp_id=in.({$safeIds})&select=emp_id,name,role,dept_id,log_id&order=name.asc";
} elseif ($myRole !== null && $myRole !== '') {
    $empQuery = "rest/v1/employees?role=eq." . urlencode($myRole) . "&select=emp_id,name,role,dept_id,log_id&order=name.asc";
} else {
    $empQuery = "rest/v1/employees?emp_id=eq.{$requesterEmpId}&select=emp_id,name,role,dept_id,log_id";
}

[$s, $employees, $err] = supabase_request('GET', $empQuery);
if ($err || $s !== 200 || !is_array($employees)) {
    echo json_encode(['ok' => false, 'message' => 'Failed to fetch employees', 'detail' => $err]);
    exit;
}

// ------------------------------------------------------------------
// 3. Fetch attendance records in range
// ------------------------------------------------------------------
[$s, $attendanceRows, $err] = supabase_request(
    'GET',
    "rest/v1/attendance?date=gte.{$startDate}&date=lte.{$endDate}&select=emp_id,date,timein,timeout,status"
);
$attendanceRows = (is_array($attendanceRows) && $s === 200) ? $attendanceRows : [];

// ------------------------------------------------------------------
// 4. Fetch leave requests in range
// ------------------------------------------------------------------
[$s, $leaveRows, $err] = supabase_request(
    'GET',
    "rest/v1/leave_requests?start_date=gte.{$startDate}&start_date=lte.{$endDate}&select=emp_id,leave_type,status,start_date,end_date"
);
$leaveRows = (is_array($leaveRows) && $s === 200) ? $leaveRows : [];

// ------------------------------------------------------------------
// 5. Fetch overtime in range
// ------------------------------------------------------------------
[$s, $ovtRows, $err] = supabase_request(
    'GET',
    "rest/v1/ovts?date=gte.{$startDate}&date=lte.{$endDate}&select=emp_id,date,status,reason"
);
$ovtRows = (is_array($ovtRows) && $s === 200) ? $ovtRows : [];

// ------------------------------------------------------------------
// 6. Index by emp_id
// ------------------------------------------------------------------
$attByEmp   = [];
foreach ($attendanceRows as $row) { $attByEmp[(int)$row['emp_id']][]   = $row; }
$leaveByEmp = [];
foreach ($leaveRows as $row)      { $leaveByEmp[(int)$row['emp_id']][] = $row; }
$ovtByEmp   = [];
foreach ($ovtRows as $row)        { $ovtByEmp[(int)$row['emp_id']][]   = $row; }

// Helper: case-insensitive partial match
function matchesAny(string $haystack, array $needles): bool {
    $h = strtolower($haystack);
    foreach ($needles as $n) {
        if (str_contains($h, strtolower($n))) return true;
    }
    return false;
}

// ------------------------------------------------------------------
// 7. Build report per employee
// ------------------------------------------------------------------
$report = [];

foreach ($employees as $idx => $emp) {
    $eid   = (int)$emp['emp_id'];
    $att   = $attByEmp[$eid]   ?? [];
    $leave = $leaveByEmp[$eid] ?? [];
    $ovt   = $ovtByEmp[$eid]   ?? [];

    // Work boundary (Manila time)
    $workStart = '08:00:00';
    $workEnd   = '17:00:00';

    // ── Attendance-based counters ──────────────────────────────────
// ── Variables ───────────────
    $absence_due_to_suspension = 0;
    $absence_without_official_leave = 0;
    $absent = 0;
    $absent_due_to_half_day = 0;
    $bereavement_half_day_1 = 0;
    $bereavement_half_day_2 = 0;
    $birthday_leave = 0;
    $break_due_to_lwph1 = 0;
    $break_due_to_lwph2 = 0;
    $early_in = 0;
    $early_out = 0;
    $emergency_leave_full_day = 0;
    $emergency_leave_half_day_1 = 0;
    $emergency_leave_half_day_2 = 0;
    $holiday = 0;
    $inhouse_training = 0;
    $late_in = 0;
    $late_out = 0;
    $leave_without_pay_full_day = 0;
    $leave_without_pay_half_day_1 = 0;
    $leave_without_pay_half_day_2 = 0;
    $leave_in_lieu = 0;
    $maternity_cs_full_day = 0;
    $maternity_cs_half_day_1 = 0;
    $maternity_cs_half_day_2 = 0;
    $maternity_normal_full_day = 0;
    $maternity_normal_half_day_1 = 0;
    $maternity_normal_half_day_2 = 0;
    $maternity_normal_cs = 0;
    $maternity_normal_cs_less_7 = 0;
    $solo_parent_leave = 0;
    $miscarriage_leave = 0;
    $no_swipe_in = 0;
    $no_swipe_out = 0;
    $no_swipe_in_with_half_day_leave_filing = 0;
    $no_swipe_out_with_half_day_leave_filing = 0;
    $off_on_duty = 0;
    $present_on_duty_2 = 0;
    $present_on_duty_3 = 0;
    $special_on_duty = 0;
    $on_duty_half = 0;
    $overtime_public_holiday = 0;
    $overtime_regular = 0;
    $paternity_leave_full_day = 0;
    $paternity_leave_half_day_1 = 0;
    $paternity_leave_half_day_2 = 0;
    $penalty_no_in = 0;
    $penalty_no_out = 0;
    $present_full_day = 0;
    $present_half_day_1 = 0;
    $present_half_day_2 = 0;
    $present_off = 0;
    $present_off_nsi = 0;
    $present_off_nso = 0;
    $present_off_special = 0;
    $present_3_regular_holiday = 0;
    $service_incentive_leave_full_day = 0;
    $service_incentive_leave_half_day_1 = 0;
    $service_incentive_leave_half_day_2 = 0;
    $sick_leave_full_day = 0;
    $sick_leave_half_day_1 = 0;
    $sick_leave_half_day_2 = 0;
    $sick_leave_manager_full_day = 0;
    $sick_leave_manager_half_day_1 = 0;
    $sick_leave_manager_half_day_2 = 0;
    $solo_parent_leave_full_day = 0;
    $solo_parent_leave_half_day_1 = 0;
    $solo_parent_leave_half_day_2 = 0;
    $special_leave_for_women_ra_9710_full_day = 0;
    $special_leave_for_women_half_day_1 = 0;
    $special_leave_for_women_half_day_2 = 0;
    $suspension = 0;
    $training = 0;
    $unproductive = 0;
    $vacation_leave_full_day = 0;
    $vacation_leave_half_day_1 = 0;
    $vacation_leave_half_day_2 = 0;
    $vacation_leave_manager_full_day = 0;
    $vacation_leave_manager_half_day_1 = 0;
    $vacation_leave_manager_half_day_2 = 0;
    $vawc_leave_ra_9262_full_day = 0;
    $vawc_leave_half_day_1 = 0;
    $vawc_leave_half_day_2 = 0;

    foreach ($att as $row) {
        $status  = strtolower(trim($row['status'] ?? ''));
        $timein  = $row['timein']  ?? null;
        $timeout = $row['timeout'] ?? null;

        // Status-based routing
        if ($status === 'suspension') { $suspension++; $absence_due_to_suspension++; $absent++; continue; }
        if ($status === 'awol' || $status === 'absence_without_official_leave') { $absence_without_official_leave++; $absent++; continue; }
        if ($status === 'absent')  { $absent++; continue; }
        if ($status === 'holiday') { $holiday++; continue; }
        if ($status === 'off_on_duty' || $status === 'off on duty') { $off_on_duty++; continue; }
        if ($status === 'on_duty' || $status === 'on duty' || $status === 'present_on_duty') { $present_full_day++; continue; }
        if ($status === 'half_day' || $status === 'half day') { $present_half_day_1++; }
        if ($status === 'training') { $training++; }
        if ($status === 'inhouse_training' || $status === 'inhouse training') { $inhouse_training++; }
        if ($status === 'unproductive') { $unproductive++; }

        // Swipe-based
        if ($timein && !$timeout) { $no_swipe_out++; $present_full_day++; }
        if ($timein && $timeout) { $present_full_day++; }
        if (!$timein && $timeout) { $no_swipe_in++; $present_full_day++; }
        if (!$timein && !$timeout && !in_array($status, ['suspension', 'awol', 'absent', 'holiday', 'off_on_duty', 'on_duty', 'present_on_duty'])) {
            $absent++;
        }

        // Time checks
        if ($timein) {
            if ($timein < $workStart) $early_in++;
            elseif ($timein > $workStart) $late_in++;
        }
        if ($timeout) {
            if ($timeout < $workEnd) $early_out++;
            elseif ($timeout > $workEnd) $late_out++;
        }
        if ($status === 'penalty_no_in') $penalty_no_in++;
        if ($status === 'penalty_no_out') $penalty_no_out++;
    }

    foreach ($leave as $row) {
        $t  = strtolower(trim($row['leave_type'] ?? ''));
        $isHalf = str_contains($t, 'half') || str_contains($t, '1/2');
        $isMgr  = str_contains($t, 'manager') || str_contains($t, 'mgr');

        if (str_contains($t, 'bereavement') || str_contains($t, 'bereave')) {
            $isHalf ? $bereavement_half_day_1++ : $bereavement_half_day_1++; // fallback
        } elseif (str_contains($t, 'birthday')) {
            $birthday_leave++;
        } elseif (str_contains($t, 'emergency')) {
            $isHalf ? $emergency_leave_half_day_1++ : $emergency_leave_full_day++;
        } elseif (str_contains($t, 'without pay') || str_contains($t, 'lwop')) {
            $isHalf ? $leave_without_pay_half_day_1++ : $leave_without_pay_full_day++;
        } elseif (str_contains($t, 'lieu') || str_contains($t, 'in-lieu')) {
            $leave_in_lieu++;
        } elseif (str_contains($t, 'maternity')) {
            $isCs = str_contains($t, 'cs') || str_contains($t, 'caesarean') || str_contains($t, 'cesarean');
            if ($isCs) { $isHalf ? $maternity_cs_half_day_1++ : $maternity_cs_full_day++; }
            else       { $isHalf ? $maternity_normal_half_day_1++ : $maternity_normal_full_day++; }
        } elseif (str_contains($t, 'solo parent') || str_contains($t, 'solo-parent')) {
            $isHalf ? $solo_parent_leave_half_day_1++ : $solo_parent_leave_full_day++;
        } elseif (str_contains($t, 'miscarriage')) {
            $miscarriage_leave++;
        } elseif (str_contains($t, 'paternity')) {
            $isHalf ? $paternity_leave_half_day_1++ : $paternity_leave_full_day++;
        } elseif (str_contains($t, 'service incentive') || str_contains($t, 'sil')) {
            $isHalf ? $service_incentive_leave_half_day_1++ : $service_incentive_leave_full_day++;
        } elseif (str_contains($t, 'sick')) {
            if ($isMgr) { $isHalf ? $sick_leave_manager_half_day_1++ : $sick_leave_manager_full_day++; }
            else        { $isHalf ? $sick_leave_half_day_1++ : $sick_leave_full_day++; }
        } elseif (str_contains($t, 'special leave for women') || str_contains($t, 'ra 9710') || str_contains($t, 'ra9710')) {
            $isHalf ? $special_leave_for_women_half_day_1++ : $special_leave_for_women_ra_9710_full_day++;
        } elseif (str_contains($t, 'vawc') || str_contains($t, 'ra 9262') || str_contains($t, 'ra9262')) {
            $isHalf ? $vawc_leave_half_day_1++ : $vawc_leave_ra_9262_full_day++;
        } elseif (str_contains($t, 'vacation')) {
            if ($isMgr) { $isHalf ? $vacation_leave_manager_half_day_1++ : $vacation_leave_manager_full_day++; }
            else        { $isHalf ? $vacation_leave_half_day_1++ : $vacation_leave_full_day++; }
        }
    }

    foreach ($ovt as $row) {
        $reason = strtolower($row['reason'] ?? '');
        if (str_contains($reason, 'holiday') || str_contains($reason, 'public')) $overtime_public_holiday++;
        else $overtime_regular++;
    }

$total = 0
        + $absence_due_to_suspension
        + $absence_without_official_leave
        + $absent
        + $absent_due_to_half_day
        + $bereavement_half_day_1
        + $bereavement_half_day_2
        + $birthday_leave
        + $break_due_to_lwph1
        + $break_due_to_lwph2
        + $early_in
        + $early_out
        + $emergency_leave_full_day
        + $emergency_leave_half_day_1
        + $emergency_leave_half_day_2
        + $holiday
        + $inhouse_training
        + $late_in
        + $late_out
        + $leave_without_pay_full_day
        + $leave_without_pay_half_day_1
        + $leave_without_pay_half_day_2
        + $leave_in_lieu
        + $maternity_cs_full_day
        + $maternity_cs_half_day_1
        + $maternity_cs_half_day_2
        + $maternity_normal_full_day
        + $maternity_normal_half_day_1
        + $maternity_normal_half_day_2
        + $maternity_normal_cs
        + $maternity_normal_cs_less_7
        + $solo_parent_leave
        + $miscarriage_leave
        + $no_swipe_in
        + $no_swipe_out
        + $no_swipe_in_with_half_day_leave_filing
        + $no_swipe_out_with_half_day_leave_filing
        + $off_on_duty
        + $present_on_duty_2
        + $present_on_duty_3
        + $special_on_duty
        + $on_duty_half
        + $overtime_public_holiday
        + $overtime_regular
        + $paternity_leave_full_day
        + $paternity_leave_half_day_1
        + $paternity_leave_half_day_2
        + $penalty_no_in
        + $penalty_no_out
        + $present_full_day
        + $present_half_day_1
        + $present_half_day_2
        + $present_off
        + $present_off_nsi
        + $present_off_nso
        + $present_off_special
        + $present_3_regular_holiday
        + $service_incentive_leave_full_day
        + $service_incentive_leave_half_day_1
        + $service_incentive_leave_half_day_2
        + $sick_leave_full_day
        + $sick_leave_half_day_1
        + $sick_leave_half_day_2
        + $sick_leave_manager_full_day
        + $sick_leave_manager_half_day_1
        + $sick_leave_manager_half_day_2
        + $solo_parent_leave_full_day
        + $solo_parent_leave_half_day_1
        + $solo_parent_leave_half_day_2
        + $special_leave_for_women_ra_9710_full_day
        + $special_leave_for_women_half_day_1
        + $special_leave_for_women_half_day_2
        + $suspension
        + $training
        + $unproductive
        + $vacation_leave_full_day
        + $vacation_leave_half_day_1
        + $vacation_leave_half_day_2
        + $vacation_leave_manager_full_day
        + $vacation_leave_manager_half_day_1
        + $vacation_leave_manager_half_day_2
        + $vawc_leave_ra_9262_full_day
        + $vawc_leave_half_day_1
        + $vawc_leave_half_day_2;

$report[] = [
        'no'           => $idx + 1,
        'emp_id'       => $eid,
        'emp_number'   => (string)$eid,
        'name'         => $emp['name'] ?? 'Unknown',
        'position'     => $emp['role'] ?? 'Employee',
        'work_location'=> 'Head Office',
        'work_location_name'=> 'Head Office',
        
        'absence_due_to_suspension' => $absence_due_to_suspension,
        'absence_without_official_leave' => $absence_without_official_leave,
        'absent' => $absent,
        'absent_due_to_half_day' => $absent_due_to_half_day,
        'bereavement_half_day_1' => $bereavement_half_day_1,
        'bereavement_half_day_2' => $bereavement_half_day_2,
        'birthday_leave' => $birthday_leave,
        'break_due_to_lwph1' => $break_due_to_lwph1,
        'break_due_to_lwph2' => $break_due_to_lwph2,
        'early_in' => $early_in,
        'early_out' => $early_out,
        'emergency_leave_full_day' => $emergency_leave_full_day,
        'emergency_leave_half_day_1' => $emergency_leave_half_day_1,
        'emergency_leave_half_day_2' => $emergency_leave_half_day_2,
        'holiday' => $holiday,
        'inhouse_training' => $inhouse_training,
        'late_in' => $late_in,
        'late_out' => $late_out,
        'leave_without_pay_full_day' => $leave_without_pay_full_day,
        'leave_without_pay_half_day_1' => $leave_without_pay_half_day_1,
        'leave_without_pay_half_day_2' => $leave_without_pay_half_day_2,
        'leave_in_lieu' => $leave_in_lieu,
        'maternity_cs_full_day' => $maternity_cs_full_day,
        'maternity_cs_half_day_1' => $maternity_cs_half_day_1,
        'maternity_cs_half_day_2' => $maternity_cs_half_day_2,
        'maternity_normal_full_day' => $maternity_normal_full_day,
        'maternity_normal_half_day_1' => $maternity_normal_half_day_1,
        'maternity_normal_half_day_2' => $maternity_normal_half_day_2,
        'maternity_normal_cs' => $maternity_normal_cs,
        'maternity_normal_cs_less_7' => $maternity_normal_cs_less_7,
        'solo_parent_leave' => $solo_parent_leave,
        'miscarriage_leave' => $miscarriage_leave,
        'no_swipe_in' => $no_swipe_in,
        'no_swipe_out' => $no_swipe_out,
        'no_swipe_in_with_half_day_leave_filing' => $no_swipe_in_with_half_day_leave_filing,
        'no_swipe_out_with_half_day_leave_filing' => $no_swipe_out_with_half_day_leave_filing,
        'off_on_duty' => $off_on_duty,
        'present_on_duty_2' => $present_on_duty_2,
        'present_on_duty_3' => $present_on_duty_3,
        'special_on_duty' => $special_on_duty,
        'on_duty_half' => $on_duty_half,
        'overtime_public_holiday' => $overtime_public_holiday,
        'overtime_regular' => $overtime_regular,
        'paternity_leave_full_day' => $paternity_leave_full_day,
        'paternity_leave_half_day_1' => $paternity_leave_half_day_1,
        'paternity_leave_half_day_2' => $paternity_leave_half_day_2,
        'penalty_no_in' => $penalty_no_in,
        'penalty_no_out' => $penalty_no_out,
        'present_full_day' => $present_full_day,
        'present_half_day_1' => $present_half_day_1,
        'present_half_day_2' => $present_half_day_2,
        'present_off' => $present_off,
        'present_off_nsi' => $present_off_nsi,
        'present_off_nso' => $present_off_nso,
        'present_off_special' => $present_off_special,
        'present_3_regular_holiday' => $present_3_regular_holiday,
        'service_incentive_leave_full_day' => $service_incentive_leave_full_day,
        'service_incentive_leave_half_day_1' => $service_incentive_leave_half_day_1,
        'service_incentive_leave_half_day_2' => $service_incentive_leave_half_day_2,
        'sick_leave_full_day' => $sick_leave_full_day,
        'sick_leave_half_day_1' => $sick_leave_half_day_1,
        'sick_leave_half_day_2' => $sick_leave_half_day_2,
        'sick_leave_manager_full_day' => $sick_leave_manager_full_day,
        'sick_leave_manager_half_day_1' => $sick_leave_manager_half_day_1,
        'sick_leave_manager_half_day_2' => $sick_leave_manager_half_day_2,
        'solo_parent_leave_full_day' => $solo_parent_leave_full_day,
        'solo_parent_leave_half_day_1' => $solo_parent_leave_half_day_1,
        'solo_parent_leave_half_day_2' => $solo_parent_leave_half_day_2,
        'special_leave_for_women_ra_9710_full_day' => $special_leave_for_women_ra_9710_full_day,
        'special_leave_for_women_half_day_1' => $special_leave_for_women_half_day_1,
        'special_leave_for_women_half_day_2' => $special_leave_for_women_half_day_2,
        'suspension' => $suspension,
        'training' => $training,
        'unproductive' => $unproductive,
        'vacation_leave_full_day' => $vacation_leave_full_day,
        'vacation_leave_half_day_1' => $vacation_leave_half_day_1,
        'vacation_leave_half_day_2' => $vacation_leave_half_day_2,
        'vacation_leave_manager_full_day' => $vacation_leave_manager_full_day,
        'vacation_leave_manager_half_day_1' => $vacation_leave_manager_half_day_1,
        'vacation_leave_manager_half_day_2' => $vacation_leave_manager_half_day_2,
        'vawc_leave_ra_9262_full_day' => $vawc_leave_ra_9262_full_day,
        'vawc_leave_half_day_1' => $vawc_leave_half_day_1,
        'vawc_leave_half_day_2' => $vawc_leave_half_day_2,
        'total_activity' => $total,
    ];
}

echo json_encode([
    'ok'           => true,
    'report'       => $report,
    'start_date'   => $startDate,
    'end_date'     => $endDate,
    'generated_at' => date('Y-m-d H:i:s'),
]);
