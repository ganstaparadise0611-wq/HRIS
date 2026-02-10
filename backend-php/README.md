# PHP demo backend for face verification (stub)

How to run (local LAN):
- Require PHP 7.4+.
- In this folder, run: `php -S 0.0.0.0:8000 -t public`
- Get your PC LAN IP (e.g., `192.168.x.x`) and set in Expo env: `EXPO_PUBLIC_API_URL=http://192.168.x.x:8000`
- Phone and PC must be on the same Wi‑Fi for Expo Go.

Required backend env vars:
- `SUPABASE_URL` (example: `https://xxxx.supabase.co`)
- `SUPABASE_ANON_KEY` (your Supabase anon key)
- `APP_JWT_SECRET` (any strong random string; used to sign login tokens)

Example (PowerShell):
`$env:SUPABASE_URL="https://xxxx.supabase.co"; $env:SUPABASE_ANON_KEY="..."; $env:APP_JWT_SECRET="change-me"; php -S 0.0.0.0:8000 -t public`

Endpoint:
- `POST /verify.php`
- FormData fields:
  - `photo` (file, required) — image captured from the front-end.
  - `user_id` (string, optional)
  - `clock_time` (string, optional)
- Response (demo):
```json
{ "ok": true, "match": 0.98, "user_id": "123", "clock_time": "...", "stored_path": "/tmp/attendance_xxx.jpg" }
```

Notes:
- CORS is open (`*`) for development; tighten in production.
- The logic is a stub: it just saves the file to a temp path and returns a fake match score. Replace with real face verification when ready.

Login endpoint:
- `POST /login.php`
- JSON body:
```json
{ "username": "admin", "password": "admin123" }
```
- Response (success):
```json
{ "ok": true, "token": "JWT...", "user": { "log_id": 2, "username": "admin" } }
```
