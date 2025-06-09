require('dotenv').config();
const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const mysql = require('mysql2/promise');
const cors = require('cors');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcrypt');
const { sendResetPasswordEmail } = require('./email');

const app = express();
app.use(cors());

// Database pool configuration
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Authentication middleware
const authenticate = async (req, res, next) => {
  const userId = req.query.userId || req.body.userId;
  if (!userId || isNaN(userId)) {
    return res.status(400).json({ error: 'Invalid or missing userId' });
  }
  try {
    const [userRows] = await pool.query('SELECT id, role FROM users WHERE id = ?', [userId]);
    if (!userRows.length) {
      return res.status(404).json({ error: 'User not found' });
    }
    req.user = { id: parseInt(userId), role: userRows[0].role };
    next();
  } catch (error) {
    console.error('Authentication error:', error.message);
    res.status(500).json({ error: 'Authentication failed', details: error.message });
  }
};

// Role check middleware
const checkRole = (allowedRoles) => (req, res, next) => {
  if (!allowedRoles.includes(req.user.role)) {
    return res.status(403).json({ error: 'Unauthorized' });
  }
  next();
};

async function initializeDatabase() {
  try {
    const connection = await pool.getConnection();
    await connection.query('CREATE DATABASE IF NOT EXISTS chboosting_new');
    await connection.query('USE chboosting_new');
    await connection.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(255) UNIQUE NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        role ENUM('user', 'booster', 'admin') DEFAULT 'user',
        account_balance DECIMAL(10,2) DEFAULT 0.00,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await connection.query(`
      CREATE TABLE IF NOT EXISTS orders (
        order_id VARCHAR(255) PRIMARY KEY,
        user_id INT NOT NULL,
        current_rank VARCHAR(50) NOT NULL,
        desired_rank VARCHAR(50) NOT NULL,
        current_lp INT DEFAULT 0,
        desired_lp INT DEFAULT 0,
        price DECIMAL(10,2) NOT NULL,
        status ENUM('Pending', 'Claimed', 'In Progress', 'Completed') DEFAULT 'Pending',
        cashback DECIMAL(10,2) DEFAULT 0.00,
        payout_status ENUM('Pending', 'Paid') DEFAULT 'Pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        extras JSON DEFAULT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
    await connection.query(`
      CREATE TABLE IF NOT EXISTS booster_orders (
        id INT AUTO_INCREMENT PRIMARY KEY,
        order_id VARCHAR(255) NOT NULL,
        booster_id INT NOT NULL,
        claimed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE,
        FOREIGN KEY (booster_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
    await connection.query(`
      CREATE TABLE IF NOT EXISTS order_credentials (
        order_id VARCHAR(255) PRIMARY KEY,
        account_username VARCHAR(255) NOT NULL,
        account_password_hash VARCHAR(255) NOT NULL,
        plaintext_password VARCHAR(255) NOT NULL,
        summoner_name VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE
      )
    `);
    await connection.query(`
      CREATE TABLE IF NOT EXISTS password_reset_tokens (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        token VARCHAR(36) NOT NULL,
        expires DATETIME NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_user_id (user_id),
        INDEX idx_token (token)
      )
    `);
    const [columns] = await connection.query("SHOW COLUMNS FROM orders LIKE 'extras'");
    if (columns.length === 0) {
      await connection.query("ALTER TABLE orders ADD extras JSON DEFAULT NULL");
    }
    const [credColumns] = await connection.query("SHOW COLUMNS FROM order_credentials LIKE 'plaintext_password'");
    if (credColumns.length === 0) {
      await connection.query("ALTER TABLE order_credentials ADD plaintext_password VARCHAR(255) NOT NULL");
    }
    const [oldPasswordColumn] = await connection.query("SHOW COLUMNS FROM order_credentials LIKE 'account_password'");
    if (oldPasswordColumn.length > 0) {
      await connection.query("ALTER TABLE order_credentials CHANGE account_password account_password_hash VARCHAR(255) NOT NULL");
    }
    const [balanceColumn] = await connection.query("SHOW COLUMNS FROM users LIKE 'account_balance'");
    if (balanceColumn.length === 0) {
      await connection.query("ALTER TABLE users ADD account_balance DECIMAL(10,2) DEFAULT 0.00");
    }
    const [payoutStatusColumn] = await connection.query("SHOW COLUMNS FROM orders LIKE 'payout_status'");
    if (payoutStatusColumn.length === 0) {
      await connection.query("ALTER TABLE orders ADD payout_status ENUM('Pending', 'Paid') DEFAULT 'Pending'");
    }
    await connection.query(`
      DELETE t1 FROM order_credentials t1
      INNER JOIN order_credentials t2
      WHERE t1.order_id = t2.order_id AND t1.created_at < t2.created_at
    `);
    console.log('Database and tables initialized, duplicates cleaned at:', new Date().toISOString());
    connection.release();
  } catch (error) {
    console.error('Database initialization error:', error.message);
    process.exit(1);
  }
}

app.post('/api/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  console.log('Webhook received, signature:', sig);
  let event;
  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
    console.log('Webhook event constructed:', event.type);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    console.log('Session:', JSON.stringify(session, null, 2));
    const { userId, orderId } = session.metadata || {};
    let orderData = {};
    try {
      orderData = session.client_reference_id ? JSON.parse(session.client_reference_id) : {};
    } catch (parseError) {
      console.error('Failed to parse client_reference_id:', parseError.message, 'Raw:', session.client_reference_id);
      return res.status(400).json({ error: 'Invalid client_reference_id format' });
    }
    console.log('Metadata:', session.metadata, 'OrderData:', orderData);

    if (!userId || !orderId) {
      console.error('Missing metadata:', { userId, orderId });
      return res.status(400).json({ error: 'Missing metadata' });
    }
    if (isNaN(userId)) {
      console.error('Invalid userId:', userId);
      return res.status(400).json({ error: 'Invalid userId' });
    }

    try {
      const [userRows] = await pool.query('SELECT id FROM users WHERE id = ?', [userId]);
      if (userRows.length === 0) {
        console.error('User not found:', userId);
        return res.status(400).json({ error: 'User not found' });
      }

      const currentRank = `${orderData.currentRank || ''} ${orderData.currentDivision || ''}`.trim().slice(0, 50);
      const desiredRank = `${orderData.desiredRank || ''} ${orderData.desiredDivision || ''}`.trim().slice(0, 50);
      if (!currentRank || !desiredRank) {
        console.error('Invalid ranks:', { currentRank, desiredRank });
        return res.status(400).json({ error: 'Missing or invalid rank data' });
      }

      const cashback = (orderData.finalPrice || 0) * 0.03;
      const extras = Array.isArray(orderData.extras) ? orderData.extras : [];
      const price = parseFloat(orderData.finalPrice) || 0;
      console.log('Saving to database:', {
        orderId,
        userId: parseInt(userId),
        currentRank,
        desiredRank,
        currentLP: parseInt(orderData.currentLP) || 0,
        desiredLP: parseInt(orderData.desiredLP) || 0,
        price,
        status: 'Pending',
        cashback,
        extras
      });

      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();
        const [existingRows] = await connection.query('SELECT order_id FROM orders WHERE order_id = ?', [orderId]);
        if (existingRows.length > 0) {
          console.log(`Order ${orderId} already exists, updating instead`);
          await connection.query(
            'UPDATE orders SET current_rank = ?, desired_rank = ?, current_lp = ?, desired_lp = ?, price = ?, status = ?, cashback = ?, extras = ? WHERE order_id = ? AND user_id = ?',
            [
              currentRank,
              desiredRank,
              parseInt(orderData.currentLP) || 0,
              parseInt(orderData.desiredLP) || 0,
              price,
              'Pending',
              cashback,
              JSON.stringify(extras),
              orderId,
              parseInt(userId)
            ]
          );
          console.log(`Order ${orderId} updated for user ${userId}`);
        } else {
          await connection.query(
            'INSERT INTO orders (order_id, user_id, current_rank, desired_rank, current_lp, desired_lp, price, status, cashback, payout_status, extras) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [
              orderId,
              parseInt(userId),
              currentRank,
              desiredRank,
              parseInt(orderData.currentLP) || 0,
              parseInt(orderData.desiredLP) || 0,
              price,
              'Pending',
              cashback,
              'Pending',
              JSON.stringify(extras)
            ]
          );
          console.log(`Order saved via webhook: ${orderId} for user ${userId}`);
        }
        await connection.query(
          'UPDATE users SET account_balance = account_balance + ? WHERE id = ?',
          [cashback, parseInt(userId)]
        );
        console.log(`Added $${cashback.toFixed(2)} cashback to userId ${userId}'s account_balance`);
        await connection.commit();
      } catch (error) {
        await connection.rollback();
        console.error('Database transaction error:', error.message, error.stack);
        throw error;
      } finally {
        connection.release();
      }
    } catch (error) {
      console.error('Database error:', error.message, error.stack);
      return res.status(500).json({ error: 'Database error', details: error.message });
    }
  }
  res.json({ received: true });
});

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/user-role', authenticate, async (req, res) => {
  try {
    res.json({ role: req.user.role });
  } catch (error) {
    console.error('Error fetching user role:', error.message);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

app.get('/api/user-balance', authenticate, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT account_balance FROM users WHERE id = ?', [req.user.id]);
    if (!rows.length) {
      return res.status(404).json({ error: 'User not found' });
    }
    const rawBalance = rows[0].account_balance;
    const balance = parseFloat(rawBalance);
    if (isNaN(balance)) {
      console.error(`Invalid balance format for userId ${req.user.id}: ${rawBalance}`);
      return res.status(500).json({ error: 'Invalid balance format in database', details: `Raw value: ${rawBalance}` });
    }
    console.log(`Fetched balance for userId ${req.user.id}: $${balance.toFixed(2)}`);
    res.json({ balance });
  } catch (error) {
    console.error(`Error fetching user balance for userId ${req.user.id}:`, error.message);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

app.post('/api/register', async (req, res) => {
  const { username, email, password } = req.body;
  try {
    const [existing] = await pool.query(
      'SELECT id FROM users WHERE username = ? OR email = ?',
      [username, email]
    );
    if (existing.length > 0) {
      return res.status(400).json({ message: 'Username or email already exists' });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const [result] = await pool.query(
      'INSERT INTO users (username, email, password, role, account_balance) VALUES (?, ?, ?, ?, ?)',
      [username, email, hashedPassword, 'user', 0.00]
    );
    res.json({ userId: result.insertId, username, role: 'user' });
  } catch (err) {
    console.error('Register error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const [results] = await pool.query(
      'SELECT id, username, password, role FROM users WHERE username = ? OR email = ?',
      [username, username]
    );
    if (results.length === 0) {
      return res.status(401).json({ message: 'Invalid username or password' });
    }
    const user = results[0];
    const isMatch = await bcrypt.compare(password, user.password);
    if (isMatch) {
      res.json({ userId: user.id, username: user.username, role: user.role });
    } else {
      res.status(401).json({ message: 'Invalid username or password' });
    }
  } catch (err) {
    console.error('Login error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

app.post('/api/forgot-password', async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ message: 'Email is required' });
  }

  try {
    const [rows] = await pool.query(
      'SELECT id, email FROM users WHERE email = ?',
      [email]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: 'No user found with this email' });
    }

    const user = rows[0];
    const token = uuidv4();
    const expires = new Date(Date.now() + 3600000); // 1 hour expiration

    await pool.query(
      'INSERT INTO password_reset_tokens (user_id, token, expires) VALUES (?, ?, ?)',
      [user.id, token, expires]
    );

    const resetLink = `http://localhost:3000/league-services.html?userId=${user.id}&token=${token}`;
    await sendResetPasswordEmail({ to: user.email, resetLink });

    res.json({ message: 'Password reset link sent' });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.post('/api/reset-password', async (req, res) => {
  const { userId, token, newPassword } = req.body;

  if (!userId || !token || !newPassword) {
    return res.status(400).json({ message: 'All fields are required' });
  }

  try {
    const [rows] = await pool.query(
      'SELECT * FROM password_reset_tokens WHERE user_id = ? AND token = ? AND expires > NOW()',
      [userId, token]
    );

    if (rows.length === 0) {
      return res.status(400).json({ message: 'Invalid or expired token' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await pool.query(
      'UPDATE users SET password = ? WHERE id = ?',
      [hashedPassword, userId]
    );

    await pool.query(
      'DELETE FROM password_reset_tokens WHERE user_id = ?',
      [userId]
    );

    res.json({ message: 'Password reset successfully' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.post('/api/create-checkout-session', async (req, res) => {
  try {
    const { orderData, userId, metadata } = req.body;
    console.log('Checkout request received at:', new Date().toISOString(), { orderData, userId, metadata });
    if (!orderData || !userId || isNaN(userId)) {
      console.error('Validation failed: Missing or invalid orderData or userId', { orderData, userId });
      return res.status(400).json({ error: 'Missing or invalid orderData or userId' });
    }
    if (!orderData.currentRank || !orderData.desiredRank || !orderData.finalPrice) {
      console.error('Validation failed: Incomplete orderData', { orderData });
      return res.status(400).json({ error: 'Incomplete orderData: missing currentRank, desiredRank, or finalPrice' });
    }
    const parsedUserId = parseInt(userId);
    if (isNaN(parsedUserId)) {
      console.error('Invalid userId format:', userId);
      return res.status(400).json({ error: 'Invalid userId format' });
    }
    const [userRows] = await pool.query('SELECT id FROM users WHERE id = ?', [parsedUserId]);
    if (userRows.length === 0) {
      console.error('User not found:', parsedUserId);
      return res.status(400).json({ error: 'User not found' });
    }
    const clientReference = {
      currentRank: orderData.currentRank,
      desiredRank: orderData.desiredRank,
      finalPrice: parseFloat(orderData.finalPrice) || 0,
      currentDivision: orderData.currentDivision || '',
      desiredDivision: orderData.desiredDivision || '',
      currentLP: parseInt(orderData.currentLP) || 0,
      desiredLP: parseInt(orderData.desiredLP) || 0,
      extras: Array.isArray(orderData.extras) ? orderData.extras.map(e => e.label) : []
    };
    const clientReferenceString = JSON.stringify(clientReference);
    console.log('client_reference_id:', { length: clientReferenceString.length, value: clientReferenceString });
    if (clientReferenceString.length > 1000) {
      console.error('client_reference_id too long:', clientReferenceString.length);
      return res.status(400).json({ error: 'Order data too long for Stripe' });
    }
    const orderId = uuidv4();
    const extrasMetadata = Array.isArray(orderData.extras) ? orderData.extras.map(e => e.label).join(', ') : [];
    const sessionParams = {
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `Rank Boost: ${orderData.currentRank} ${orderData.currentDivision || ''} to ${orderData.desiredRank} ${orderData.desiredDivision || ''}`,
              description: extrasMetadata ? `Extras: ${extrasMetadata}` : undefined
            },
            unit_amount: Math.round(parseFloat(orderData.finalPrice) * 100)
          },
          quantity: 1
        }
      ],
      mode: 'payment',
      success_url: `http://localhost:3000/confirmation.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `http://localhost:3000/checkout.html`,
      metadata: {
        userId: parsedUserId.toString(),
        orderId,
        extras: extrasMetadata
      },
      client_reference_id: clientReferenceString
    };
    console.log('Creating Stripe Checkout session with params:', JSON.stringify(sessionParams, null, 2));
    const session = await stripe.checkout.sessions.create(sessionParams).catch(error => {
      throw new Error(`Stripe API error: ${error.message}, Type: ${error.type}, Code: ${error.code || 'N/A'}, Status: ${error.status || 'N/A'}, Raw: ${JSON.stringify(error.raw || {})}`);
    });
    console.log('Checkout session created:', { sessionId: session.id, userId: parsedUserId, orderId });
    res.json({ id: session.id });
  } catch (error) {
    console.error('Checkout session error at:', new Date().toISOString(), error.message, error.stack);
    res.status(500).json({ error: 'Error creating checkout session', details: error.message });
  }
});

app.get('/api/user-orders', authenticate, async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT order_id, current_rank, desired_rank, current_lp, desired_lp, price, status, cashback, created_at, extras FROM orders WHERE user_id = ?',
      [req.user.id]
    );
    console.log('Orders fetched for userId:', req.user.id, 'Rows:', rows);
    res.json(rows);
  } catch (error) {
    console.error('Error fetching user orders:', error.message);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

app.get('/api/available-orders', authenticate, checkRole(['booster', 'admin']), async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT order_id, current_rank, desired_rank, current_lp, desired_lp, price, created_at, extras FROM orders WHERE status = "Pending"'
    );
    const orders = rows.map(order => ({
      ...order,
      booster_payout: (order.price * 0.85).toFixed(2)
    }));
    console.log('Available orders fetched for userId:', req.user.id, 'Rows:', rows);
    res.json(orders);
  } catch (error) {
    console.error('Error fetching available orders:', error.message);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

app.post('/api/claim-order', authenticate, checkRole(['booster', 'admin']), async (req, res) => {
  const { orderId } = req.body;
  try {
    const [orderRows] = await pool.query('SELECT status FROM orders WHERE order_id = ?', [orderId]);
    if (!orderRows.length || orderRows[0].status !== 'Pending') {
      return res.status(400).json({ error: 'Order not available' });
    }
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      await connection.query('UPDATE orders SET status = "Claimed" WHERE order_id = ?', [orderId]);
      await connection.query(
        'INSERT INTO booster_orders (order_id, booster_id) VALUES (?, ?)',
        [orderId, req.user.id]
      );
      await connection.commit();
      res.json({ success: true, message: 'Order claimed successfully' });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error claiming order:', error.message);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

app.post('/api/unclaim-order', authenticate, checkRole(['booster', 'admin']), async (req, res) => {
  const { orderId } = req.body;
  try {
    const [orderRows] = await pool.query(
      'SELECT o.status FROM orders o JOIN booster_orders bo ON o.order_id = bo.order_id WHERE o.order_id = ? AND bo.booster_id = ?',
      [orderId, req.user.id]
    );
    if (!orderRows.length || orderRows[0].status !== 'Claimed') {
      return res.status(400).json({ error: 'Order not claimed by this booster' });
    }
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      await connection.query('UPDATE orders SET status = "Pending" WHERE order_id = ?', [orderId]);
      await connection.query('DELETE FROM booster_orders WHERE order_id = ? AND booster_id = ?', [orderId, req.user.id]);
      await connection.commit();
      res.json({ success: true, message: 'Order unclaimed successfully' });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error unclaiming order:', error.message);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

app.get('/api/working-orders', authenticate, checkRole(['booster', 'admin']), async (req, res) => {
  try {
    let query, params;
    if (req.user.role === 'admin') {
      query = `
        SELECT o.order_id, o.current_rank, o.desired_rank, o.current_lp, o.desired_lp, o.price, o.status, o.created_at, o.extras
        FROM orders o
        LEFT JOIN booster_orders bo ON o.order_id = bo.order_id
        WHERE o.status IN ('Claimed', 'In Progress', 'Completed')
      `;
      params = [];
    } else {
      query = `
        SELECT o.order_id, o.current_rank, o.desired_rank, o.current_lp, o.desired_lp, o.price, o.status, o.created_at, o.extras
        FROM orders o
        JOIN booster_orders bo ON o.order_id = bo.order_id
        WHERE bo.booster_id = ? AND o.status IN ('Claimed', 'In Progress', 'Completed')
      `;
      params = [req.user.id];
    }
    const [rows] = await pool.query(query, params);
    const orders = rows.map(order => ({
      ...order,
      booster_payout: (order.price * 0.85).toFixed(2)
    }));
    console.log('Working orders fetched for userId:', req.user.id, 'Role:', req.user.role, 'Rows:', rows);
    res.json(orders);
  } catch (error) {
    console.error('Error fetching working orders:', error.message);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

app.get('/api/all-orders', authenticate, checkRole(['admin']), async (req, res) => {
  try {
    const sqlQuery = [
      'SELECT o.order_id, o.user_id, o.current_rank, o.desired_rank, o.price, o.status, o.cashback, o.created_at, o.extras, bo.booster_id',
      'FROM orders o',
      'LEFT JOIN booster_orders bo ON o.order_id = bo.order_id'
    ].join(' ');
    const [rows] = await pool.query(sqlQuery);
    res.json(rows);
  } catch (error) {
    console.error('Error fetching all orders:', error.message);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

app.post('/api/complete-order', authenticate, checkRole(['booster', 'admin']), async (req, res) => {
  const { orderId } = req.body;
  try {
    let query, params;
    if (req.user.role === 'admin') {
      query = 'SELECT status FROM orders WHERE order_id = ? AND status IN ("Claimed", "In Progress")';
      params = [orderId];
    } else {
      query = `
        SELECT o.status
        FROM orders o
        JOIN booster_orders bo ON o.order_id = bo.order_id
        WHERE o.order_id = ? AND bo.booster_id = ? AND o.status IN ('Claimed', 'In Progress')
      `;
      params = [orderId, req.user.id];
    }
    const [orderRows] = await pool.query(query, params);
    if (!orderRows.length) {
      return res.status(400).json({ error: 'Order not found, not in valid status, or not assigned to this booster' });
    }
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      await connection.query('UPDATE orders SET status = "Completed" WHERE order_id = ?', [orderId]);
      await connection.commit();
      res.json({ success: true, message: 'Order marked as completed' });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error completing order:', error.message);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

app.post('/api/approve-payout', authenticate, checkRole(['admin']), async (req, res) => {
  const { orderId } = req.body;
  try {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const [orderRows] = await connection.query(
        'SELECT o.price, o.payout_status, bo.booster_id FROM orders o JOIN booster_orders bo ON o.order_id = bo.order_id WHERE o.order_id = ? AND o.status = "Completed"',
        [orderId]
      );
      if (!orderRows.length) {
        await connection.rollback();
        return res.status(400).json({ error: 'Order not found, not completed, or no booster assigned' });
      }
      if (orderRows[0].payout_status === 'Paid') {
        await connection.rollback();
        return res.status(400).json({ error: 'Payout already processed' });
      }
      const boosterId = orderRows[0].booster_id;
      const payout = parseFloat(orderRows[0].price) * 0.85;
      await connection.query(
        'UPDATE users SET account_balance = account_balance + ? WHERE id = ?',
        [payout, boosterId]
      );
      await connection.query(
        'UPDATE orders SET payout_status = "Paid" WHERE order_id = ?',
        [orderId]
      );
      console.log(`Payout of $${payout.toFixed(2)} approved for boosterId ${boosterId}, orderId ${orderId}`);
      await connection.commit();
      res.json({ success: true, message: 'Payout approved successfully' });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error approving payout:', error.message);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

app.get('/api/completed-orders', authenticate, checkRole(['admin']), async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT o.order_id, o.user_id, u.username AS customer_username, o.current_rank, o.desired_rank, o.current_lp, o.desired_lp, o.price, o.status, o.cashback, o.created_at, o.extras, o.payout_status, bo.booster_id, ub.username AS booster_username
       FROM orders o
       LEFT JOIN booster_orders bo ON o.order_id = bo.order_id
       LEFT JOIN users u ON o.user_id = u.id
       LEFT JOIN users ub ON bo.booster_id = ub.id
       WHERE o.status = 'Completed'`
    );
    const orders = rows.map(order => ({
      ...order,
      booster_payout: (order.price * 0.85).toFixed(2)
    }));
    console.log('Completed orders fetched for userId:', req.user.id, 'Rows:', orders);
    res.json(orders);
  } catch (error) {
    console.error('Error fetching completed orders:', error.message);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'Database connected' });
  } catch (err) {
    console.error('Health check error:', err.message);
    res.status(500).json({ error: 'Database connection failed', details: err.message });
  }
});

app.get('/api/get-session', async (req, res) => {
  const { session_id } = req.query;
  if (!session_id) {
    return res.status(400).json({ error: 'Missing session_id' });
  }
  try {
    const session = await stripe.checkout.sessions.retrieve(session_id);
    res.json({ session });
  } catch (error) {
    console.error('Error retrieving session:', error.message);
    res.status(500).json({ error: 'Failed to retrieve session', details: error.message });
  }
});

app.post('/api/submit-credentials', async (req, res) => {
  const { orderId, userId, accountUsername, password, summonerName } = req.body;
  try {
    console.log('Submit credentials request:', { orderId, userId, accountUsername, password: '***', summonerName });
    if (orderId === undefined || userId === undefined || accountUsername === undefined || password === undefined || summonerName === undefined) {
      const errors = [];
      if (orderId === undefined) errors.push('orderId');
      if (userId === undefined) errors.push('userId');
      if (accountUsername === undefined) errors.push('accountUsername');
      if (password === undefined) errors.push('password');
      if (summonerName === undefined) errors.push('summonerName');
      return res.status(400).json({ error: `Missing required fields: ${errors.join(', ')}` });
    }
    if (isNaN(userId)) {
      return res.status(400).json({ error: 'Invalid userId: must be a number' });
    }
    if (typeof orderId !== 'string' || orderId.length > 255) {
      return res.status(400).json({ error: 'Invalid orderId: must be a string <= 255 characters' });
    }
    if (!password) {
      return res.status(400).json({ error: 'Password cannot be empty' });
    }
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const [existingRows] = await connection.query('SELECT order_id FROM order_credentials WHERE order_id = ?', [orderId]);
      const [orderRows] = await connection.query('SELECT user_id FROM orders WHERE order_id = ?', [orderId]);
      if (!orderRows.length || orderRows[0].user_id !== parseInt(userId)) {
        await connection.rollback();
        return res.status(403).json({ error: 'Unauthorized' });
      }
      const hashedPassword = await bcrypt.hash(password, 10);
      if (existingRows.length > 0) {
        await connection.query(
          'UPDATE order_credentials SET account_username = ?, account_password_hash = ?, plaintext_password = ?, summoner_name = ?, created_at = CURRENT_TIMESTAMP WHERE order_id = ?',
          [accountUsername, hashedPassword, password, summonerName, orderId]
        );
        console.log(`Updated credentials for order ${orderId}`);
      } else {
        await connection.query(
          'INSERT INTO order_credentials (order_id, account_username, account_password_hash, plaintext_password, summoner_name) VALUES (?, ?, ?, ?, ?)',
          [orderId, accountUsername, hashedPassword, password, summonerName]
        );
        console.log(`Inserted credentials for order ${orderId}`);
      }
      await connection.commit();
      res.json({ success: true });
    } catch (error) {
      await connection.rollback();
      console.error('Transaction error:', error.message);
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error submitting credentials:', error.message);
    res.status(500).json({ error: 'Failed to submit credentials', details: error.message });
  }
});

app.get('/api/order-credentials', async (req, res) => {
  const { orderId, userId } = req.query;
  try {
    const [orderRows] = await pool.query('SELECT user_id FROM orders WHERE order_id = ?', [orderId]);
    if (!orderRows.length) {
      return res.status(404).json({ error: 'Order not found' });
    }
    const [boosterRows] = await pool.query('SELECT booster_id FROM booster_orders WHERE order_id = ?', [orderId]);
    const [userRows] = await pool.query('SELECT role FROM users WHERE id = ?', [userId]);
    const isBooster = userRows.length && userRows[0].role === 'booster' && boosterRows.some(row => row.booster_id === parseInt(userId));
    const isCustomer = orderRows[0].user_id === parseInt(userId);
    if (!isCustomer && !isBooster) {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    const [credentialRows] = await pool.query(
      `SELECT account_username, summoner_name ${isBooster ? ', plaintext_password' : ''} FROM order_credentials WHERE order_id = ?`,
      [orderId]
    );
    res.json({ credentials: credentialRows.length ? credentialRows[0] : null });
  } catch (error) {
    console.error('Error fetching credentials:', error.message);
    res.status(500).json({ error: 'Failed to fetch credentials', details: error.message });
  }
});

app.post('/api/send-message', async (req, res) => {
  const { orderId, userId, message } = req.body;
  try {
    const [orderRows] = await pool.query('SELECT user_id FROM orders WHERE order_id = ?', [orderId]);
    if (!orderRows.length) {
      return res.status(404).json({ error: 'Order not found' });
    }
    const [boosterRows] = await pool.query('SELECT booster_id FROM booster_orders WHERE order_id = ?', [orderId]);
    if (orderRows[0].user_id !== parseInt(userId) && !boosterRows.some(row => row.booster_id === parseInt(userId))) {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    await pool.query(
      'INSERT INTO order_messages (order_id, sender_id, message) VALUES (?, ?, ?)',
      [orderId, userId, message]
    );
    res.json({ success: true });
  } catch (error) {
    console.error('Error sending message:', error.message);
    res.status(500).json({ error: 'Failed to send message', details: error.message });
  }
});

app.get('/api/order-messages', async (req, res) => {
  const { orderId, userId } = req.query;
  try {
    const [orderRows] = await pool.query('SELECT user_id FROM orders WHERE order_id = ?', [orderId]);
    if (!orderRows.length) {
      return res.status(404).json({ error: 'Order not found' });
    }
    const [boosterRows] = await pool.query('SELECT booster_id FROM booster_orders WHERE order_id = ?', [orderId]);
    if (orderRows[0].user_id !== parseInt(userId) && !boosterRows.some(row => row.booster_id === parseInt(userId))) {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    const [rows] = await pool.query(
      'SELECT m.id, m.order_id, m.sender_id, m.message, m.created_at, u.username AS sender_username FROM order_messages m JOIN users u ON m.sender_id = u.id WHERE m.order_id = ? ORDER BY m.created_at',
      [orderId]
    );
    res.json(rows);
  } catch (error) {
    console.error('Error fetching messages:', error.message);
    res.status(500).json({ error: 'Failed to fetch messages', details: error.message });
  }
});

app.get(['/', '/index.html'], (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/league-services.html', (req, res) => res.sendFile(path.join(__dirname, 'public', 'league-services.html')));
app.get('/valorant-services.html', (req, res) => res.sendFile(path.join(__dirname, 'public', 'valorant-services.html')));
app.get('/checkout.html', (req, res) => res.sendFile(path.join(__dirname, 'public', 'checkout.html')));
app.get('/confirmation.html', (req, res) => res.sendFile(path.join(__dirname, 'public', 'confirmation.html')));
app.get('/dashboard.html', (req, res) => res.sendFile(path.join(__dirname, 'public', 'dashboard.html')));
app.get('/boosters.html', (req, res) => res.sendFile(path.join(__dirname, 'public', 'boosters.html')));

initializeDatabase().then(() => {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}).catch(err => {
  console.error('Failed to start server:', err.message);
  process.exit(1);
});