const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('.'));

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image and video files are allowed'));
    }
  }
});

// Initialize database
const db = new sqlite3.Database('campus360.db', (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
  } else {
    console.log('Connected to SQLite database');
    initializeDatabase();
  }
});

// Initialize database tables
function initializeDatabase() {
  // Users table
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT DEFAULT 'student',
    name TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`, (err) => {
    if (err) {
      console.error('Error creating users table:', err.message);
    } else {
      console.log('Users table ready');
      // Create default admin user
      createDefaultAdmin();
    }
  });

  // Issues table
  db.run(`CREATE TABLE IF NOT EXISTS issues (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    issue_id TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    location TEXT NOT NULL,
    description TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    reported_by TEXT NOT NULL,
    reported_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    resolved_at DATETIME,
    attachments TEXT,
    FOREIGN KEY (reported_by) REFERENCES users(email)
  )`, (err) => {
    if (err) {
      console.error('Error creating issues table:', err.message);
    } else {
      console.log('Issues table ready');
    }
  });

  // Contacts table
  db.run(`CREATE TABLE IF NOT EXISTS contacts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    message TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`, (err) => {
    if (err) {
      console.error('Error creating contacts table:', err.message);
    } else {
      console.log('Contacts table ready');
    }
  });
}

// Create default admin user
function createDefaultAdmin() {
  const adminEmail = 'admin@drait.edu.in';
  const adminPassword = 'principal123';
  
  db.get('SELECT * FROM users WHERE email = ?', [adminEmail], (err, row) => {
    if (err) {
      console.error('Error checking admin user:', err.message);
      return;
    }
    
    if (!row) {
      bcrypt.hash(adminPassword, 10, (err, hash) => {
        if (err) {
          console.error('Error hashing admin password:', err.message);
          return;
        }
        
        db.run('INSERT INTO users (email, password, role, name) VALUES (?, ?, ?, ?)',
          [adminEmail, hash, 'admin', 'Administrator'],
          (err) => {
            if (err) {
              console.error('Error creating admin user:', err.message);
            } else {
              console.log('Default admin user created (admin@drait.edu.in / principal123)');
            }
          }
        );
      });
    }
  });
}

// Authentication middleware
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
}

// Admin middleware
function requireAdmin(req, res, next) {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

// Generate issue ID
function generateIssueId(callback) {
  db.get('SELECT COUNT(*) as count FROM issues', (err, row) => {
    if (err) {
      return callback(err, null);
    }
    const issueId = 'ISS' + String(row.count + 1).padStart(4, '0');
    callback(null, issueId);
  });
}

// Routes

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Campus360 API is running' });
});

// User Registration
app.post('/api/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;

    // Validate email domain
    if (!email || !email.endsWith('@drait.edu.in')) {
      return res.status(400).json({ error: 'Only @drait.edu.in email addresses are allowed' });
    }

    if (!password || password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    // Check if user exists
    db.get('SELECT * FROM users WHERE email = ?', [email], async (err, row) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }

      if (row) {
        return res.status(400).json({ error: 'User already exists' });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Create user
      db.run('INSERT INTO users (email, password, name, role) VALUES (?, ?, ?, ?)',
        [email, hashedPassword, name || email.split('@')[0], 'student'],
        function(err) {
          if (err) {
            return res.status(500).json({ error: 'Error creating user' });
          }

          // Generate token
          const token = jwt.sign(
            { id: this.lastID, email, role: 'student' },
            JWT_SECRET,
            { expiresIn: '7d' }
          );

          res.status(201).json({
            message: 'User registered successfully',
            token,
            user: { email, role: 'student', name: name || email.split('@')[0] }
          });
        }
      );
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// User Login
app.post('/api/login', (req, res) => {
  const { email, password } = req.body;

  if (!email || !email.endsWith('@drait.edu.in')) {
    return res.status(400).json({ error: 'Only @drait.edu.in email addresses are allowed' });
  }

  db.get('SELECT * FROM users WHERE email = ?', [email], async (err, row) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }

    if (!row) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const validPassword = await bcrypt.compare(password, row.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Generate token
    const token = jwt.sign(
      { id: row.id, email: row.email, role: row.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      message: 'Login successful',
      token,
      user: {
        email: row.email,
        role: row.role,
        name: row.name
      }
    });
  });
});

// Get current user
app.get('/api/me', authenticateToken, (req, res) => {
  db.get('SELECT id, email, role, name, created_at FROM users WHERE id = ?', [req.user.id], (err, row) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    if (!row) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ user: row });
  });
});

// Submit Issue
app.post('/api/issues', authenticateToken, upload.array('attachments', 5), (req, res) => {
  const { title, category, location, description } = req.body;

  if (!title || !category || !location || !description) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  generateIssueId((err, issueId) => {
    if (err) {
      return res.status(500).json({ error: 'Error generating issue ID' });
    }

    const attachments = req.files ? req.files.map(f => f.filename).join(',') : null;

    db.run(
      `INSERT INTO issues (issue_id, title, category, location, description, reported_by, attachments)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [issueId, title, category, location, description, req.user.email, attachments],
      function(err) {
        if (err) {
          return res.status(500).json({ error: 'Error submitting issue' });
        }

        res.status(201).json({
          message: 'Issue submitted successfully',
          issue: {
            id: issueId,
            title,
            category,
            location,
            status: 'pending'
          }
        });
      }
    );
  });
});

