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
  console.log(`Authenticating userId: ${userId}`);
  if (!userId || isNaN(userId)) {
    console.error('Invalid or missing userId');
    return res.status(400).json({ error: 'Invalid or missing userId' });
  }
  try {
    const [userRows] = await pool.query('SELECT id, role FROM users WHERE id = ?', [userId]);
    if (!userRows.length) {
      console.error(`User not found for userId: ${userId}`);
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
        game_type VARCHAR(50) DEFAULT 'League of Legends',
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
    await connection.query(`
      CREATE TABLE IF NOT EXISTS order_messages (
        id INT AUTO_INCREMENT PRIMARY KEY,
        order_id VARCHAR(255) NOT NULL,
        sender_id INT NOT NULL,
        message TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE,
        FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
    await connection.query(`
      CREATE TABLE IF NOT EXISTS payout_requests (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        amount DECIMAL(10,2) NOT NULL,
        status ENUM('pending', 'paid', 'rejected') DEFAULT 'pending',
        payment_method VARCHAR(50) NOT NULL,
        payment_details VARCHAR(255) NOT NULL,
        requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        processed_at TIMESTAMP NULL,
        admin_notes TEXT,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
    await connection.query(`
      CREATE TABLE IF NOT EXISTS booster_profiles (
        user_id INT PRIMARY KEY,
        lol_highest_rank VARCHAR(50) DEFAULT NULL,
        valorant_highest_rank VARCHAR(50) DEFAULT NULL,
        lol_preferred_lanes TEXT DEFAULT NULL,
        lol_preferred_champions TEXT DEFAULT NULL,
        valorant_preferred_roles TEXT DEFAULT NULL,
        valorant_preferred_agents TEXT DEFAULT NULL,
        language TEXT DEFAULT NULL,
        bio TEXT DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
    const [languageColumn] = await connection.query("SHOW COLUMNS FROM booster_profiles LIKE 'language'");
    if (languageColumn.length === 0) {
      await connection.query("ALTER TABLE booster_profiles ADD language TEXT DEFAULT NULL");
    }
    const [bioColumn] = await connection.query("SHOW COLUMNS FROM booster_profiles LIKE 'bio'");
    if (bioColumn.length === 0) {
      await connection.query("ALTER TABLE booster_profiles ADD bio TEXT DEFAULT NULL");
    }
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
    console.log('Database initialized at:', new Date().toISOString());
    connection.release();
  } catch (error) {
    console.error('Database initialization error:', error.message);
    process.exit(1);
  }
}

app.post('/api/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const { userId, orderId } = session.metadata || {};
    let orderData = {};
    try {
      // Prefer fullOrderData from metadata if available
      if (session.metadata && session.metadata.fullOrderData) {
        orderData = JSON.parse(session.metadata.fullOrderData);
        console.log('Webhook using fullOrderData from metadata:', orderData);
      } else if (session.client_reference_id) {
        orderData = JSON.parse(session.client_reference_id);
        console.log('Webhook using client_reference_id:', orderData);
      }
    } catch (parseError) {
      console.error('Failed to parse order data:', parseError.message);
      return res.status(400).json({ error: 'Invalid order data format' });
    }

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

      const leagueRanks = ['Iron', 'Bronze', 'Silver', 'Gold', 'Platinum', 'Emerald', 'Diamond', 'Master', 'Grandmaster', 'Challenger'];
      const valorantRanks = ['Iron', 'Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond', 'Ascendant', 'Immortal', 'Radiant'];
      const leagueDivisions = ['I', 'II', 'III', 'IV'];
      const valorantDivisions = ['I', 'II', 'III'];
      const gameType = orderData.game || 'League of Legends';
      const validRanks = gameType === 'Valorant' ? valorantRanks : leagueRanks;
      const validDivisions = gameType === 'Valorant' ? valorantDivisions : leagueDivisions;

      if (!['League of Legends', 'Valorant'].includes(gameType)) {
        console.error('Invalid gameType:', gameType);
        return res.status(400).json({ error: 'Invalid game type' });
      }

      // Normalize ranks by removing division if included
      let normalizedCurrentRank = orderData.currentRank || '';
      let normalizedDesiredRank = orderData.desiredRank || '';
      if (normalizedCurrentRank.includes(' ')) {
        normalizedCurrentRank = normalizedCurrentRank.split(' ')[0];
      }
      if (normalizedDesiredRank.includes(' ')) {
        normalizedDesiredRank = normalizedDesiredRank.split(' ')[0];
      }

      if (!normalizedCurrentRank || !validRanks.includes(normalizedCurrentRank)) {
        console.error('Invalid normalized currentRank:', normalizedCurrentRank, 'Original:', orderData.currentRank);
        return res.status(400).json({ error: 'Invalid current rank' });
      }
      if (!normalizedDesiredRank || !validRanks.includes(normalizedDesiredRank)) {
        console.error('Invalid normalized desiredRank:', normalizedDesiredRank, 'Original:', orderData.desiredRank);
        return res.status(400).json({ error: 'Invalid desired rank' });
      }
      if (!['Master', 'Grandmaster', 'Challenger', 'Immortal', 'Radiant'].includes(normalizedCurrentRank) && orderData.currentDivision && !validDivisions.includes(orderData.currentDivision)) {
        console.warn('Invalid currentDivision:', orderData.currentDivision, 'Setting to default');
        orderData.currentDivision = '';
      }
      if (!['Master', 'Grandmaster', 'Challenger', 'Immortal', 'Radiant'].includes(normalizedDesiredRank) && orderData.desiredDivision && !validDivisions.includes(orderData.desiredDivision)) {
        console.warn('Invalid desiredDivision:', orderData.desiredDivision, 'Setting to default');
        orderData.desiredDivision = '';
      }

      const currentRank = ['Master', 'Grandmaster', 'Challenger', 'Immortal', 'Radiant'].includes(normalizedCurrentRank) 
        ? normalizedCurrentRank 
        : `${normalizedCurrentRank} ${orderData.currentDivision || ''}`.trim().slice(0, 50);
      const desiredRank = ['Master', 'Grandmaster', 'Challenger', 'Immortal', 'Radiant'].includes(normalizedDesiredRank) 
        ? normalizedDesiredRank 
        : `${normalizedDesiredRank} ${orderData.desiredDivision || ''}`.trim().slice(0, 50);

      const cashback = (orderData.finalPrice || 0) * 0.03;
      const extras = Array.isArray(orderData.extras) ? orderData.extras : [];
      const price = parseFloat(orderData.finalPrice) || 0;

      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();
        const [existingRows] = await connection.query('SELECT order_id FROM orders WHERE order_id = ?', [orderId]);
        if (existingRows.length > 0) {
          await connection.query(
            'UPDATE orders SET current_rank = ?, desired_rank = ?, current_lp = ?, desired_lp = ?, price = ?, status = ?, cashback = ?, game_type = ?, extras = ? WHERE order_id = ? AND user_id = ?',
            [
              currentRank,
              desiredRank,
              parseInt(orderData.currentLP) || 0,
              parseInt(orderData.desiredLP) || 0,
              price,
              'Pending',
              cashback,
              gameType,
              JSON.stringify(extras),
              orderId,
              parseInt(userId)
            ]
          );
          console.log(`Order ${orderId} updated for user ${userId}`);
        } else {
          await connection.query(
            'INSERT INTO orders (order_id, user_id, current_rank, desired_rank, current_lp, desired_lp, price, status, cashback, payout_status, game_type, extras) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
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
              gameType,
              JSON.stringify(extras)
            ]
          );
          console.log(`Order ${orderId} created for user ${userId}`);
        }
        await connection.query(
          'UPDATE users SET account_balance = account_balance + ? WHERE id = ?',
          [cashback, parseInt(userId)]
        );
        await connection.commit();
        console.log(`Transaction committed for orderId: ${orderId}`);
      } catch (err) {
        await connection.rollback();
        console.error('Transaction error:', err.message);
        throw err;
      } finally {
        connection.release();
      }
    } catch (error) {
      console.error('Webhook processing error:', error.message);
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
    const balance = parseFloat(rows[0].account_balance);
    if (isNaN(balance)) {
      console.error(`Invalid balance for userId ${req.user.id}: ${rows[0].account_balance}`);
      return res.status(500).json({ error: 'Invalid balance format' });
    }
    res.json({ balance });
  } catch (error) {
    console.error('Error fetching user balance:', error.message);
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
    const [rows] = await pool.query('SELECT id, email FROM users WHERE email = ?', [email]);
    if (rows.length === 0) {
      return res.status(404).json({ message: 'No user found with this email' });
    }
    const user = rows[0];
    const token = uuidv4();
    const expires = new Date(Date.now() + 3600000);
    await pool.query(
      'INSERT INTO password_reset_tokens (user_id, token, expires) VALUES (?, ?, ?)',
      [user.id, token, expires]
    );
    const resetLink = `http://localhost:3000/league-services.html?userId=${user.id}&token=${token}`;
    await sendResetPasswordEmail({ to: user.email, resetLink });
    res.json({ message: 'Password reset link sent' });
  } catch (error) {
    console.error('Forgot password error:', error.message);
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
    await pool.query('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, userId]);
    await pool.query('DELETE FROM password_reset_tokens WHERE user_id = ?', [userId]);
    res.json({ message: 'Password reset successfully' });
  } catch (error) {
    console.error('Reset password error:', error.message);
    res.status(500).json({ message: 'Server error' });
  }
});

app.post('/api/create-checkout-session', async (req, res) => {
  try {
    const { orderData, userId, metadata } = req.body;
    console.log('Checkout request received:', { orderData, userId, metadata });
    if (!orderData || !userId || isNaN(userId)) {
      console.error('Invalid checkout request:', { orderData, userId });
      return res.status(400).json({ error: 'Missing or invalid orderData or userId' });
    }
    if (!orderData.currentRank || !orderData.desiredRank || !orderData.finalPrice) {
      console.error('Incomplete orderData:', orderData);
      return res.status(400).json({ error: 'Incomplete orderData' });
    }
    const parsedUserId = parseInt(userId);
    const [userRows] = await pool.query('SELECT id FROM users WHERE id = ?', [parsedUserId]);
    if (userRows.length === 0) {
      console.error('User not found:', parsedUserId);
      return res.status(400).json({ error: 'User not found' });
    }

    // Define rank and division lists
    const leagueRanks = ['Iron', 'Bronze', 'Silver', 'Gold', 'Platinum', 'Emerald', 'Diamond', 'Master', 'Grandmaster', 'Challenger'];
    const valorantRanks = ['Iron', 'Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond', 'Ascendant', 'Immortal', 'Radiant'];
    const leagueDivisions = ['I', 'II', 'III', 'IV'];
    const valorantDivisions = ['I', 'II', 'III'];

    // Normalize ranks to exclude division
    const gameType = orderData.game || 'League of Legends';
    if (!['League of Legends', 'Valorant'].includes(gameType)) {
      console.error('Invalid gameType:', gameType);
      return res.status(400).json({ error: 'Invalid game type' });
    }
    const validRanks = gameType === 'Valorant' ? valorantRanks : leagueRanks;
    const validDivisions = gameType === 'Valorant' ? valorantDivisions : leagueDivisions;

    let normalizedCurrentRank = orderData.currentRank.includes(' ') ? orderData.currentRank.split(' ')[0] : orderData.currentRank;
    let normalizedDesiredRank = orderData.desiredRank.includes(' ') ? orderData.desiredRank.split(' ')[0] : orderData.desiredRank;
    if (!validRanks.includes(normalizedCurrentRank) || !validRanks.includes(normalizedDesiredRank)) {
      console.error('Invalid ranks:', { currentRank: normalizedCurrentRank, desiredRank: normalizedDesiredRank, gameType });
      return res.status(400).json({ error: 'Invalid rank' });
    }

    // Validate divisions
    if (!['Master', 'Grandmaster', 'Challenger', 'Immortal', 'Radiant'].includes(normalizedCurrentRank) && orderData.currentDivision && !validDivisions.includes(orderData.currentDivision)) {
      console.warn('Invalid currentDivision:', orderData.currentDivision, 'Setting to default');
      orderData.currentDivision = '';
    }
    if (!['Master', 'Grandmaster', 'Challenger', 'Immortal', 'Radiant'].includes(normalizedDesiredRank) && orderData.desiredDivision && !validDivisions.includes(orderData.desiredDivision)) {
      console.warn('Invalid desiredDivision:', orderData.desiredDivision, 'Setting to default');
      orderData.desiredDivision = '';
    }

    // Validate finalPrice
    const finalPrice = parseFloat(orderData.finalPrice);
    if (isNaN(finalPrice) || finalPrice <= 0) {
      console.error('Invalid finalPrice:', orderData.finalPrice);
      return res.status(400).json({ error: 'Invalid final price' });
    }

    // Ensure no division for Master+ ranks
    if (['Master', 'Grandmaster', 'Challenger', 'Immortal', 'Radiant'].includes(normalizedCurrentRank)) {
      orderData.currentDivision = '';
    }
    if (['Master', 'Grandmaster', 'Challenger', 'Immortal', 'Radiant'].includes(normalizedDesiredRank)) {
      orderData.desiredDivision = '';
    }

    // Function to abbreviate rank names if needed
    const abbreviateRank = (rank) => {
      const abbreviations = {
        'Ascendant': 'Asc',
        'Immortal': 'Imm',
        'Radiant': 'Rad',
        'Challenger': 'Chal',
        'Grandmaster': 'GM',
        'Platinum': 'Plat',
        'Diamond': 'Dia',
        'Emerald': 'Em'
      };
      return abbreviations[rank] || rank.slice(0, 4);
    };

    // Build minimal client_reference_id
    let clientReference = {
      currentRank: normalizedCurrentRank.slice(0, 10),
      desiredRank: normalizedDesiredRank.slice(0, 10),
      finalPrice: finalPrice,
      game: gameType, // Use full game name
      currentDiv: (orderData.currentDivision || '').slice(0, 3),
      desiredDiv: (orderData.desiredDivision || '').slice(0, 3)
    };

    let clientReferenceString = JSON.stringify(clientReference);
    console.log('Initial client_reference_id:', { length: clientReferenceString.length, value: clientReferenceString });

    // If too long, abbreviate ranks
    if (clientReferenceString.length > 190) {
      clientReference.currentRank = abbreviateRank(normalizedCurrentRank);
      clientReference.desiredRank = abbreviateRank(normalizedDesiredRank);
      clientReferenceString = JSON.stringify(clientReference);
      console.log('Abbreviated client_reference_id:', { length: clientReferenceString.length, value: clientReferenceString });
    }

    // Final check
    if (clientReferenceString.length > 200) {
      console.error('client_reference_id too long after all truncations:', clientReferenceString.length);
      return res.status(400).json({ error: 'Order data too long' });
    }

    const orderId = uuidv4();
    const extrasMetadata = Array.isArray(orderData.extras) ? orderData.extras.map(e => e.label || '').join(', ') : '';
    const sessionParams = {
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `Rank Boost: ${normalizedCurrentRank} ${orderData.currentDivision || ''} to ${normalizedDesiredRank} ${orderData.desiredDivision || ''}`,
              description: extrasMetadata || undefined
            },
            unit_amount: Math.round(finalPrice * 100)
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
        extras: extrasMetadata,
        fullOrderData: JSON.stringify(orderData) // Store full data in metadata
      },
      client_reference_id: clientReferenceString
    };
    console.log('Creating Stripe Checkout session with params:', sessionParams);
    const session = await stripe.checkout.sessions.create(sessionParams);
    console.log('Checkout session created:', { sessionId: session.id, userId: parsedUserId, orderId });
    res.json({ id: session.id });
  } catch (error) {
    console.error('Checkout session error:', error.message);
    res.status(500).json({ error: 'Error creating checkout session', details: error.message });
  }
});

app.get('/api/user-orders', authenticate, async (req, res) => {
  try {
    console.log(`Fetching orders for userId: ${req.user.id}`);
    const [rows] = await pool.query(
      'SELECT order_id, current_rank, desired_rank, current_lp, desired_lp, price, status, cashback, DATE_FORMAT(created_at, "%Y-%m-%dT%H:%i:%s.000Z") AS created_at, extras, game_type FROM orders WHERE user_id = ?',
      [req.user.id]
    );
    console.log(`Orders found for userId ${req.user.id}: ${rows.length}`, rows);
    res.json(rows);
  } catch (error) {
    console.error('Error fetching user orders:', error.message);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

app.get('/api/available-orders', authenticate, checkRole(['booster', 'admin']), async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT order_id, current_rank, desired_rank, current_lp, desired_lp, price, game_type, DATE_FORMAT(created_at, "%Y-%m-%dT%H:%i:%s.000Z") AS created_at FROM orders WHERE status = "Pending"'
    );
    const data = rows.map(row => ({
      ...row,
      price: parseFloat(row.price).toFixed(2)
    }));
    console.log('Available orders:', data);
    res.json(data);
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
    if (!orderRows.length || !['Claimed', 'In Progress'].includes(orderRows[0].status)) {
      return res.status(400).json({ error: 'Order not claimed by this booster or invalid status' });
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
        SELECT o.order_id, o.current_rank, o.desired_rank, o.current_lp, o.desired_lp, o.price, o.status, DATE_FORMAT(o.created_at, "%Y-%m-%dT%H:%i:%s.000Z") AS created_at, o.game_type
        FROM orders o
        LEFT JOIN booster_orders bo ON o.order_id = bo.order_id
        WHERE o.status IN ('Claimed', 'In Progress', 'Completed')
      `;
      params = [];
    } else {
      query = `
        SELECT o.order_id, o.current_rank, o.desired_rank, o.current_lp, o.desired_lp, o.price, o.status, DATE_FORMAT(o.created_at, "%Y-%m-%dT%H:%i:%s.000Z") AS created_at, o.game_type
        FROM orders o
        JOIN booster_orders bo ON o.order_id = bo.order_id
        WHERE bo.booster_id = ? AND o.status IN ('Claimed', 'In Progress', 'Completed')
      `;
      params = [req.user.id];
    }
    const [rows] = await pool.query(query, params);
    const orders = rows.map(order => ({
      ...order,
      price: parseFloat(order.price).toFixed(2),
      booster_payout: (parseFloat(order.price) * 0.85).toFixed(2)
    }));
    console.log('Working orders:', orders);
    res.json(orders);
  } catch (error) {
    console.error('Error fetching working orders:', error.message);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

app.get('/api/all-orders', authenticate, checkRole(['admin']), async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT o.order_id, o.user_id, o.current_rank, o.desired_rank, o.price, o.status, o.cashback, DATE_FORMAT(o.created_at, "%Y-%m-%dT%H:%i:%s.000Z") AS created_at, o.extras, bo.booster_id
      FROM orders o
      LEFT JOIN booster_orders bo ON o.order_id = bo.order_id
    `);
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
      return res.status(400).json({ error: 'Order not found or not in valid status' });
    }
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      await connection.query('UPDATE orders SET status = "Completed" WHERE order_id = ?', [orderId]);
      await connection.commit();
      res.json({ success: true, message: 'Order completed successfully' });
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
    if (!orderId) {
      return res.status(400).json({ error: 'Missing orderId' });
    }
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const [orderRows] = await connection.query(
        'SELECT o.price, o.payout_status, bo.booster_id FROM orders o ' +
        'JOIN booster_orders bo ON o.order_id = bo.order_id ' +
        'WHERE o.order_id = ? AND o.status = "Completed"',
        [orderId]
      );
      if (!orderRows.length || !orderRows[0].booster_id) {
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
    const [rows] = await pool.query(`
      SELECT o.order_id, o.user_id, u.username AS customer_username, o.current_rank, o.desired_rank, o.current_lp, o.desired_lp, o.price, o.status, o.cashback, DATE_FORMAT(o.created_at, "%Y-%m-%dT%H:%i:%s.000Z") AS created_at, o.extras, o.payout_status, bo.booster_id, ub.username AS booster_username
      FROM orders o
      LEFT JOIN booster_orders bo ON o.order_id = bo.order_id
      LEFT JOIN users u ON o.user_id = u.id
      LEFT JOIN users ub ON bo.booster_id = ub.id
      WHERE o.status = 'Completed'
    `);
    const orders = rows.map(order => ({
      ...order,
      booster_payout: (parseFloat(order.price) * 0.85).toFixed(2)
    }));
    res.json(orders);
  } catch (error) {
    console.error('Error fetching completed orders:', error.message);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

app.post('/api/request-payout', authenticate, checkRole(['booster']), async (req, res) => {
  const { amount, paymentMethod, paymentDetails } = req.body;
  try {
    const [userRows] = await pool.query('SELECT account_balance FROM users WHERE id = ?', [req.user.id]);
    if (!userRows.length) {
      return res.status(404).json({ error: 'User not found' });
    }
    const balance = parseFloat(userRows[0].account_balance);
    if (isNaN(amount) || amount <= 0 || amount > balance) {
      return res.status(400).json({ error: 'Invalid payout amount' });
    }
    const [recentRequest] = await pool.query(
      'SELECT requested_at FROM payout_requests WHERE user_id = ? AND requested_at >= DATE_SUB(NOW(), INTERVAL 1 MONTH)',
      [req.user.id]
    );
    if (recentRequest.length) {
      return res.status(400).json({ error: 'Payout request allowed only once per month' });
    }
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      await connection.query(
        'INSERT INTO payout_requests (user_id, amount, payment_method, payment_details) VALUES (?, ?, ?, ?)',
        [req.user.id, amount, paymentMethod, paymentDetails]
      );
      await connection.commit();
      res.json({ success: true, message: 'Payout request submitted' });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error requesting payout:', error.message);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

app.get('/api/payout-requests', authenticate, checkRole(['admin']), async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT pr.id, pr.user_id, u.username, pr.amount, pr.status, pr.payment_method, pr.payment_details, pr.requested_at, pr.processed_at, pr.admin_notes
      FROM payout_requests pr
      JOIN users u ON pr.user_id = u.id
      WHERE pr.status = 'pending'
      ORDER BY pr.requested_at DESC
    `);
    res.json(rows);
  } catch (error) {
    console.error('Error fetching payout requests:', error.message);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

app.post('/api/process-payout', authenticate, checkRole(['admin']), async (req, res) => {
  const { requestId, action, adminNotes } = req.body;
  if (!requestId || !['approve', 'reject'].includes(action)) {
    return res.status(400).json({ error: 'Invalid requestId or action' });
  }
  try {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const [rows] = await pool.query(
        'SELECT user_id, amount, status FROM payout_requests WHERE id = ?',
        [requestId]
      );
      if (!rows.length) {
        await connection.rollback();
        return res.status(404).json({ error: 'Payout request not found' });
      }
      if (rows[0].status !== 'pending') {
        await connection.rollback();
        return res.status(400).json({ error: 'Request already processed' });
      }
      if (action === 'approve') {
        const [userRows] = await connection.query(
          'SELECT account_balance FROM users WHERE id = ?',
          [rows[0].user_id]
        );
        if (parseFloat(rows[0].amount) > parseFloat(userRows[0].account_balance)) {
          await connection.rollback();
          return res.status(400).json({ error: 'Insufficient balance' });
        }
        await connection.query(
          'UPDATE users SET account_balance = account_balance - ? WHERE id = ?',
          [parseFloat(rows[0].amount), rows[0].user_id]
        );
        await connection.query(
          'UPDATE payout_requests SET status = "paid", processed_at = NOW(), admin_notes = ? WHERE id = ?',
          [adminNotes || '', requestId]
        );
      } else {
        await connection.query(
          'UPDATE payout_requests SET status = "rejected", processed_at = NOW(), admin_notes = ? WHERE id = ?',
          [adminNotes || 'No reason provided', requestId]
        );
      }
      await connection.commit();
      res.json({ success: true, message: `Payout request ${action}d successfully` });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error processing payout:', error.message);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

app.get('/api/payout-history', authenticate, checkRole(['booster', 'admin']), async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT id, user_id, amount, status, payment_method, payment_details, requested_at, processed_at, admin_notes
      FROM payout_requests
      WHERE user_id = ? ORDER BY requested_at DESC
    `, [req.user.id]);
    res.json(rows);
  } catch (error) {
    console.error('Error fetching payout history:', error.message);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

app.get('/api/order-credentials', authenticate, async (req, res) => {
  const { orderId } = req.query;
  try {
    const [rows] = await pool.query(`
      SELECT account_username, summoner_name, plaintext_password
      FROM order_credentials
      WHERE order_id = ?
    `, [orderId]);
    if (!rows.length) {
      return res.status(404).json({ error: 'Credentials not found' });
    }
    res.json({ credentials: rows[0] });
  } catch (error) {
    console.error('Error fetching order credentials:', error.message);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

app.get('/api/order-messages', authenticate, async (req, res) => {
  const { orderId } = req.query;
  try {
    const [rows] = await pool.query(`
      SELECT om.id, om.order_id, om.sender_id, u.username AS sender_username, om.message, om.created_at
      FROM order_messages om
      JOIN users u ON om.sender_id = u.id
      WHERE om.order_id = ?
      ORDER BY om.created_at ASC
    `, [orderId]);
    res.json(rows);
  } catch (error) {
    console.error('Error fetching order messages:', error.message);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

app.post('/api/send-message', authenticate, async (req, res) => {
  const { orderId, message } = req.body;
  try {
    const [orderRows] = await pool.query('SELECT order_id FROM orders WHERE order_id = ?', [orderId]);
    if (!orderRows.length) {
      return res.status(404).json({ error: 'Order not found' });
    }
    await pool.query(
      'INSERT INTO order_messages (order_id, sender_id, message) VALUES (?, ?, ?)',
      [orderId, req.user.id, message]
    );
    res.json({ success: true, message: 'Message sent successfully' });
  } catch (error) {
    console.error('Error sending message:', error.message);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

app.post('/api/submit-credentials', authenticate, async (req, res) => {
  const { orderId, accountUsername, password, summonerName } = req.body;
  try {
    const [orderRows] = await pool.query('SELECT user_id FROM orders WHERE order_id = ?', [orderId]);
    if (!orderRows.length || orderRows[0].user_id !== req.user.id) {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    await pool.query(
      'INSERT INTO order_credentials (order_id, account_username, account_password_hash, plaintext_password, summoner_name) VALUES (?, ?, ?, ?, ?)',
      [orderId, accountUsername, hashedPassword, password, summonerName]
    );
    res.json({ success: true, message: 'Credentials submitted successfully' });
  } catch (error) {
    console.error('Error submitting credentials:', error.message);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

app.get('/api/boosters', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT u.id, u.username, 
             TIMESTAMPDIFF(MINUTE, u.last_activity, NOW()) <= 5 AS online_status,
             bp.lol_highest_rank, bp.valorant_highest_rank, 
             bp.lol_preferred_lanes, bp.lol_preferred_champions, 
             bp.valorant_preferred_roles, bp.valorant_preferred_agents,
             bp.language, bp.bio
      FROM users u
      LEFT JOIN booster_profiles bp ON u.id = bp.user_id
      WHERE u.role = 'booster'
    `);
    res.json(rows);
  } catch (error) {
    console.error('Error fetching boosters:', error.message);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

app.get('/api/booster-profile', authenticate, checkRole(['booster', 'admin']), async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT lol_highest_rank, valorant_highest_rank, lol_preferred_lanes, lol_preferred_champions, valorant_preferred_roles, valorant_preferred_agents, language, bio FROM booster_profiles WHERE user_id = ?',
      [req.user.id]
    );
    if (!rows.length) {
      await pool.query('INSERT INTO booster_profiles (user_id) VALUES (?)', [req.user.id]);
      return res.json({
        lol_highest_rank: null,
        valorant_highest_rank: null,
        lol_preferred_lanes: null,
        lol_preferred_champions: null,
        valorant_preferred_roles: null,
        valorant_preferred_agents: null,
        language: null,
        bio: null
      });
    }
    res.json(rows[0]);
  } catch (error) {
    console.error('Error fetching booster profile:', error.message);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

app.post('/api/booster-profile', authenticate, checkRole(['booster', 'admin']), async (req, res) => {
  const {
    lolHighestRank,
    valorantHighestRank,
    lolPreferredLanes,
    lolPreferredChampions,
    valorantPreferredRoles,
    valorantPreferredAgents,
    language,
    bio
  } = req.body;
  try {
    await pool.query(
      `INSERT INTO booster_profiles (
        user_id, lol_highest_rank, valorant_highest_rank, 
        lol_preferred_lanes, lol_preferred_champions, 
        valorant_preferred_roles, valorant_preferred_agents,
        language, bio
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        lol_highest_rank = VALUES(lol_highest_rank),
        valorant_highest_rank = VALUES(valorant_highest_rank),
        lol_preferred_lanes = VALUES(lol_preferred_lanes),
        lol_preferred_champions = VALUES(lol_preferred_champions),
        valorant_preferred_roles = VALUES(valorant_preferred_roles),
        valorant_preferred_agents = VALUES(valorant_preferred_agents),
        language = VALUES(language),
        bio = VALUES(bio)`,
      [
        req.user.id,
        lolHighestRank || null,
        valorantHighestRank || null,
        lolPreferredLanes || null,
        lolPreferredChampions || null,
        valorantPreferredRoles || null,
        valorantPreferredAgents || null,
        language || null,
        bio || null
      ]
    );
    res.json({ success: true, message: 'Booster profile updated successfully' });
  } catch (error) {
    console.error('Error updating booster profile:', error.message);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

app.listen(3000, async () => {
  console.log('Server running on http://localhost:3000');
  await initializeDatabase();
});