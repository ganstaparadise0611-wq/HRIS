<?php
header('Content-Type: application/json');
require_once __DIR__ . '/connect.php';
if (!file_exists(__DIR__ . '/facepp_api.php')) {
    echo json_encode(['ok'=>false,'message'=>'facepp_api.php missing']);
    exit;
}
require_once __DIR__ . '/facepp_api.php';

[$status,$data,$err] = supabase_request('GET','rest/v1/accounts?log_id=eq.23&select=face,username,log_id');
if ($err || $status !== 200 || !is_array($data) || count($data)===0) {
    echo json_encode(['ok'=>false,'message'=>'Could not load account','status'=>$status,'err'=>$err]);
    exit;
}
$face = $data[0]['face'] ?? null;
if (!$face) { echo json_encode(['ok'=>false,'message'=>'No face stored']); exit; }

$result = facepp_compare_faces($face, $face);
if ($result === null) {
    $err = facepp_get_last_error();
    echo json_encode(['ok'=>false,'message'=>'Compare failed','detail'=>$err]);
    exit;
}

echo json_encode(['ok'=>true,'result'=>$result]);
?>
