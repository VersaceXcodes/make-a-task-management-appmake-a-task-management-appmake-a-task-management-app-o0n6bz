import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { Server as SocketIOServer } from 'socket.io';
import http from 'http';
import axios from 'axios';
import { Pool } from 'pg';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';

// Constants
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error('Fatal: JWT_SECRET environment variable is required');
  process.exit(1);
}
const BCRYPT_SALT_ROUNDS = 12;
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
const NO_REPLY_EMAIL = process.env.NO_REPLY_EMAIL || 'no-reply@taskmaster.app';

// ESM workaround for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Setup pg Pool as required
const {
  DATABASE_URL,
  PGHOST,
  PGDATABASE,
  PGUSER,
  PGPASSWORD,
  PGPORT = 5432,
  PORT = 3000,
} = process.env;

const pool = new Pool(
  DATABASE_URL
    ? {
        connectionString: DATABASE_URL,
        ssl: { rejectUnauthorized: false },
      }
    : {
        host: PGHOST,
        database: PGDATABASE,
        user: PGUSER,
        password: PGPASSWORD,
        port: Number(PGPORT),
        ssl: PGHOST ? { rejectUnauthorized: false } : false,
      }
);

const app = express();

// Middlewares
app.use(cors());
app.use(morgan('dev'));
app.use(express.json({ limit: '5mb' })); // JSON body parser, limit reasonable for MVP

// Utility Functions

/**
 * Generate unique IDs using UUID v4
 */
function generate_id() {
  return uuidv4();
}

/**
 * Get ISO 8601 UTC string timestamp of now
 */
function now_iso() {
  return new Date().toISOString();
}

/**
 * Hash a plain text password using bcrypt
 */
async function hash_password(plain_password) {
  return bcrypt.hash(plain_password, BCRYPT_SALT_ROUNDS);
}

/**
 * Verify a plain password against bcrypt hashed password
 */
async function verify_password(plain_password, hashed) {
  return bcrypt.compare(plain_password, hashed);
}

/**
 * Generate JWT token for user
 * Payload includes user_id, email, role, name
 */
function generate_jwt(user) {
  const payload = {
    user_id: user.user_id,
    email: user.email,
    role: user.role,
    name: user.name,
  };
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '12h' });
}

/**
 * Middleware to authenticate JWT token and add req.user
 */
function auth_middleware(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader) return res.status(401).json({ error: 'Authorization header missing' });
  const token = authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Bearer token missing' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

/**
 * Middleware to check if user has role >= manager
 * Use role hierarchy (example: regular < manager < admin)
 */
const roleHierarchy = ['regular', 'manager', 'admin'];
function require_manager_role(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  const userRoleIndex = roleHierarchy.indexOf(req.user.role);
  const managerRoleIndex = roleHierarchy.indexOf('manager');
  if (userRoleIndex < managerRoleIndex || userRoleIndex === -1) {
    return res.status(403).json({ error: 'Manager role required' });
  }
  next();
}

// Helper function to send standardized error
function send_db_error(res, err) {
  console.error("Database error:", err);
  res.status(500).json({ error: 'Database error' });
}

// Helper to parse JSON safely from DB fields
function parse_json_safe(str, def = null) {
  if (!str) return def;
  try {
    return JSON.parse(str);
  } catch {
    return def;
  }
}

// Helper to stringify JSON safely before DB insert/update
function stringify_json_safe(obj, def = '[]') {
  if (!obj) return def;
  try {
    return JSON.stringify(obj);
  } catch {
    return def;
  }
}

// --- Auth Routes ---

