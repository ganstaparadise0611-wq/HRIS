@echo off
SETLOCAL ENABLEDELAYEDEXPANSION
REM Determine repo folder (this batch lives in backend-php\)
set REPO_DIR=%~dp0
if not exist "%REPO_DIR%logs" mkdir "%REPO_DIR%logs"

REM Configure these to match your environment if needed
set PHP_EXE=C:\php\php.exe
set NGROK_EXE=C:\path\to\ngrok.exe

if not exist "%PHP_EXE%" (
  set PHP_EXE=php
)

pushd "%REPO_DIR%public"

echo Starting PHP built-in server... >> "%REPO_DIR%logs\startup.log" 2>&1
start "PHP Server" "%PHP_EXE%" -S 127.0.0.1:8000 -t "%REPO_DIR%public" > "%REPO_DIR%logs\php-server.log" 2>&1
timeout /t 2 /nobreak >nul

echo Starting ngrok wrapper... >> "%REPO_DIR%logs\startup.log" 2>&1
start "ngrok wrapper" powershell -NoProfile -ExecutionPolicy Bypass -File "%REPO_DIR%ngrok-runloop.ps1" -PhpPort 8000 -NgrokPath "%NGROK_EXE%"

popd
exit /b 0
