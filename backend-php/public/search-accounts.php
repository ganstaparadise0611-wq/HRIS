<?php
// Search for accounts by username
//
// GET /search-accounts.php?query=john&limit=10
//
// Returns matching accounts from the database

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, Accept');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'message' => 'Method not allowed']);
    exit;
}

require_once __DIR__ . '/connect.php';

$query = trim($_GET['query'] ?? '');
$limit = (int)($_GET['limit'] ?? 10);
$currentUserId = $_GET['current_user_id'] ?? '';

if (empty($query)) {
    echo json_encode(['ok' => true, 'accounts' => []]);
    exit;
}

// Search accounts by username (case-insensitive partial match)
[$status, $data, $err] = supabase_request(
    'GET',
    "rest/v1/accounts?username=ilike.*{$query}*&select=log_id,username&limit={$limit}"
);

if ($err) {
    error_log("Error searching accounts: " . $err);
    http_response_code(500);
    echo json_encode(['ok' => false, 'message' => 'Database error']);
    exit;
}

if ($status !== 200) {
    http_response_code($status);
    echo json_encode(['ok' => false, 'message' => 'Failed to search accounts', 'status' => $status]);
    exit;
}

// Filter out the current user from results
$accounts = is_array($data) ? $data : [];
if (!empty($currentUserId)) {
    $accounts = array_filter($accounts, function($account) use ($currentUserId) {
        return $account['log_id'] !== $currentUserId;
    });
    $accounts = array_values($accounts); // Re-index array
}

echo json_encode([
    'ok' => true,
    'accounts' => $accounts,
    'count' => count($accounts)
]);
