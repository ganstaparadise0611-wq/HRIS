<?php
/**
 * Test Supabase Storage Bucket Configuration
 * This script checks if the Posts bucket is properly configured for public access
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, apikey');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/connect.php';

function testSupabaseStorage() {
    $results = [
        'success' => false,
        'checks' => [],
        'recommendations' => []
    ];
    
    // 1. Check if we can list objects in the Posts bucket
    $results['checks'][] = [
        'test' => 'List Posts bucket',
        'status' => 'testing'
    ];
    
    [$status, $data, $error] = supabase_request(
        'GET',
        'storage/v1/bucket/Posts',
        null
    );
    
    if ($status === 200 && $data) {
        $bucketInfo = is_string($data) ? json_decode($data, true) : $data;
        $isPublic = $bucketInfo['public'] ?? false;
        
        $results['checks'][0]['status'] = 'passed';
        $results['checks'][0]['data'] = [
            'bucket_exists' => true,
            'is_public' => $isPublic,
            'bucket_info' => $bucketInfo
        ];
        
        if (!$isPublic) {
            $results['recommendations'][] = 'The Posts bucket is not public. Go to Supabase Dashboard > Storage > Posts bucket > Make Public';
        }
    } else {
        $results['checks'][0]['status'] = 'failed';
        $results['checks'][0]['error'] = $error ?? "Status: $status";
        $results['recommendations'][] = 'Create a public bucket named "Posts" in Supabase Storage';
    }
    
    // 2. Test a sample video URL (if any recent posts exist)
    $results['checks'][] = [
        'test' => 'Check recent video posts',
        'status' => 'testing'
    ];
    
    [$status, $data, $error] = supabase_request(
        'GET',
        'rest/v1/feeds_posts?select=post_id,video_url,media_type&order=created_at.desc&limit=5'
    );
    
    if ($status === 200 && $data) {
        $posts = is_string($data) ? json_decode($data, true) : $data;
        $videoPosts = array_filter($posts, fn($p) => !empty($p['video_url']));
        
        if (count($videoPosts) > 0) {
            $results['checks'][1]['status'] = 'passed';
            $results['checks'][1]['data'] = [
                'total_media_posts' => count($videoPosts),
                'sample_urls' => array_map(fn($p) => $p['video_url'], array_slice($videoPosts, 0, 3))
            ];
        } else {
            $results['checks'][1]['status'] = 'info';
            $results['checks'][1]['message'] = 'No video posts found in database';
        }
    } else {
        $results['checks'][1]['status'] = 'failed';
        $results['checks'][1]['error'] = "Could not fetch posts";
    }
    
    // 3. Check bucket CORS policy
    $results['checks'][] = [
        'test' => 'CORS Configuration',
        'status' => 'info',
        'message' => 'CORS should allow all origins (*) for mobile apps'
    ];
    
    $results['success'] = count(array_filter($results['checks'], fn($c) => $c['status'] === 'failed')) === 0;
    
    return $results;
}

try {
    $results = testSupabaseStorage();
    echo json_encode($results, JSON_PRETTY_PRINT);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}
