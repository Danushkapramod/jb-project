const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { dbAsync } = require('../db');
const whatsappService = require('../services/whatsapp');

const JWT_SECRET = process.env.JWT_SECRET || 'agri_vehicle_super_secret_jwt_key_2026';

// Supported Vehicle Types (including ESP32 Hardware Gadget choices)
const ALLOWED_VEHICLE_TYPES = [
  'Tractor',
  'Harvester',
  'PowerTiller',
  'WaterPump',
  'Rotavator',
  'Lorry',
  'Combine Harvester',
  'Water Bowser'
];

// Middleware to authenticate JWT token
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token.' });
    }
    req.user = user;
    next();
  });
}

// -------------------------------------------------------------
// AUTHENTICATION ENDPOINTS
// -------------------------------------------------------------

// POST /api/auth/register - Register a new vehicle owner
router.post('/auth/register', async (req, res) => {
  try {
    const { name, email, password, phone, vehicleRegNo, vehicleType, location } = req.body;

    // Validate required fields
    if (!name || !email || !password || !phone || !vehicleRegNo || !vehicleType || !location) {
      return res.status(400).json({ error: 'All fields are required.' });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      return res.status(400).json({ error: 'Invalid email address format.' });
    }

    // Validate vehicle type
    if (!ALLOWED_VEHICLE_TYPES.includes(vehicleType)) {
      return res.status(400).json({
        error: `Invalid vehicle type. Allowed types: ${ALLOWED_VEHICLE_TYPES.join(', ')}`
      });
    }

    // Check duplicate email
    const existingUser = await dbAsync.get('SELECT id FROM users WHERE email = ?', [email.trim().toLowerCase()]);
    if (existingUser) {
      return res.status(400).json({ error: 'An owner with this email is already registered.' });
    }

    // Check password length
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
    }

    // Hash password
    const salt = bcrypt.genSaltSync(10);
    const passwordHash = bcrypt.hashSync(password, salt);

    // Insert new user
    const result = await dbAsync.run(
      `INSERT INTO users (name, email, password_hash, phone, vehicle_reg_no, vehicle_type, location)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        name.trim(),
        email.trim().toLowerCase(),
        passwordHash,
        phone.trim(),
        vehicleRegNo.trim(),
        vehicleType,
        location.trim()
      ]
    );

    const newUser = {
      id: result.lastID,
      name: name.trim(),
      email: email.trim().toLowerCase(),
      phone: phone.trim(),
      vehicle_reg_no: vehicleRegNo.trim(),
      vehicle_type: vehicleType,
      location: location.trim()
    };

    const token = jwt.sign(newUser, JWT_SECRET, { expiresIn: '7d' });

    res.status(201).json({
      message: 'Vehicle owner registered successfully!',
      token,
      user: newUser
    });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ error: 'Internal server error during registration.' });
  }
});

// POST /api/auth/login - Log in an existing vehicle owner
router.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const user = await dbAsync.get('SELECT * FROM users WHERE email = ?', [email.trim().toLowerCase()]);
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const isMatch = bcrypt.compareSync(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const safeUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      vehicle_reg_no: user.vehicle_reg_no,
      vehicle_type: user.vehicle_type,
      location: user.location
    };

    const token = jwt.sign(safeUser, JWT_SECRET, { expiresIn: '7d' });

    res.json({
      message: 'Login successful!',
      token,
      user: safeUser
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error during login.' });
  }
});

// GET /api/auth/me - Get current logged-in owner profile
router.get('/auth/me', authenticateToken, async (req, res) => {
  try {
    const user = await dbAsync.get(
      'SELECT id, name, email, phone, vehicle_reg_no, vehicle_type, location, created_at FROM users WHERE id = ?',
      [req.user.id]
    );
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }
    res.json({ user });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch user profile.' });
  }
});

// -------------------------------------------------------------
// DISPATCH & VEHICLE BOOKING ENDPOINTS
// -------------------------------------------------------------

// POST /api/dispatch - Incoming external API call for vehicle request
// Parameters: requesterPhone, vehicleType, date, location, notes
router.post('/dispatch', async (req, res) => {
  try {
    const { requesterPhone, vehicleType, date } = req.body;
    const location = (req.body.location || 'Field Station Plot 1').trim();
    const notes = (req.body.notes || 'Requested via ESP32 Hardware Gadget').trim();

    if (!requesterPhone || !vehicleType || !date) {
      return res.status(400).json({
        error: 'Missing required parameters: requesterPhone, vehicleType, and date are required.'
      });
    }

    if (!ALLOWED_VEHICLE_TYPES.includes(vehicleType)) {
      return res.status(400).json({
        error: `Invalid vehicleType. Must be one of: ${ALLOWED_VEHICLE_TYPES.join(', ')}`
      });
    }

    const dispatchId = `REQ-${Date.now().toString().slice(-6)}-${Math.floor(1000 + Math.random() * 9000)}`;

    await dbAsync.run(
      `INSERT INTO dispatches (id, requester_phone, vehicle_type, date, location, notes, status)
       VALUES (?, ?, ?, ?, ?, ?, 'PENDING')`,
      [dispatchId, requesterPhone.trim(), vehicleType, date, location, notes]
    );

    const dispatchPayload = {
      id: dispatchId,
      requesterPhone: requesterPhone.trim(),
      vehicleType,
      date,
      location,
      notes,
      status: 'PENDING',
      createdAt: new Date().toISOString()
    };

    // Broadcast to connected vehicle owners matching this vehicle type via Socket.io
    const io = req.app.get('io');
    if (io) {
      io.emit('new_job_request', dispatchPayload);
    }

    res.status(201).json({
      success: true,
      message: `Job request broadcasted to all registered ${vehicleType} owners!`,
      dispatch: dispatchPayload
    });
  } catch (err) {
    console.error('Dispatch creation error:', err);
    res.status(500).json({ error: 'Failed to initiate dispatch request.' });
  }
});

// POST /api/dispatch/:id/approve - Approve a job (First-Come First-Served Lock)
router.post('/dispatch/:id/approve', authenticateToken, async (req, res) => {
  const dispatchId = req.params.id;
  const ownerId = req.user.id;

  try {
    // 1. Check current status in DB
    const dispatch = await dbAsync.get('SELECT * FROM dispatches WHERE id = ?', [dispatchId]);
    if (!dispatch) {
      return res.status(404).json({ success: false, error: 'Dispatch request not found.' });
    }

    // 2. Lock check: If already approved or not pending
    if (dispatch.status !== 'PENDING') {
      return res.status(409).json({
        success: false,
        error: 'Sorry! This request has already been claimed by another vehicle owner.'
      });
    }

    // 3. Atomically update status to APPROVED
    const updateResult = await dbAsync.run(
      `UPDATE dispatches 
       SET status = 'APPROVED', approved_by_user_id = ?, approved_at = CURRENT_TIMESTAMP
       WHERE id = ? AND status = 'PENDING'`,
      [ownerId, dispatchId]
    );

    if (updateResult.changes === 0) {
      return res.status(409).json({
        success: false,
        error: 'Race condition: Another owner accepted this job just milliseconds before you!'
      });
    }

    // 4. Retrieve owner profile details with fallbacks
    let owner = await dbAsync.get(
      'SELECT id, name, phone, vehicle_reg_no, vehicle_type, location FROM users WHERE id = ?',
      [ownerId]
    );

    if (!owner && req.user && req.user.email) {
      owner = await dbAsync.get(
        'SELECT id, name, phone, vehicle_reg_no, vehicle_type, location FROM users WHERE email = ?',
        [req.user.email]
      );
    }

    if (!owner) {
      owner = {
        id: ownerId,
        name: (req.user && req.user.name) || 'Vehicle Owner',
        phone: (req.user && req.user.phone) || 'Not specified',
        vehicle_reg_no: (req.user && req.user.vehicle_reg_no) || 'Not specified',
        vehicle_type: dispatch.vehicle_type,
        location: (req.user && req.user.location) || 'Not specified'
      };
    }

    // 5. Emit socket event to all clients so other owners' popups automatically close/lock
    const io = req.app.get('io');
    if (io) {
      io.emit('job_locked', {
        dispatchId,
        approvedBy: owner.name,
        approvedByUserId: owner.id,
        vehicleType: dispatch.vehicle_type
      });
    }

    // 6. Send organized WhatsApp confirmation message to the requester in background
    whatsappService.sendBookingConfirmation(
      dispatch.requester_phone,
      owner,
      dispatch
    ).then((result) => {
      console.log('WhatsApp booking confirmation result:', result);
    }).catch((waErr) => {
      console.error('WhatsApp dispatch warning:', waErr.message);
    });

    res.json({
      success: true,
      message: 'Job request approved! Requester has been notified via WhatsApp.',
      dispatchId,
      owner
    });
  } catch (err) {
    console.error('Approval error:', err);
    res.status(500).json({ success: false, error: err.message || 'Failed to process approval.' });
  }
});

// POST /api/dispatch/:id/deny - Dismiss/deny the pop-up locally
router.post('/dispatch/:id/deny', authenticateToken, async (req, res) => {
  res.json({ success: true, message: 'Request denied/dismissed on this device.' });
});

// GET /api/dispatch/my-jobs - Get list of jobs accepted by the logged-in owner
router.get('/dispatch/my-jobs', authenticateToken, async (req, res) => {
  try {
    const jobs = await dbAsync.all(
      `SELECT * FROM dispatches WHERE approved_by_user_id = ? ORDER BY approved_at DESC`,
      [req.user.id]
    );
    res.json({ jobs });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch your jobs history.' });
  }
});

// GET /api/dispatch/pending - Get active unclaimed dispatches matching the logged-in owner's vehicle type
router.get('/dispatch/pending', authenticateToken, async (req, res) => {
  try {
    const user = await dbAsync.get('SELECT vehicle_type FROM users WHERE id = ?', [req.user.id]);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found.' });
    }

    const pending = await dbAsync.all(
      `SELECT * FROM dispatches 
       WHERE status = 'PENDING' AND vehicle_type = ? 
       ORDER BY created_at DESC LIMIT 30`,
      [user.vehicle_type]
    );

    res.json({ success: true, vehicleType: user.vehicle_type, count: pending.length, pending });
  } catch (err) {
    console.error('Pending dispatches fetch error:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch pending requests.' });
  }
});

// GET /api/dispatch/:id/status - Status check for IoT devices (ESP32) & external callers
router.get('/dispatch/:id/status', async (req, res) => {
  const dispatchId = req.params.id;
  try {
    const dispatch = await dbAsync.get(
      `SELECT d.*, u.name as approved_owner_name, u.phone as approved_owner_phone, u.vehicle_reg_no
       FROM dispatches d
       LEFT JOIN users u ON d.approved_by_user_id = u.id
       WHERE d.id = ?`,
      [dispatchId]
    );

    if (!dispatch) {
      return res.status(404).json({ success: false, status: 'NOT_FOUND', error: 'Dispatch request not found.' });
    }

    res.json({
      success: true,
      id: dispatch.id,
      status: dispatch.status,
      vehicleType: dispatch.vehicle_type,
      date: dispatch.date,
      location: dispatch.location,
      notes: dispatch.notes,
      driverName: dispatch.approved_owner_name || null,
      driverPhone: dispatch.approved_owner_phone || null,
      vehicleRegNo: dispatch.vehicle_reg_no || null
    });
  } catch (err) {
    console.error('Dispatch status query error:', err);
    res.status(500).json({ success: false, error: 'Failed to retrieve dispatch status.' });
  }
});

// GET /api/dispatch/all - Get all dispatches (for Admin monitoring)
router.get('/dispatch/all', async (req, res) => {
  try {
    const dispatches = await dbAsync.all(
      `SELECT d.*, u.name as approved_owner_name, u.phone as approved_owner_phone, u.vehicle_reg_no
       FROM dispatches d
       LEFT JOIN users u ON d.approved_by_user_id = u.id
       ORDER BY d.created_at DESC LIMIT 50`
    );
    res.json({ dispatches });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch dispatches.' });
  }
});

// DELETE /api/dispatch/:id - Remove a single test or unwanted dispatch request
router.delete('/dispatch/:id', async (req, res) => {
  const dispatchId = req.params.id;
  try {
    const dispatch = await dbAsync.get('SELECT * FROM dispatches WHERE id = ?', [dispatchId]);
    if (!dispatch) {
      return res.status(404).json({ success: false, error: 'Dispatch request not found.' });
    }

    await dbAsync.run('DELETE FROM dispatches WHERE id = ?', [dispatchId]);

    const io = req.app.get('io');
    if (io) {
      io.emit('dispatch_deleted', { id: dispatchId });
    }

    res.json({ success: true, message: `Dispatch ${dispatchId} removed successfully.` });
  } catch (err) {
    console.error('Delete dispatch error:', err);
    res.status(500).json({ success: false, error: 'Failed to delete dispatch.' });
  }
});

// POST /api/dispatch/:id/delete - Compatible fallback for POST-only environments
router.post('/dispatch/:id/delete', async (req, res) => {
  const dispatchId = req.params.id;
  try {
    const dispatch = await dbAsync.get('SELECT * FROM dispatches WHERE id = ?', [dispatchId]);
    if (!dispatch) {
      return res.status(404).json({ success: false, error: 'Dispatch request not found.' });
    }

    await dbAsync.run('DELETE FROM dispatches WHERE id = ?', [dispatchId]);

    const io = req.app.get('io');
    if (io) {
      io.emit('dispatch_deleted', { id: dispatchId });
    }

    res.json({ success: true, message: `Dispatch ${dispatchId} removed successfully.` });
  } catch (err) {
    console.error('Delete dispatch error:', err);
    res.status(500).json({ success: false, error: 'Failed to delete dispatch.' });
  }
});

// POST /api/dispatch/clear-all - Delete all dispatches (for cleaning test data)
router.post('/dispatch/clear-all', async (req, res) => {
  try {
    const result = await dbAsync.run('DELETE FROM dispatches');
    const io = req.app.get('io');
    if (io) {
      io.emit('all_dispatches_cleared');
    }
    res.json({ success: true, message: 'All dispatches cleared successfully.', deletedCount: result.changes });
  } catch (err) {
    console.error('Clear all dispatches error:', err);
    res.status(500).json({ success: false, error: 'Failed to clear dispatches.' });
  }
});


// -------------------------------------------------------------
// WHATSAPP WEB STATUS & CONTROL ENDPOINTS
// -------------------------------------------------------------

// GET /api/whatsapp/status - Check WhatsApp connection status & QR code
router.get('/whatsapp/status', (req, res) => {
  res.json(whatsappService.getStatus());
});

// POST /api/whatsapp/reconnect - Trigger WhatsApp reconnect (non-blocking)
router.post('/whatsapp/reconnect', (req, res) => {
  res.json({ success: true, message: 'WhatsApp session restart initiated. Restarting Chromium engine...' });
  whatsappService.initialize(true).catch((err) => {
    console.error('Background reconnect error:', err);
  });
});


// POST /api/whatsapp/disconnect - Force logout, purge local session files, and generate a new QR code
router.post(['/whatsapp/disconnect', '/whatsapp/logout'], (req, res) => {
  res.json({ success: true, message: 'WhatsApp session disconnect initiated. Purging stored credentials and restarting engine...' });
  whatsappService.disconnectAndClearSession().catch((err) => {
    console.error('Background disconnect error:', err);
  });
});

// POST /api/whatsapp/test-message or test_message - Send a quick custom WhatsApp message to test connectivity
router.post(['/whatsapp/test-message', '/whatsapp/test_message'], async (req, res) => {
  const { phone, message } = req.body;
  if (!phone || !message) {
    return res.status(400).json({ success: false, error: 'Phone number and message text are required.' });
  }

  const result = await whatsappService.sendMessageDirect(phone, message);
  if (result.success) {
    res.json({ success: true, message: 'Message sent successfully via WhatsApp!', messageId: result.messageId });
  } else {
    res.status(400).json({ success: false, error: result.error || result.warning || 'Failed to deliver WhatsApp message' });
  }
});

// POST /api/auth/clear-user - Remove a user to allow re-registration if needed
router.post('/auth/clear-user', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required.' });
  try {
    await dbAsync.run('DELETE FROM users WHERE email = ?', [email.trim().toLowerCase()]);
    res.json({ success: true, message: `Account ${email} cleared. You can now register fresh!` });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
