# Deployment Guide

## Important: Backend Limitations on Vercel

⚠️ **The backend CANNOT run on Vercel** because:
- Vercel serverless functions have timeout limits (10s hobby, 60s pro)
- Video processing can take several minutes
- FFmpeg (native binary) is not available on Vercel
- No persistent file system for temporary files

## Deployment Strategy

### Option 1: Frontend on Vercel + Backend on Separate Hosting (Recommended)

1. **Deploy Frontend to Vercel:**
   - The `vercel.json` is already configured
   - Set environment variable in Vercel dashboard:
     - `VITE_API_URL` = Your backend URL (e.g., `https://your-backend.railway.app`)

2. **Deploy Backend Separately:**
   - **Railway** (Recommended): https://railway.app
     - Supports long-running processes
     - Can install FFmpeg
     - Free tier available
   - **Render**: https://render.com
     - Supports background workers
   - **DigitalOcean App Platform**: https://www.digitalocean.com/products/app-platform
   - **Heroku**: https://www.heroku.com (paid plans)

### Option 2: Full Stack on Railway/Render

Deploy both frontend and backend together on Railway or Render.

## Vercel Frontend Setup

1. **Connect Repository:**
   ```bash
   vercel
   ```

2. **Set Environment Variables in Vercel Dashboard:**
   - Go to Project Settings → Environment Variables
   - Add: `VITE_API_URL` = `https://your-backend-url.com`
   - Make sure Firebase config is set (if using Firebase)

3. **Build Settings:**
   - Build Command: `cd client && npm install && npm run build`
   - Output Directory: `client/dist`
   - Install Command: `npm install` (root) or `cd client && npm install`

## Backend Deployment (Railway Example)

1. **Install Railway CLI:**
   ```bash
   npm i -g @railway/cli
   ```

2. **Login and Initialize:**
   ```bash
   railway login
   railway init
   ```

3. **Set Environment Variables:**
   ```bash
   railway variables set OPENAI_API_KEY=your_key_here
   railway variables set PORT=3001
   ```

4. **Deploy:**
   ```bash
   railway up
   ```

5. **Update Vercel Environment Variable:**
   - Set `VITE_API_URL` to your Railway backend URL

## Local Development

Create `client/.env.local`:
```
VITE_API_URL=http://localhost:3001
```

## Troubleshooting

### 404 Error on Vercel
- Check that `vercel.json` is in the root directory
- Verify build command and output directory
- Check Vercel build logs for errors

### API Calls Failing
- Verify `VITE_API_URL` is set correctly in Vercel
- Check CORS settings on backend
- Ensure backend is running and accessible

### Video Processing Timeout
- Backend must be on a platform that supports long-running processes
- Vercel serverless functions will timeout






