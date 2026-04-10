<?php
// Supabase "database connection" helper file.
// This file only contains the configuration and helper functions to talk to Supabase.

// Load backend-php/.env so Face++ keys work even when PHP is started without start-system.ps1
$envFile = __DIR__ . '/../.env';
if (is_file($envFile) && is_readable($envFile)) {
    $lines = @file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    if ($lines) {
        foreach ($lines as $line) {
            $line = trim($line);
            if ($line === '' || $line[0] === '#') continue;
            $eq = strpos($line, '=');
            if ($eq > 0) {
                $k = trim(substr($line, 0, $eq));
                $v = trim(substr($line, $eq + 1));
                if (($v !== '' && ($v[0] === '"' || $v[0] === "'")) && substr($v, -1) === $v[0]) {
                    $v = substr($v, 1, -1);
                }
                if ($k !== '') putenv("$k=$v");
            }
        }
    }
}

// --- Supabase config (from your project) ---
define('SUPABASE_URL', 'https://cgyqweheceduyrpxqvwd.supabase.co');

// Fallback anon key (publishable; safe to commit). This lets local dev work
// even when your PHP runtime doesn't have environment variables configured.
define('SUPABASE_PUBLIC_ANON_KEY', 'sb_publishable_MJmY9d0yFuPp6KtQ62stGw_lFHMnNAK');

// Prefer service role key (server-side) when available, otherwise anon key.
// IMPORTANT: never commit service role keys.
define(
    'SUPABASE_API_KEY',
    getenv('SUPABASE_SERVICE_ROLE_KEY')
        ?: (getenv('SUPABASE_ANON_KEY') ?: SUPABASE_PUBLIC_ANON_KEY)
);

// --- Supabase helper functions (inline) ---
function supabase_request(string $method, string $path, $body = null, array $extraHeaders = []): array
{
    $url = rtrim(SUPABASE_URL, '/') . '/' . ltrim($path, '/');

    // Use curl if available, otherwise fallback to file_get_contents
    if (function_exists('curl_init')) {
        $ch = curl_init($url);

        // Check if we are sending binary data (e.g. for Storage)
        $isJson = true;
        foreach ($extraHeaders as $h) {
            if (stripos($h, 'Content-Type:') !== false && stripos($h, 'application/json') === false) {
                $isJson = false;
                break;
            }
        }

        $headers = [
            'apikey: ' . SUPABASE_API_KEY,
            'Authorization: Bearer ' . SUPABASE_API_KEY,
        ];
        
        // Add Content-Type: application/json only if not specified
        if ($isJson) {
            $headers[] = 'Content-Type: application/json';
        }
        
        $headers = array_merge($headers, $extraHeaders);

        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_CUSTOMREQUEST  => strtoupper($method),
            CURLOPT_HTTPHEADER     => $headers,
            CURLOPT_TIMEOUT        => 30, // Increased for binary uploads
            CURLOPT_CONNECTTIMEOUT => 15,
            CURLOPT_SSL_VERIFYPEER => true,
            CURLOPT_SSL_VERIFYHOST => 2,
        ]);

        if ($body !== null) {
            $payload = ($isJson && !is_string($body)) ? json_encode($body) : $body;
            curl_setopt($ch, CURLOPT_POSTFIELDS, $payload);
        }

        $responseBody = curl_exec($ch);
        $statusCode   = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $curlErr      = curl_error($ch);
        $curlErrNo    = curl_errno($ch);

        if ($curlErr) {
            // Provide more detailed error messages
            $errorMsg = $curlErr;
            if ($curlErrNo === CURLE_OPERATION_TIMEOUTED || $curlErrNo === CURLE_OPERATION_TIMEDOUT) {
                $errorMsg = "Connection to Supabase timed out. Check your internet connection.";
            } elseif ($curlErrNo === CURLE_COULDNT_CONNECT) {
                $errorMsg = "Could not connect to Supabase. Check your internet connection and Supabase URL.";
            } elseif ($curlErrNo === CURLE_SSL_CONNECT_ERROR) {
                $errorMsg = "SSL connection error. Check Supabase URL and SSL configuration.";
            }
            error_log("Supabase curl error (code $curlErrNo): $errorMsg");
            return [$statusCode ?: 0, null, $errorMsg];
        }
    } else {
        // Fallback to file_get_contents
        $headers = [
            'Content-Type: application/json',
            'apikey: ' . SUPABASE_API_KEY,
            'Authorization: Bearer ' . SUPABASE_API_KEY,
        ];
        $headers = array_merge($headers, $extraHeaders);

        $content = null;
        if ($body !== null) {
            $content = json_encode($body);
            $headers[] = 'Content-Length: ' . strlen($content);
        }

        $options = [
            'http' => [
                'method' => strtoupper($method),
                'header' => implode("\r\n", $headers),
                'ignore_errors' => true,
                'timeout' => 20, // 20 second timeout (increased for slow connections)
            ],
            'ssl' => [
                'verify_peer' => true,
                'verify_peer_name' => true,
            ]
        ];

        if ($content !== null) {
            $options['http']['content'] = $content;
        }

        $context = stream_context_create($options);
        $responseBody = @file_get_contents($url, false, $context);
        
        if ($responseBody === false) {
            $lastError = error_get_last();
            $errorMsg = 'Failed to connect to Supabase';
            if ($lastError) {
                $errorMsg .= ': ' . $lastError['message'];
            }
            return [0, null, $errorMsg];
        }

        // Extract status code from response headers
        $statusCode = 200;
        if (isset($http_response_header)) {
            foreach ($http_response_header as $header) {
                if (preg_match('/^HTTP\/\d\.\d\s+(\d+)/', $header, $matches)) {
                    $statusCode = (int)$matches[1];
                    break;
                }
            }
        }
    }

    $decoded = json_decode($responseBody, true);
    if (json_last_error() !== JSON_ERROR_NONE) {
        return [$statusCode, $responseBody, null];
    }

    return [$statusCode, $decoded, null];
}

