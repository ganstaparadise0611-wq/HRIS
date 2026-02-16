<?php
/**
 * DeepFace API Integration (via Google Colab)
 * 
 * This integrates with DeepFace running on Google Colab
 * DeepFace uses state-of-the-art deep learning models for face recognition
 * 
 * Free Tier: UNLIMITED (runs on Google Colab)
 * Accuracy: 97-99% (depends on model)
 * 
 * Setup:
 * 1. Open the provided Google Colab notebook
 * 2. Run all cells to start the DeepFace API server
 * 3. Copy the ngrok URL from the output
 * 4. Set it below in DEEPFACE_API_URL
 */

// DeepFace API Configuration (running on Google Colab)
const DEEPFACE_API_URL = 'YOUR_COLAB_NGROK_URL_HERE'; // e.g., https://abc-123-xyz.ngrok-free.app

// Global variable to store last DeepFace API error
$GLOBALS['deepface_last_error'] = null;

/**
 * Check if DeepFace API is configured
 */
function deepface_api_configured(): bool
{
    return !empty(DEEPFACE_API_URL) && 
           DEEPFACE_API_URL !== 'YOUR_COLAB_NGROK_URL_HERE' &&
           filter_var(DEEPFACE_API_URL, FILTER_VALIDATE_URL) !== false;
}

/**
 * Compare two faces using DeepFace API (running on Google Colab)
 * 
 * @param string $image1Base64 Base64 encoded image 1 (enrolled face)
 * @param string $image2Base64 Base64 encoded image 2 (current face)
 * @return array|null Array with verified boolean and confidence, or null on error
 */
function deepface_compare_faces(string $image1Base64, string $image2Base64): ?array
{
    if (!deepface_api_configured()) {
        $GLOBALS['deepface_last_error'] = 'DeepFace API not configured - set DEEPFACE_API_URL';
        error_log("DeepFace API not configured");
        return null;
    }
    
    // DeepFace API endpoint
    $url = rtrim(DEEPFACE_API_URL, '/') . '/verify';
    
    // Validate base64
    $imageData1 = base64_decode($image1Base64, true);
    $imageData2 = base64_decode($image2Base64, true);
    
    if ($imageData1 === false || $imageData2 === false) {
        $GLOBALS['deepface_last_error'] = 'Invalid base64 image data';
        error_log("Invalid base64 image data for DeepFace API");
        return null;
    }
    
    // Prepare JSON payload
    $payload = json_encode([
        'image1' => $image1Base64,
        'image2' => $image2Base64,
    ]);
    
    if ($payload === false) {
        $GLOBALS['deepface_last_error'] = 'Failed to encode JSON payload';
        error_log("Failed to encode JSON for DeepFace API");
        return null;
    }
    
    // Initialize cURL
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => $payload,
        CURLOPT_HTTPHEADER => [
            'Content-Type: application/json',
            'Content-Length: ' . strlen($payload),
        ],
        CURLOPT_TIMEOUT => 15, // DeepFace can take a bit longer (processing on CPU/GPU)
        CURLOPT_CONNECTTIMEOUT => 5,
    ]);
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $error = curl_error($ch);
    
    if ($error) {
        $GLOBALS['deepface_last_error'] = 'CURL Error: ' . $error . ' (Is Google Colab running?)';
        error_log("DeepFace API curl error: " . $error);
        return null;
    }
    
    if ($httpCode !== 200) {
        // Try to parse error message
        $errorDetails = json_decode($response, true);
        $errorMessage = $errorDetails['error'] ?? $response;
        
        $GLOBALS['deepface_last_error'] = "HTTP $httpCode: " . substr($errorMessage, 0, 200);
        error_log("DeepFace API HTTP error: $httpCode - " . substr($errorMessage, 0, 200));
        return null;
    }
    
    $result = json_decode($response, true);
    if (!is_array($result)) {
        $GLOBALS['deepface_last_error'] = 'Invalid response format: ' . substr($response, 0, 200);
        error_log("DeepFace API invalid response: " . substr($response, 0, 200));
        return null;
    }
    
    // Check for API errors
    if (isset($result['error'])) {
        $GLOBALS['deepface_last_error'] = $result['error'];
        error_log("DeepFace API error: " . $result['error']);
        return null;
    }
    
    // DeepFace returns:
    // - verified: boolean (true if faces match)
    // - distance: float (lower is better match)
    // - threshold: float (threshold for this model)
    // - similarity: float (0-1, higher is better)
    $verified = $result['verified'] ?? false;
    $distance = $result['distance'] ?? 1.0;
    $threshold = $result['threshold'] ?? 0.4;
    $similarity = $result['similarity'] ?? 0.0;
    
    // Calculate confidence (inverse of distance, normalized)
    $confidence = $similarity; // Already 0-1 scale
    
    error_log(sprintf(
        "DeepFace API result - Verified: %s, Distance: %.4f, Threshold: %.4f, Similarity: %.4f",
        $verified ? 'YES' : 'NO',
        $distance,
        $threshold,
        $similarity
    ));
    
    return [
        'verified' => $verified,
        'confidence' => $confidence,
        'distance' => $distance,
        'threshold' => $threshold,
        'similarity' => $similarity,
        'similar' => $verified, // Alias for consistency with other APIs
        'api' => 'deepface',
    ];
}

/**
 * Check if DeepFace API is online and responding
 */
function deepface_health_check(): bool
{
    if (!deepface_api_configured()) {
        return false;
    }
    
    $url = rtrim(DEEPFACE_API_URL, '/') . '/health';
    
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 3,
        CURLOPT_CONNECTTIMEOUT => 2,
    ]);
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    
    if ($httpCode === 200) {
        $result = json_decode($response, true);
        return isset($result['status']) && $result['status'] === 'ok';
    }
    
    return false;
}

/**
 * Get the last DeepFace API error
 */
function deepface_get_last_error(): ?string
{
    return $GLOBALS['deepface_last_error'] ?? null;
}
