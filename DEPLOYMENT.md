# Deployment Guide - Render

This guide will help you deploy the Doctor-Patient Chat System to Render using GitHub.

## Quick Start

### 1. Prepare Your Repository

Make sure your code is ready:
```bash
# Check that all files are ready
git status

# If you haven't initialized git yet
git init
git add .
git commit -m "Initial commit: Ready for Render deployment"
```

### 2. Push to GitHub

```bash
# Create a new repository on GitHub first, then:
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
git branch -M main
git push -u origin main
```

### 3. Deploy to Render

#### Option A: Using Render Dashboard (Recommended for first-time)

1. **Sign up/Login to Render**
   - Go to [https://render.com](https://render.com)
   - Sign up or log in with your GitHub account

2. **Create New Web Service**
   - Click "New +" button
   - Select "Web Service"
   - Connect your GitHub account if prompted
   - Select your repository

3. **Configure the Service**
   - **Name**: `doctor-patient-chat` (or your choice)
   - **Region**: Choose closest to your users
   - **Branch**: `main` (or your default branch)
   - **Root Directory**: Leave empty (root of repo)
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Plan**: Free (or upgrade for better performance)

4. **Advanced Settings** (Optional)
   - **Auto-Deploy**: Yes (deploys on every push)
   - **Health Check Path**: `/` (or leave empty)

5. **Create Web Service**
   - Click "Create Web Service"
   - Wait for build to complete (2-5 minutes)
   - Your app will be live at `https://your-app-name.onrender.com`

#### Option B: Using render.yaml (Blueprint)

1. **Push render.yaml to GitHub**
   ```bash
   git add render.yaml
   git commit -m "Add Render configuration"
   git push
   ```

2. **Deploy via Blueprint**
   - Go to Render Dashboard
   - Click "New +" → "Blueprint"
   - Connect your repository
   - Render will auto-detect `render.yaml`
   - Review and click "Apply"

## Post-Deployment

### Access Your App
- Your app URL: `https://your-app-name.onrender.com`
- Share this URL with users

### Monitor Your App
- View logs in Render Dashboard
- Check metrics and performance
- Monitor uptime

### Update Your App
- Push changes to GitHub
- Render auto-deploys (if enabled)
- Or manually trigger deployment from dashboard

## Troubleshooting

### Build Fails
- Check build logs in Render Dashboard
- Ensure `package.json` has correct dependencies
- Verify Node.js version compatibility

### App Not Starting
- Check start command: should be `npm start`
- Verify `server.js` uses `process.env.PORT`
- Review application logs

### Socket.IO Not Working
- Ensure WebSocket support is enabled (Render supports this)
- Check CORS settings in `server.js`
- Verify Socket.IO client connects to correct URL

### Free Tier Limitations
- App spins down after 15 minutes of inactivity
- First request after spin-down takes 30-60 seconds
- Consider upgrading for production use

## Environment Variables

You can add environment variables in Render Dashboard:
- Go to your service → Environment
- Add variables like:
  - `NODE_ENV=production`
  - Custom API keys if needed

## Custom Domain (Optional)

1. Go to your service → Settings → Custom Domain
2. Add your domain
3. Follow DNS configuration instructions
4. SSL certificate is automatically provisioned

## Support

- Render Docs: [https://render.com/docs](https://render.com/docs)
- Render Community: [https://community.render.com](https://community.render.com)


