<?php
// update-qr.php – Updates the qr_code field for an account (used when username changes or for QR regen)
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, Accept, ngrok-skip-browser-warning');
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }

require_once __DIR__ . '/connect.php';

$raw  = file_get_contents('php://input') ?: '';
$body = json_decode($raw, true);

$log_id  = $body['log_id']  ?? null;
$qr_code = $body['qr_code'] ?? null;

if (!$log_id || !$qr_code) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'message' => 'Missing log_id or qr_code']);
    exit;
}

[$status, $result, $err] = supabase_request(
    'PATCH',
    "rest/v1/accounts?log_id=eq.{$log_id}",
    ['qr_code' => $qr_code],
    ['Prefer: return=representation']
);

if ($err || $status < 200 || $status >= 300) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'message' => 'Failed to update QR code', 'detail' => $err]);
    exit;
}

echo json_encode(['ok' => true, 'message' => 'QR code updated successfully']);
?>
