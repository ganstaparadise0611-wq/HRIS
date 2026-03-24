<?php
// notify-helper.php
// Include this file and call send_push_notification() or notify_users() to send push alerts.
// Requires connect.php to be included BEFORE this file.

if (!defined('SUPABASE_URL')) {
    require_once __DIR__ . '/connect.php';
}

/**
 * Send Expo push notifications to one or more Expo push tokens.
 *
 * @param string|array $tokens   Single token or array of tokens
 * @param string       $title    Notification title
 * @param string       $body     Notification body text
 * @param array        $data     Optional extra data payload
 * @return array                 ['sent' => int, 'errors' => array]
 */
function send_expo_push(mixed $tokens, string $title, string $body, array $data = []): array
{
    if (!is_array($tokens)) {
        $tokens = [$tokens];
    }

    // Filter out blanks / invalid-looking tokens
    $tokens = array_values(array_filter($tokens, function ($t) {
        return is_string($t) && str_starts_with($t, 'ExponentPushToken[');
    }));

    if (empty($tokens)) {
        return ['sent' => 0, 'errors' => []];
    }

    // Build Expo message batch (max 100 per request)
    $chunks = array_chunk($tokens, 100);
    $sentCount = 0;
    $errors    = [];

    foreach ($chunks as $chunk) {
        $messages = array_map(function ($token) use ($title, $body, $data) {
            return [
                'to'    => $token,
                'sound' => 'default',
                'title' => $title,
                'body'  => $body,
                'data'  => $data,
            ];
        }, $chunk);

        $payload  = json_encode($messages);
        $ch       = curl_init('https://exp.host/--/api/v2/push/send');
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST           => true,
            CURLOPT_POSTFIELDS     => $payload,
            CURLOPT_HTTPHEADER     => [
                'Content-Type: application/json',
                'Accept: application/json',
                'Accept-Encoding: gzip, deflate',
            ],
            CURLOPT_TIMEOUT        => 15,
        ]);

        $response = curl_exec($ch);
        $curlErr  = curl_error($ch);
        curl_close($ch);

        if ($curlErr) {
            $errors[] = "cURL error: $curlErr";
            continue;
        }

        $decoded = json_decode($response, true);
        if (!isset($decoded['data'])) {
            $errors[] = "Unexpected Expo response: " . substr($response, 0, 200);
            continue;
        }

        foreach ($decoded['data'] as $result) {
            if (($result['status'] ?? '') === 'ok') {
                $sentCount++;
            } else {
                $errors[] = $result['message'] ?? 'Unknown delivery error';
            }
        }
    }

    return ['sent' => $sentCount, 'errors' => $errors];
}

/**
 * Fetch all push tokens for an array of user_ids from the push_tokens table.
 *
 * @param array $userIds  Array of integer user IDs (log_id)
 * @return array          Flat array of Expo push token strings
 */
function get_push_tokens_for_users(array $userIds): array
{
    if (empty($userIds)) return [];

    // Build IN filter: user_id=in.(1,2,3)
    $inList = implode(',', array_map('intval', $userIds));
    [$status, $data, $err] = supabase_request(
        'GET',
        "rest/v1/push_tokens?user_id=in.({$inList})&select=push_token"
    );

    if ($err || $status !== 200 || !is_array($data)) {
        error_log("get_push_tokens_for_users error: " . ($err ?? "status $status"));
        return [];
    }

    return array_column($data, 'push_token');
}

/**
 * Fetch ALL push tokens in the system (for broadcast notifications).
 *
 * @return array  Flat array of Expo push token strings
 */
function get_all_push_tokens(): array
{
    [$status, $data, $err] = supabase_request(
        'GET',
        "rest/v1/push_tokens?select=push_token"
    );

    if ($err || $status !== 200 || !is_array($data)) {
        error_log("get_all_push_tokens error: " . ($err ?? "status $status"));
        return [];
    }

    return array_column($data, 'push_token');
}

/**
 * Convenience: notify specific users by their user_id (log_id).
 *
 * @param array  $userIds  Array of user IDs
 * @param string $title
 * @param string $body
 * @param array  $data     Optional extra payload
 */
function notify_users(array $userIds, string $title, string $body, array $data = []): void
{
    $tokens = get_push_tokens_for_users($userIds);
    if (!empty($tokens)) {
        send_expo_push($tokens, $title, $body, $data);
    }
}

/**
 * Convenience: notify ALL users (broadcast).
 *
 * @param string $title
 * @param string $body
 * @param array  $data  Optional extra payload
 */
function notify_all(string $title, string $body, array $data = []): void
{
    $tokens = get_all_push_tokens();
    if (!empty($tokens)) {
        send_expo_push($tokens, $title, $body, $data);
    }
}
