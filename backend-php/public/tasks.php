<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

// Handle preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

require_once 'connect.php';
require_once 'notify-helper.php';

$method = $_SERVER['REQUEST_METHOD'];

try {
    switch ($method) {
        case 'GET':
            handleGetRequest();
            break;
        case 'POST':
            handlePostRequest();
            break;
        case 'PUT':
            handlePutRequest();
            break;
        case 'DELETE':
            handleDeleteRequest();
            break;
        default:
            throw new Exception('Method not allowed', 405);
    }
} catch (Exception $e) {
    http_response_code($e->getCode() ?: 500);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}

function handleGetRequest() {
    if (!isset($_GET['user_id'])) {
        throw new Exception('User ID is required', 400);
    }
    
    $user_id = intval($_GET['user_id']);
    $status = isset($_GET['status']) ? $_GET['status'] : null;
    
    // Build Supabase query
    $query = "user_id=eq.{$user_id}";
    if ($status) {
        $query .= "&status=eq.{$status}";
    }
    $query .= "&order=created_at.desc";
    
    [$statusCode, $data, $err] = supabase_request(
        'GET',
        "rest/v1/tasks?{$query}&select=id,title,description,priority,status,due_date,created_at,updated_at,assigned_to"
    );
    
    if ($err) {
        throw new Exception('Database error: ' . $err, 500);
    }
    
    if ($statusCode !== 200) {
        throw new Exception('Failed to fetch tasks', $statusCode);
    }
    
    echo json_encode([
        'success' => true,
        'data' => $data,
        'count' => count($data)
    ]);
}

function handlePostRequest() {
    $input = json_decode(file_get_contents('php://input'), true);
    
    if (!$input) {
        throw new Exception('Invalid JSON input', 400);
    }
    
    // Create new task
    $required_fields = ['user_id', 'title', 'description'];
    foreach ($required_fields as $field) {
        if (!isset($input[$field]) || empty(trim($input[$field]))) {
            throw new Exception("Field '$field' is required", 400);
        }
    }
    
    $user_id = intval($input['user_id']);
    $title = trim($input['title']);
    $description = trim($input['description']);
    $priority = isset($input['priority']) ? $input['priority'] : 'medium';
    $due_date = isset($input['due_date']) && !empty($input['due_date']) ? $input['due_date'] : null;
    $assigned_to = isset($input['assigned_to']) ? intval($input['assigned_to']) : $user_id;
    
    // Validate priority
    if (!in_array($priority, ['low', 'medium', 'high'])) {
        throw new Exception('Invalid priority value', 400);
    }
    
    // Validate due_date format if provided
    if ($due_date && !preg_match('/^\d{4}-\d{2}-\d{2}$/', $due_date)) {
        throw new Exception('Invalid due_date format. Use YYYY-MM-DD', 400);
    }
    
    // Create task data for Supabase
    $taskData = [
        'user_id' => $user_id,
        'title' => $title,
        'description' => $description,
        'priority' => $priority,
        'status' => 'pending',
        'created_by' => $user_id,
        'assigned_to' => $assigned_to
    ];
    
    if ($due_date) {
        $taskData['due_date'] = $due_date;
    }
    
    [$statusCode, $result, $err] = supabase_request(
        'POST',
        'rest/v1/tasks',
        $taskData
    );
    
    if ($err) {
        throw new Exception('Database error: ' . $err, 500);
    }
    
    if ($statusCode !== 201) {
        throw new Exception('Failed to create task', $statusCode);
    }
    
    // Push notification: notify the user a new task was assigned
    notify_users(
        [$assigned_to],
        '📋 New Task Assigned',
        "You have a new task: {$title}",
        ['type' => 'task_assigned']
    );

    echo json_encode([
        'success' => true,
        'message' => 'Task created successfully',
        'data' => $result[0] ?? $result
    ]);
}

function handlePutRequest() {
    $input = json_decode(file_get_contents('php://input'), true);
    
    if (!$input) {
        throw new Exception('Invalid JSON input', 400);
    }
    
    if (!isset($input['id']) || !isset($input['user_id'])) {
        throw new Exception('Task ID and User ID are required', 400);
    }
    
    $task_id = intval($input['id']);
    $user_id = intval($input['user_id']);
    
    // Build update data
    $updateData = [];
    $allowed_fields = ['title', 'description', 'priority', 'due_date', 'status'];
    
    foreach ($allowed_fields as $field) {
        if (isset($input[$field])) {
            $updateData[$field] = $input[$field];
        }
    }
    
    if (empty($updateData)) {
        throw new Exception('No valid fields to update', 400);
    }
    
    // Validate status if provided
    if (isset($updateData['status']) && !in_array($updateData['status'], ['pending', 'in_progress', 'completed'])) {
        throw new Exception('Invalid status value', 400);
    }
    
    // Validate priority if provided
    if (isset($updateData['priority']) && !in_array($updateData['priority'], ['low', 'medium', 'high'])) {
        throw new Exception('Invalid priority value', 400);
    }
    
    [$statusCode, $result, $err] = supabase_request(
        'PATCH',
        "rest/v1/tasks?id=eq.{$task_id}&user_id=eq.{$user_id}",
        $updateData
    );
    
    if ($err) {
        throw new Exception('Database error: ' . $err, 500);
    }
    
    if ($statusCode !== 204 && $statusCode !== 200) {
        throw new Exception('Failed to update task', $statusCode);
    }
    
    echo json_encode([
        'success' => true,
        'message' => 'Task updated successfully'
    ]);
}

function handleDeleteRequest() {
    $input = json_decode(file_get_contents('php://input'), true);
    
    if (!$input || !isset($input['id']) || !isset($input['user_id'])) {
        throw new Exception('Task ID and User ID are required', 400);
    }
    
    $task_id = intval($input['id']);
    $user_id = intval($input['user_id']);
    
    [$statusCode, $result, $err] = supabase_request(
        'DELETE',
        "rest/v1/tasks?id=eq.{$task_id}&user_id=eq.{$user_id}"
    );
    
    if ($err) {
        throw new Exception('Database error: ' . $err, 500);
    }
    
    if ($statusCode !== 204 && $statusCode !== 200) {
        throw new Exception('Failed to delete task or task not found', $statusCode);
    }
    
    echo json_encode([
        'success' => true,
        'message' => 'Task deleted successfully'
    ]);
}
?>