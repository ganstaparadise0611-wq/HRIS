<?php
require_once __DIR__ . '/backend-php/public/connect.php';
[$s, $r, $e] = supabase_request('GET', 'rest/v1/attendance?order=att_id.desc&limit=5');
file_put_contents('db_dump.json', json_encode($r, JSON_PRETTY_PRINT));
?>
