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
    
    $path = "rest/v1/user_activities?emp_id=eq.{$emp_id}&select=activity_id,emp_id,task_description,location,photo_data,status,created_at,file_type&order=created_at.desc";
    
    if ($today_only) {
        $today = date('Y-m-d');
        $path .= "&created_at=gte.{$today}T00:00:00Z";
    }
    
    [$status, $result, $err] = supabase_request('GET', $path, null, ['Accept: application/json']);
    
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
    
    // Decode photo_data from bytea and expose as photo_url for the app
    // Supabase/PostgREST returns bytea as base64 (JSON) or hex (e.g. \x5824...)
    if (is_array($result)) {
        foreach ($result as &$item) {
            $raw = $item['photo_data'] ?? $item['photo_url'] ?? $item['photo'] ?? null;
            if ($raw === null) {
                continue;
            }
            // Handle bytea as array of bytes (some APIs)
            if (is_array($raw)) {
                $raw = implode('', array_map('chr', $raw));
                $raw = base64_encode($raw);
                $item['photo_url'] = $raw;
                continue;
            }
            if (!is_string($raw) || trim($raw) === '') {
                continue;
            }
            $raw = trim($raw);
            $b64 = null;
            // Hex format: \x + hex digits (PostgreSQL/Supabase bytea hex - first char is backslash)
            $hex = null;
            if (strlen($raw) > 4 && $raw[0] === '\\' && $raw[1] === 'x') {
                $hex = substr($raw, 2);
            } elseif (strlen($raw) > 4 && (strpos($raw, '0x') === 0 || stripos($raw, '0x') === 0)) {
                $hex = substr($raw, 2);
            }
            if ($hex !== null && preg_match('/^[0-9a-fA-F]+$/', $hex) && strlen($hex) % 2 === 0) {
                $bin = @hex2bin($hex);
                if ($bin !== false) {
                    $b64 = base64_encode($bin);
                }
            }
            // Pure hex (no prefix)
            elseif (strlen($raw) > 20 && preg_match('/^[0-9a-fA-F]+$/', $raw) && strlen($raw) % 2 === 0) {
                $bin = @hex2bin($raw);
                if ($bin !== false) {
                    $b64 = base64_encode($bin);
                }
            }
            // PostgREST returns bytea as base64 in JSON
            if ($b64 === null) {
                $b64 = $raw;
            }
            if ($b64 !== null && $b64 !== '') {
                $item['photo_url'] = $b64;
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
    $photoBase64 = '';
    $fileType = null;

    // Check if it's multipart form data (with photo/file upload)
    if (
        (!empty($_FILES['photo']) && !empty($_FILES['photo']['tmp_name'])) ||
        (!empty($_FILES['file']) && !empty($_FILES['file']['tmp_name']))
    ) {
        // Prefer 'photo', fall back to generic 'file'
        $fieldName = !empty($_FILES['photo']['tmp_name']) ? 'photo' : 'file';

        $emp_id = isset($_POST['emp_id']) ? (int)$_POST['emp_id'] : 0;
        $task_description = isset($_POST['task_description']) ? trim($_POST['task_description']) : '';
        $location = isset($_POST['location']) ? trim($_POST['location']) : '';
        
        if (empty($emp_id) || empty($task_description) || empty($location)) {
            http_response_code(400);
            echo json_encode(['ok' => false, 'message' => 'Missing required fields: emp_id, task_description, location']);
            exit;
        }
        
        // Read uploaded file (image or any file)
        $tmp = $_FILES[$fieldName]['tmp_name'];
        $fileType = $_FILES[$fieldName]['type'] ?? null;
        $fileData = @file_get_contents($tmp);
        if ($fileData === false) {
            http_response_code(500);
            echo json_encode(['ok' => false, 'message' => 'Failed to read uploaded file']);
            exit;
        }
        
        // Convert to base64 for storage
        $photoBase64 = base64_encode($fileData);
        
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
        $fileType = isset($body['file_type']) ? trim($body['file_type']) : null;
        
        if (empty($emp_id) || empty($task_description) || empty($location)) {
            http_response_code(400);
            echo json_encode(['ok' => false, 'message' => 'Missing required fields: emp_id, task_description, location']);
            exit;
        }
    }
    
    // Insert activity into Supabase (table uses emp_id, photo_data, file_type)
    $insertData = [
        'emp_id' => $emp_id,
        'task_description' => $task_description,
        'location' => $location,
        'status' => 'pending',
    ];
    
    // Only add photo_data if we have one
    if (isset($photoBase64) && $photoBase64 !== '') {
        $insertData['photo_data'] = $photoBase64;
        // Use detected MIME type when available, otherwise default to image/jpeg
        $insertData['file_type'] = $fileType ?: 'image/jpeg';
    }
    
    [$status, $result, $err] = supabase_insert('user_activities', $insertData);
    
    if ($err) {
        http_response_code(500);
        echo json_encode(['ok' => false, 'message' => 'Supabase request failed', 'detail' => $err]);
        exit;
    }
    
    if ($status < 200 || $status >= 300) {
        $supabaseMsg = is_array($result) ? ($result['message'] ?? $result['details'] ?? json_encode($result)) : (string)$result;
        http_response_code(500);
        echo json_encode(['ok' => false, 'message' => 'Failed to create activity: ' . $supabaseMsg, 'status' => $status, 'detail' => $result]);
        exit;
    }

    // Also create a feed entry so the activity appears in Feeds
    if (is_array($result) && count($result) > 0 && isset($result[0]['activity_id'])) {
        $activityRow = $result[0];
        $feedData = [
            'emp_id'      => $emp_id,
            'caption'     => $task_description,
            'image_url'   => null,
            'is_achievement' => false,
            'kind'        => 'activity',
            'activity_id' => $activityRow['activity_id'],
        ];
        // Fire-and-forget; if this fails we still keep the activity
        supabase_insert('feeds_posts', $feedData);
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