/**
 * Execute multiple requests in parallel
 * @param array $requests Array of ['method', 'path', 'body', 'extraHeaders']
 * @return array Array of [$status, $data, $err] for each request
 */
function supabase_request_multi(array $requests): array
{
    if (empty($requests)) return [];
    if (!function_exists('curl_multi_init')) {
        // Fallback to sequential if curl_multi is unavailable
        $results = [];
        foreach ($requests as $req) {
            $results[] = supabase_request($req['method'], $req['path'], $req['body'] ?? null, $req['extraHeaders'] ?? []);
        }
        return $results;
    }

    $mh = curl_multi_init();
    $handles = [];
    $results = [];

    foreach ($requests as $i => $req) {
        $url = rtrim(SUPABASE_URL, '/') . '/' . ltrim($req['path'], '/');
        $ch = curl_init($url);
        
        $headers = array_merge([
            'Content-Type: application/json',
            'apikey: ' . SUPABASE_API_KEY,
            'Authorization: Bearer ' . SUPABASE_API_KEY,
        ], $req['extraHeaders'] ?? []);

        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_CUSTOMREQUEST  => strtoupper($req['method']),
            CURLOPT_HTTPHEADER     => $headers,
            CURLOPT_TIMEOUT        => 15,
            CURLOPT_CONNECTTIMEOUT => 5,
            CURLOPT_SSL_VERIFYPEER => true,
            CURLOPT_SSL_VERIFYHOST => 2,
        ]);

        if (isset($req['body'])) {
            curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($req['body']));
        }

        curl_multi_add_handle($mh, $ch);
        $handles[$i] = $ch;
    }

    // Execute handles in parallel
    $active = null;
    do {
        $mrc = curl_multi_exec($mh, $active);
    } while ($mrc == CURLM_CALL_MULTI_PERFORM);

    while ($active && $mrc == CURLM_OK) {
        if (curl_multi_select($mh) == -1) {
            usleep(100);
        }
        do {
            $mrc = curl_multi_exec($mh, $active);
        } while ($mrc == CURLM_CALL_MULTI_PERFORM);
    }

    // Collect results
    foreach ($handles as $i => $ch) {
        $responseBody = curl_multi_getcontent($ch);
        $statusCode   = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $curlErr      = curl_error($ch);
        
        $decoded = ($curlErr) ? null : json_decode($responseBody, true);
        $err = ($curlErr) ? $curlErr : (json_last_error() !== JSON_ERROR_NONE ? 'JSON Decode Error' : null);
        
        $results[$i] = [$statusCode, $decoded, $err];
        
        curl_multi_remove_handle($mh, $ch);
        curl_close($ch);
    }

    curl_multi_close($mh);
    return $results;
}

function supabase_insert(string $table, array $row): array
{
    return supabase_request('POST', "rest/v1/{$table}", $row, [
        'Prefer: return=representation',
    ]);
}

function supabase_select(string $table, array $filters = [], string $select = '*', string $orderBy = ''): array
{
    $path = "rest/v1/{$table}?select={$select}";
    
    // Add filters
    foreach ($filters as $key => $value) {
        $path .= "&{$key}=eq." . urlencode($value);
    }
    
    // Add ordering
    if ($orderBy !== '') {
        $path .= "&order={$orderBy}";
    }
    
    return supabase_request('GET', $path);
}

function supabase_select_single(string $table, array $filters = [], string $select = '*'): array
{
    $path = "rest/v1/{$table}?select={$select}";
    
    foreach ($filters as $key => $value) {
        $path .= "&{$key}=eq." . urlencode($value);
    }
    
    [$status, $data, $err] = supabase_request('GET', $path, null, [
        'Accept: application/vnd.pgrst.object+json',
    ]);
    
    return [$status, $data, $err];
}

// No endpoint / echo logic here on purpose.
// Include this file from other PHP scripts to use supabase_request() / supabase_insert().
