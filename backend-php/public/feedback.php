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
    $type = isset($_GET['type']) ? $_GET['type'] : null;
    
    // Build Supabase query
    $query = "user_id=eq.{$user_id}";
    if ($status) {
        $query .= "&status=eq.{$status}";
    }
    if ($type) {
        $query .= "&type=eq.{$type}";
    }
    $query .= "&order=created_at.desc";
    
    [$statusCode, $data, $err] = supabase_request(
        'GET',
        "rest/v1/feedback?{$query}&select=id,title,message,type,status,created_at,updated_at"
    );
    
    if ($err) {
        throw new Exception('Database error: ' . $err, 500);
    }
    
    if ($statusCode !== 200) {
        throw new Exception('Failed to fetch feedback', $statusCode);
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
    
    // Create new feedback
    $required_fields = ['user_id', 'title', 'message'];
    foreach ($required_fields as $field) {
        if (!isset($input[$field]) || empty(trim($input[$field]))) {
            throw new Exception("Field '$field' is required", 400);
        }
    }
    
    $user_id = intval($input['user_id']);
    $title = trim($input['title']);
    $message = trim($input['message']);
    $type = isset($input['type']) ? $input['type'] : 'suggestion';
    
    // Validate type
    if (!in_array($type, ['suggestion', 'complaint', 'compliment'])) {
        throw new Exception('Invalid type value', 400);
    }
    
    // Create feedback data for Supabase
    $feedbackData = [
        'user_id' => $user_id,
        'title' => $title,
        'message' => $message,
        'type' => $type,
        'status' => 'pending'
    ];
    
    [$statusCode, $result, $err] = supabase_request(
        'POST',
        'rest/v1/feedback',
        $feedbackData
    );
    
    if ($err) {
        throw new Exception('Database error: ' . $err, 500);
    }
    
    if ($statusCode !== 201) {
        throw new Exception('Failed to create feedback', $statusCode);
    }
    
    echo json_encode([
        'success' => true,
        'message' => 'Feedback submitted successfully',
        'data' => $result[0] ?? $result
    ]);
}

function handlePutRequest() {
    $input = json_decode(file_get_contents('php://input'), true);
    
    if (!$input) {
        throw new Exception('Invalid JSON input', 400);
    }
    
    if (!isset($input['id']) || !isset($input['user_id'])) {
        throw new Exception('Feedback ID and User ID are required', 400);
    }
    
    $feedback_id = intval($input['id']);
    $user_id = intval($input['user_id']);
    
    // Build update data
    $updateData = [];
    $allowed_fields = ['title', 'message', 'type', 'status'];
    
    foreach ($allowed_fields as $field) {
        if (isset($input[$field])) {
            $updateData[$field] = $input[$field];
        }
    }
    
    if (empty($updateData)) {
        throw new Exception('No valid fields to update', 400);
    }
    
    // Validate status if provided
    if (isset($updateData['status']) && !in_array($updateData['status'], ['pending', 'reviewed', 'resolved'])) {
        throw new Exception('Invalid status value', 400);
    }
    
    // Validate type if provided
    if (isset($updateData['type']) && !in_array($updateData['type'], ['suggestion', 'complaint', 'compliment'])) {
        throw new Exception('Invalid type value', 400);
    }
    
    [$statusCode, $result, $err] = supabase_request(
        'PATCH',
        "rest/v1/feedback?id=eq.{$feedback_id}&user_id=eq.{$user_id}",
        $updateData
    );
    
    if ($err) {
        throw new Exception('Database error: ' . $err, 500);
    }
    
    if ($statusCode !== 204 && $statusCode !== 200) {
        throw new Exception('Failed to update feedback', $statusCode);
    }
    
    echo json_encode([
        'success' => true,
        'message' => 'Feedback updated successfully'
    ]);
}

function handleDeleteRequest() {
    $input = json_decode(file_get_contents('php://input'), true);
    
    if (!$input || !isset($input['id']) || !isset($input['user_id'])) {
        throw new Exception('Feedback ID and User ID are required', 400);
    }
    
    $feedback_id = intval($input['id']);
    $user_id = intval($input['user_id']);
    
    [$statusCode, $result, $err] = supabase_request(
        'DELETE',
        "rest/v1/feedback?id=eq.{$feedback_id}&user_id=eq.{$user_id}"
    );
    
    if ($err) {
        throw new Exception('Database error: ' . $err, 500);
    }
    
    if ($statusCode !== 204 && $statusCode !== 200) {
        throw new Exception('Failed to delete feedback or feedback not found', $statusCode);
    }
    
    echo json_encode([
        'success' => true,
        'message' => 'Feedback deleted successfully'
    ]);
}
?>