# Deploying AgriDispatch: Frontend on Netlify & Backend on Render 🚀

This guide explains how to deploy the **Frontend on Netlify** and the **Backend on Render**.

---

## 🏗️ Architecture Overview

```
[Netlify CDN]  ──► Hosts `public/` (HTML, JS, CSS)
   │               URL: https://your-site.netlify.app
   │
   │ (API Calls & WebSockets)
   ▼
[Render Web Service] ──► Runs Docker with Node.js + Chromium + whatsapp-web.js
                         URL: https://your-backend.onrender.com
```

---

## PART 1: Deploy Backend to Render

Render will host the Node.js server, SQLite database, Socket.io real-time engine, and headless Chromium for `whatsapp-web.js`.

### Step 1: Push Project to GitHub
1. Create a new repository on [github.com](https://github.com/) (e.g., `agri-dispatch`).
2. Push your project files:
   ```bash
   git init
   git add .
   git commit -m "Initial commit for Render & Netlify"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/agri-dispatch.git
   git push -u origin main
   ```

### Step 2: Create Web Service on Render
1. Go to [dashboard.render.com](https://dashboard.render.com/) and sign in.
2. Click **New + > Web Service**.
3. Select **Build and deploy from a Git repository** and connect your `agri-dispatch` repository.
4. Fill in the settings:
   - **Name**: `agri-dispatch-backend` (or any name you choose)
   - **Region**: Closest to you (e.g. *Singapore* or *Oregon*)
   - **Language / Environment**: Select **Docker**
     > *Note: Render will automatically detect the provided `Dockerfile`, which installs all necessary Chromium packages!*
   - **Plan**: Select **Free**
5. Click **Deploy Web Service**.
6. Render will build the Docker container and start your server.
7. Once deployed, copy your **Render Service URL** from the top of the dashboard:
   `https://agri-dispatch-backend.onrender.com`

---

## PART 2: Deploy Frontend to Netlify

Netlify hosts the static frontend (`public/` directory) on a global CDN with free SSL.

### Option A: Drag & Drop (Fastest — 30 Seconds!)
1. Go to [app.netlify.com/drop](https://app.netlify.com/drop).
2. Simply drag and drop the `public` folder from this project into the drop zone.
3. Netlify will instantly publish your site and give you a live URL:
   `https://your-app-name.netlify.app`

### Option B: Connect via GitHub (Automatic Updates)
1. Go to [app.netlify.com](https://app.netlify.com/) and click **Add new site > Import an existing project**.
2. Select **GitHub** and pick your `agri-dispatch` repository.
3. In the Build settings:
   - **Base directory**: (leave blank)
   - **Build command**: (leave blank)
   - **Publish directory**: `public`
4. Click **Deploy site**.

---

## PART 3: Connect Frontend to Backend

Now, tell your Netlify frontend where your Render backend is running. You can do this in **one click directly in the browser**:

1. Open your live Netlify website:
   `https://your-site.netlify.app`
2. Click the **API Config** (or **API: Backend**) button in the navigation bar.
3. Paste your Render backend URL:
   `https://agri-dispatch-backend.onrender.com`
4. Click **OK**. The site will reload and immediately connect to your Render backend!

*(Alternative: You can edit line 10 in `public/config.js` to set `defaultRenderUrl` to your Render URL before deploying).*

---

## ⚡ Pro-Tip: Keeping Render Awake (Prevent Free Sleep)

Render Free Tier Web Services go to sleep after 15 minutes of inactivity. When asleep, `whatsapp-web.js` pauses until a new request arrives.

**To keep your WhatsApp bot connected 24/7 for free:**
1. Create a free account on [cron-job.org](https://cron-job.org/) or [uptimerobot.com](https://uptimerobot.com/).
2. Create a HTTP monitor:
   - **URL**: `https://your-backend.onrender.com/api/whatsapp/status`
   - **Interval**: Every **10 minutes**
3. This sends a lightweight ping that keeps Render awake 24/7 without ever letting Chromium sleep!

---

## 📱 WhatsApp Connection on Render

1. Open your Netlify admin page: `https://your-site.netlify.app/admin.html`
2. The page communicates with your Render backend and displays the WhatsApp QR code.
3. Open WhatsApp on your phone > **Linked Devices > Link a Device** > scan the QR code.
4. Status will change to green (**READY**). Your system is fully active and ready to dispatch notifications!
