<?php
// Overtime requests API endpoint
// Handles CREATE, GET, UPDATE, and DELETE operations for overtime requests

// CORS headers
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, Accept');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

header('Content-Type: application/json');

require_once __DIR__ . '/connect.php';

// GET endpoint - Get overtime history for an employee
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $emp_id = $_GET['emp_id'] ?? null;
    // Debug log for incoming GET request
    error_log("[overtime_requests.php] GET request received. emp_id=" . print_r($emp_id, true));
    
    if (empty($emp_id)) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'message' => 'Missing emp_id parameter']);
        exit;
    }
    
    // NOTE: Supabase table name is "ovts", so we query that here
    // The table has a 'timestamp' column, not 'created_at'
    [$status, $result, $err] = supabase_request(
        'GET',
        "rest/v1/ovts?emp_id=eq.{$emp_id}&select=*&order=timestamp.desc"
    );
    error_log("[overtime_requests.php] Supabase response: status=$status, err=" . print_r($err, true));
    
    if ($err) {
        http_response_code(500);
        echo json_encode(['ok' => false, 'message' => 'Supabase request failed', 'detail' => $err]);
        exit;
    }
    
    if ($status < 200 || $status >= 300) {
        http_response_code($status);
        echo json_encode(['ok' => false, 'message' => 'Failed to load overtime history', 'status' => $status]);
        exit;
    }
    
    // Transform the data to reconstruct time range for React Native app
    if (is_array($result)) {
        foreach ($result as &$item) {
            // Map t_id to ovt_id for backward compatibility with React Native app
            if (isset($item['t_id']) && !isset($item['ovt_id'])) {
                $item['ovt_id'] = $item['t_id'];
            }
            
            // Extract end_time from reason if it was stored there
            $reason = $item['reason'] ?? '';
            $end_time = null;
            
            // Check if reason contains " | End: HH:MM" pattern
            if (preg_match('/\s+\|\s+End:\s+(\d{2}:\d{2})/', $reason, $matches)) {
                $end_time = $matches[1];
                // Remove the end_time from reason to restore original
                $item['reason'] = preg_replace('/\s+\|\s+End:\s+\d{2}:\d{2}/', '', $reason);
            }
            
            // Reconstruct time range format expected by React Native
            $time_value = $item['time'] ?? '';
            if ($time_value && $end_time) {
                // Format time as "HH:MM-HH:MM" for React Native
                $start_time_formatted = substr($time_value, 0, 5); // Get HH:MM from TIME
                $item['time'] = $start_time_formatted . '-' . $end_time;
            } elseif ($time_value) {
                // If no end_time found, just use start_time
                $item['time'] = substr($time_value, 0, 5);
            }
        }
        unset($item); // Break reference
    }
    
    echo json_encode([
        'ok' => true,
        'data' => is_array($result) ? $result : [],
    ]);
    exit;
}

// POST endpoint - Handle CREATE, UPDATE, DELETE
$raw = file_get_contents('php://input') ?: '';
$body = json_decode($raw, true);

if (!is_array($body)) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'message' => 'Invalid JSON body']);
    exit;
}

$action = $body['action'] ?? '';

