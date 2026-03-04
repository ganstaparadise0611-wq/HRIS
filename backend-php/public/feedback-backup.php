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
$path_info = isset($_SERVER['PATH_INFO']) ? $_SERVER['PATH_INFO'] : '';
$request_uri = $_SERVER['REQUEST_URI'];

// Parse the endpoint
$endpoint = '';
if (strpos($request_uri, 'feedback.php') !== false) {
    $parts = explode('/', trim($path_info, '/'));
    $endpoint = isset($parts[0]) ? $parts[0] : '';
}

try {
    switch ($method) {
        case 'GET':
            handleGetRequest($endpoint);
            break;
        case 'POST':
            handlePostRequest($endpoint);
            break;
        case 'PUT':
            handlePutRequest($endpoint);
            break;
        case 'DELETE':
            handleDeleteRequest($endpoint);
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

function handleGetRequest($endpoint) {
    global $conn;
    
    switch ($endpoint) {
        case 'list':
        default:
            // Get user feedback
            if (!isset($_GET['user_id'])) {
                throw new Exception('User ID is required', 400);
            }
            
            $user_id = intval($_GET['user_id']);
            $status = isset($_GET['status']) ? $_GET['status'] : null;
            $type = isset($_GET['type']) ? $_GET['type'] : null;
            
            $sql = "SELECT 
                        id,
                        title,
                        message,
                        type,
                        status,
                        category,
                        priority_level,
                        created_at,
                        reviewed_at,
                        response,
                        reviewed_by
                    FROM feedback 
                    WHERE user_id = ?";
            
            $params = [$user_id];
            
            if ($status) {
                $sql .= " AND status = ?";
                $params[] = $status;
            }
            
            if ($type) {
                $sql .= " AND type = ?";
                $params[] = $type;
            }
            
            $sql .= " ORDER BY created_at DESC";
            
            $stmt = $conn->prepare($sql);
            $stmt->execute($params);
            $feedback = $stmt->fetchAll(PDO::FETCH_ASSOC);
            
            echo json_encode([
                'success' => true,
                'data' => $feedback,
                'count' => count($feedback)
            ]);
            break;
            
        case 'summary':
            // Get feedback summary
            if (!isset($_GET['user_id'])) {
                // Global summary for admins
                $sql = "SELECT 
                            type,
                            status,
                            COUNT(*) as feedback_count,
                            AVG(CASE 
                                WHEN priority_level = 'high' THEN 3 
                                WHEN priority_level = 'medium' THEN 2 
                                ELSE 1 
                            END) as avg_priority_score
                        FROM feedback
                        GROUP BY type, status
                        ORDER BY type, status";
                
                $stmt = $conn->prepare($sql);
                $stmt->execute();
            } else {
                // User-specific summary
                $user_id = intval($_GET['user_id']);
                $sql = "SELECT 
                            COUNT(*) as total_feedback,
                            SUM(CASE WHEN status = 'resolved' THEN 1 ELSE 0 END) as resolved_feedback,
                            SUM(CASE WHEN status = 'reviewed' THEN 1 ELSE 0 END) as reviewed_feedback,
                            SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_feedback,
                            SUM(CASE WHEN type = 'suggestion' THEN 1 ELSE 0 END) as suggestions,
                            SUM(CASE WHEN type = 'complaint' THEN 1 ELSE 0 END) as complaints,
                            SUM(CASE WHEN type = 'compliment' THEN 1 ELSE 0 END) as compliments
                        FROM feedback 
                        WHERE user_id = ?";
                
                $stmt = $conn->prepare($sql);
                $stmt->execute([$user_id]);
            }
            
            $summary = $stmt->fetchAll(PDO::FETCH_ASSOC);
            
            echo json_encode([
                'success' => true,
                'data' => $summary
            ]);
            break;
            
        case 'categories':
            // Get available categories
            $sql = "SELECT DISTINCT category FROM feedback WHERE category IS NOT NULL ORDER BY category";
            $stmt = $conn->prepare($sql);
            $stmt->execute();
            $categories = $stmt->fetchAll(PDO::FETCH_COLUMN);
            
            echo json_encode([
                'success' => true,
                'data' => $categories
            ]);
            break;
    }
}

function handlePostRequest($endpoint) {
    global $conn;
    
    $input = json_decode(file_get_contents('php://input'), true);
    
    if (!$input) {
        throw new Exception('Invalid JSON input', 400);
    }
    
    switch ($endpoint) {
        case 'submit':
        default:
            // Submit new feedback
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
            $category = isset($input['category']) ? trim($input['category']) : null;
            $priority_level = isset($input['priority_level']) ? $input['priority_level'] : 'medium';
            
            // Validate type
            if (!in_array($type, ['suggestion', 'complaint', 'compliment'])) {
                throw new Exception('Invalid feedback type', 400);
            }
            
            // Validate priority
            if (!in_array($priority_level, ['low', 'medium', 'high'])) {
                throw new Exception('Invalid priority level', 400);
            }
            
            $sql = "INSERT INTO feedback (user_id, title, message, type, category, priority_level, created_at, updated_at) 
                    VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())";
            
            $stmt = $conn->prepare($sql);
            $result = $stmt->execute([$user_id, $title, $message, $type, $category, $priority_level]);
            
            if ($result) {
                $feedback_id = $conn->lastInsertId();
                
                // Get the created feedback
                $stmt = $conn->prepare("SELECT * FROM feedback WHERE id = ?");
                $stmt->execute([$feedback_id]);
                $feedback = $stmt->fetch(PDO::FETCH_ASSOC);
                
                echo json_encode([
                    'success' => true,
                    'message' => 'Feedback submitted successfully',
                    'data' => $feedback
                ]);
            } else {
                throw new Exception('Failed to submit feedback', 500);
            }
            break;
    }
}

function handlePutRequest($endpoint) {
    global $conn;
    
    $input = json_decode(file_get_contents('php://input'), true);
    
    if (!$input) {
        throw new Exception('Invalid JSON input', 400);
    }
    
    switch ($endpoint) {
        case 'respond':
            // Admin response to feedback
            if (!isset($input['feedback_id']) || !isset($input['reviewer_id']) || !isset($input['response'])) {
                throw new Exception('Feedback ID, Reviewer ID, and Response are required', 400);
            }
            
            $feedback_id = intval($input['feedback_id']);
            $reviewer_id = intval($input['reviewer_id']);
            $response = trim($input['response']);
            $status = isset($input['status']) ? $input['status'] : 'reviewed';
            
            // Validate status
            if (!in_array($status, ['reviewed', 'resolved'])) {
                throw new Exception('Invalid status value', 400);
            }
            
            $sql = "UPDATE feedback SET 
                        status = ?, 
                        response = ?, 
                        reviewed_by = ?, 
                        reviewed_at = NOW(),
                        updated_at = NOW()
                    WHERE id = ?";
            
            $stmt = $conn->prepare($sql);
            $result = $stmt->execute([$status, $response, $reviewer_id, $feedback_id]);
            
            if ($stmt->rowCount() > 0) {
                // Get updated feedback
                $stmt = $conn->prepare("SELECT * FROM feedback WHERE id = ?");
                $stmt->execute([$feedback_id]);
                $feedback = $stmt->fetch(PDO::FETCH_ASSOC);
                
                echo json_encode([
                    'success' => true,
                    'message' => 'Response added successfully',
                    'data' => $feedback
                ]);
            } else {
                throw new Exception('Feedback not found', 404);
            }
            break;
            
        case 'status':
            // Update feedback status
            if (!isset($input['feedback_id']) || !isset($input['status'])) {
                throw new Exception('Feedback ID and Status are required', 400);
            }
            
            $feedback_id = intval($input['feedback_id']);
            $status = $input['status'];
            
            // Validate status
            if (!in_array($status, ['pending', 'reviewed', 'resolved'])) {
                throw new Exception('Invalid status value', 400);
            }
            
            $sql = "UPDATE feedback SET status = ?, updated_at = NOW() WHERE id = ?";
            $stmt = $conn->prepare($sql);
            $result = $stmt->execute([$status, $feedback_id]);
            
            if ($stmt->rowCount() > 0) {
                echo json_encode([
                    'success' => true,
                    'message' => 'Feedback status updated successfully'
                ]);
            } else {
                throw new Exception('Feedback not found', 404);
            }
            break;
            
        case 'update':
        default:
            // Update feedback (only for pending feedback)
            if (!isset($input['feedback_id']) || !isset($input['user_id'])) {
                throw new Exception('Feedback ID and User ID are required', 400);
            }
            
            $feedback_id = intval($input['feedback_id']);
            $user_id = intval($input['user_id']);
            
            // Check if feedback is still pending and belongs to user
            $stmt = $conn->prepare("SELECT status FROM feedback WHERE id = ? AND user_id = ?");
            $stmt->execute([$feedback_id, $user_id]);
            $feedback_status = $stmt->fetchColumn();
            
            if (!$feedback_status) {
                throw new Exception('Feedback not found or not authorized', 404);
            }
            
            if ($feedback_status !== 'pending') {
                throw new Exception('Cannot update feedback that has been reviewed', 403);
            }
            
            $updates = [];
            $params = [];
            $allowed_fields = ['title', 'message', 'type', 'category', 'priority_level'];
            
            foreach ($allowed_fields as $field) {
                if (isset($input[$field])) {
                    $updates[] = "$field = ?";
                    $params[] = $input[$field];
                }
            }
            
            if (empty($updates)) {
                throw new Exception('No valid fields to update', 400);
            }
            
            $updates[] = "updated_at = NOW()";
            $sql = "UPDATE feedback SET " . implode(', ', $updates) . " WHERE id = ? AND user_id = ?";
            $params[] = $feedback_id;
            $params[] = $user_id;
            
            $stmt = $conn->prepare($sql);
            $result = $stmt->execute($params);
            
            if ($stmt->rowCount() > 0) {
                // Get updated feedback
                $stmt = $conn->prepare("SELECT * FROM feedback WHERE id = ?");
                $stmt->execute([$feedback_id]);
                $feedback = $stmt->fetch(PDO::FETCH_ASSOC);
                
                echo json_encode([
                    'success' => true,
                    'message' => 'Feedback updated successfully',
                    'data' => $feedback
                ]);
            } else {
                throw new Exception('Failed to update feedback', 500);
            }
            break;
    }
}

function handleDeleteRequest($endpoint) {
    global $conn;
    
    $input = json_decode(file_get_contents('php://input'), true);
    
    if (!$input || !isset($input['feedback_id']) || !isset($input['user_id'])) {
        throw new Exception('Feedback ID and User ID are required', 400);
    }
    
    $feedback_id = intval($input['feedback_id']);
    $user_id = intval($input['user_id']);
    
    // Check if feedback is still pending and belongs to user
    $stmt = $conn->prepare("SELECT status FROM feedback WHERE id = ? AND user_id = ?");
    $stmt->execute([$feedback_id, $user_id]);
    $feedback_status = $stmt->fetchColumn();
    
    if (!$feedback_status) {
        throw new Exception('Feedback not found or not authorized', 404);
    }
    
    if ($feedback_status !== 'pending') {
        throw new Exception('Cannot delete feedback that has been reviewed', 403);
    }
    
    switch ($endpoint) {
        case 'delete':
        default:
            $sql = "DELETE FROM feedback WHERE id = ? AND user_id = ?";
            $stmt = $conn->prepare($sql);
            $result = $stmt->execute([$feedback_id, $user_id]);
            
            if ($stmt->rowCount() > 0) {
                echo json_encode([
                    'success' => true,
                    'message' => 'Feedback deleted successfully'
                ]);
            } else {
                throw new Exception('Failed to delete feedback', 500);
            }
            break;
    }
}
?>