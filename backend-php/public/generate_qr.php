<?php
// Generate a QR code for a specific user based on the qr_code column
//
// Usage (PNG image response):
//   generate_qr.php?user_id=10
//   generate_qr.php?username=Chester
//
// This endpoint looks up the user in the Supabase `accounts` table,
// reads the `qr_code` text, and then redirects to a public QR-code
// image URL (no extra libraries needed).

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, Accept');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

require_once __DIR__ . '/connect.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    header('Content-Type: application/json');
    echo json_encode(['ok' => false, 'message' => 'Method not allowed']);
    exit;
}

header('Content-Type: image/png');

$userId = isset($_GET['user_id']) ? trim((string)$_GET['user_id']) : '';
$username = isset($_GET['username']) ? trim((string)$_GET['username']) : '';

if ($userId === '' && $username === '') {
    http_response_code(400);
    header('Content-Type: application/json');
    echo json_encode(['ok' => false, 'message' => 'Missing user_id or username']);
    exit;
}

// Fetch account by log_id or username
if ($userId !== '') {
    [$status, $account, $err] = supabase_select_single(
        'accounts',
        ['log_id' => $userId],
        'log_id,username,qr_code'
    );
} else {
    [$status, $account, $err] = supabase_select_single(
        'accounts',
        ['username' => $username],
        'log_id,username,qr_code'
    );
}

if ($err) {
    http_response_code(500);
    header('Content-Type: application/json');
    echo json_encode(['ok' => false, 'message' => 'Supabase request failed', 'detail' => $err]);
    exit;
}

if ($status !== 200 || !is_array($account) || empty($account)) {
    http_response_code(404);
    header('Content-Type: application/json');
    echo json_encode(['ok' => false, 'message' => 'User not found']);
    exit;
}

$qrText = isset($account['qr_code']) ? (string)$account['qr_code'] : '';

if ($qrText === '') {
    http_response_code(404);
    header('Content-Type: application/json');
    echo json_encode(['ok' => false, 'message' => 'No qr_code stored for this user']);
    exit;
}

// Build a simple external QR-code image URL.
// You can swap this to another provider if you prefer.
$encoded = urlencode($qrText);
$size = isset($_GET['size']) ? trim((string)$_GET['size']) : '300x300';
if (!preg_match('/^\d+x\d+$/', $size)) {
    $size = '300x300';
}

$qrImageUrl = "https://api.qrserver.com/v1/create-qr-code/?size={$size}&data={$encoded}";

// Redirect to the generated QR image
header('Location: ' . $qrImageUrl, true, 302);
exit;

