# Free Linux Server & Deployment Guide for Agri Connect

This guide provides instructions on how to get a **free Linux server for 7+ days (up to 100% free forever)** and deploy the **Agri-Vehicle Dispatch & WhatsApp System** on it.

---

## 1. Top Options to Get a Free Linux Server

Because `whatsapp-web.js` runs a headless Chromium browser in the background, your Linux server should have **at least 1GB - 2GB RAM**.

| Provider | Free Period / Credit | RAM & Specs | Notes |
| :--- | :--- | :--- | :--- |
| **Oracle Cloud (OCI)** *(Recommended)* | **Always Free (Permanent)** | **24 GB RAM**, 4 Ampere ARM CPUs, 200 GB Storage | **Best option.** Never expires. Powerful enough to run multiple Chromium sessions with zero lag. |
| **DigitalOcean** | **60 Days Free** ($200 credit) | 2 GB - 4 GB RAM Droplet | Super easy setup. Also free via GitHub Student Developer Pack. |
| **Google Cloud (GCP)** | **90 Days Free** ($300 credit) | 1 GB - 4 GB RAM VM | Free trial credits plus Always Free `e2-micro` instance. |
| **Linode / Akamai** | **60 Days Free** ($100 credit) | 2 GB - 4 GB RAM Linode | Very reliable and fast to launch. |
| **AWS (Amazon Web Services)** | **12 Months Free** | 1 GB RAM (`t2.micro` or `t3.micro`) | Good, but 1 GB RAM can be tight for Chromium without a swapfile. |

---

### Step-by-Step: Getting the Free Server

#### Option A: Oracle Cloud Always Free (Best & Free Forever)
1. Go to [cloud.oracle.com/free](https://www.oracle.com/cloud/free/) and click **Start for free**.
2. Sign up with your email (a credit/debit card is required for identity verification, a \$1 temporary hold is refunded immediately).
3. Once in the Oracle Cloud Console, navigate to **Compute > Instances > Create Instance**.
4. Choose **Ubuntu 22.04 LTS** or **Ubuntu 24.04 LTS**.
5. Under **Shape**, select **Ampere (VM.Standard.A1.Flex)** with **2 to 4 OCPUs** and **12 to 24 GB RAM** (marked *Always Free Eligible*).
6. Download the SSH private key (`.key` file).
7. Click **Create**. Within 1–2 minutes, your server will be running with a Public IP address.

#### Option B: DigitalOcean ($200 Credit for 60 Days / Student Pack)
1. Go to [digitalocean.com](https://www.digitalocean.com/) and register a new account to claim $200 free credit for 60 days (or link your GitHub Student Pack).
2. Click **Create > Droplets**.
3. Select **Ubuntu 22.04 or 24.04**.
4. Select the **Basic Plan** ($12/mo or $18/mo with 2GB - 4GB RAM - covered by the $200 free credit).
5. Choose password or SSH key, then click **Create Droplet**.

---

## 2. Server Setup & Deployment Instructions

Once you connect to your Linux server via SSH (`ssh root@YOUR_SERVER_IP` or `ssh -i key.key ubuntu@YOUR_SERVER_IP`):

### Step 1: Update System & Install Node.js LTS
```bash
sudo apt-get update && sudo apt-get upgrade -y

# Install Node.js 20.x LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs git build-essential
```

Verify the installation:
```bash
node -v   # Should be v20.x or higher
npm -v
```

---

### Step 2: Install Essential Linux Dependencies for Chromium / Puppeteer
> [!IMPORTANT]
> `whatsapp-web.js` requires headless Chromium. On Linux, Chromium needs these specific system libraries to run without crashing:

```bash
sudo apt-get install -y \
  ca-certificates fonts-liberation libasound2 libatk-bridge2.0-0 \
  libatk1.0-0 libc6 libcairo2 libcups2 libdbus-1-3 libexpat1 \
  libfontconfig1 libgbm1 libgcc1 libglib2.0-0 libgtk-3-0 libnspr4 \
  libnss3 libpango-1.0-0 libpangocairo-1.0-0 libstdc++6 libx11-6 \
  libx11-xcb1 libxcb1 libxcomposite1 libxcursor1 libxdamage1 \
  libxext6 libxfixes3 libxi6 libxrandr2 libxrender1 libxss1 \
  libxtst6 lsb-release wget xdg-utils
```

*(Optional: If on a 1GB RAM instance like AWS `t2.micro`, add a 2GB swapfile so Chromium doesn't run out of memory:)*
```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
```

---

### Step 3: Clone or Upload Your Project

Upload your project folder to `/var/www/agri-dispatch` or clone it:
```bash
mkdir -p /var/www/agri-dispatch
cd /var/www/agri-dispatch

# (Upload or copy project files here)
```

Install project dependencies:
```bash
npm install
```

---

### Step 4: Open Port 3000 in Linux Firewall & Cloud Security List

In the server terminal:
```bash
sudo ufw allow 3000/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw reload
```

> **Note for Oracle Cloud / AWS users**: Also open port `3000` (Ingress Rule, TCP, 0.0.0.0/0) in your Cloud Security Group / Virtual Cloud Network (VCN) Ingress Rules.

---

### Step 5: Keep the Server Running 24/7 using PM2

Install **PM2** (Production Process Manager for Node.js):
```bash
sudo npm install -g pm2

# Start the application
pm2 start server.js --name "agri-dispatch"

# Configure PM2 to restart automatically on system reboot
pm2 startup
pm2 save
```

To view logs anytime:
```bash
pm2 logs agri-dispatch
```

---

## 3. Accessing Your Deployed Application

Once started, open your web browser and visit:
- **Home Portal**: `http://YOUR_SERVER_IP:3000`
- **Admin & WhatsApp Station**: `http://YOUR_SERVER_IP:3000/admin.html`
- **Vehicle Owner Registration**: `http://YOUR_SERVER_IP:3000/register.html`
- **Driver Duty Dashboard**: `http://YOUR_SERVER_IP:3000/dashboard.html`

### Linking WhatsApp:
1. Open `http://YOUR_SERVER_IP:3000/admin.html`.
2. Wait a few seconds for the QR code to appear.
3. Open WhatsApp on your phone > **Linked Devices > Link a Device** > scan the QR code on your screen.
4. The status will turn green (**CONNECTED**). Your server is now ready to dispatch instant booking confirmation messages!
