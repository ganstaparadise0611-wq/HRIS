<?php
require_once __DIR__ . '/connect.php';
[$s, $data, $err] = supabase_request('GET', "rest/v1/departments?select=*");
print_r($data);
