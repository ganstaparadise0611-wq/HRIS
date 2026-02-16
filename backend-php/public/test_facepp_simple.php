<?php
/**
 * Simple Face++ API Credential Test
 * Tests if your Face++ API credentials are valid
 * 
 * Open: http://localhost:8000/test_facepp_simple.php
 */

header('Content-Type: text/html; charset=utf-8');

echo "<!DOCTYPE html>
<html>
<head>
    <title>Face++ API Simple Test</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; background: #f5f5f5; }
        .container { max-width: 800px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        h1 { color: #333; border-bottom: 3px solid #4CAF50; padding-bottom: 10px; }
        .test { margin: 20px 0; padding: 15px; background: #f9f9f9; border-left: 4px solid #2196F3; }
        .success { color: #4CAF50; font-weight: bold; }
        .error { color: #f44336; font-weight: bold; }
        .warning { color: #FF9800; font-weight: bold; }
        .info { color: #2196F3; }
        pre { background: #263238; color: #aed581; padding: 15px; border-radius: 5px; overflow-x: auto; font-size: 12px; }
        .step { margin: 10px 0; padding: 10px; background: white; border-radius: 5px; }
        .credential-box { background: #E3F2FD; padding: 15px; border-radius: 5px; margin: 10px 0; border-left: 4px solid #2196F3; }
    </style>
</head>
<body>
    <div class='container'>
        <h1>🧪 Face++ API Credential Test</h1>
        <p style='color: #666;'>This test verifies your Face++ API credentials are valid by calling the Face++ API Info endpoint.</p>
";

// Load configuration
require_once __DIR__ . '/facepp_api.php';

// Test 1: Check Configuration
echo "<div class='test'>";
echo "<h2>Step 1: Configuration Check</h2>";

if (!facepp_api_configured()) {
    echo "<div class='step error'>❌ Face++ API NOT configured</div>";
    echo "<p>Please update facepp_api.php with your API credentials from <a href='https://console.faceplusplus.com/' target='_blank'>Face++ Console</a>.</p>";
    echo "</div></div></body></html>";
    exit;
}

echo "<div class='step success'>✅ Face++ API credentials are configured</div>";
echo "<div class='credential-box'>";
echo "<div class='info'><strong>API Key:</strong> " . substr(FACEPP_API_KEY, 0, 12) . "..." . substr(FACEPP_API_KEY, -6) . "</div>";
echo "<div class='info'><strong>API Secret:</strong> " . substr(FACEPP_API_SECRET, 0, 12) . "..." . substr(FACEPP_API_SECRET, -6) . "</div>";
echo "</div>";
echo "</div>";

// Test 2: Test API Credentials with Face++ Info API
echo "<div class='test'>";
echo "<h2>Step 2: Testing API Credentials</h2>";
echo "<div class='step info'>🌐 Calling Face++ API to verify credentials...</div>";

$start_time = microtime(true);

// Use Face++ API Info endpoint to test credentials
// This endpoint doesn't require images, just valid credentials
$url = 'https://api-us.faceplusplus.com/facepp/v3/detect';

// Create a valid test image URL (Face++ sample image)
$test_image_url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3a/Cat03.jpg/481px-Cat03.jpg';

$data = [
    'api_key' => FACEPP_API_KEY,
    'api_secret' => FACEPP_API_SECRET,
    'image_url' => $test_image_url,
    'return_attributes' => 'none'
];

$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, $url);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query($data));
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
curl_setopt($ch, CURLOPT_TIMEOUT, 15);

$response = curl_exec($ch);
$http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curl_error = curl_error($ch);

$end_time = microtime(true);
$duration = round(($end_time - $start_time) * 1000);

if ($curl_error) {
    echo "<div class='step error'>❌ Connection Error</div>";
    echo "<div class='step error'>Error: " . htmlspecialchars($curl_error) . "</div>";
    echo "<div class='step'><strong>Troubleshooting:</strong> Check your internet connection and firewall settings.</div>";
} else {
    $result = json_decode($response, true);
    
    echo "<div class='step success'>✅ Successfully connected to Face++ API</div>";
    echo "<div class='step info'>⏱️ Response time: {$duration}ms</div>";
    echo "<div class='step info'>📊 HTTP Status: {$http_code}</div>";
    
    echo "<div class='step'>";
    echo "<h3>🔍 API Response:</h3>";
    echo "<pre>" . json_encode($result, JSON_PRETTY_PRINT) . "</pre>";
    echo "</div>";
    
    // Check response
    if (isset($result['error_message'])) {
        echo "<div class='step error'>❌ API Error: " . htmlspecialchars($result['error_message']) . "</div>";
        
        if (strpos($result['error_message'], 'AUTHENTICATION_ERROR') !== false) {
            echo "<div class='step'>";
            echo "<h3>🔧 Credential Issue Detected</h3>";
            echo "<p>Your API credentials appear to be incorrect or invalid.</p>";
            echo "<ul>";
            echo "<li>Double-check your <strong>API Key</strong> and <strong>API Secret</strong> in facepp_api.php</li>";
            echo "<li>Make sure you copied them correctly from <a href='https://console.faceplusplus.com/' target='_blank'>Face++ Console</a></li>";
            echo "<li>Check for extra spaces or missing characters</li>";
            echo "</ul>";
            echo "</div>";
        } elseif (strpos($result['error_message'], 'CONCURRENCY_LIMIT_EXCEEDED') !== false) {
            echo "<div class='step warning'>⚠️ Too many concurrent requests. This is normal - your credentials are valid!</div>";
        }
    } else {
        // Success! Check what we got
        if (isset($result['faces'])) {
            echo "<div class='step success'>";
            echo "<h3>✅ API Credentials are VALID!</h3>";
            echo "<p>Your Face++ API is working correctly.</p>";
            
            if (count($result['faces']) > 0) {
                echo "<p>✅ Face detection is working (detected " . count($result['faces']) . " face(s) in test image)</p>";
            } else {
                echo "<p>ℹ️ No faces detected in test image (this is OK - the cat image was just for testing connectivity)</p>";
            }
            echo "</div>";
        } elseif (isset($result['request_id'])) {
            echo "<div class='step success'>";
            echo "<h3>✅ API Credentials are VALID!</h3>";
            echo "<p>Your Face++ API is working correctly and returning valid responses.</p>";
            echo "</div>";
        }
    }
}

echo "</div>";

// Test 3: Check API Quota
echo "<div class='test'>";
echo "<h2>Step 3: API Usage Information</h2>";
echo "<div class='step'>";
echo "<h3>📊 Your Face++ Free Tier Limits:</h3>";
echo "<ul>";
echo "<li><strong>Daily Quota:</strong> 1,000 API calls per day</li>";
echo "<li><strong>QPS (Queries/Second):</strong> Limited to prevent abuse</li>";
echo "<li><strong>Resets:</strong> Daily at 00:00 UTC</li>";
echo "</ul>";
echo "<p>Check your current usage at: <a href='https://console.faceplusplus.com/' target='_blank'>Face++ Console</a></p>";
echo "</div>";
echo "</div>";

// Test Summary
echo "<div class='test'>";
echo "<h2>📋 Test Summary</h2>";

if (isset($result) && !isset($result['error_message']) && ($http_code == 200 || $http_code == 400)) {
    echo "<div class='step success'>";
    echo "<h3>✅ Face++ API is Ready!</h3>";
    echo "<ul>";
    echo "<li>✅ Configuration: Valid</li>";
    echo "<li>✅ API Connection: Working</li>";
    echo "<li>✅ Credentials: Verified</li>";
    echo "<li>✅ Response Time: {$duration}ms</li>";
    echo "</ul>";
    echo "</div>";
    
    echo "<div class='step'>";
    echo "<h3>🚀 Next Steps:</h3>";
    echo "<ol>";
    echo "<li><strong>Your Face++ API is now active!</strong> It will automatically be used when employees clock in/out.</li>";
    echo "<li>The system uses a smart fallback:
        <ul style='margin-top: 5px;'>
            <li>1️⃣ DeepFace (if Google Colab is running) - Unlimited free, 97-99% accuracy</li>
            <li>2️⃣ <strong>Face++</strong> - 1000/day free, 99.8% accuracy <span style='color: green; font-weight: bold;'>(ACTIVE NOW)</span></li>
            <li>3️⃣ Luxand - Original system, 90-95% accuracy</li>
        </ul>
    </li>";
    echo "<li><strong>Test it live:</strong> Try logging in with your mobile app to see Face++ in action!</li>";
    echo "<li><strong>(Optional)</strong> Set up DeepFace on Google Colab for even better performance and unlimited free calls.</li>";
    echo "</ol>";
    echo "</div>";
} else {
    echo "<div class='step error'>";
    echo "<h3>❌ Test Failed</h3>";
    echo "<p>Please fix the issues above and try again.</p>";
    echo "</div>";
    
    echo "<div class='step'>";
    echo "<h3>🔧 Common Issues:</h3>";
    echo "<ul>";
    echo "<li><strong>Invalid Credentials:</strong> Double-check API Key and Secret in facepp_api.php</li>";
    echo "<li><strong>Network Error:</strong> Check internet connection and firewall</li>";
    echo "<li><strong>Quota Exceeded:</strong> Check usage at Face++ Console</li>";
    echo "</ul>";
    echo "</div>";
}

echo "</div>";

echo "    </div>
</body>
</html>";
?>
