const fs = require('fs');

let target = fs.readFileSync('backend-php/public/attendance-report.php', 'utf8');

// The new variable definitions and report building
const phpVars = fs.readFileSync('temp_out.txt', 'utf8');
const pVars = phpVars.split('--- PHP Vars ---')[1].split('--- PHP Total ---')[0].trim();
const pTotal = phpVars.split('--- PHP Total ---')[1].split('--- PHP Push ---')[0].trim();
const pPush = phpVars.split('--- PHP Push ---')[1].trim();

// Custom logic for the foreach loops
const attLogic = `
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
`;

// Build entire block for inside foreach ($employees as $idx => $emp) { ... }
const regex = /\/ ── Attendance-based counters ──────────────────────────────────[\s\S]+?\];\n\}/;
const replacement = `/ ── Attendance-based counters ──────────────────────────────────\n${pVars}\n${attLogic}\n${pTotal}\n\n${pPush}\n}`;

target = target.replace(regex, replacement);
fs.writeFileSync('backend-php/public/attendance-report.php', target);
console.log('Successfully updated PHP file');
