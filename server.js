require('dotenv').config();
const express = require('express');
const http = require('http');
const path = require('path');
const cors = require('cors');
const { Server } = require('socket.io');

const apiRoutes = require('./routes/api');
const whatsappService = require('./services/whatsapp');
require('./db'); // Initialize SQLite tables

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Attach io to express app so routes can access it
app.set('io', io);

// Attach io to whatsappService for status broadcasts
whatsappService.setSocket(io);

// Robust CORS handling for Netlify and all origins
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Origin', 'X-Requested-With', 'Content-Type', 'Accept', 'Authorization']
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static frontend files
app.use(express.static(path.join(__dirname, 'public')));

// Health Check Endpoints for Render
app.get('/health', (req, res) => res.status(200).send('OK'));
app.get('/api/health', (req, res) => res.status(200).json({ status: 'ok', uptime: process.uptime() }));

// API Routes
app.use('/api', apiRoutes);

// Catch unhandled errors gracefully to prevent server exiting
process.on('uncaughtException', (err) => {
  console.error('⚠️ Uncaught Exception:', err.message);
});
process.on('unhandledRejection', (reason) => {
  console.error('⚠️ Unhandled Rejection:', reason);
});

// Socket.io Real-time Handling
io.on('connection', (socket) => {
  console.log(`🔌 New client connected: ${socket.id}`);

  // Send initial WhatsApp status upon connection
  socket.emit('whatsapp_status', whatsappService.getStatus());

  // Owner dashboard registers their vehicle type for targeted dispatch alerts
  socket.on('register_driver', (data) => {
    if (data && data.vehicleType) {
      socket.join(`vehicle_${data.vehicleType}`);
      console.log(`🚜 Driver ${data.name || socket.id} joined room: vehicle_${data.vehicleType}`);
    }
  });

  socket.on('disconnect', () => {
    console.log(`🔌 Client disconnected: ${socket.id}`);
  });
});

// Initialize WhatsApp Web Client
whatsappService.initialize();

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`🌾 AGRI-VEHICLE DISPATCH SYSTEM SERVER IS RUNNING! 🌾`);
  console.log(`📡 Local: http://localhost:${PORT}`);
  console.log(`🚜 Owner Portal: http://localhost:${PORT}/dashboard.html`);
  console.log(`📱 Admin & WhatsApp Station: http://localhost:${PORT}/admin.html`);
  console.log(`=======================================================`);
});
