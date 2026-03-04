<?php
// Test script for creating tasks and feedback
require_once 'connect.php';

echo "Testing Task and Feedback Creation...\n\n";

// Test 1: Create a task
echo "1. Creating a test task...\n";
$taskData = [
    'user_id' => 1,
    'title' => 'Test Task from API',
    'description' => 'This is a test task created via API',
    'priority' => 'high',
    'due_date' => '2026-03-10'
];

[$status, $result, $err] = supabase_request('POST', 'rest/v1/tasks', $taskData);

if ($status === 201) {
    echo "✅ Task created successfully!\n";
    echo "Task ID: " . ($result[0]['id'] ?? 'Unknown') . "\n";
    echo "Title: " . ($result[0]['title'] ?? 'Unknown') . "\n\n";
} else {
    echo "❌ Failed to create task. Status: $status\n";
    if ($err) echo "Error: $err\n";
    echo "\n";
}

// Test 2: Create feedback
echo "2. Creating test feedback...\n";
$feedbackData = [
    'user_id' => 1,
    'title' => 'Test Feedback from API',
    'message' => 'This is test feedback created via API',
    'type' => 'suggestion'
];

[$status, $result, $err] = supabase_request('POST', 'rest/v1/feedback', $feedbackData);

if ($status === 201) {
    echo "✅ Feedback created successfully!\n";
    echo "Feedback ID: " . ($result[0]['id'] ?? 'Unknown') . "\n";
    echo "Title: " . ($result[0]['title'] ?? 'Unknown') . "\n\n";
} else {
    echo "❌ Failed to create feedback. Status: $status\n";
    if ($err) echo "Error: $err\n";
    echo "\n";
}

// Test 3: Fetch tasks
echo "3. Fetching tasks for user 1...\n";
[$status, $result, $err] = supabase_request('GET', 'rest/v1/tasks?user_id=eq.1&order=created_at.desc');

if ($status === 200) {
    echo "✅ Tasks fetched successfully!\n";
    echo "Total tasks: " . count($result) . "\n";
    if (count($result) > 0) {
        echo "Most recent task: " . ($result[0]['title'] ?? 'Unknown') . "\n";
    }
    echo "\n";
} else {
    echo "❌ Failed to fetch tasks. Status: $status\n";
    if ($err) echo "Error: $err\n";
    echo "\n";
}

// Test 4: Fetch feedback
echo "4. Fetching feedback for user 1...\n";
[$status, $result, $err] = supabase_request('GET', 'rest/v1/feedback?user_id=eq.1&order=created_at.desc');

if ($status === 200) {
    echo "✅ Feedback fetched successfully!\n";
    echo "Total feedback: " . count($result) . "\n";
    if (count($result) > 0) {
        echo "Most recent feedback: " . ($result[0]['title'] ?? 'Unknown') . "\n";
    }
    echo "\n";
} else {
    echo "❌ Failed to fetch feedback. Status: $status\n";
    if ($err) echo "Error: $err\n";
    echo "\n";
}

echo "API Test completed!\n";
?>