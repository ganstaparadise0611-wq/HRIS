<?php
header('Content-Type: application/json');
require_once __DIR__ . '/connect.php';

[$status, $data, $err] = supabase_request('GET', 'rest/v1/accounts?log_id=eq.23&select=face,username,log_id');
if ($err) {
    http_response_code(500);
    echo json_encode(['ok'=>false,'message'=>'Supabase error','detail'=>$err]);
    exit;
}
if ($status !== 200 || !is_array($data) || count($data)===0) {
    http_response_code(404);
    echo json_encode(['ok'=>false,'message'=>'User not found']);
    exit;
}
$account = $data[0];
echo json_encode(['ok'=>true,'username'=>$account['username'],'log_id'=>$account['log_id'],'face'=>$account['face']]);
?>
