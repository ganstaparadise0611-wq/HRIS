<?php
// Simple test endpoint to verify server is running
header('Access-Control-Allow-Origin: *');
header('Content-Type: application/json');
echo json_encode(['ok' => true, 'message' => 'Server is running!', 'time' => date('Y-m-d H:i:s')]);
