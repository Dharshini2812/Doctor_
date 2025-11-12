# Doctor-Patient Chat System over Sockets

A minimal real-time chat between a doctor and a patient using Node.js, Express, and Socket.IO.

## Features
- Join as Doctor or Patient
- Connect via shared Patient ID (room-based)
- Real-time messaging
- Typing indicator
- Presence list for the room

## Requirements
- Node.js 18+ installed (`node -v`)

## Setup

```bash
# In PowerShell from the project directory
npm install
npm run start
```

Then open `http://localhost:3000` in two different browser windows or devices:
- Join one as Patient with a Patient ID (e.g., P1234)
- Join the other as Doctor using the same Patient ID

You can also open multiple tabs to simulate both roles locally.

## How it works
- The backend serves static files from `public/` and hosts a Socket.IO server.
- Both Doctor and Patient join the same room named `chat:<PatientID>`.
- Messages are broadcast only within that room.
- Presence and typing events are pushed to clients in real time.

## File Structure
```
server.js              # Express + Socket.IO server
public/index.html      # UI (role selection, patient ID, chat)
public/script.js       # Client-side Socket.IO logic
public/styles.css      # Basic styling
package.json           # Dependencies and scripts
```

## Customization
- Add authentication, database storage, or multi-patient dashboards as needed.
- Replace in-memory presence with a database or Redis for scale.

## Scripts
- `npm start` — start server on port 3000
- `npm run dev` — start with nodemon (auto-reload)

## Notes
This example is intentionally simple and does not include user authentication or message persistence.

## Deployment to Render

This application is ready to deploy to Render with GitHub integration.

### Prerequisites
- A GitHub account
- A Render account (sign up at [render.com](https://render.com))

### Steps to Deploy

1. **Push to GitHub**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
   git push -u origin main
   ```

2. **Connect to Render**
   - Go to [Render Dashboard](https://dashboard.render.com)
   - Click "New +" → "Web Service"
   - Connect your GitHub account if not already connected
   - Select your repository

3. **Configure Service**
   - **Name**: `doctor-patient-chat` (or your preferred name)
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Plan**: Free (or choose a paid plan)

4. **Environment Variables** (optional)
   - `NODE_ENV`: `production`
   - `PORT`: Render automatically sets this, but you can set it to `10000` if needed

5. **Deploy**
   - Click "Create Web Service"
   - Render will automatically build and deploy your app
   - Your app will be available at `https://your-app-name.onrender.com`

### Using render.yaml (Alternative Method)

If you prefer using the `render.yaml` file:
1. Push your code to GitHub (including `render.yaml`)
2. Go to Render Dashboard → "New +" → "Blueprint"
3. Connect your repository
4. Render will automatically detect and use `render.yaml` for configuration

### Important Notes for Render
- The free tier spins down after 15 minutes of inactivity
- First request after spin-down may take 30-60 seconds
- For production use, consider upgrading to a paid plan
- Socket.IO works perfectly on Render's infrastructure

## Docker

Requirements:
- Docker Desktop (Windows) or Docker Engine

Build and run with Docker:

```bash
# In project root
docker compose up --build -d

# Open the app
start http://localhost:3000

# To view logs
docker compose logs -f

# To stop
docker compose down
```











