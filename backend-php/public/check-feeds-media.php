<?php
/**
 * Check for problematic image URLs in feeds
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

require_once __DIR__ . '/connect.php';

[$status, $data, $error] = supabase_request(
    'GET',
    'rest/v1/feeds_posts?select=post_id,image_url,video_url,caption&order=created_at.desc&limit=20'
);

$results = [
    'total_posts' => 0,
    'posts_with_images' => 0,
    'posts_with_videos' => 0,
    'problematic_images' => [],
    'posts' => []
];

if ($status === 200 && $data) {
    $posts = is_string($data) ? json_decode($data, true) : $data;
    $results['total_posts'] = count($posts);
    
    foreach ($posts as $post) {
        $postInfo = [
            'post_id' => $post['post_id'],
            'caption' => substr($post['caption'] ?? '', 0, 50) . '...',
            'has_image' => !empty($post['image_url']),
            'has_video' => !empty($post['video_url']),
            'image_type' => null,
            'image_preview' => null
        ];
        
        if (!empty($post['image_url'])) {
            $results['posts_with_images']++;
            $imageUrl = $post['image_url'];
            
            if (str_starts_with($imageUrl, 'data:')) {
                $postInfo['image_type'] = 'base64';
                $postInfo['image_preview'] = substr($imageUrl, 0, 60) . '...';
            } elseif (str_starts_with($imageUrl, 'http://')) {
                $postInfo['image_type'] = 'http (problematic!)';
                $postInfo['image_preview'] = $imageUrl;
                $results['problematic_images'][] = [
                    'post_id' => $post['post_id'],
                    'url' => $imageUrl
                ];
            } elseif (str_starts_with($imageUrl, 'https://')) {
                $postInfo['image_type'] = 'https';
                $postInfo['image_preview'] = $imageUrl;
            } else {
                $postInfo['image_type'] = 'raw_base64';
                $postInfo['image_preview'] = substr($imageUrl, 0, 40) . '...';
            }
        }
        
        if (!empty($post['video_url'])) {
            $results['posts_with_videos']++;
            $postInfo['video_url'] = $post['video_url'];
        }
        
        $results['posts'][] = $postInfo;
    }
}

echo json_encode($results, JSON_PRETTY_PRINT);
