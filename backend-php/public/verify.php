<?php
// Verify endpoint - accepts multipart form with 'photo' file and optional 'user_id'

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, Accept, ngrok-skip-browser-warning, Cache-Control');
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

// Require user_id so verification is tied to the logged-in user
if (!$userId) {
    http_response_code(400);
    echo json_encode([
        'ok' => false,
        'message' => 'Missing user_id',
        'hint' => 'Send user_id from the logged-in session so verification matches the correct account.'
    ]);
    exit;
}

// If user_id provided, fetch stored face from Supabase
$storedFaceBase64 = null;
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
if ($storedFace && is_string($storedFace)) {
    // Normalize: PostgreSQL bytea can come back as hex (\x2f396a... or raw hex) or as text (data URI / base64)
    $hex = null;
    if (strpos($storedFace, '\\x') === 0 && strlen($storedFace) > 2) {
        $hex = substr($storedFace, 2);
    } elseif (strlen($storedFace) > 20 && ctype_xdigit($storedFace)) {
        $hex = $storedFace;
    }
    if ($hex !== null) {
        $decoded = @hex2bin($hex);
        $storedFaceBase64 = ($decoded !== false) ? $decoded : $storedFace;
    } else {
        $storedFaceBase64 = $storedFace;
    }
} else {
    $storedFaceBase64 = null;
}

// If no stored face available, respond with 404 so client can fall back
if (!$storedFaceBase64) {
    http_response_code(404);
    echo json_encode(['ok' => false, 'message' => 'No stored face for user']);
    exit;
}

// Use Face++ compare when properly configured
$faceppConfigured = function_exists('facepp_api_configured') ? facepp_api_configured() : false;

if ($faceppConfigured && function_exists('facepp_compare_faces')) {
    // First: detect a face in the LIVE camera photo.
    // This makes "no face detected" reliable instead of depending on compare() error strings.
    $detectUrl = 'https://api-us.faceplusplus.com/facepp/v3/detect';
    $detectPayload = [
        'api_key' => defined('FACEPP_API_KEY') ? FACEPP_API_KEY : getenv('FACEPP_API_KEY'),
        'api_secret' => defined('FACEPP_API_SECRET') ? FACEPP_API_SECRET : getenv('FACEPP_API_SECRET'),
        'image_base64' => $photoBase64,
        'return_attributes' => 'none',
    ];

    $ch = curl_init($detectUrl);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => http_build_query($detectPayload),
        CURLOPT_TIMEOUT => 20,
        CURLOPT_CONNECTTIMEOUT => 8,
    ]);
    $detectResponse = curl_exec($ch);
    $detectHttpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $detectError = curl_error($ch);
    curl_close($ch);

    if ($detectError) {
        http_response_code(502);
        echo json_encode([
            'ok' => false,
            'message' => 'Face detection service error. Please try again.',
            'detail' => $detectError,
        ]);
        exit;
    }

    $detectJson = json_decode((string)$detectResponse, true);
    if ($detectHttpCode !== 200 || !is_array($detectJson) || isset($detectJson['error_message'])) {
        $apiError = is_array($detectJson) ? ($detectJson['error_message'] ?? '') : '';
        http_response_code(400);
        echo json_encode([
            'ok' => false,
            'code' => 'NO_FACE_DETECTED',
            'message' => 'No face detected in camera.',
            'hint' => 'Make sure your whole face is inside the frame with good lighting, then try again.',
            'detail' => $apiError !== '' ? $apiError : substr((string)$detectResponse, 0, 200),
        ]);
        exit;
    }

    $faces = $detectJson['faces'] ?? [];
    if (!is_array($faces) || count($faces) === 0) {
        http_response_code(401);
        echo json_encode([
            'ok' => false,
            'code' => 'NO_FACE_DETECTED',
            'message' => 'No face detected in camera.',
            'hint' => 'Center your face in the frame and try again.',
        ]);
        exit;
    }

    $result = facepp_compare_faces($photoBase64, $storedFaceBase64);
    if ($result === null) {
        $err = function_exists('facepp_get_last_error') ? facepp_get_last_error() : 'Face comparison failed';
        // Distinguish between "no face detected" vs generic server error
        if (is_string($err) && stripos($err, 'NO_FACE') !== false) {
            http_response_code(401);
            echo json_encode([
                'ok' => false,
                'code' => 'NO_FACE_DETECTED',
                'message' => 'No face detected in camera.',
                'hint' => 'Make sure your whole face is inside the frame with good lighting, then try again.',
            ]);
            exit;
        } else {
            http_response_code(500);
            echo json_encode(['ok' => false, 'message' => 'Face comparison error', 'detail' => $err]);
            exit;
        }
    }

    // result contains 'similar' boolean and confidence (0-1)
    if (!empty($result['similar'])) {
        echo json_encode([
            'ok' => true,
            'message' => 'Face matched',
            'match_score' => $result['confidence'],
            'threshold' => $result['threshold']
        ]);
        exit;
    } else {
        http_response_code(401);
        echo json_encode([
            'ok' => false,
            'code' => 'FACE_NOT_MATCHED',
            'message' => 'Face did not match',
            'match_score' => $result['confidence'],
            'threshold' => $result['threshold']
        ]);
        exit;
    }
}

// If provider not configured, do NOT auto-approve.
http_response_code(501);
echo json_encode([
    'ok' => false,
    'message' => 'No face recognition provider configured on server.',
    'hint' => 'Set FACEPP_API_KEY and FACEPP_API_SECRET in the PHP server environment (or backend-php/.env), then restart the backend.',
    'debug' => [
        'facepp_configured' => $faceppConfigured,
        'has_FACEPP_API_KEY' => !empty(getenv('FACEPP_API_KEY')),
        'has_FACEPP_API_SECRET' => !empty(getenv('FACEPP_API_SECRET')),
    ],
]);
exit;

?>