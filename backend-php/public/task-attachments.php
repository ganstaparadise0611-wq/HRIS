<?php
// Task attachments API
// GET  /task-attachments.php?task_id=123
// POST /task-attachments.php (multipart form-data: file, task_id, uploaded_by)

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, Accept, ngrok-skip-browser-warning');
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

require_once __DIR__ . '/connect.php';

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $taskId = isset($_GET['task_id']) ? intval($_GET['task_id']) : 0;
    if ($taskId <= 0) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'message' => 'Missing task_id']);
        exit;
    }

    [$status, $data, $err] = supabase_request(
        'GET',
        "rest/v1/task_attachments?task_id=eq.{$taskId}&select=attachment_id,task_id,filename,file_path,file_type,file_size,uploaded_by,uploaded_at&order=uploaded_at.desc"
    );

    if ($err || $status < 200 || $status >= 300) {
        http_response_code(500);
        echo json_encode(['ok' => false, 'message' => 'Failed to fetch attachments', 'detail' => $err]);
        exit;
    }

    echo json_encode(['ok' => true, 'attachments' => is_array($data) ? $data : []]);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (!isset($_FILES['file'])) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'message' => 'No file uploaded']);
        exit;
    }

    $taskId = isset($_POST['task_id']) ? intval($_POST['task_id']) : 0;
    $uploadedBy = isset($_POST['uploaded_by']) ? intval($_POST['uploaded_by']) : 0;
    if ($taskId <= 0 || $uploadedBy <= 0) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'message' => 'Missing task_id or uploaded_by']);
        exit;
    }

    $file = $_FILES['file'];
    $origName = $file['name'] ?? 'attachment';
    $mimeType = $file['type'] ?? 'application/octet-stream';
    $fileSize = $file['size'] ?? null;

    $ext = pathinfo($origName, PATHINFO_EXTENSION);
    $safeExt = $ext ? ('.' . $ext) : '';
    $storageName = 'task_' . $taskId . '_' . time() . '_' . uniqid() . $safeExt;

    $content = file_get_contents($file['tmp_name']);
    if ($content === false) {
        http_response_code(500);
        echo json_encode(['ok' => false, 'message' => 'Failed to read file content']);
        exit;
    }

    // Upload to Supabase Storage bucket: TaskAttachments
    [$status, $data, $err] = supabase_request(
        'POST',
        "storage/v1/object/TaskAttachments/{$storageName}",
        $content,
        ["Content-Type: {$mimeType}"]
    );

    if ($err || $status >= 300) {
        http_response_code(500);
        echo json_encode(['ok' => false, 'message' => 'Storage upload failed', 'error' => $err, 'status' => $status]);
        exit;
    }

    $publicUrl = SUPABASE_URL . "/storage/v1/object/public/TaskAttachments/{$storageName}";

    $insert = [
        'task_id' => $taskId,
        'filename' => $origName,
        'file_path' => $publicUrl,
        'file_type' => $mimeType,
        'file_size' => $fileSize,
        'uploaded_by' => $uploadedBy,
    ];

    [$status2, $result2, $err2] = supabase_request(
        'POST',
        'rest/v1/task_attachments',
        $insert,
        ['Prefer: return=representation']
    );

    if ($err2 || $status2 < 200 || $status2 >= 300) {
        http_response_code(500);
        echo json_encode(['ok' => false, 'message' => 'Failed to save attachment record', 'detail' => $err2]);
        exit;
    }

    echo json_encode([
        'ok' => true,
        'attachment' => is_array($result2) && count($result2) > 0 ? $result2[0] : $result2,
        'file_url' => $publicUrl
    ]);
    exit;
}

http_response_code(405);
echo json_encode(['ok' => false, 'message' => 'Method not allowed']);
exit;
?>
