<?php
// Login endpoint for the Expo app.
//
// POST /login.php
// Body: JSON { "username": "...", "password": "..." }
//
// Notes:
// - This validates against the `accounts` table in Supabase via the REST API.
// - It supports either plaintext passwords (legacy) or PHP password_hash() hashes.
// - On success, returns user data and log_id for session management.

// #region agent log - entry point
$logPath = __DIR__ . '/../../../.cursor/debug.log';
@file_put_contents($logPath, json_encode(['id'=>'log_'.time().'_entry','timestamp'=>time()*1000,'location'=>'login.php:12','message'=>'Request received','data'=>['method'=>$_SERVER['REQUEST_METHOD']??'unknown','uri'=>$_SERVER['REQUEST_URI']??'unknown','has_input'=>!empty(file_get_contents('php://input'))],'runId'=>'run1','hypothesisId'=>'A'])."\n", FILE_APPEND);
// #endregion

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

// #region agent log - before require
$logPath = __DIR__ . '/../../../.cursor/debug.log';
@file_put_contents($logPath, json_encode(['id'=>'log_'.time().'_require','timestamp'=>time()*1000,'location'=>'login.php:32','message'=>'Before require connect.php','data'=>['connect_exists'=>file_exists(__DIR__ . '/connect.php')],'runId'=>'run1','hypothesisId'=>'A'])."\n", FILE_APPEND);
// #endregion

require_once __DIR__ . '/connect.php';

$raw = file_get_contents('php://input') ?: '';
$body = json_decode($raw, true);

// #region agent log
$logPath = __DIR__ . '/../../../.cursor/debug.log';
file_put_contents($logPath, json_encode(['id'=>'log_'.time().'_a','timestamp'=>time()*1000,'location'=>'login.php:32','message'=>'JSON parsing result','data'=>['raw_length'=>strlen($raw),'json_error'=>json_last_error_msg(),'is_array'=>is_array($body),'has_username'=>isset($body['username']),'has_password'=>isset($body['password'])],'runId'=>'run1','hypothesisId'=>'A'])."\n", FILE_APPEND);
// #endregion

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

// Fetch the account by username
[$status, $data, $err] = supabase_request(
    'GET', 
    "rest/v1/accounts?username=eq." . urlencode($username)
);

// #region agent log
$logPath = __DIR__ . '/../../../.cursor/debug.log';
file_put_contents($logPath, json_encode(['id'=>'log_'.time().'_b','timestamp'=>time()*1000,'location'=>'login.php:53','message'=>'Database query result','data'=>['status'=>$status,'has_error'=>!empty($err),'error'=>$err,'data_type'=>gettype($data),'data_count'=>is_array($data)?count($data):0,'username'=>$username],'runId'=>'run1','hypothesisId'=>'B'])."\n", FILE_APPEND);
// #endregion

if ($err) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'message' => 'Database error', 'detail' => $err]);
    exit;
}

if ($status !== 200) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'message' => 'Unexpected response from database', 'status' => $status]);
    exit;
}

if (!is_array($data) || count($data) === 0) {
    http_response_code(401);
    echo json_encode(['ok' => false, 'message' => 'Invalid username or password']);
    exit;
}

$account = $data[0];
$stored = (string)($account['password'] ?? '');

// #region agent log
$logPath = __DIR__ . '/../../../.cursor/debug.log';
file_put_contents($logPath, json_encode(['id'=>'log_'.time().'_c1','timestamp'=>time()*1000,'location'=>'login.php:76','message'=>'Before password verification','data'=>['has_stored_password'=>!empty($stored),'stored_length'=>strlen($stored),'input_length'=>strlen($password),'stored_prefix'=>substr($stored,0,10)],'runId'=>'run1','hypothesisId'=>'C'])."\n", FILE_APPEND);
// #endregion

// Check if password is hashed (bcrypt, argon2, etc.) or plain text
$isHash = str_starts_with($stored, '$2y$') || str_starts_with($stored, '$2a$') || str_starts_with($stored, '$argon2');
$valid = $isHash ? password_verify($password, $stored) : hash_equals($stored, $password);

// #region agent log
$logPath = __DIR__ . '/../../../.cursor/debug.log';
file_put_contents($logPath, json_encode(['id'=>'log_'.time().'_c2','timestamp'=>time()*1000,'location'=>'login.php:79','message'=>'After password verification','data'=>['is_hash'=>$isHash,'valid'=>$valid,'verification_method'=>$isHash?'password_verify':'hash_equals'],'runId'=>'run1','hypothesisId'=>'C'])."\n", FILE_APPEND);
// #endregion

if (!$valid) {
    http_response_code(401);
    echo json_encode(['ok' => false, 'message' => 'Invalid username or password']);
    exit;
}

// #region agent log
$logPath = __DIR__ . '/../../../.cursor/debug.log';
file_put_contents($logPath, json_encode(['id'=>'log_'.time().'_d','timestamp'=>time()*1000,'location'=>'login.php:87','message'=>'Before building response','data'=>['has_log_id'=>isset($account['log_id']),'log_id'=>$account['log_id']??null,'log_id_type'=>isset($account['log_id'])?gettype($account['log_id']):'missing','has_username'=>isset($account['username']),'account_keys'=>array_keys($account)],'runId'=>'run1','hypothesisId'=>'D'])."\n", FILE_APPEND);
// #endregion

// Login successful
$response = [
    'ok' => true,
    'message' => 'Login successful',
    'user' => [
        'log_id' => $account['log_id'],
        'username' => $account['username'],
    ],
    'password_storage' => $isHash ? 'hashed' : 'plaintext',
];

// #region agent log
$logPath = __DIR__ . '/../../../.cursor/debug.log';
file_put_contents($logPath, json_encode(['id'=>'log_'.time().'_e','timestamp'=>time()*1000,'location'=>'login.php:95','message'=>'Response built','data'=>['response_keys'=>array_keys($response),'user_keys'=>array_keys($response['user']),'log_id_in_response'=>$response['user']['log_id']??null],'runId'=>'run1','hypothesisId'=>'E'])."\n", FILE_APPEND);
// #endregion

echo json_encode($response);
