const fs = require('fs');

const colsRaw = `
Absence Due to Suspension
Absence Without Official Leave
Absent
Absent due to Half Day
Bereavement Half Day 1
Bereavement Half Day 2
Birthday Leave
Break Due to LWPH1
Break Due to LWPH2
Early In
Early Out
Emergency Leave (Full Day)
Emergency Leave Half Day 1
Emergency Leave Half Day 2
Holiday
Inhouse Training
Late In
Late Out
Leave Without Pay (Full Day)
Leave Without Pay Half Day 1
Leave Without Pay Half Day 2
Leave in Lieu
Maternity CS (Full Day)
Maternity CS Half Day 1
Maternity CS Half Day 2
Maternity Normal (Full Day)
Maternity Normal Half Day 1
Maternity Normal Half Day 2
Maternity Normal/CS
Maternity Normal/CS Less 7
Solo Parent Leave
Miscarriage Leave
No Swipe In
No Swipe Out
No Swipe In with Half Day Leave Filing
No Swipe Out with Half Day Leave Filing
Off On Duty
Present On Duty 2
Present On Duty 3
Special On Duty
On Duty Half
Overtime (Public Holiday)
Overtime (Regular)
Paternity Leave (Full Day)
Paternity Leave Half Day 1
Paternity Leave Half Day 2
Penalty No In
Penalty No Out
Present (Full Day)
Present Half Day 1
Present Half Day 2
Present OFF
Present OFF NSI
Present OFF NSO
Present OFF Special
Present 3 Regular Holiday
Service Incentive Leave (Full Day)
Service Incentive Leave Half Day 1
Service Incentive Leave Half Day 2
Sick Leave (Full Day)
Sick Leave Half Day 1
Sick Leave Half Day 2
Sick Leave Manager (Full Day)
Sick Leave Manager Half Day 1
Sick Leave Manager Half Day 2
Solo Parent Leave (Full Day)
Solo Parent Leave Half Day 1
Solo Parent Leave Half Day 2
Special Leave for Women (RA 9710 Full Day)
Special Leave for Women Half Day 1
Special Leave for Women Half Day 2
Suspension
Training
Unproductive
Vacation Leave (Full Day)
Vacation Leave Half Day 1
Vacation Leave Half Day 2
Vacation Leave Manager (Full Day)
Vacation Leave Manager Half Day 1
Vacation Leave Manager Half Day 2
VAWC Leave (RA 9262 Full Day)
VAWC Leave Half Day 1
VAWC Leave Half Day 2
`.trim().split('\n').map(l => l.trim()).filter(l => l);

const makeKey = (str) => {
    return str.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
};

const items = colsRaw.map(c => ({
    label: c,
    key: makeKey(c)
}));

// Build TSX interface
let tsxInterface = `  // Exact 90 columns mapped
${items.map(i => `  ${i.key}: number;`).join('\n')}
  total_activity: number;`;

// Build TSX COLUMNS
const guessGroup = (label) => {
    const l = label.toLowerCase();
    if (l.includes('suspen') || l.includes('awol') || l.includes('absent')) return 'Absences';
    if (l.includes('late') || l.includes('early') || l.includes('swipe') || l.includes('break') || l.includes('penalty')) return 'Time Records';
    if (l.includes('maternity') || l.includes('paternity') || l.includes('vawc') || l.includes('solo parent') || l.includes('special leave for women')) return 'Special Leaves';
    if (l.includes('leave') || l.includes('miscarriage')) return 'Leaves';
    if (l.includes('overtime')) return 'Overtime';
    if (l.includes('duty') || l.includes('present') || l.includes('holiday')) return 'Presence';
    return 'Other';
};

let tsxColumns = `const COLUMNS: { key: keyof ReportRow; label: string; group: string }[] = [\n`;
tsxColumns += items.map(i => `  { key: '${i.key}', label: '${i.label}', group: '${guessGroup(i.label)}' },`).join('\n');
tsxColumns += `\n  { key: 'total_activity', label: 'Total Activity', group: 'Total' },\n];`;

// Build TSX CSV headers
let tsxCsvHeaders = `    const header1 = [
      'No.', 'Emp No', 'Employee Name', 'Position', 'Work Location', 'Work Location Name',
${items.map(i => `      '${i.label}',`).join('\n')}
      'Total Activity',
    ].join(',');`;

// Build TSX CSV rows
let tsxCsvRows = `    const rows = report.map(r => [
      r.no, \`"\${r.emp_number}"\`, \`"\${r.name}"\`, \`"\${r.position}"\`, \`"\${r.work_location}"\`, \`"\${r.work_location_name}"\`,
      ${items.map(i => `r.${i.key}`).join(', ')},
      r.total_activity,
    ].join(','));`;

// ======================= PHP =======================

// Build PHP variables
let phpVars = `    // ── Variables ───────────────\n`;
phpVars += items.map(i => `    $${i.key} = 0;`).join('\n');

// Build PHP Total
let phpTotal = `    $total = 0\n`;
phpTotal += items.map(i => `        + $${i.key}`).join('\n') + ';';

// Build PHP Report Push
let phpPush = `    $report[] = [
        'no'           => $idx + 1,
        'emp_id'       => $eid,
        'emp_number'   => (string)$eid,
        'name'         => $emp['name'] ?? 'Unknown',
        'position'     => $emp['role'] ?? 'Employee',
        'work_location'=> 'Head Office',
        'work_location_name'=> 'Head Office',
        
`;
phpPush += items.map(i => `        '${i.key}' => $${i.key},`).join('\n');
phpPush += `\n        'total_activity' => $total,\n    ];`;

fs.writeFileSync('temp_out.txt', 
  "--- TSX Interface ---\n" + tsxInterface + 
  "\n\n--- TSX Columns ---\n" + tsxColumns + 
  "\n\n--- TSX CSV ---\n" + tsxCsvHeaders + "\n\n" + tsxCsvRows + 
  "\n\n--- PHP Vars ---\n" + phpVars + 
  "\n\n--- PHP Total ---\n" + phpTotal + 
  "\n\n--- PHP Push ---\n" + phpPush
);
console.log("Done");
