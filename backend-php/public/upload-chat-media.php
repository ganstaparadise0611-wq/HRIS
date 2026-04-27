<?php
// Handle uploading media files for Chat (Images, Videos, Documents)
//
// POST /upload-chat-media.php
// Body: Multipart Form-Data { "file": [BINARY], "type": "image|video|file" }

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, Accept, ngrok-skip-browser-warning');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

header('Content-Type: application/json');

require_once __DIR__ . '/connect.php';

if (!isset($_FILES['file'])) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'message' => 'No file uploaded']);
    exit;
}

$file = $_FILES['file'];
$mediaTypeInput = $_POST['type'] ?? 'file';

// 1. Determine file extension and mime type
$ext = pathinfo($file['name'], PATHINFO_EXTENSION);
$fileName = 'media_' . time() . '_' . uniqid() . '.' . $ext;
$mimeType = $file['type'];

// 2. Read file binary
$content = file_get_contents($file['tmp_name']);
if (!$content) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'message' => 'Failed to read file content']);
    exit;
}

// 3. Upload to Supabase Storage (ChatMedia bucket)
// POST storage/v1/object/ChatMedia/filename
[$status, $data, $err] = supabase_request(
    'POST',
    "storage/v1/object/ChatMedia/{$fileName}",
    $content,
    ["Content-Type: {$mimeType}"]
);

if ($err || $status >= 300) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'message' => 'Storage upload failed', 'error' => $err, 'status' => $status]);
    exit;
}

// 4. Construct the Public URL
// Standard Supabase public URL: https://[URL]/storage/v1/object/public/[BUCKET]/[FILE]
$baseUrl = SUPABASE_URL;
$publicUrl = "{$baseUrl}/storage/v1/object/public/ChatMedia/{$fileName}";

echo json_encode([
    'ok' => true,
    'message' => 'File uploaded successfully',
    'media_url' => $publicUrl,
    'media_type' => $mediaTypeInput,
    'file_name' => $file['name'],
    'file_size' => $file['size']
]);
