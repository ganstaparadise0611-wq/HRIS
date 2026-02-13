@echo off
echo Starting PHP Server using XAMPP...
echo.
echo Server will run at: http://0.0.0.0:8000
echo Make sure your phone is on the same WiFi network!
echo.
echo Press Ctrl+C to stop the server
echo.
cd /d %~dp0
C:\xampp\php\php.exe -S 0.0.0.0:8000 -t public
pause
