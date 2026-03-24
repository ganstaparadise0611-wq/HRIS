<?php
require_once 'connect.php';

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json');

// Handle preflight OPTIONS request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);
    $email = $input['email'] ?? '';

    if (empty($email)) {
        echo json_encode(['success' => false, 'message' => 'Email is required']);
        exit;
    }

    // 1. Check if email exists in accounts table (username column stores emails)
    [$status, $data, $err] = supabase_request(
        'GET',
        '/rest/v1/accounts?username=eq.' . urlencode($email) . '&select=log_id,username',
        null,
        ['Prefer' => 'return=representation']
    );

    if ($err || empty($data) || !is_array($data) || count($data) === 0) {
        echo json_encode(['success' => false, 'message' => 'Email not found']);
        exit;
    }

    $user = $data[0];
    $userId = $user['log_id'];

    // 2. Generate 6-digit code
    $code = sprintf('%06d', mt_rand(0, 999999));
    $expiresAt = date('Y-m-d H:i:s', strtotime('+15 minutes'));

    // 3. Store code in password_resets table
    $resetData = [
        'user_id' => $userId,
        'email' => $email,
        'code' => $code,
        'expires_at' => $expiresAt,
        'used' => false
    ];

    [$insertStatus, $insertData, $insertErr] = supabase_request(
        'POST',
        '/rest/v1/password_resets',
        $resetData,
        ['Prefer' => 'return=representation']
    );

    if ($insertStatus >= 400 || $insertErr) {
        echo json_encode(['success' => false, 'message' => 'Failed to generate code']);
        exit;
    }

    // 4. Send email via PHPMailer with Brevo SMTP
    // Send email via Mailjet API
    $mjApiKey = '259cc4fcf9038529a9e4479789f62d2c';
    $mjApiSecret = '71268d2405e01d8c3a06d66318af4910';
    $mjUrl = 'https://api.mailjet.com/v3.1/send';
    $mjPayload = [
        'Messages' => [
            [
                'From' => [
                    'Email' => 'vincealbertalcaraz6@gmail.com',
                    'Name' => 'Password Reset'
                ],
                'To' => [
                    [
                        'Email' => $email,
                        'Name' => $email
                    ]
                ],
                'Subject' => 'Password Reset Code',
                'HTMLPart' => '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #333;">Password Reset Request</h2>
                    <p>You requested to reset your password. Use the code below to verify your identity:</p>
                    <div style="background: #f4f4f4; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 5px; margin: 20px 0;">'
                        . $code . '
                    </div>
                    <p style="color: #666;">This code will expire in 15 minutes.</p>
                    <p style="color: #666;">If you did not request this, please ignore this email.</p>
                </div>'
            ]
        ]
    ];

    $ch = curl_init($mjUrl);
    curl_setopt($ch, CURLOPT_POST, 1);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($mjPayload));
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
    curl_setopt($ch, CURLOPT_USERPWD, $mjApiKey . ':' . $mjApiSecret);
    $mjResponse = curl_exec($ch);
    $mjErr = curl_error($ch);
    $mjStatus = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($mjStatus == 200) {
        echo json_encode([
            'success' => true,
            'message' => 'Verification code sent to your email'
        ]);
    } else {
        echo json_encode([
            'success' => false,
            'message' => 'Failed to send email. Please try again.',
            'debug' => $mjErr,
            'mailjet_response' => $mjResponse
        ]);
    }
} else {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);
}
