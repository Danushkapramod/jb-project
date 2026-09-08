const { Client, LocalAuth } = require('whatsapp-web.js');
const QRCode = require('qrcode');
const path = require('path');
const fs = require('fs');

function getChromiumExecutablePath() {
  if (process.env.PUPPETEER_EXECUTABLE_PATH && fs.existsSync(process.env.PUPPETEER_EXECUTABLE_PATH)) {
    return process.env.PUPPETEER_EXECUTABLE_PATH;
  }
  const candidates = [
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/google-chrome'
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return undefined; // fallback to Puppeteer bundled
}

class WhatsAppService {
  constructor() {
    this.client = null;
    this.status = 'NOT_INITIALIZED'; // NOT_INITIALIZED, INITIALIZING, WAITING_FOR_QR_SCAN, AUTHENTICATED, READY, DISCONNECTED
    this.qrCodeDataUrl = null;
    this.qrRaw = null;
    this.clientInfo = null;
    this.io = null;
    this.recentLogs = [];
  }

  setSocket(io) {
    this.io = io;
  }

  log(message, type = 'info') {
    const timestamp = new Date().toLocaleTimeString();
    const entry = { timestamp, message, type };
    this.recentLogs.unshift(entry);
    if (this.recentLogs.length > 50) this.recentLogs.pop();
    console.log(`[WhatsApp ${type.toUpperCase()}] ${message}`);
    if (this.io) {
      this.io.emit('whatsapp_log', entry);
    }
  }

  async initialize() {
    if (this.client) {
      try {
        await this.client.destroy();
      } catch (e) {}
      this.client = null;
    }

    this.status = 'INITIALIZING';
    this.log('Initializing WhatsApp Web client with Chromium...');
    if (this.io) {
      this.io.emit('whatsapp_status', this.getStatus());
    }

    const execPath = getChromiumExecutablePath();
    if (execPath) {
      this.log(`Using Chromium executable: ${execPath}`);
    }

    this.client = new Client({
      authStrategy: new LocalAuth({
        dataPath: path.resolve(__dirname, '../.wwebjs_auth')
      }),
      puppeteer: {
        headless: true,
        executablePath: execPath,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--disable-gpu'
        ]
      },
      webVersionCache: {
        type: 'remote',
        remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2412.54.html'
      }
    });

    this.client.on('qr', async (qr) => {
      this.status = 'WAITING_FOR_QR_SCAN';
      this.qrRaw = qr;
      this.log('New QR code received. Ready to scan from WhatsApp mobile app.');

      try {
        this.qrCodeDataUrl = await QRCode.toDataURL(qr, { width: 300, margin: 2 });
        if (this.io) {
          this.io.emit('whatsapp_status', this.getStatus());
        }
      } catch (err) {
        console.error('Failed to generate QR data URL:', err);
      }
    });

    this.client.on('authenticated', () => {
      this.status = 'AUTHENTICATED';
      this.log('WhatsApp authenticated successfully.');
      if (this.io) {
        this.io.emit('whatsapp_status', this.getStatus());
      }
    });

    this.client.on('auth_failure', (msg) => {
      this.status = 'AUTH_FAILURE';
      this.log(`WhatsApp authentication failed: ${msg}`, 'error');
      if (this.io) {
        this.io.emit('whatsapp_status', this.getStatus());
      }
    });

    this.client.on('ready', () => {
      this.status = 'READY';
      this.qrCodeDataUrl = null;
      this.qrRaw = null;
      this.clientInfo = this.client.info || {};
      const number = this.client.info ? this.client.info.wid.user : 'Unknown';
      this.log(`WhatsApp client is READY! Connected as: ${number}`, 'success');
      if (this.io) {
        this.io.emit('whatsapp_status', this.getStatus());
      }
    });

    this.client.on('disconnected', (reason) => {
      this.status = 'DISCONNECTED';
      this.clientInfo = null;
      this.log(`WhatsApp disconnected: ${reason}`, 'warn');
      if (this.io) {
        this.io.emit('whatsapp_status', this.getStatus());
      }
    });

    this.client.initialize().catch((err) => {
      this.status = 'ERROR';
      this.log(`Initialization error: ${err.message}`, 'error');
      if (this.io) {
        this.io.emit('whatsapp_status', this.getStatus());
      }
    });
  }

  getStatus() {
    return {
      status: this.status,
      qrCode: this.qrCodeDataUrl,
      info: this.clientInfo,
      logs: this.recentLogs.slice(0, 15)
    };
  }

  // Format phone number to WhatsApp JID (e.g. 94771234567@c.us)
  formatWhatsAppNumber(phone) {
    if (!phone) return null;
    let clean = phone.replace(/[^0-9]/g, '');

    // Handle standard Sri Lanka local format (077xxxxxxx -> 9477xxxxxxx)
    if (clean.startsWith('0') && clean.length === 10) {
      clean = '94' + clean.slice(1);
    } else if (clean.length === 9) {
      // 9 digits without leading 0 (e.g. 728649732 -> 94728649732)
      clean = '94' + clean;
    }

    if (!clean.endsWith('@c.us')) {
      clean += '@c.us';
    }
    return clean;
  }

  async sendBookingConfirmation(requesterPhone, owner, dispatch) {
    const formattedNumber = this.formatWhatsAppNumber(requesterPhone);
    if (!formattedNumber) {
      this.log(`Invalid phone number: ${requesterPhone}`, 'error');
      return { success: false, error: 'Invalid phone number' };
    }

    const message = `🚜 *AGRICULTURAL VEHICLE DISPATCH CONFIRMED* 🚜\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `Hello! Your booking for *${dispatch.vehicle_type}* has been *APPROVED*.\n\n` +
      `👨‍🌾 *Vehicle & Owner Details:*\n` +
      `• *Owner Name:* ${owner.name}\n` +
      `• *Contact Number:* ${owner.phone}\n` +
      `• *Vehicle Reg No:* ${owner.vehicle_reg_no}\n` +
      `• *Vehicle Type:* ${owner.vehicle_type}\n` +
      `• *Owner Location:* ${owner.location}\n\n` +
      `📅 *Booking Information:*\n` +
      `• *Date:* ${dispatch.date}\n` +
      `• *Destination Field/Area:* ${dispatch.location}\n` +
      `• *Notes:* ${dispatch.notes || 'None'}\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `The vehicle owner has been dispatched and will reach out to you.\n` +
      `_Agri-Vehicle Dispatch System_`;

    if (this.status !== 'READY' || !this.client) {
      this.log(`WhatsApp not connected. Message formatted & prepared for ${formattedNumber}.`, 'warn');
      return {
        success: false,
        warning: 'WhatsApp client is not currently connected. Message not sent via WhatsApp.',
        messageContent: message
      };
    }

    try {
      this.log(`Sending WhatsApp confirmation to ${formattedNumber}...`);
      const sent = await this.client.sendMessage(formattedNumber, message);
      this.log(`WhatsApp message delivered successfully to ${formattedNumber}`, 'success');
      return { success: true, messageId: sent.id._serialized, messageContent: message };
    } catch (err) {
      this.log(`Failed to send WhatsApp message to ${formattedNumber}: ${err.message}`, 'error');
      return { success: false, error: err.message, messageContent: message };
    }
  }
}

const whatsappService = new WhatsAppService();
module.exports = whatsappService;
