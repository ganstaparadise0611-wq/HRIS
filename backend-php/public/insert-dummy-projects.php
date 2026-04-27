<?php
require_once __DIR__ . '/connect.php';

// First check if any projects exist
[$pStatus, $projects, $pErr] = supabase_request('GET', 'rest/v1/projects?select=id,name');

if (empty($projects)) {
    // Insert some default ones
    $defaults = [
        ['name' => 'Internal Development', 'status' => 'active'],
        ['name' => 'Client Website TDT', 'status' => 'active'],
        ['name' => 'Mobile App UI/UX', 'status' => 'active'],
        ['name' => 'Server Maintenance', 'status' => 'active'],
        ['name' => 'Documentation Phase', 'status' => 'active']
    ];
    
    foreach ($defaults as $proj) {
        supabase_request('POST', 'rest/v1/projects', $proj);
    }
    echo "Inserted dummy projects!\n";
} else {
    echo "Projects already exist. Found " . count($projects) . " projects.\n";
}
?>
