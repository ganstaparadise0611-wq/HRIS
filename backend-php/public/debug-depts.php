<?php
require_once __DIR__ . '/connect.php';

[$s, $data, $err] = supabase_request('GET', "rest/v1/employees?select=emp_id,name,role,dept_id,log_id");

// print out formatted table
echo str_pad('EMP_ID', 8) . " | " . str_pad('DEPT_ID', 8) . " | " . str_pad('NAME', 30) . " | " . "ROLE\n";
echo str_repeat('-', 80) . "\n";
foreach ($data as $e) {
    echo str_pad($e['emp_id'], 8) . " | " . str_pad($e['dept_id'] ?? 'NULL', 8) . " | " . str_pad($e['name'], 30) . " | " . $e['role'] . "\n";
}
