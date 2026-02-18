<?php
// User Activities API endpoint
// Handles CREATE and GET operations for user activities

// CORS headers
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, Accept');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

header('Content-Type: application/json');

require_once __DIR__ . '/connect.php';

// GET endpoint - Get activities for an employee
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $emp_id = $_GET['emp_id'] ?? null;
    
    if (empty($emp_id)) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'message' => 'Missing emp_id parameter']);
        exit;
    }
    
    // Get today's activities by default, or all if requested
    $today_only = isset($_GET['today_only']) && $_GET['today_only'] === 'true';
    
    $path = "rest/v1/user_activities?emp_id=eq.{$emp_id}&select=*&order=created_at.desc";
    
    if ($today_only) {
        $today = date('Y-m-d');
        $path .= "&created_at=gte.{$today}T00:00:00Z";
    }
    
    [$status, $result, $err] = supabase_request('GET', $path);
    
    if ($err) {
        http_response_code(500);
        echo json_encode(['ok' => false, 'message' => 'Supabase request failed', 'detail' => $err]);
        exit;
    }
    
    if ($status < 200 || $status >= 300) {
        http_response_code($status);
        echo json_encode(['ok' => false, 'message' => 'Failed to load activities', 'status' => $status]);
        exit;
    }
    
    // Decode photo_url from bytea if needed
    // Supabase REST API returns bytea as base64 strings by default when using JSON
    // But it might also return as hex, so we handle both cases
    if (is_array($result)) {
        foreach ($result as &$item) {
            if (isset($item['photo_url']) && $item['photo_url'] !== null) {
                $photoUrl = $item['photo_url'];
                
                if (is_string($photoUrl)) {
                    // Check if it's hex format (starts with \x or is pure hex)
                    if (strpos($photoUrl, '\\x') === 0) {
                        // Remove \x prefix and decode hex
                        $hex = substr($photoUrl, 2);
                        $decoded = @hex2bin($hex);
                        if ($decoded !== false) {
                            $item['photo_url'] = $decoded;
                        }
                    } elseif (ctype_xdigit($photoUrl) && strlen($photoUrl) > 20) {
                        // If it's pure hex (long enough to be image data), decode it
                        $decoded = @hex2bin($photoUrl);
                        if ($decoded !== false) {
                            $item['photo_url'] = $decoded;
                        }
                    }
                    // If it's already base64, leave it as is
                }
            }
        }
        unset($item);
    }
    
    echo json_encode([
        'ok' => true,
        'data' => is_array($result) ? $result : [],
    ]);
    exit;
}

// POST endpoint - Create new activity
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    // Check if it's multipart form data (with photo upload)
    if (!empty($_FILES['photo']) && !empty($_FILES['photo']['tmp_name'])) {
        // Handle multipart form data with photo
        $emp_id = isset($_POST['emp_id']) ? (int)$_POST['emp_id'] : 0;
        $task_description = isset($_POST['task_description']) ? trim($_POST['task_description']) : '';
        $location = isset($_POST['location']) ? trim($_POST['location']) : '';
        
        if (empty($emp_id) || empty($task_description) || empty($location)) {
            http_response_code(400);
            echo json_encode(['ok' => false, 'message' => 'Missing required fields: emp_id, task_description, location']);
            exit;
        }
        
        // Read photo file
        $tmp = $_FILES['photo']['tmp_name'];
        $photoData = @file_get_contents($tmp);
        if ($photoData === false) {
            http_response_code(500);
            echo json_encode(['ok' => false, 'message' => 'Failed to read uploaded photo']);
            exit;
        }
        
        // Convert photo to base64 for storage
        // Supabase REST API accepts base64 strings for bytea columns
        $photoBase64 = base64_encode($photoData);
        
    } else {
        // Handle JSON body
        $raw = file_get_contents('php://input') ?: '';
        $body = json_decode($raw, true);
        
        if (!is_array($body)) {
            http_response_code(400);
            echo json_encode(['ok' => false, 'message' => 'Invalid JSON body or missing photo']);
            exit;
        }
        
        $emp_id = isset($body['emp_id']) ? (int)$body['emp_id'] : 0;
        $task_description = isset($body['task_description']) ? trim($body['task_description']) : '';
        $location = isset($body['location']) ? trim($body['location']) : '';
        $photoBase64 = isset($body['photo_base64']) ? trim($body['photo_base64']) : '';
        
        if (empty($emp_id) || empty($task_description) || empty($location)) {
            http_response_code(400);
            echo json_encode(['ok' => false, 'message' => 'Missing required fields: emp_id, task_description, location']);
            exit;
        }
    }
    
    // Insert activity into Supabase
    $insertData = [
        'emp_id' => $emp_id,
        'task_description' => $task_description,
        'location' => $location,
        'status' => 'pending',
    ];
    
    // Only add photo_url if we have one
    // Supabase REST API accepts base64 strings for bytea columns
    if (isset($photoBase64) && !empty($photoBase64)) {
        $insertData['photo_url'] = $photoBase64;
    }
    
    [$status, $result, $err] = supabase_insert('user_activities', $insertData);
    
    if ($err) {
        http_response_code(500);
        echo json_encode(['ok' => false, 'message' => 'Supabase request failed', 'detail' => $err]);
        exit;
    }
    
    if ($status < 200 || $status >= 300) {
        http_response_code($status);
        echo json_encode(['ok' => false, 'message' => 'Failed to create activity', 'status' => $status, 'body' => $result]);
        exit;
    }
    
    echo json_encode([
        'ok' => true,
        'message' => 'Activity created successfully',
        'data' => is_array($result) && count($result) > 0 ? $result[0] : $result,
    ]);
    exit;
}

// Method not allowed
http_response_code(405);
echo json_encode(['ok' => false, 'message' => 'Method not allowed']);
exit;

?>
