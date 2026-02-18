Setup notes — auto-start backend and ngrok

1) Edit the files to match your environment

- `start-on-boot.bat`: update `PHP_EXE` and `NGROK_EXE` paths if necessary.
- `ngrok-runloop.ps1`: update `NgrokPath` in the batch call or pass different args.

2) Test manually

From PowerShell, in `backend-php`:

```powershell
# Run the PHP server in the foreground (for testing):
php -S 127.0.0.1:8000 -t .\public

# Run the ngrok wrapper directly:
powershell -NoProfile -ExecutionPolicy Bypass -File .\ngrok-runloop.ps1 -PhpPort 8000 -NgrokPath "C:\path\to\ngrok.exe"
```

3) Register the Scheduled Task (optional)

Run the included helper (may require elevation):

```powershell
powershell -ExecutionPolicy Bypass -File .\register-task.ps1
```

Or run the equivalent `schtasks` command manually:

```powershell
schtasks /Create /SC ONLOGON /RL HIGHEST /TN "Start My App Backend" /TR "C:\Users\Vince\OneDrive\文件\NEW\backend-php\start-on-boot.bat" /F
```

4) Next steps

- Configure your ngrok authtoken and `ngrok.yml` as needed.
- Consider using NSSM to register PHP and ngrok as Windows services for stronger auto-restart behavior.
- I can add app-level retry logic into the React/Expo app if you want — tell me which file to modify.
