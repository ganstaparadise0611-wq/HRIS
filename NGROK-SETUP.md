# 🚀 Using Ngrok to Connect Your Mobile App

## What is Ngrok?
Ngrok creates a secure tunnel from the internet to your local PHP server, giving you a public URL that works from any device on any network.

## ✅ Setup Steps

### 1. Get Ngrok Auth Token (One-time setup)
1. Visit: https://dashboard.ngrok.com/signup
2. Sign up (free) using Google, GitHub, or email
3. Copy your authtoken from: https://dashboard.ngrok.com/get-started/your-authtoken

### 2. Configure Ngrok
```powershell
# Refresh PATH
$env:PATH = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")

# Add your authtoken (replace YOUR_TOKEN with your actual token)
ngrok config add-authtoken YOUR_TOKEN_HERE
```

### 3. Start Your PHP Server (Terminal 1)
```powershell
php -S 0.0.0.0:8000 -t backend-php/public
```
Keep this running!

### 4. Start Ngrok (Terminal 2)
```powershell
.\start-ngrok.ps1
```

You'll see output like:
```
Session Status                online
Forwarding                    https://abc-123-def.ngrok-free.app -> http://localhost:8000
```

### 5. Update Your Backend Config
Copy the `https://...ngrok-free.app` URL and run:
```powershell
.\update-backend-url.ps1 "https://your-ngrok-url-here.ngrok-free.app"
```

### 6. Restart Your Expo App
Press `r` in the Expo terminal to reload.

### 7. Try Logging In!
Your app should now connect successfully! 🎉

---

## 📝 Notes

- **Free tier limitations**: 
  - URL changes each time you restart ngrok
  - 40 connections/minute limit
  - Shows "Visit Site" button before connecting (can skip)

- **Keep both terminals running**:
  - Terminal 1: PHP server
  - Terminal 2: Ngrok tunnel

- **Update URL after each restart**: The ngrok URL changes when you close and reopen ngrok (unless you have a paid plan)

---

## 🔄 Quick Start Commands

**Every time you develop:**
```powershell
# Terminal 1: Start PHP server
php -S 0.0.0.0:8000 -t backend-php/public

# Terminal 2: Start ngrok
.\start-ngrok.ps1

# Terminal 3: Update config with new URL
.\update-backend-url.ps1 "https://YOUR-NEW-URL.ngrok-free.app"
```

---

## 🆘 Troubleshooting

**"ngrok not found"**: Close and reopen PowerShell

**"ERR_NGROK_108"**: You need to add your authtoken (see step 2)

**Still can't connect**: 
- Make sure PHP server is running
- Check the ngrok URL is correct in backend-config.ts
- Restart Expo app after updating URL

---

## 🌟 Alternative: Deploy to Cloud (Free)

For a permanent URL, consider deploying to:
- **Railway.app** - Easy deployment, free tier
- **Render.com** - Free hosting with auto-deploy
- **Fly.io** - Free tier available

This eliminates the need for ngrok and local server!
