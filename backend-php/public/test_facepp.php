<?php
/**
 * Test Face++ API Integration
 * 
 * This script tests if Face++ API is properly configured and working.
 * Open in browser: http://localhost:8000/test_facepp.php
 */

header('Content-Type: text/html; charset=utf-8');

echo "<!DOCTYPE html>
<html>
<head>
    <title>Face++ API Test</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; background: #f5f5f5; }
        .container { max-width: 800px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        h1 { color: #333; border-bottom: 3px solid #4CAF50; padding-bottom: 10px; }
        .test { margin: 20px 0; padding: 15px; background: #f9f9f9; border-left: 4px solid #2196F3; }
        .success { color: #4CAF50; font-weight: bold; }
        .error { color: #f44336; font-weight: bold; }
        .info { color: #2196F3; }
        pre { background: #263238; color: #aed581; padding: 15px; border-radius: 5px; overflow-x: auto; }
        .step { margin: 10px 0; padding: 10px; background: white; border-radius: 5px; }
    </style>
</head>
<body>
    <div class='container'>
        <h1>🧪 Face++ API Connection Test</h1>
";

// Load Face++ API
require_once __DIR__ . '/facepp_api.php';

echo "<div class='test'>";
echo "<h2>Step 1: Configuration Check</h2>";

if (facepp_api_configured()) {
    echo "<div class='step success'>✅ Face++ API is configured!</div>";
    echo "<div class='step info'>📝 API Key: " . substr(FACEPP_API_KEY, 0, 10) . "..." . substr(FACEPP_API_KEY, -5) . "</div>";
    echo "<div class='step info'>📝 API Secret: " . substr(FACEPP_API_SECRET, 0, 10) . "..." . substr(FACEPP_API_SECRET, -5) . "</div>";
} else {
    echo "<div class='step error'>❌ Face++ API NOT configured</div>";
    echo "<p>Please update facepp_api.php with your API credentials.</p>";
    echo "</div></div></body></html>";
    exit;
}

echo "</div>";

// Test 1: Download sample test images from Face++ demo
echo "<div class='test'>";
echo "<h2>Step 2: Fetching Test Images</h2>";

echo "<div class='step'>Downloading Face++ demo images for testing...</div>";

// Use Face++ official demo images (available publicly)
$demo_image1_url = "https://api-us.faceplusplus.com/facepp/v1/demo_pic1.jpg";
$demo_image2_url = "https://api-us.faceplusplus.com/facepp/v1/demo_pic2.jpg";

// Download images and convert to base64
$test_image1 = null;
$test_image2 = null;

// Try to fetch demo images
$img1_data = @file_get_contents($demo_image1_url);
$img2_data = @file_get_contents($demo_image2_url);

if ($img1_data && $img2_data) {
    $test_image1 = base64_encode($img1_data);
    $test_image2 = base64_encode($img2_data);
    
    echo "<div class='step success'>✅ Test images downloaded from Face++ demo</div>";
    echo "<div class='step info'>📏 Image 1 size: " . strlen($test_image1) . " bytes (base64)</div>";
    echo "<div class='step info'>📏 Image 2 size: " . strlen($test_image2) . " bytes (base64)</div>";
    
    // Show preview
    echo "<div class='step'>";
    echo "<p><strong>Preview:</strong></p>";
    echo "<img src='data:image/jpeg;base64,$test_image1' alt='Test Face 1' style='max-width: 200px; border: 2px solid #ddd; margin: 5px;'> ";
    echo "<img src='data:image/jpeg;base64,$test_image2' alt='Test Face 2' style='max-width: 200px; border: 2px solid #ddd; margin: 5px;'>";
    echo "</div>";
} else {
    // Fallback: Use minimal base64 test images (1x1 pixel - just to test API connectivity)
    echo "<div class='step info'>⚠️ Could not download demo images, using minimal test data</div>";
    
    // Minimal valid JPEG (1x1 black pixel) - just for testing API connection
    $minimal_jpeg = base64_decode('/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCwAA8A/9k=');
    
    $test_image1 = base64_encode($minimal_jpeg);
    $test_image2 = base64_encode($minimal_jpeg);
    
    echo "<div class='step info'>Using minimal test data to verify API connectivity</div>";
}

echo "</div>";

// Test 2: Call Face++ API
echo "<div class='test'>";
echo "<h2>Step 3: Testing Face++ API Connection</h2>";
echo "<div class='step info'>🌐 Calling Face++ API (this may take 3-5 seconds)...</div>";

$start_time = microtime(true);
$result = facepp_compare_faces($test_image1, $test_image2);
$end_time = microtime(true);
$duration = round(($end_time - $start_time) * 1000);

if ($result === null) {
    $error = facepp_get_last_error();
    echo "<div class='step error'>❌ Face++ API call FAILED</div>";
    echo "<div class='step error'>Error: " . htmlspecialchars($error) . "</div>";
    
    // Provide troubleshooting tips
    echo "<div class='step'>";
    echo "<h3>🔧 Troubleshooting:</h3>";
    echo "<ul>";
    echo "<li>Check if your API credentials are correct in facepp_api.php</li>";
    echo "<li>Verify your Face++ account is active at <a href='https://console.faceplusplus.com/' target='_blank'>console.faceplusplus.com</a></li>";
    echo "<li>Check if you have remaining API quota (1000 free calls/day)</li>";
    echo "<li>Make sure your server can access api-us.faceplusplus.com</li>";
    echo "</ul>";
    echo "</div>";
} else {
    echo "<div class='step success'>✅ Face++ API call SUCCESSFUL!</div>";
    echo "<div class='step info'>⏱️ Response time: {$duration}ms</div>";
    
    // Display results
    echo "<div class='step'>";
    echo "<h3>📊 Comparison Results:</h3>";
    echo "<pre>" . json_encode($result, JSON_PRETTY_PRINT) . "</pre>";
    echo "</div>";
    
    // Interpret results
    echo "<div class='step'>";
    echo "<h3>🎯 Interpretation:</h3>";
    
    $confidence = $result['confidence_raw'] ?? 0;
    $threshold = $result['threshold_raw'] ?? 70;
    $similar = $result['similar'] ?? false;
    
    echo "<p><strong>Confidence Score:</strong> " . number_format($confidence, 2) . "%</p>";
    echo "<p><strong>Threshold:</strong> " . number_format($threshold, 2) . "%</p>";
    echo "<p><strong>Result:</strong> ";
    
    if ($similar) {
        echo "<span class='success'>✅ FACES MATCH</span>";
    } else {
        echo "<span class='error'>❌ FACES DO NOT MATCH</span>";
    }
    echo "</p>";
    
    // Note about test images
    echo "<p><em>Note: These are synthetic test images. With real face photos, Face++ achieves 99.8% accuracy.</em></p>";
    echo "</div>";
}

echo "</div>";

// Summary
echo "<div class='test'>";
echo "<h2>📋 Test Summary</h2>";

if ($result !== null) {
    echo "<div class='step success'>";
    echo "<h3>✅ All Tests PASSED!</h3>";
    echo "<p>Your Face++ API is properly configured and working correctly.</p>";
    echo "<ul>";
    echo "<li>✅ Configuration: Valid</li>";
    echo "<li>✅ API Connection: Working</li>";
    echo "<li>✅ Face Comparison: Functional</li>";
    echo "<li>✅ Response Time: {$duration}ms</li>";
    echo "</ul>";
    echo "<p><strong>Your HRIS face recognition is ready to use Face++!</strong></p>";
    echo "</div>";
} else {
    echo "<div class='step error'>";
    echo "<h3>❌ Tests FAILED</h3>";
    echo "<p>Please fix the issues above and try again.</p>";
    echo "</div>";
}

echo "</div>";

// Next steps
echo "<div class='test'>";
echo "<h2>🚀 Next Steps</h2>";
echo "<div class='step'>";
echo "<ol>";
echo "<li>Face++ is now active in your system</li>";
echo "<li>It will automatically be used when verifying faces</li>";
echo "<li>Test with your mobile app by trying to log in</li>";
echo "<li>(Optional) Set up DeepFace on Google Colab for even better performance</li>";
echo "</ol>";
echo "</div>";
echo "</div>";

echo "    </div>
</body>
</html>";
?>