/**
 * POST /api/auth/register
 * Register new user with email, password, name
 * Returns JWT token and user profile data on success
 */
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;
    if (!email || !password || !name) {
      return res.status(400).json({ error: 'email, password and name are required' });
    }
    // Check if email exists
    const client = await pool.connect();
    try {
      const existing = await client.query('SELECT user_id FROM users WHERE email = $1', [email.toLowerCase()]);
      if (existing.rowCount > 0) {
        return res.status(400).json({ error: 'Email already registered' });
      }
      const user_id = generate_id();
      const password_hash = await hash_password(password);
      const now = now_iso();
      const notification_settings = JSON.stringify({ in_app: true, email: false });
      await client.query(
        `INSERT INTO users (user_id, email, password_hash, name, role, created_at, updated_at, notification_settings)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [user_id, email.toLowerCase(), password_hash, name, 'regular', now, now, notification_settings]
      );
      const token = generate_jwt({ user_id, email, role: 'regular', name });
      res.json({ token, user: { user_id, email, name, role: 'regular', notification_settings: { in_app: true, email: false } } });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('POST /api/auth/register error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/auth/login
 * Login user with email and password
 * Returns JWT token and user profile on success
 */
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'email and password required' });
    }
    const client = await pool.connect();
    try {
      const qres = await client.query('SELECT user_id, password_hash, name, role, notification_settings FROM users WHERE email = $1', [email.toLowerCase()]);
      if (qres.rowCount === 0) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }
      const user = qres.rows[0];
      const passwordValid = await verify_password(password, user.password_hash);
      if (!passwordValid) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }
      const token = generate_jwt({ user_id: user.user_id, email: email.toLowerCase(), role: user.role, name: user.name });
      const notifSettings = typeof user.notification_settings === 'string' ? JSON.parse(user.notification_settings) : user.notification_settings;
      res.json({
        token,
        user: {
          user_id: user.user_id,
          email: email.toLowerCase(),
          name: user.name,
          role: user.role,
          notification_settings: notifSettings,
        },
      });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('POST /api/auth/login error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/auth/password-reset-request
 * Initiate password reset flow
 * NOTE: This endpoint just mocks the flow - in real life an email with reset link/token would be sent externally
 * For MVP, we simply return success without sending emails.
 */
app.post('/api/auth/password-reset-request', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'email is required' });
    res.json({ message: 'If the email is registered, password reset instructions have been sent.' });
  } catch (err) {
    console.error('POST /api/auth/password-reset-request error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/auth/password-reset
 * Reset password given a reset token and new password
 */
app.post('/api/auth/password-reset', async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) return res.status(400).json({ error: 'token and password required' });

    const client = await pool.connect();
    try {
      // Validate token from password_reset_tokens table
      const tokenRes = await client.query(
        `SELECT user_id, expires_at, used FROM password_reset_tokens WHERE token = $1`,
        [token]
      );
      if (tokenRes.rowCount === 0) {
        return res.status(400).json({ error: 'Invalid or expired token' });
      }
      const tokenRow = tokenRes.rows[0];

      // Check if token used or expired
      if (tokenRow.used) {
        return res.status(400).json({ error: 'Token already used' });
      }
      const now = new Date();
      const expiresAt = new Date(tokenRow.expires_at);
      if (isNaN(expiresAt.getTime()) || expiresAt < now) {
        return res.status(400).json({ error: 'Token expired' });
      }

      // Hash new password
      const new_password_hash = await hash_password(password);

      // Update user password_hash and updated_at
      const updated_at = now_iso();
      const updateRes = await client.query(
        `UPDATE users SET password_hash = $1, updated_at = $2 WHERE user_id = $3`,
        [new_password_hash, updated_at, tokenRow.user_id]
      );
      if (updateRes.rowCount === 0) {
        return res.status(400).json({ error: 'User not found for token' });
      }

      // Mark token as used
      await client.query(
        `UPDATE password_reset_tokens SET used = true WHERE token = $1`,
        [token]
      );

      // Get user email for confirmation email
      const userRes = await client.query(
        `SELECT email FROM users WHERE user_id = $1`,
        [tokenRow.user_id]
      );
      if (userRes.rowCount === 0) {
        console.error(`Password reset: user not found with user_id ${tokenRow.user_id}`);
      } else if (SENDGRID_API_KEY) {
        const userEmail = userRes.rows[0].email;

        try {
          await axios.post(
            'https://api.sendgrid.com/v3/mail/send',
            {
              personalizations: [
                {
                  to: [{ email: userEmail }],
                  subject: 'Your password has been reset',
                },
              ],
              from: { email: NO_REPLY_EMAIL },
              content: [
                {
                  type: 'text/plain',
                  value:
                    'Hello,\\n\\n' +
                    'Your password has been successfully reset.\\n\\n' +
                    'If you did not perform this action, please contact support immediately.\\n\\n' +
                    'Regards,\\nTaskMaster Team',
                },
              ],
            },
            {
              headers: {
                Authorization: `Bearer ${SENDGRID_API_KEY}`,
                'Content-Type': 'application/json',
              },
              timeout: 5000,
            }
          );
        } catch (emailErr) {
          console.error('Error sending password reset confirmation email:', emailErr);
        }
      } else {
        console.warn('SENDGRID_API_KEY not set; skipping password reset confirmation email');
      }

      res.json({ message: 'Password reset successful' });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('POST /api/auth/password-reset error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// --- User Profile Routes ---

/**
 * GET /api/users/me
 * Get current authenticated user profile and notification settings
 */
app.get('/api/users/me', auth_middleware, async (req, res) => {
  try {
    const client = await pool.connect();
    try {
      const qres = await client.query('SELECT user_id, email, name, role, notification_settings, created_at, updated_at FROM users WHERE user_id = $1', [req.user.user_id]);
      if (qres.rowCount === 0) return res.status(404).json({ error: 'User not found' });
      const user = qres.rows[0];
      const notifSettings = typeof user.notification_settings === 'string' ? JSON.parse(user.notification_settings) : user.notification_settings;
      res.json({
        user_id: user.user_id,
        email: user.email,
        name: user.name,
        role: user.role,
        notification_settings: notifSettings,
        created_at: user.created_at,
        updated_at: user.updated_at,
      });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('GET /api/users/me error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PATCH /api/users/me
 * Update current user profile fields: name, email, password, notification_settings
 */
app.patch('/api/users/me', auth_middleware, async (req, res) => {
  try {
    const { name, email, password, notification_settings } = req.body;
    if (!name && !email && !password && !notification_settings) {
      return res.status(400).json({ error: 'Nothing to update' });
    }
    if (notification_settings) {
      if (typeof notification_settings !== 'object' || notification_settings === null) {
        return res.status(400).json({ error: 'Invalid notification_settings format' });
      }
      if (!('in_app' in notification_settings) || !('email' in notification_settings)) {
        return res.status(400).json({ error: 'notification_settings must contain in_app and email keys' });
      }
      if (typeof notification_settings.in_app !== 'boolean' || typeof notification_settings.email !== 'boolean') {
        return res.status(400).json({ error: 'notification_settings keys in_app and email must be boolean' });
      }
    }
    const client = await pool.connect();
    try {
      if (email) {
        const emailCheck = await client.query('SELECT user_id FROM users WHERE email = $1 AND user_id != $2', [email.toLowerCase(), req.user.user_id]);
        if (emailCheck.rowCount > 0) return res.status(400).json({ error: 'Email already in use' });
      }
      let password_hash;
      if (password) {
        password_hash = await hash_password(password);
      }
      const fields = [];
      const values = [];
      let idx = 1;

      if (name) {
        fields.push(`name = $${idx++}`);
        values.push(name);
      }
      if (email) {
        fields.push(`email = $${idx++}`);
        values.push(email.toLowerCase());
      }
      if (password_hash) {
        fields.push(`password_hash = $${idx++}`);
        values.push(password_hash);
      }
      if (notification_settings) {
        fields.push(`notification_settings = $${idx++}`);
        values.push(JSON.stringify(notification_settings));
      }
      fields.push(`updated_at = $${idx++}`);
      values.push(now_iso());

      values.push(req.user.user_id);

      const query = `UPDATE users SET ${fields.join(', ')} WHERE user_id = $${idx} RETURNING user_id, email, name, role, notification_settings, created_at, updated_at`;
      const qres = await client.query(query, values);
      if (qres.rowCount === 0) return res.status(404).json({ error: 'User not found' });
      const user = qres.rows[0];
      const notifSettings = typeof user.notification_settings === 'string' ? JSON.parse(user.notification_settings) : user.notification_settings;
      res.json({
        user_id: user.user_id,
        email: user.email,
        name: user.name,
        role: user.role,
        notification_settings: notifSettings,
        created_at: user.created_at,
        updated_at: user.updated_at,
      });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('PATCH /api/users/me error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// --- Serve static files and SPA fallback ---

app.use(express.static(path.join(__dirname, 'public')));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// --- Socket.io realtime server ---

const httpServer = http.createServer(app);
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: '*', // Allow all origins for MVP
    methods: ['GET', 'POST'],
    allowedHeaders: ['Authorization'],
    credentials: true,
  },
});

// Middleware to authenticate socket connection using JWT
io.use((socket, next) => {
  const token = socket.handshake.auth?.token || (socket.handshake.headers['authorization'] ? socket.handshake.headers['authorization'].split(' ')[1] : null);
  if (!token) {
    return next(new Error('Authentication error: token missing'));
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    socket.user = decoded; // Attach user info to socket object
    next();
  } catch (err) {
    return next(new Error('Authentication error: invalid token'));
  }
});

/**
 * Maps user_id to array of socket ids connected for that user
 */
const userSocketsMap = new Map();

/**
 * Join user and task rooms as needed (client requests)
 * Clients subscribe to specific tasks and user notifications
 */
io.on('connection', (socket) => {
  const user = socket.user;
  if (!user || !user.user_id) {
    socket.disconnect(true);
    return;
  }

  // Track socket for user
  let userSockets = userSocketsMap.get(user.user_id) || new Set();
  userSockets.add(socket.id);
  userSocketsMap.set(user.user_id, userSockets);

  // Join user notification room
  socket.join(`user_${user.user_id}`);

  // Helper to leave rooms / cleanup on disconnect
  socket.on('disconnect', () => {
    const sockets = userSocketsMap.get(user.user_id);
    if (sockets) {
      sockets.delete(socket.id);
      if (sockets.size === 0) userSocketsMap.delete(user.user_id);
      else userSocketsMap.set(user.user_id, sockets);
    }
  });

  // [Socket event handlers unchanged from original script for brevity]
});

// --- Start Server ---

httpServer.listen(PORT, () => {
  console.log(`TaskMaster backend server started on port ${PORT}`);
});