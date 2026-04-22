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
    $type = isset($_GET['type']) ? $_GET['type'] : 'all'; // 'received', 'sent', 'all'
    $status = isset($_GET['status']) ? $_GET['status'] : null;
    
    // Build query based on type
    if ($type === 'received') {
        $filter = "assigned_to=eq.{$user_id}";
    } elseif ($type === 'sent') {
        $filter = "user_id=eq.{$user_id}";
    } else {
        $filter = "or=(user_id.eq.{$user_id},assigned_to.eq.{$user_id})";
    }

    if ($status) {
        $filter .= "&status=eq.{$status}";
    }
    
    // We want to join with employees to get names
    // Note: In Supabase/PostgREST, we can use select with joins if relations are defined
    // Assuming 'tasks' has foreign keys to 'employees' (via log_id or emp_id)
    // For now, let's just fetch the tasks and names if the schema supports it.
    // If not, we might need multiple requests or a different select string.
    $select = "id,title,description,priority,status,start_date,end_date,due_date,created_at,updated_at,assigned_to,user_id";
    
    [$statusCode, $data, $err] = supabase_request(
        'GET',
        "rest/v1/tasks?{$filter}&select={$select}&order=created_at.desc"
    );
    
    if ($err) {
        throw new Exception('Database error: ' . $err, 500);
    }
    
    if ($statusCode !== 200) {
        throw new Exception('Failed to fetch tasks', $statusCode);
    }
    
    // Enrich data with names if necessary (optional but helpful)
    // Since we don't know the exact relation names for joins, let's keep it simple for now
    // or try to fetch names of all involved users.
    
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
    $start_date = isset($input['start_date']) && !empty($input['start_date']) ? $input['start_date'] : null;
    $end_date = isset($input['end_date']) && !empty($input['end_date']) ? $input['end_date'] : null;
    $due_date = isset($input['due_date']) && !empty($input['due_date']) ? $input['due_date'] : null;
    $assigned_to = isset($input['assigned_to']) ? intval($input['assigned_to']) : $user_id;
    
    // Validate priority
    if (!in_array($priority, ['low', 'medium', 'high'])) {
        throw new Exception('Invalid priority value', 400);
    }
    
    // Validate date formats if provided
    if ($start_date && !preg_match('/^\d{4}-\d{2}-\d{2}$/', $start_date)) {
        throw new Exception('Invalid start_date format. Use YYYY-MM-DD', 400);
    }
    if ($end_date && !preg_match('/^\d{4}-\d{2}-\d{2}$/', $end_date)) {
        throw new Exception('Invalid end_date format. Use YYYY-MM-DD', 400);
    }
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
    
    if ($start_date) {
        $taskData['start_date'] = $start_date;
    }
    if ($end_date) {
        $taskData['end_date'] = $end_date;
    }
    if ($due_date) {
        $taskData['due_date'] = $due_date;
    }
    
    [$statusCode, $result, $err] = supabase_request(
        'POST',
        'rest/v1/tasks',
        $taskData,
        ['Prefer: return=representation']
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
    $allowed_fields = ['title', 'description', 'priority', 'start_date', 'end_date', 'due_date', 'status'];
    
    foreach ($allowed_fields as $field) {
        if (isset($input[$field])) {
            $updateData[$field] = $input[$field];
        }
    }
    
    if (empty($updateData)) {
        throw new Exception('No valid fields to update', 400);
    }
    
    // Validate status if provided
    if (isset($updateData['status']) && !in_array($updateData['status'], ['pending', 'in_progress', 'completed', 'verified', 'cancelled', 'suspended'])) {
        throw new Exception('Invalid status value', 400);
    }
    
    // Validate priority if provided
    if (isset($updateData['priority']) && !in_array($updateData['priority'], ['low', 'medium', 'high'])) {
        throw new Exception('Invalid priority value', 400);
    }

    // Validate date formats if provided
    if (isset($updateData['start_date']) && !preg_match('/^\d{4}-\d{2}-\d{2}$/', $updateData['start_date'])) {
        throw new Exception('Invalid start_date format. Use YYYY-MM-DD', 400);
    }
    if (isset($updateData['end_date']) && !preg_match('/^\d{4}-\d{2}-\d{2}$/', $updateData['end_date'])) {
        throw new Exception('Invalid end_date format. Use YYYY-MM-DD', 400);
    }
    if (isset($updateData['due_date']) && !preg_match('/^\d{4}-\d{2}-\d{2}$/', $updateData['due_date'])) {
        throw new Exception('Invalid due_date format. Use YYYY-MM-DD', 400);
    }
    
    $filter = "id=eq.{$task_id}&or=(user_id.eq.{$user_id},assigned_to.eq.{$user_id})";
    [$statusCode, $result, $err] = supabase_request(
        'PATCH',
        "rest/v1/tasks?{$filter}",
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