// Get all issues (with filters)
app.get('/api/issues', authenticateToken, (req, res) => {
  const { category, status, limit = 50 } = req.query;
  let query = 'SELECT * FROM issues WHERE 1=1';
  const params = [];

  if (req.user.role !== 'admin') {
    query += ' AND reported_by = ?';
    params.push(req.user.email);
  }

  if (category) {
    query += ' AND category = ?';
    params.push(category);
  }

  if (status) {
    query += ' AND status = ?';
    params.push(status);
  }

  query += ' ORDER BY reported_at DESC LIMIT ?';
  params.push(parseInt(limit));

  db.all(query, params, (err, rows) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    res.json({ issues: rows });
  });
});

// Get single issue
app.get('/api/issues/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  let query = 'SELECT * FROM issues WHERE issue_id = ?';
  const params = [id];

  if (req.user.role !== 'admin') {
    query += ' AND reported_by = ?';
    params.push(req.user.email);
  }

  db.get(query, params, (err, row) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    if (!row) {
      return res.status(404).json({ error: 'Issue not found' });
    }
    res.json({ issue: row });
  });
});

// Update issue status (Admin only)
app.patch('/api/issues/:id/status', authenticateToken, requireAdmin, (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!['pending', 'in-progress', 'resolved'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  const updateQuery = status === 'resolved' 
    ? 'UPDATE issues SET status = ?, resolved_at = CURRENT_TIMESTAMP WHERE issue_id = ?'
    : 'UPDATE issues SET status = ? WHERE issue_id = ?';

  const params = status === 'resolved' ? [status, id] : [status, id];

  db.run(updateQuery, params, function(err) {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Issue not found' });
    }
    res.json({ message: 'Issue status updated', issue_id: id, status });
  });
});

// Get statistics (Admin only)
app.get('/api/statistics', authenticateToken, requireAdmin, (req, res) => {
  const stats = {};

  // Total issues
  db.get('SELECT COUNT(*) as total FROM issues', (err, row) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    stats.total = row.total;

    // Issues by status
    db.all('SELECT status, COUNT(*) as count FROM issues GROUP BY status', (err, rows) => {
      if (err) return res.status(500).json({ error: 'Database error' });
      stats.byStatus = {};
      rows.forEach(row => {
        stats.byStatus[row.status] = row.count;
      });

      // Issues by category
      db.all('SELECT category, COUNT(*) as count FROM issues GROUP BY category', (err, rows) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        stats.byCategory = {};
        rows.forEach(row => {
          stats.byCategory[row.category] = row.count;
        });

        // Resolution rate
        const resolved = stats.byStatus.resolved || 0;
        stats.resolutionRate = stats.total > 0 ? Math.round((resolved / stats.total) * 100) : 0;

        res.json({ statistics: stats });
      });
    });
  });
});

// Submit contact form
app.post('/api/contact', (req, res) => {
  const { name, email, message } = req.body;

  if (!name || !email || !message) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  db.run('INSERT INTO contacts (name, email, message) VALUES (?, ?, ?)',
    [name, email, message],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Error submitting contact form' });
      }
      res.status(201).json({ message: 'Message sent successfully' });
    }
  );
});

// Create uploads directory if it doesn't exist
const fs = require('fs');
if (!fs.existsSync('uploads')) {
  fs.mkdirSync('uploads');
}

// Start server
app.listen(PORT, () => {
  console.log(`Campus360 server running on http://localhost:${PORT}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  db.close((err) => {
    if (err) {
      console.error('Error closing database:', err.message);
    } else {
      console.log('Database connection closed');
    }
    process.exit(0);
  });
});



