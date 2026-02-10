# PHP demo backend for face verification (stub)

How to run (local LAN):
- Require PHP 7.4+.
- In this folder, run: `php -S 0.0.0.0:8000 -t public`
- Get your PC LAN IP (e.g., `192.168.x.x`) and set in Expo env: `EXPO_PUBLIC_API_URL=http://192.168.x.x:8000`
- Phone and PC must be on the same Wi‑Fi for Expo Go.

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
