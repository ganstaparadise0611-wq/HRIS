<?php
// Login endpoint for the Expo app.
//
// POST /login.php
// Body: JSON { "username": "...", "password": "..." }
//
// Notes:
// - This validates against the `accounts` table in Supabase via the REST API.
// - It supports either plaintext passwords (legacy) or PHP password_hash() hashes.
// - On success, returns a signed JWT you can store client-side.

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, Accept');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'message' => 'Method not allowed']);
    exit;
}

require_once __DIR__ . '/connect.php';

function base64url_encode(string $data): string
{
    return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
}

function jwt_hs256(array $payload, string $secret): string
{
    $header = ['alg' => 'HS256', 'typ' => 'JWT'];
    $segments = [
        base64url_encode(json_encode($header, JSON_UNESCAPED_SLASHES)),
        base64url_encode(json_encode($payload, JSON_UNESCAPED_SLASHES)),
    ];
    $signingInput = implode('.', $segments);
    $signature = hash_hmac('sha256', $signingInput, $secret, true);
    $segments[] = base64url_encode($signature);
    return implode('.', $segments);
}

$raw = file_get_contents('php://input') ?: '';
$body = json_decode($raw, true);

if (!is_array($body)) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'message' => 'Invalid JSON body']);
    exit;
}

$username = trim((string)($body['username'] ?? ''));
$password = (string)($body['password'] ?? '');

if ($username === '' || $password === '') {
    http_response_code(400);
    echo json_encode(['ok' => false, 'message' => 'Missing username or password']);
    exit;
}

// Fetch the account row by username
[$status, $account, $err] = supabase_select_single('accounts', ['username' => $username], 'log_id,username,password');

if ($err) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'message' => 'Supabase request failed', 'detail' => $err]);
    exit;
}

if ($status === 406 || $account === null) {
    // PostgREST returns 406 when object is empty and Accept: object is used
    http_response_code(401);
    echo json_encode(['ok' => false, 'message' => 'Invalid username or password']);
    exit;
}

if ($status < 200 || $status >= 300) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'message' => 'Unexpected Supabase response', 'status' => $status, 'body' => $account]);
    exit;
}

$stored = (string)($account['password'] ?? '');

$isHash = str_starts_with($stored, '$2y$') || str_starts_with($stored, '$2a$') || str_starts_with($stored, '$argon2');
$valid = $isHash ? password_verify($password, $stored) : hash_equals($stored, $password);

if (!$valid) {
    http_response_code(401);
    echo json_encode(['ok' => false, 'message' => 'Invalid username or password']);
    exit;
}

$jwtSecret = getenv('APP_JWT_SECRET') ?: '';
if ($jwtSecret === '') {
    http_response_code(500);
    echo json_encode(['ok' => false, 'message' => 'Missing APP_JWT_SECRET environment variable']);
    exit;
}

$now = time();
$payload = [
    'sub' => (string)$account['log_id'],
    'username' => (string)$account['username'],
    'iat' => $now,
    // 7 days by default (client can still "keepLogged" via storage policy)
    'exp' => $now + (7 * 24 * 60 * 60),
];

$token = jwt_hs256($payload, $jwtSecret);

echo json_encode([
    'ok' => true,
    'token' => $token,
    'user' => [
        'log_id' => $account['log_id'],
        'username' => $account['username'],
    ],
    'password_storage' => $isHash ? 'hashed' : 'plaintext',
]);

