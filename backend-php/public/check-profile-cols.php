<?php
require_once 'connect.php';

echo "Checking for personal information columns in employees table...\n\n";

// Fetch one record to see columns
[$status, $data, $err] = supabase_request('GET', 'rest/v1/employees?limit=1');

if ($status === 200 && !empty($data)) {
    $record = $data[0];
    $required = [
        'marital_status',
        'spouse_name',
        'emergency_contact_name',
        'emergency_contact_phone',
        'emergency_contact_relation'
    ];
    
    $missing = [];
    foreach ($required as $col) {
        if (!array_key_exists($col, $record)) {
            $missing[] = $col;
        }
    }
    
    if (empty($missing)) {
        echo "✅ All required columns exist!\n";
    } else {
        echo "❌ Missing columns: " . implode(', ', $missing) . "\n\n";
        echo "Please run this SQL in your Supabase SQL Editor:\n\n";
        echo "ALTER TABLE employees \n";
        foreach ($missing as $col) {
            echo "ADD COLUMN IF NOT EXISTS $col TEXT,\n";
        }
        echo "-- Remove final comma above\n";
    }
} else {
    echo "Could not fetch employee record to check columns. Status: $status\n";
    if ($err) echo "Error: $err\n";
}
?>