// CREATE endpoint
if ($action === 'create') {
    $emp_id = $body['emp_id'] ?? null;
    $date = $body['date'] ?? null;
    $start_time = $body['start_time'] ?? null;
    $end_time = $body['end_time'] ?? null;
    $reason = $body['reason'] ?? null;
    
    if (empty($emp_id) || empty($date) || empty($start_time) || empty($end_time) || empty($reason)) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'message' => 'Missing required fields: emp_id, date, start_time, end_time, reason']);
        exit;
    }
    
    // Calculate total hours
    $start = new DateTime($date . ' ' . $start_time);
    $end = new DateTime($date . ' ' . $end_time);
    
    // Handle case where end time is next day
    if ($end < $start) {
        $end->modify('+1 day');
    }
    
    $diff = $start->diff($end);
    $total_hours = $diff->h + ($diff->i / 60) + ($diff->s / 3600);
    
    // The 'time' column in ovts table is TIME type, so we can only store a single time value
    // We'll store start_time in the TIME column and append end_time to reason in a parseable format
    // The GET endpoint will reconstruct the time range when returning data
    
    // Convert "17:00" to "17:00:00" for PostgreSQL TIME type
    $start_time_formatted = $start_time . (strlen($start_time) === 5 ? ':00' : '');
    
    $insertData = [
        'emp_id' => $emp_id,
        'date' => $date,
        'time' => $start_time_formatted, // Store start time in TIME column (PostgreSQL TIME type)
        'reason' => $reason . ' | End: ' . $end_time, // Store end_time in reason (will be extracted in GET)
        'status' => 'Pending',
    ];
    
    // Insert into Supabase "ovts" table using service role key to bypass RLS
    [$status, $result, $err] = supabase_request(
        'POST',
        'rest/v1/ovts',
        [$insertData],
        ['Prefer: return=representation'],
        true // Use service role key to bypass RLS
    );
    
    if ($err) {
        http_response_code(500);
        echo json_encode(['ok' => false, 'message' => 'Supabase request failed', 'detail' => $err]);
        exit;
    }
    
    if ($status < 200 || $status >= 300) {
        http_response_code($status);
        echo json_encode(['ok' => false, 'message' => 'Failed to create overtime request', 'status' => $status, 'body' => $result]);
        exit;
    }
    
    echo json_encode([
        'ok' => true,
        'message' => 'Overtime request created successfully',
        'data' => $result,
    ]);
    exit;
}

// UPDATE and DELETE require t_id (primary key column name in ovts table)
$t_id = $body['t_id'] ?? $body['ovt_id'] ?? null; // Support both for backward compatibility

if (empty($t_id) && ($action === 'update' || $action === 'delete')) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'message' => 'Missing t_id']);
    exit;
}

// UPDATE endpoint
if ($action === 'update') {
    $date = $body['date'] ?? null;
    $start_time = $body['start_time'] ?? null;
    $end_time = $body['end_time'] ?? null;
    $reason = $body['reason'] ?? null;

    if (!$date || !$start_time || !$end_time || !$reason) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'message' => 'Missing required fields: date, start_time, end_time, reason']);
        exit;
    }

    // Convert "17:00" to "17:00:00" for PostgreSQL TIME type
    $start_time_formatted = $start_time . (strlen($start_time) === 5 ? ':00' : '');
    
    $updateData = [
        'date' => $date,
        'time' => $start_time_formatted, // Store start time in TIME column (PostgreSQL TIME type)
        'reason' => $reason . ' | End: ' . $end_time, // Store end_time in reason (will be extracted in GET)
    ];

    // Update row in "ovts" table using service role key to bypass RLS
    [$status, $result, $err] = supabase_request(
        'PATCH',
        "rest/v1/ovts?t_id=eq.{$t_id}",
        $updateData,
        ['Prefer: return=representation'],
        true // Use service role key to bypass RLS
    );

    if ($err) {
        http_response_code(500);
        echo json_encode(['ok' => false, 'message' => 'Supabase request failed', 'detail' => $err]);
        exit;
    }

    if ($status < 200 || $status >= 300) {
        http_response_code($status);
        echo json_encode(['ok' => false, 'message' => 'Failed to update overtime request', 'status' => $status, 'body' => $result]);
        exit;
    }

    echo json_encode([
        'ok' => true,
        'message' => 'Overtime request updated successfully',
        'data' => $result,
    ]);
    exit;
}

// DELETE endpoint
if ($action === 'delete') {
    // Delete row from "ovts" table using service role key to bypass RLS
    [$status, $result, $err] = supabase_request(
        'DELETE',
        "rest/v1/ovts?t_id=eq.{$t_id}",
        null,
        [],
        true // Use service role key to bypass RLS
    );

    if ($err) {
        http_response_code(500);
        echo json_encode(['ok' => false, 'message' => 'Supabase request failed', 'detail' => $err]);
        exit;
    }

    if ($status < 200 || $status >= 300) {
        http_response_code($status);
        echo json_encode(['ok' => false, 'message' => 'Failed to delete overtime request', 'status' => $status]);
        exit;
    }

    echo json_encode([
        'ok' => true,
        'message' => 'Overtime request deleted successfully',
    ]);
    exit;
}

// Invalid action
http_response_code(400);
echo json_encode(['ok' => false, 'message' => 'Invalid action. Use "create", "update", or "delete"']);
exit;
