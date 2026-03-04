<?php
// Test script to create tasks and feedback tables in Supabase
require_once 'connect.php';

echo "Creating Tasks and Feedback tables in Supabase...\n\n";

// Check if tables exist by trying to fetch from them
echo "Testing if tasks table exists...\n";
[$status, $data, $err] = supabase_request('GET', 'rest/v1/tasks?limit=1');

if ($status === 200) {
    echo "✅ Tasks table already exists!\n";
    echo "Current tasks count: " . count($data) . "\n\n";
} else {
    echo "❌ Tasks table does not exist. Status: $status\n";
    if ($err) echo "Error: $err\n";
    echo "\nTo create the tables, run the SQL commands from create-tasks-feedback-compatible.sql in your Supabase SQL Editor.\n\n";
}

echo "Testing if feedback table exists...\n";
[$status, $data, $err] = supabase_request('GET', 'rest/v1/feedback?limit=1');

if ($status === 200) {
    echo "✅ Feedback table already exists!\n";
    echo "Current feedback count: " . count($data) . "\n\n";
} else {
    echo "❌ Feedback table does not exist. Status: $status\n";
    if ($err) echo "Error: $err\n";
    echo "\nTo create the tables, run the SQL commands from create-tasks-feedback-compatible.sql in your Supabase SQL Editor.\n\n";
}

echo "API Test completed.\n";
?>