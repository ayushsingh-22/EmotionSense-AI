# 🚀 Emotion AI - Startup Guide

This guide explains how to start your Emotion AI application in different configurations.

## 📦 Quick Start Options

### Option 1: Start Everything Together (Recommended)
**Use this when**: You want to run both frontend and backend for full application functionality.

```bash
# Double-click this file or run:
start-all.bat
```

**What happens**:
- ✅ Opens 2 separate windows
- ✅ Backend starts on `http://localhost:8080`
- ✅ Frontend starts on `http://localhost:3000`
- ✅ Both services auto-install dependencies
- ✅ Both services run independently

**To stop**: Close both command windows or press `Ctrl+C` in each.

---

### Option 2: Start Backend Only
**Use this when**: You want to test API endpoints or run backend separately.

```bash
# Double-click this file or run:
start-backend.bat
```

**What happens**:
- ✅ Backend starts on `http://localhost:8080`
- ✅ All API endpoints available at `/api/*`
- ✅ Health check at `/health`

**Test it**:
```bash
# Open browser or use curl
curl http://localhost:8080/health
```

---

### Option 3: Start Frontend Only
**Use this when**: Backend is already running or you're testing UI in isolation.

```bash
# Double-click this file or run:
start-frontend.bat
```

**What happens**:
- ✅ Frontend starts on `http://localhost:3000`
- ⚠️ **Important**: Backend must be running separately at `http://localhost:8080`
- ❌ Without backend, API calls will fail

---

## 🎯 Common Workflows

### Development Workflow (Full Stack)
```bash
1. Run: start-all.bat
2. Wait for both services to start (~30 seconds)
3. Open browser: http://localhost:3000
4. Start developing!
```

### API Development Workflow
```bash
1. Run: start-backend.bat
2. Test endpoints with Postman/Thunder Client/curl
3. When ready, run: start-frontend.bat (in separate terminal)
```

### Frontend-Only Development
```bash
1. Run: start-backend.bat (keep it running)
2. Run: start-frontend.bat
3. Make UI changes - hot reload works!
4. Backend keeps running in background
```

---

## 🔍 Verification Checklist

### After Starting Services

**Backend Health Check**:
```bash
# Should return: {"status":"ok","message":"Emotion AI API is running"}
curl http://localhost:8080/health
```

**Frontend Access**:
- Open `http://localhost:3000` in browser
- Should see Emotion AI Dashboard
- No connection errors in console

**Full Integration Test**:
1. Go to Text Analysis page
2. Enter text: "I am so happy today!"
3. Click "Analyze Emotion"
4. Should see emotion results within 2-3 seconds

---

## ⚡ Port Configuration

| Service  | Port | URL                        | Purpose                |
|----------|------|----------------------------|------------------------|
| Backend  | 8080 | http://localhost:8080      | API Server             |
| Frontend | 3000 | http://localhost:3000      | Next.js Web UI         |

**Important**: Frontend is configured to call backend at `localhost:8080`. If you change backend port, update `frontend/.env.local`.

---

## 🛠️ Troubleshooting

### Issue: "Port already in use"
**Solution**:
```bash
# Find process using port 8080
netstat -ano | findstr :8080

# Kill process (replace PID with actual number)
taskkill /PID <PID> /F

# Or change port in backend/.env
PORT=8081
```

### Issue: "Cannot connect to backend"
**Check**:
1. ✅ Backend is running on port 8080
2. ✅ No firewall blocking localhost
3. ✅ Check `frontend/.env.local` has correct API URL
4. ✅ Check browser console for CORS errors

### Issue: "Module not found" errors
**Solution**:
```bash
# Backend
cd backend
npm install

# Frontend
cd frontend
npm install
```

### Issue: Windows Defender blocks scripts
**Solution**:
```bash
# Run PowerShell as Administrator
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

---

## 📝 Environment Setup

### Backend Environment (backend/.env)
```env
PORT=8080
NODE_ENV=development
LOG_LEVEL=info
```

### Frontend Environment (frontend/.env.local)
```env
NEXT_PUBLIC_API_URL=http://localhost:8080
```

---

## 🔄 Restart Services

### Quick Restart (Both Services)
1. Close both command windows
2. Run `start-all.bat` again

### Restart Single Service
1. Press `Ctrl+C` in the service window
2. Run the service again or press any key if window is still open

---

## 📊 Performance Tips

1. **First Start**: Takes longer (npm install runs)
2. **Subsequent Starts**: Much faster (~10 seconds)
3. **Hot Reload**: Frontend changes reflect immediately
4. **Backend Changes**: Restart backend window only

---

## 🎓 Learning Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [Node.js Backend Guide](./backend/README.md)
- [Frontend Architecture](./frontend/ARCHITECTURE.md)
- [API Documentation](./backend/README_DETAILED.md)

---

## ✅ Success Indicators

When everything is working correctly, you should see:

**Backend Window**:
```
✨ Emotion AI Backend Server started successfully!
🚀 Server running on: http://localhost:8080
📝 Logs directory: ./logs
🎯 Environment: development
```

**Frontend Window**:
```
▲ Next.js 14.2.33
- Local:        http://localhost:3000
- Network:      http://192.168.x.x:3000

✓ Ready in 3.2s
```

**Browser**:
- Dashboard loads with no errors
- Theme toggle works
- All pages accessible
- API calls succeed (check Network tab)

---

## 🆘 Need Help?

If you encounter issues:
1. Check this guide's troubleshooting section
2. Review `PORT_CONFIGURATION.md` for port-specific issues
3. Check console/terminal output for error messages
4. Verify Node.js version: `node --version` (should be 18.x or higher)

---

**Happy Coding! 🎉**
