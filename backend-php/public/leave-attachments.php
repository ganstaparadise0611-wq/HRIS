<?php
// Leave attachments API endpoint
// Handles upload, list, and delete operations for leave request attachments

// CORS headers
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, GET, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, Accept');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

header('Content-Type: application/json');

require_once __DIR__ . '/connect.php';

// Upload directory
$uploadDir = __DIR__ . '/uploads/leave-attachments/';
if (!is_dir($uploadDir)) {
    mkdir($uploadDir, 0755, true);
}

// GET endpoint - List attachments for a leave request
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $leave_id = $_GET['leave_id'] ?? null;
    
    if (empty($leave_id)) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'message' => 'Missing leave_id parameter']);
        exit;
    }
    
    [$status, $result, $err] = supabase_request(
        'GET',
        "rest/v1/leave_attachments?leave_id=eq.{$leave_id}&select=*&order=uploaded_at.desc"
    );
    
    if ($err) {
        http_response_code(500);
        echo json_encode(['ok' => false, 'message' => 'Supabase request failed', 'detail' => $err]);
        exit;
    }
    
    if ($status < 200 || $status >= 300) {
        http_response_code($status);
        echo json_encode(['ok' => false, 'message' => 'Failed to load attachments', 'status' => $status]);
        exit;
    }
    
    echo json_encode([
        'ok' => true,
        'data' => is_array($result) ? $result : [],
    ]);
    exit;
}

// POST endpoint - Upload attachment
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $leave_id = $_POST['leave_id'] ?? null;
    
    if (empty($leave_id)) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'message' => 'Missing leave_id parameter']);
        exit;
    }
    
    if (!isset($_FILES['file']) || $_FILES['file']['error'] !== UPLOAD_ERR_OK) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'message' => 'No file uploaded or upload error']);
        exit;
    }
    
    $file = $_FILES['file'];
    $fileName = basename($file['name']);
    $fileSize = $file['size'];
    $mimeType = $file['type'];
    
    // Validate file size (max 10MB)
    $maxSize = 10 * 1024 * 1024;
    if ($fileSize > $maxSize) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'message' => 'File size exceeds 10MB limit']);
        exit;
    }
    
    // Allowed MIME types
    $allowedMimes = [
        'application/pdf',
        'image/jpeg',
        'image/png',
        'image/gif',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ];
    
    if (!in_array($mimeType, $allowedMimes)) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'message' => 'File type not allowed']);
        exit;
    }
    
    // Generate unique filename
    $ext = pathinfo($fileName, PATHINFO_EXTENSION);
    $uniqueName = 'leave_' . $leave_id . '_' . time() . '_' . bin2hex(random_bytes(4)) . '.' . $ext;
    $filePath = $uploadDir . $uniqueName;
    
    // Move uploaded file
    if (!move_uploaded_file($file['tmp_name'], $filePath)) {
        http_response_code(500);
        echo json_encode(['ok' => false, 'message' => 'Failed to save file']);
        exit;
    }
    
    // Insert attachment record into database
    $insertData = [
        'leave_id' => (int)$leave_id,
        'file_name' => $fileName,
        'file_size' => $fileSize,
        'mime_type' => $mimeType,
        'file_path' => 'uploads/leave-attachments/' . $uniqueName,
    ];
    
    [$status, $result, $err] = supabase_request(
        'POST',
        'rest/v1/leave_attachments',
        [$insertData],
        ['Prefer: return=representation']
    );
    
    if ($err || $status < 200 || $status >= 300) {
        // Clean up uploaded file if database insert fails
        unlink($filePath);
        
        http_response_code(500);
        echo json_encode(['ok' => false, 'message' => 'Failed to save attachment record', 'detail' => $err]);
        exit;
    }
    
    echo json_encode([
        'ok' => true,
        'message' => 'File uploaded successfully',
        'data' => $result,
    ]);
    exit;
}

// DELETE endpoint - Delete attachment
if ($_SERVER['REQUEST_METHOD'] === 'DELETE') {
    $raw = file_get_contents('php://input') ?: '';
    $body = json_decode($raw, true);
    
    $attachment_id = $body['attachment_id'] ?? null;
    
    if (empty($attachment_id)) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'message' => 'Missing attachment_id']);
        exit;
    }
    
    // Fetch attachment details
    [$status, $attachmentData, $err] = supabase_request(
        'GET',
        "rest/v1/leave_attachments?attachment_id=eq.{$attachment_id}&select=file_path"
    );
    
    if ($err || $status < 200 || $status >= 300 || empty($attachmentData)) {
        http_response_code(404);
        echo json_encode(['ok' => false, 'message' => 'Attachment not found']);
        exit;
    }
    
    $filePath = $attachmentData[0]['file_path'] ?? null;
    
    // Delete from database
    [$status, $result, $err] = supabase_request(
        'DELETE',
        "rest/v1/leave_attachments?attachment_id=eq.{$attachment_id}"
    );
    
    if ($err || $status < 200 || $status >= 300) {
        http_response_code(500);
        echo json_encode(['ok' => false, 'message' => 'Failed to delete attachment record']);
        exit;
    }
    
    // Delete physical file
    if ($filePath) {
        $fullPath = __DIR__ . '/' . $filePath;
        if (file_exists($fullPath)) {
            unlink($fullPath);
        }
    }
    
    echo json_encode([
        'ok' => true,
        'message' => 'Attachment deleted successfully',
    ]);
    exit;
}

// Invalid method
http_response_code(405);
echo json_encode(['ok' => false, 'message' => 'Method not allowed']);
exit;
