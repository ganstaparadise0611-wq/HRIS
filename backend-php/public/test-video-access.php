<?php
/**
 * Test Video Access and Performance
 * This checks if videos are accessible and provides optimization tips
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

require_once __DIR__ . '/connect.php';

function testVideoAccess() {
    $results = [
        'success' => false,
        'videos' => [],
        'recommendations' => []
    ];
    
    // Get recent videos
    [$status, $data, $error] = supabase_request(
        'GET',
        'rest/v1/feeds_posts?select=post_id,video_url,caption,created_at&video_url=not.is.null&order=created_at.desc&limit=5'
    );
    
    if ($status === 200 && $data) {
        $posts = is_string($data) ? json_decode($data, true) : $data;
        
        foreach ($posts as $post) {
            $videoUrl = $post['video_url'];
            
            // Test if video URL is accessible
            $ch = curl_init($videoUrl);
            curl_setopt_array($ch, [
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_NOBODY => true, // HEAD request
                CURLOPT_TIMEOUT => 10,
                CURLOPT_HTTPHEADER => [
                    'apikey: ' . SUPABASE_API_KEY,
                ]
            ]);
            
            $startTime = microtime(true);
            curl_exec($ch);
            $responseTime = (microtime(true) - $startTime) * 1000; // Convert to ms
            $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            $contentLength = curl_getinfo($ch, CURLINFO_CONTENT_LENGTH_DOWNLOAD);
            curl_close($ch);
            
            $videoInfo = [
                'post_id' => $post['post_id'],
                'caption' => substr($post['caption'] ?? '', 0, 30) . '...',
                'url' => $videoUrl,
                'accessible' => $httpCode === 200,
                'http_code' => $httpCode,
                'response_time_ms' => round($responseTime, 2),
                'size_mb' => $contentLength > 0 ? round($contentLength / (1024 * 1024), 2) : 'Unknown'
            ];
            
            // Performance recommendations
            if ($responseTime > 3000) {
                $videoInfo['warning'] = 'Slow response time (> 3s)';
            }
            if ($contentLength > 50 * 1024 * 1024) { // > 50MB
                $videoInfo['warning'] = 'Large file size (> 50MB) - consider compression';
            }
            
            $results['videos'][] = $videoInfo;
        }
        
        $results['success'] = true;
        
        // General recommendations
        if (count($results['videos']) > 0) {
            $avgResponseTime = array_sum(array_column($results['videos'], 'response_time_ms')) / count($results['videos']);
            
            if ($avgResponseTime > 2000) {
                $results['recommendations'][] = 'Videos are loading slowly. Consider compressing videos before upload.';
            }
            
            $results['recommendations'][] = 'For faster playback, upload videos under 30MB and use quality: 0.7';
            $results['recommendations'][] = 'On mobile networks, video loading may be slower - this is normal';
        }
    } else {
        $results['error'] = "Failed to fetch videos: Status $status";
        if ($error) {
            $results['error'] .= " - $error";
        }
    }
    
    return $results;
}

try {
    $results = testVideoAccess();
    echo json_encode($results, JSON_PRETTY_PRINT);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}
