# Agri Connect 🚜🌾

An on-demand agricultural machinery dispatch platform (similar to PickMe/Uber) built for agricultural operations.

## ✨ Features
- **Vehicle Owner Portal**: Registration & Login with 5 machinery categories:
  - 🚜 *Tractor*
  - 🌾 *Harvester*
  - 🚜⚡ *PowerTiller*
  - 💧 *WaterPump*
  - ⚙️ *Rotavator*
- **Real-Time PickMe-Style Dispatching**:
  - Live sound alerts (synthesized Web Audio chime).
  - Countdown timer & pop-up modal on driver's screen.
  - **First-Come First-Served Lock**: The first driver to click **APPROVE** claims the job. All other drivers' modals automatically dismiss with a notification that the request was claimed.
- **WhatsApp Automation (`whatsapp-web.js`)**:
  - Web-based QR code scanner at `/admin.html` (no need to access the server console).
  - Automatically sends formatted, organized booking confirmations directly to the farmer/requester's WhatsApp number.
- **External API & Sandbox Simulator**:
  - `POST /api/dispatch` endpoint for external agricultural forms, apps, or sensors.
  - Interactive web simulator in the Admin portal to test dispatches with a single click.

---

## 🚀 Quick Start (Local Development)

### 1. Install Dependencies
```bash
npm install
```

### 2. Start the Server
```bash
npm start
# or
node server.js
```

### 3. Open in Browser
- **Home Portal**: [http://localhost:3000](http://localhost:3000)
- **Vehicle Owner Register**: [http://localhost:3000/register.html](http://localhost:3000/register.html)
- **Vehicle Owner Login**: [http://localhost:3000/login.html](http://localhost:3000/login.html)
- **Driver Live Dashboard**: [http://localhost:3000/dashboard.html](http://localhost:3000/dashboard.html)
- **Admin & WhatsApp Station**: [http://localhost:3000/admin.html](http://localhost:3000/admin.html)

---

## 📡 API Reference

### Trigger a Vehicle Dispatch
**Endpoint:** `POST /api/dispatch`  
**Headers:** `Content-Type: application/json`  
**Body:**
```json
{
  "requesterPhone": "94771234567",
  "vehicleType": "Tractor",
  "date": "2026-09-10",
  "location": "North Farm Zone B, Plot 3",
  "notes": "Need 2 acres ploughed"
}
```

**cURL Example:**
```bash
curl -X POST http://localhost:3000/api/dispatch \
  -H "Content-Type: application/json" \
  -d '{"requesterPhone":"94771234567","vehicleType":"Tractor","date":"2026-09-10","location":"North Farm Zone B","notes":"Ploughing 2 acres"}'
```

---

## 🌐 Deploy to Netlify (Frontend) & Render (Backend)
Follow the complete guide in [NETLIFY_RENDER_DEPLOYMENT.md](NETLIFY_RENDER_DEPLOYMENT.md) to deploy:
- **Frontend** on **Netlify** (drag-and-drop `public/` folder or link GitHub).
- **Backend** on **Render** (using the included `Dockerfile` with automated Chromium setup).

---

## ☁️ Free Linux Server Deployment (Self-Hosted VPS)
See [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) for full instructions on setting up a free Linux VPS (Oracle Cloud Always Free or DigitalOcean 60-day trial) with all headless Chromium dependencies and PM2.
