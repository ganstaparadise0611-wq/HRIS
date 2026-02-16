<?php
/**
 * Face++ Debugging Tool
 * Shows exact credentials and raw API response
 */

header('Content-Type: text/html; charset=utf-8');

require_once __DIR__ . '/facepp_api.php';

echo "<!DOCTYPE html>
<html>
<head>
    <title>Face++ Debug</title>
    <style>
        body { font-family: monospace; padding: 20px; background: #1e1e1e; color: #d4d4d4; }
        .box { background: #252526; padding: 20px; margin: 20px 0; border-radius: 5px; border: 1px solid #3c3c3c; }
        .label { color: #4ec9b0; font-weight: bold; }
        .value { color: #ce9178; word-break: break-all; }
        .success { color: #4caf50; }
        .error { color: #f44336; }
        h2 { color: #569cd6; }
        pre { background: #1e1e1e; padding: 10px; overflow-x: auto; border: 1px solid #3c3c3c; }
    </style>
</head>
<body>
    <h1>🔍 Face++ API Debug</h1>
";

echo "<div class='box'>";
echo "<h2>📋 Current Configuration</h2>";
echo "<div><span class='label'>API Key:</span> <span class='value'>" . FACEPP_API_KEY . "</span></div>";
echo "<div><span class='label'>API Key Length:</span> <span class='value'>" . strlen(FACEPP_API_KEY) . " characters</span></div>";
echo "<div><span class='label'>API Secret:</span> <span class='value'>" . FACEPP_API_SECRET . "</span></div>";
echo "<div><span class='label'>API Secret Length:</span> <span class='value'>" . strlen(FACEPP_API_SECRET) . " characters</span></div>";
echo "<div><span class='label'>Base URL:</span> <span class='value'>" . FACEPP_API_BASE_URL . "</span></div>";
echo "</div>";

echo "<div class='box'>";
echo "<h2>🔬 Raw API Test</h2>";
echo "<p>Making direct API call to Face++ compare endpoint with test images...</p>";

// Create a simple test face image (1x1 black pixel JPEG for connectivity test)
$test_image_base64 = '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCwAA8A/9k=';

// Use Face++ compare API (simpler than detect for testing)
$url = 'https://api-us.faceplusplus.com/facepp/v3/compare';
$post_data = [
    'api_key' => FACEPP_API_KEY,
    'api_secret' => FACEPP_API_SECRET,
    'image_base64_1' => $test_image_base64,
    'image_base64_2' => $test_image_base64
];

echo "<div><span class='label'>Request URL:</span> <span class='value'>$url</span></div>";
echo "<div><span class='label'>Testing with base64 images (same format your app uses)</span></div>";

$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, $url);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query($post_data));
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
curl_setopt($ch, CURLOPT_TIMEOUT, 15);
curl_setopt($ch, CURLOPT_VERBOSE, true);

$verbose = fopen('php://temp', 'w+');
curl_setopt($ch, CURLOPT_STDERR, $verbose);

$start_time = microtime(true);
$response = curl_exec($ch);
$end_time = microtime(true);

$http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curl_error = curl_error($ch);
$curl_info = curl_getinfo($ch);

echo "<div><span class='label'>Duration:</span> <span class='value'>" . round(($end_time - $start_time) * 1000) . "ms</span></div>";
echo "<div><span class='label'>HTTP Code:</span> <span class='value'>$http_code</span></div>";

if ($curl_error) {
    echo "<div class='error'>CURL Error: $curl_error</div>";
}

echo "<div><span class='label'>Raw Response:</span></div>";
echo "<pre>" . htmlspecialchars($response) . "</pre>";

$result = json_decode($response, true);
if ($result) {
    echo "<div><span class='label'>Parsed JSON:</span></div>";
    echo "<pre>" . json_encode($result, JSON_PRETTY_PRINT) . "</pre>";
    
    if (isset($result['error_message'])) {
        echo "<div class='error'>❌ Error: " . htmlspecialchars($result['error_message']) . "</div>";
        
        if (strpos($result['error_message'], 'AUTHENTICATION_ERROR') !== false || 
            strpos($result['error_message'], 'INVALID_API_KEY') !== false) {
            echo "<div class='box'>";
            echo "<h2>🔧 Troubleshooting Steps</h2>";
            echo "<ol>";
            echo "<li>Go to <a href='https://console.faceplusplus.com/' target='_blank' style='color: #4ec9b0;'>Face++ Console</a></li>";
            echo "<li>Look for your API Key and API Secret in the dashboard</li>";
            echo "<li>Copy them EXACTLY (no spaces before/after)</li>";
            echo "<li>Update facepp_api.php with the correct values</li>";
            echo "<li>Make sure you're using the <strong>US Console</strong> (not China console)</li>";
            echo "</ol>";
            echo "<p>Expected formats:</p>";
            echo "<ul>";
            echo "<li>API Key: 32 characters (letters and numbers)</li>";
            echo "<li>API Secret: 32 characters (letters, numbers, dashes, underscores)</li>";
            echo "</ul>";
            echo "</div>";
        }
    } else {
        echo "<div class='success'>✅ API call successful!</div>";
        if (isset($result['faces'])) {
            echo "<div>Detected " . count($result['faces']) . " face(s)</div>";
        }
    }
}

echo "</div>";

echo "<div class='box'>";
echo "<h2>📊 CURL Info</h2>";
echo "<pre>" . print_r($curl_info, true) . "</pre>";
echo "</div>";

echo "</body></html>";
?>
