<?php
// Verify endpoint - accepts multipart form with 'photo' file and optional 'user_id'

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, Accept');
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'message' => 'Method not allowed']);
    exit;
}

require_once __DIR__ . '/connect.php';

// Try to include Face++ helper if available
if (file_exists(__DIR__ . '/facepp_api.php')) {
    require_once __DIR__ . '/facepp_api.php';
}

// Read uploaded file
if (empty($_FILES['photo']) || empty($_FILES['photo']['tmp_name'])) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'message' => 'Missing photo file']);
    exit;
}

$tmp = $_FILES['photo']['tmp_name'];
$photoData = @file_get_contents($tmp);
if ($photoData === false) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'message' => 'Failed to read uploaded file']);
    exit;
}

$photoBase64 = base64_encode($photoData);

$userId = isset($_POST['user_id']) ? trim($_POST['user_id']) : null;

// If user_id provided, fetch stored face from Supabase
$storedFaceBase64 = null;
if ($userId) {
    [$status, $data, $err] = supabase_request('GET', "rest/v1/accounts?log_id=eq." . urlencode($userId) . "&select=face,username,log_id");
    if ($err) {
        http_response_code(500);
        echo json_encode(['ok' => false, 'message' => 'Database connection error', 'detail' => $err]);
        exit;
    }
    if ($status !== 200 || !is_array($data) || count($data) === 0) {
        http_response_code(404);
        echo json_encode(['ok' => false, 'message' => 'User not found']);
        exit;
    }
    $account = $data[0];
    $storedFace = $account['face'] ?? null;
    if ($storedFace) {
        // If stored face looks like JSON or array, try to extract base64
        $storedFaceBase64 = is_string($storedFace) ? $storedFace : null;
    }
}

// If no stored face available, respond with 404 so client can fall back
if (!$storedFaceBase64) {
    http_response_code(404);
    echo json_encode(['ok' => false, 'message' => 'No stored face for user']);
    exit;
}

// Use Face++ compare if available
if (function_exists('facepp_compare_faces')) {
    $result = facepp_compare_faces($photoBase64, $storedFaceBase64);
    if ($result === null) {
        $err = function_exists('facepp_get_last_error') ? facepp_get_last_error() : 'Face comparison failed';
        http_response_code(500);
        echo json_encode(['ok' => false, 'message' => 'Face comparison error', 'detail' => $err]);
        exit;
    }

    // result contains 'similar' boolean and confidence (0-1)
    if (!empty($result['similar'])) {
        echo json_encode(['ok' => true, 'message' => 'Face matched', 'match_score' => $result['confidence'], 'threshold' => $result['threshold']]);
        exit;
    } else {
        http_response_code(401);
        echo json_encode(['ok' => false, 'message' => 'Face did not match', 'match_score' => $result['confidence'], 'threshold' => $result['threshold']]);
        exit;
    }
}

// If no provider available
http_response_code(501);
echo json_encode(['ok' => false, 'message' => 'No face recognition provider configured']);
exit;

?>