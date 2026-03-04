<?php
// Simple task creation test
require_once 'connect.php';

echo "Testing task creation with user_id 23...\n";

// Try creating a task with user_id 23 
$taskData = [
    'user_id' => 23,
    'title' => 'Simple Test Task',
    'description' => 'This is a simple test task',
    'priority' => 'medium'
];

echo "Sending data: " . json_encode($taskData) . "\n\n";

$ch = curl_init('http://localhost:8000/tasks.php');
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($taskData));
curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

echo "HTTP Status: $httpCode\n";
echo "Response: $response\n\n";

// Now test fetching
echo "Fetching tasks for user 23...\n";
$response = file_get_contents('http://localhost:8000/tasks.php?user_id=23');
echo "Tasks response: $response\n";

?>