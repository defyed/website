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
// Only parse JSON for non-webhook routes
app.use((req, res, next) => {
  if (req.originalUrl === '/api/webhook') {
    next(); // Skip JSON parsing for Stripe webhook
  } else {
    express.json()(req, res, next); // Use normal JSON for other routes
  }
});

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
  const userId = req.query.userId || req.body.userId || req.body.adminUserId;

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
    // Users table with coach role
    await connection.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(255) UNIQUE NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        role ENUM('user', 'booster', 'admin', 'coach') DEFAULT 'user',
        account_balance DECIMAL(10,2) DEFAULT 0.00,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Orders table with order_type
    await connection.query(`
      CREATE TABLE IF NOT EXISTS orders (
        order_id VARCHAR(255) PRIMARY KEY,
        user_id INT NOT NULL,
        current_rank VARCHAR(50) DEFAULT NULL,
        desired_rank VARCHAR(50) DEFAULT NULL,
        current_lp INT DEFAULT 0,
        desired_lp INT DEFAULT 0,
        price DECIMAL(10,2) NOT NULL,
        status ENUM('Pending', 'Claimed', 'In Progress', 'Completed', 'Paid') DEFAULT 'Pending',
        cashback DECIMAL(10,2) DEFAULT 0.00,
        payout_status ENUM('Pending', 'Paid') DEFAULT 'Pending',
        game_type VARCHAR(50) DEFAULT 'League of Legends',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        extras JSON DEFAULT NULL,
        order_type ENUM('boost', 'coaching') NOT NULL DEFAULT 'boost',
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // Coaching orders table
   await connection.query(`
  CREATE TABLE IF NOT EXISTS coaching_orders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    coach_id INT NOT NULL,
    order_id VARCHAR(255) NOT NULL,
    booked_hours INT NOT NULL,
    game_type VARCHAR(50) NOT NULL,
    total_price DECIMAL(10,2) NOT NULL,
    coach_name VARCHAR(255) NOT NULL,
    status ENUM('pending', 'completed', 'cancelled') DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (coach_id) REFERENCES users(id) ON DELETE CASCADE
  )
`);
const [coachingPayoutStatusColumn] = await connection.query("SHOW COLUMNS FROM coaching_orders LIKE 'payout_status'");
if (coachingPayoutStatusColumn.length === 0) {
  await connection.query("ALTER TABLE coaching_orders ADD payout_status ENUM('Pending', 'Paid') DEFAULT 'Pending'");
}
    // Coach profiles table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS coach_profiles (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        user_id BIGINT NOT NULL,
        game_type VARCHAR(255) NOT NULL,
        bio VARCHAR(255) DEFAULT NULL,
        price_per_hour DECIMAL(10,2) NOT NULL,
        lol_highest_rank VARCHAR(50) DEFAULT NULL,
        valorant_highest_rank VARCHAR(50) DEFAULT NULL,
        lol_preferred_lanes VARCHAR(255) DEFAULT NULL,
        lol_preferred_champions VARCHAR(255) DEFAULT NULL,
        valorant_preferred_roles VARCHAR(255) DEFAULT NULL,
        valorant_preferred_agents VARCHAR(255) DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
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
    await connection.query(`
      CREATE TABLE IF NOT EXISTS coupons (
        id INT AUTO_INCREMENT PRIMARY KEY,
        code VARCHAR(50) UNIQUE NOT NULL,
        lol_discount_percentage DECIMAL(5,2) NOT NULL,
        valorant_discount_percentage DECIMAL(5,2) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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
    const { userId, orderId, fullOrderData } = session.metadata || {};
    let orderData = {};
    try {
      if (fullOrderData) {
        orderData = JSON.parse(fullOrderData);
        console.log('Webhook using fullOrderData:', orderData);
      } else if (session.client_reference_id) {
        orderData = JSON.parse(session.client_reference_id);
        console.log('Webhook using client_reference_id:', orderData);
      } else {
        console.error('No order data found in metadata or client_reference_id');
        return res.status(400).json({ error: 'No order data provided' });
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
      const [userRows] = await pool.query('SELECT id, username FROM users WHERE id = ?', [userId]);
      if (!userRows.length) {
        console.error('User not found:', userId);
        return res.status(400).json({ error: 'User not found' });
      }

      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();

        if (orderData.type === 'coaching') {
          const { coachId, hours, game, finalPrice, coachName } = orderData;
          if (!coachId || !hours || !game || !finalPrice || !coachName) {
            console.error('Incomplete coaching order data:', orderData);
            await connection.rollback();
            return res.status(400).json({ error: 'Incomplete coaching order data' });
          }

          const [coachRows] = await connection.query('SELECT id, username FROM users WHERE id = ? AND role = "coach"', [coachId]);
          if (!coachRows.length) {
            console.error('Coach not found:', coachId);
            await connection.rollback();
            return res.status(400).json({ error: 'Coach not found' });
          }

          
          const cashback = parseFloat((finalPrice * 0.0299).toFixed(2));

          // Insert coaching order
          await connection.query(
            `INSERT INTO coaching_orders (
              user_id, coach_id, order_id, booked_hours, game_type, total_price, coach_name, status, cashback
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [parseInt(userId), coachId, orderId, hours, game, finalPrice, coachName, 'pending', cashback]
          );

          // Add cashback to customer's account balance
          await connection.query(
            'UPDATE users SET account_balance = account_balance + ? WHERE id = ?',
            [cashback, parseInt(userId)]
          );

          console.log(`Coaching order ${orderId} created for user ${userId}, coach ${coachId}, cashback $${cashback} credited`);
        } else if (orderData.type === 'boost') {
          const { currentRank, desiredRank, currentDivision, desiredDivision, currentLP, desiredLP, finalPrice, game, extras } = orderData;
          const leagueRanks = ['Iron', 'Bronze', 'Silver', 'Gold', 'Platinum', 'Emerald', 'Diamond', 'Master', 'Grandmaster', 'Challenger'];
          const valorantRanks = ['Iron', 'Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond', 'Ascendant', 'Immortal', 'Radiant'];
          const leagueDivisions = ['I', 'II', 'III', 'IV'];
          const valorantDivisions = ['I', 'II', 'III'];
          const gameType = game || 'League of Legends';
          const validRanks = gameType === 'Valorant' ? valorantRanks : leagueRanks;
          const validDivisions = gameType === 'Valorant' ? valorantDivisions : leagueDivisions;

          let normalizedCurrentRank = currentRank?.includes(' ') ? currentRank.split(' ')[0] : currentRank;
          let normalizedDesiredRank = desiredRank?.includes(' ') ? desiredRank.split(' ')[0] : desiredRank;
          if (!normalizedCurrentRank || !validRanks.includes(normalizedCurrentRank)) {
            console.error('Invalid currentRank:', normalizedCurrentRank);
            await connection.rollback();
            return res.status(400).json({ error: 'Invalid current rank' });
          }
          if (!normalizedDesiredRank || !validRanks.includes(normalizedDesiredRank)) {
            console.error('Invalid desiredRank:', normalizedDesiredRank);
            await connection.rollback();
            return res.status(400).json({ error: 'Invalid desired rank' });
          }
          let validatedCurrentDivision = currentDivision || '';
          let validatedDesiredDivision = desiredDivision || '';
          if (!['Master', 'Grandmaster', 'Challenger', 'Immortal', 'Radiant'].includes(normalizedCurrentRank) && validatedCurrentDivision && !validDivisions.includes(validatedCurrentDivision)) {
            console.warn('Invalid currentDivision:', validatedCurrentDivision);
            validatedCurrentDivision = '';
          }
          if (!['Master', 'Grandmaster', 'Challenger', 'Immortal', 'Radiant'].includes(normalizedDesiredRank) && validatedDesiredDivision && !validDivisions.includes(validatedDesiredDivision)) {
            console.warn('Invalid desiredDivision:', validatedDesiredDivision);
            validatedDesiredDivision = '';
          }
          const currentRankFull = ['Master', 'Grandmaster', 'Challenger', 'Immortal', 'Radiant'].includes(normalizedCurrentRank)
            ? normalizedCurrentRank
            : `${normalizedCurrentRank} ${validatedCurrentDivision}`.trim().slice(0, 50);
          const desiredRankFull = ['Master', 'Grandmaster', 'Challenger', 'Immortal', 'Radiant'].includes(normalizedDesiredRank)
            ? normalizedDesiredRank
            : `${normalizedDesiredRank} ${validatedDesiredDivision}`.trim().slice(0, 50);
          const cashback = (finalPrice || 0) * 0.03;
          const extrasArray = Array.isArray(extras) ? extras : [];

          const [existingRows] = await connection.query('SELECT order_id FROM orders WHERE order_id = ?', [orderId]);
          if (existingRows.length > 0) {
            await connection.query(
              'UPDATE orders SET current_rank = ?, desired_rank = ?, current_lp = ?, desired_lp = ?, price = ?, status = ?, cashback = ?, game_type = ?, extras = ? WHERE order_id = ? AND user_id = ?',
              [
                currentRankFull,
                desiredRankFull,
                parseInt(currentLP) || 0,
                parseInt(desiredLP) || 0,
                parseFloat(finalPrice) || 0,
                'Pending',
                cashback,
                gameType,
                JSON.stringify(extrasArray),
                orderId,
                parseInt(userId)
              ]
            );
            console.log(`Boost order ${orderId} updated for user ${userId}`);
          } else {
            await connection.query(
              'INSERT INTO orders (order_id, user_id, current_rank, desired_rank, current_lp, desired_lp, price, status, cashback, payout_status, game_type, extras, order_type) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
              [
                orderId,
                parseInt(userId),
                currentRankFull,
                desiredRankFull,
                parseInt(currentLP) || 0,
                parseInt(desiredLP) || 0,
                parseFloat(finalPrice) || 0,
                'Pending',
                cashback,
                'Pending',
                gameType,
                JSON.stringify(extrasArray),
                'boost'
              ]
            );
            console.log(`Boost order ${orderId} created for user ${userId}`);
          }
          await connection.query(
            'UPDATE users SET account_balance = account_balance + ? WHERE id = ?',
            [cashback, parseInt(userId)]
          );
        } else {
          console.error('Invalid order type:', orderData.type);
          await connection.rollback();
          return res.status(400).json({ error: 'Invalid order type' });
        }

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

app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

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
    const resetLink = `https://chboosting.com/league-services.html?userId=${user.id}&token=${token}`;
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
    const { orderData, userId, type } = req.body;
    console.log('Checkout request received:', { orderData, userId, type });

    // Validate required fields
    if (!orderData || !userId || isNaN(userId) || !type) {
      console.error('Invalid checkout request:', { orderData, userId, type });
      return res.status(400).json({ error: 'Missing or invalid orderData, userId, or type' });
    }

    const parsedUserId = parseInt(userId);
    const [userRows] = await pool.query('SELECT id, username FROM users WHERE id = ?', [parsedUserId]);
    if (!userRows.length) {
      console.error('User not found:', parsedUserId);
      return res.status(400).json({ error: 'User not found' });
    }
    const customerName = userRows[0].username;

    let sessionParams, orderId, fullOrderData;

    if (type === 'coaching') {
      // Normalize field names (accept both camelCase and snake_case)
      const { coachId, coach_id, hours, game, game_type, totalPrice, total_price, coachName, coach_name } = orderData;
      const validatedCoachId = coachId || coach_id;
      const validatedGame = game || game_type;
      const validatedTotalPrice = totalPrice || total_price;
      const validatedCoachName = coachName || coach_name;

      if (!validatedCoachId || !hours || !validatedTotalPrice || !validatedGame || !validatedCoachName) {
        console.error('Incomplete coaching orderData:', orderData);
        return res.status(400).json({ error: 'Missing coaching order fields' });
      }
      // Add coach validation
  const [coachRows] = await pool.query('SELECT id, username FROM users WHERE id = ? AND role = "coach"', [validatedCoachId]);
  if (!coachRows.length) {
    console.error('Coach not found:', validatedCoachId);
    return res.status(400).json({ error: 'Coach not found' });
  }
  if (coachRows[0].username !== validatedCoachName) {
    console.warn('Coach name mismatch:', { expected: coachRows[0].username, received: validatedCoachName });
  }
      if (!['League of Legends', 'Valorant'].includes(validatedGame)) {
        console.error('Invalid game:', validatedGame);
        return res.status(400).json({ error: 'Invalid game type' });
      }
      if (isNaN(validatedTotalPrice) || validatedTotalPrice <= 0 || isNaN(hours) || hours < 1 || hours > 4) {
        console.error('Invalid totalPrice or hours:', { totalPrice: validatedTotalPrice, hours });
        return res.status(400).json({ error: 'Invalid total price or hours' });
      }

      orderId = uuidv4();
      fullOrderData = {
        type: 'coaching',
        coachId: validatedCoachId,
        hours,
        game: validatedGame,
        finalPrice: validatedTotalPrice,
        customerName,
        coachName: validatedCoachName
      };

      sessionParams = {
        payment_method_types: ['card'],
        line_items: [{
          price_data: {
            currency: 'usd',
            product_data: { name: `Coaching Session with ${validatedCoachName}` },
            unit_amount: Math.round(validatedTotalPrice * 100),
          },
          quantity: 1,
        }],
        mode: 'payment',
        success_url: `https://chboosting.com/confirmation?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `https://chboosting.com/checkout`,
        metadata: {
          userId: parsedUserId.toString(),
          orderId: orderId.toString(),
          fullOrderData: JSON.stringify(fullOrderData)
        },
        client_reference_id: JSON.stringify({
          type: 'coaching',
          game: validatedGame,
          finalPrice: validatedTotalPrice
        })
      };
    } else if (type === 'boost') {
  const { currentRank, desiredRank, finalPrice, game, currentDivision, desiredDivision, currentLP, desiredLP, extras } = orderData;
  if (!currentRank || !desiredRank || !finalPrice) {
    console.error('Incomplete boost orderData:', orderData);
    return res.status(400).json({ error: 'Incomplete boost orderData' });
  }
  const leagueRanks = ['Iron', 'Bronze', 'Silver', 'Gold', 'Platinum', 'Emerald', 'Diamond', 'Master', 'Grandmaster', 'Challenger'];
  const valorantRanks = ['Iron', 'Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond', 'Ascendant', 'Immortal', 'Radiant'];
  const leagueDivisions = ['I', 'II', 'III', 'IV'];
  const valorantDivisions = ['I', 'II', 'III'];
  const gameType = game || 'League of Legends';
  if (!['League of Legends', 'Valorant'].includes(gameType)) {
    console.error('Invalid gameType:', gameType);
    return res.status(400).json({ error: 'Invalid game type' });
  }
  const validRanks = gameType === 'Valorant' ? valorantRanks : leagueRanks;
  const validDivisions = gameType === 'Valorant' ? valorantDivisions : leagueDivisions;
  let normalizedCurrentRank = currentRank.includes(' ') ? currentRank.split(' ')[0] : currentRank;
  let normalizedDesiredRank = desiredRank.includes(' ') ? desiredRank.split(' ')[0] : desiredRank;
  if (!validRanks.includes(normalizedCurrentRank) || !validRanks.includes(normalizedDesiredRank)) {
    console.error('Invalid ranks:', { currentRank: normalizedCurrentRank, desiredRank: normalizedDesiredRank, gameType });
    return res.status(400).json({ error: 'Invalid rank' });
  }
  let validatedCurrentDivision = currentDivision || '';
  let validatedDesiredDivision = desiredDivision || '';
  if (!['Master', 'Grandmaster', 'Challenger', 'Immortal', 'Radiant'].includes(normalizedCurrentRank) && validatedCurrentDivision && !validDivisions.includes(validatedCurrentDivision)) {
    console.warn('Invalid currentDivision:', validatedCurrentDivision, 'Setting to default');
    validatedCurrentDivision = '';
  }
  if (!['Master', 'Grandmaster', 'Challenger', 'Immortal', 'Radiant'].includes(normalizedDesiredRank) && validatedDesiredDivision && !validDivisions.includes(validatedDesiredDivision)) {
    console.warn('Invalid desiredDivision:', validatedDesiredDivision, 'Setting to default');
    validatedDesiredDivision = '';
  }
  const finalPriceParsed = parseFloat(finalPrice);
  if (isNaN(finalPriceParsed) || finalPriceParsed <= 0) {
    console.error('Invalid finalPrice:', finalPrice);
    return res.status(400).json({ error: 'Invalid final price' });
  }
  const abbreviateRank = (rank) => {
    const abbreviations = {
      'Ascendant': 'Asc', 'Immortal': 'Imm', 'Radiant': 'Rad',
      'Challenger': 'Chal', 'Grandmaster': 'GM', 'Platinum': 'Plat',
      'Diamond': 'Dia', 'Emerald': 'Em'
    };
    return abbreviations[rank] || rank.slice(0, 4);
  };
  let clientReference = {
    cRank: abbreviateRank(normalizedCurrentRank).slice(0, 10),
    dRank: abbreviateRank(normalizedDesiredRank).slice(0, 10),
    price: finalPriceParsed,
    game: gameType === 'League of Legends' ? 'LoL' : 'Val',
    cDiv: validatedCurrentDivision.slice(0, 3),
    dDiv: validatedDesiredDivision.slice(0, 3)
  };
  let clientReferenceString = JSON.stringify(clientReference);
  if (clientReferenceString.length > 190) {
    clientReference.cRank = abbreviateRank(normalizedCurrentRank).slice(0, 4);
    clientReference.dRank = abbreviateRank(normalizedDesiredRank).slice(0, 4);
    clientReferenceString = JSON.stringify(clientReference);
  }
  if (clientReferenceString.length > 200) {
    console.error('client_reference_id too long:', clientReferenceString.length);
    return res.status(400).json({ error: 'Order data too long' });
  }
  orderId = uuidv4();
  const extrasMetadata = Array.isArray(extras) ? extras.map(e => e.label || '').join(', ') : '';
  fullOrderData = {
    type: 'boost',
    currentRank: normalizedCurrentRank,
    desiredRank: normalizedDesiredRank,
    currentDivision: validatedCurrentDivision,
    desiredDivision: validatedDesiredDivision,
    currentLP: currentLP || 0,
    desiredLP: desiredLP || 0,
    finalPrice: finalPriceParsed,
    game: gameType,
    extras: extras || []
  };
  sessionParams = {
    payment_method_types: ['card'],
    line_items: [{
      price_data: {
        currency: 'usd',
        product_data: {
          name: `Rank Boost: ${normalizedCurrentRank} ${validatedCurrentDivision} to ${normalizedDesiredRank} ${validatedDesiredDivision}`,
          description: extrasMetadata || undefined
        },
        unit_amount: Math.round(finalPriceParsed * 100)
      },
      quantity: 1
    }],
    mode: 'payment',
    success_url: `https://chboosting.com/confirmation?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `https://chboosting.com/checkout`,
    metadata: {
      userId: parsedUserId.toString(),
      orderId,
      extras: extrasMetadata,
      fullOrderData: JSON.stringify(fullOrderData)
    },
    client_reference_id: clientReferenceString
  };
    } else {
      console.error('Invalid type:', type);
      return res.status(400).json({ error: 'Invalid order type' });
    }

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
    const { type } = req.query;
    console.log(`Fetching orders for userId: ${req.user.id}, role: ${req.user.role}, type: ${type || 'all'}`);
    let orders = [];

    if (req.user.role === 'user' && (!type || type === 'boost')) {
      // Fetch boost orders for customers
      const [boostRows] = await pool.query(
        `SELECT o.order_id, o.current_rank, o.desired_rank, o.current_lp, o.desired_lp, o.price, o.status, o.cashback, 
                DATE_FORMAT(o.created_at, "%Y-%m-%dT%H:%i:%s.000Z") AS created_at, o.extras, o.game_type, 'boost' AS order_type,
                u.username AS customer_username, ub.username AS booster_username
         FROM orders o
         LEFT JOIN users u ON o.user_id = u.id
         LEFT JOIN booster_orders bo ON o.order_id = bo.order_id
         LEFT JOIN users ub ON bo.booster_id = ub.id
         WHERE o.user_id = ? AND o.order_type = 'boost'`,
        [req.user.id]
      );
      orders.push(...boostRows.map(row => {
        const parseRank = (rank, gameType) => {
          const highRanks = gameType === 'Valorant' ? ['Immortal', 'Radiant'] : ['Master', 'Grandmaster', 'Challenger'];
          if (highRanks.includes(rank)) return { rank, division: '' };
          const [baseRank, division] = rank ? rank.split(' ') : [rank, ''];
          return { rank: baseRank || rank, division: division || '' };
        };
        return {
          ...row,
          currentRank: parseRank(row.current_rank, row.game_type).rank,
          currentDivision: parseRank(row.current_rank, row.game_type).division,
          desiredRank: parseRank(row.desired_rank, row.game_type).rank,
          desiredDivision: parseRank(row.desired_rank, row.game_type).division
        };
      }));
    }

    if (!type || type === 'coaching') {
      // Fetch coaching orders for customers or coaches
      const whereClause = req.user.role === 'coach' ? 'co.coach_id = ?' : 'co.user_id = ?';
      const [coachingRows] = await pool.query(
  `SELECT co.order_id, co.user_id, co.coach_id, co.booked_hours, co.game_type,
          co.total_price AS price, co.coach_name, co.status, co.cashback,
          DATE_FORMAT(co.created_at, "%Y-%m-%dT%H:%i:%s.000Z") AS created_at,
          'coaching' AS order_type,
          u.username AS customer_username
   FROM coaching_orders co
   LEFT JOIN users u ON co.user_id = u.id
   WHERE ${whereClause}`,
  [req.user.id]
);

      orders.push(...coachingRows.map(row => ({
        ...row,
        currentRank: null,
        currentDivision: null,
        desiredRank: null,
        desiredDivision: null,
        coach_username: row.coach_name
      })));
    }

    console.log(`Orders found for userId ${req.user.id}: ${orders.length}`, orders);
    res.json(orders);
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
app.post('/api/complete-coaching-order', authenticate, checkRole(['coach', 'admin']), async (req, res) => {
  const { orderId } = req.body;
  try {
    const [orderRows] = await pool.query(
      'SELECT status, coach_id FROM coaching_orders WHERE order_id = ? AND status = ?',
      [orderId, 'pending']
    );
    if (!orderRows.length) {
      return res.status(400).json({ error: 'Order not found or not in pending status' });
    }
    if (req.user.role !== 'admin' && orderRows[0].coach_id !== req.user.id) {
      return res.status(403).json({ error: 'Unauthorized: Not your coaching order' });
    }
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      await connection.query('UPDATE coaching_orders SET status = "completed" WHERE order_id = ?', [orderId]);
      await connection.commit();
      res.json({ success: true, message: 'Coaching order completed successfully' });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error completing coaching order:', error.message);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

app.post('/api/approve-coaching-payout', authenticate, checkRole(['admin']), async (req, res) => {
    const { orderId, userId } = req.body;
    try {
        if (!orderId || !userId) {
            return res.status(400).json({ error: 'Missing orderId or userId' });
        }
        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();
            // Fetch the coaching order
            const [orderRows] = await connection.query(
                'SELECT total_price, payout_status, coach_id FROM coaching_orders WHERE order_id = ? AND status = "completed"',
                [orderId]
            );
            if (!orderRows.length || !orderRows[0].coach_id) {
                await connection.rollback();
                return res.status(400).json({ error: 'Order not found, not completed, or no coach assigned' });
            }
            if (orderRows[0].payout_status === 'Paid') {
                await connection.rollback();
                return res.status(400).json({ error: 'Payout already processed' });
            }
            const coachId = orderRows[0].coach_id;
            const payout = parseFloat(orderRows[0].total_price) * 0.85; // Adjust multiplier as needed
            // Update coach's account balance
            await connection.query(
                'UPDATE users SET account_balance = account_balance + ? WHERE id = ?',
                [payout, coachId]
            );
            // Update payout status
            await connection.query(
                'UPDATE coaching_orders SET payout_status = "Paid" WHERE order_id = ?',
                [orderId]
            );
            await connection.commit();
            res.json({ success: true, message: 'Coaching payout approved successfully' });
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Error approving coaching payout:', error.message);
        res.status(500).json({ error: 'Internal server error', details: error.message });
    }
});

app.get('/api/completed-orders', authenticate, checkRole(['admin']), async (req, res) => {
    const { userId } = req.query;
    try {
        if (!userId) return res.status(400).json({ error: 'Missing userId' });
        const connection = await pool.getConnection();
        try {
            // Fetch completed boost orders
            const [boostRows] = await connection.query(`
                SELECT o.order_id, o.user_id, u.username AS customer_username, o.current_rank, o.desired_rank, 
                       o.current_lp, o.desired_lp, o.price, o.status, o.cashback, 
                       DATE_FORMAT(o.created_at, '%Y-%m-%dT%H:%i:%s.000Z') AS created_at, 
                       o.extras, o.payout_status, o.order_type, bo.booster_id, ub.username AS booster_username,
                       o.game_type
                FROM orders o
                LEFT JOIN booster_orders bo ON o.order_id = bo.order_id
                LEFT JOIN users u ON o.user_id = u.id
                LEFT JOIN users ub ON bo.booster_id = ub.id
                WHERE o.status = 'Completed'
            `);
            // Fetch completed coaching orders
            const [coachingRows] = await connection.query(`
                SELECT co.order_id, co.user_id, u.username AS customer_username, co.booked_hours, 
                       co.game_type, co.total_price AS price, co.status, co.cashback, 
                       DATE_FORMAT(co.created_at, '%Y-%m-%dT%H:%i:%s.000Z') AS created_at, 
                       co.payout_status, 'coaching' AS order_type, co.coach_id, uc.username AS coach_username
                FROM coaching_orders co
                LEFT JOIN users u ON co.user_id = u.id
                LEFT JOIN users uc ON co.coach_id = uc.id
                WHERE co.status = 'completed'
            `);
            // Combine and normalize orders
            const orders = [
                ...boostRows.map(order => ({
                    ...order,
                    booster_payout: (parseFloat(order.price) * 0.85).toFixed(2),
                    coach_id: null,
                    coach_username: null,
                    booked_hours: null,
                    game_type: order.game_type || 'League of Legends'
                })),
                ...coachingRows.map(order => ({
                    ...order,
                    booster_payout: (parseFloat(order.price) * 0.85).toFixed(2),
                    current_rank: null,
                    desired_rank: null,
                    current_lp: null,
                    desired_lp: null,
                    extras: null,
                    booster_id: null,
                    booster_username: null
                }))
            ];
            res.json(orders);
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Error fetching completed orders:', error.message);
        res.status(500).json({ error: 'Internal server error', details: error.message });
    }
});
app.post('/api/approve-coaching-payout', authenticate, checkRole(['admin']), async (req, res) => {
    const { orderId, userId } = req.body;
    try {
        if (!orderId || !userId) {
            return res.status(400).json({ error: 'Missing orderId or userId' });
        }
        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();
            // Fetch the coaching order
            const [orderRows] = await connection.query(
                'SELECT total_price, payout_status, coach_id FROM coaching_orders WHERE order_id = ? AND status = "completed"',
                [orderId]
            );
            if (!orderRows.length || !orderRows[0].coach_id) {
                await connection.rollback();
                return res.status(400).json({ error: 'Order not found, not completed, or no coach assigned' });
            }
            if (orderRows[0].payout_status === 'Paid') {
                await connection.rollback();
                return res.status(400).json({ error: 'Payout already processed' });
            }
            const coachId = orderRows[0].coach_id;
            const payout = parseFloat(orderRows[0].total_price) * 0.85; // Adjust multiplier as needed
            // Update coach's account balance
            await connection.query(
                'UPDATE users SET account_balance = account_balance + ? WHERE id = ?',
                [payout, coachId]
            );
            // Update payout status
            await connection.query(
                'UPDATE coaching_orders SET payout_status = "Paid" WHERE order_id = ?',
                [orderId]
            );
            await connection.commit();
            res.json({ success: true, message: 'Coaching payout approved successfully' });
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Error approving coaching payout:', error.message);
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
app.get('/api/coaches', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT u.id, u.username,
             TIMESTAMPDIFF(MINUTE, u.last_activity, NOW()) <= 8 AS online_status,
             cp.game_type, cp.bio, cp.price_per_hour,
             cp.lol_highest_rank, cp.valorant_highest_rank,
             cp.lol_preferred_lanes, cp.lol_preferred_champions,
             cp.valorant_preferred_roles, cp.valorant_preferred_agents
      FROM users u
      LEFT JOIN coach_profiles cp ON u.id = cp.user_id
      WHERE u.role = 'coach'
    `);
    res.json(rows);
  } catch (error) {
    console.error('Error fetching coaches:', error.message);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});
app.get('/api/coach-profile', authenticate, async (req, res) => {
  console.log('GET /api/coach-profile called with query:', req.query, 'user:', req.user);
  const userId = parseInt(req.query.userId) || req.user?.id;
  const role = req.user?.role;

  if (!userId || isNaN(userId)) {
    console.log('Invalid userId:', req.query.userId);
    return res.status(400).json({ error: 'Invalid or missing userId' });
  }

  if (role !== 'coach' && role !== 'admin') {
    console.log('Forbidden: User role is', role, 'userId:', userId);
    return res.status(403).json({ error: 'Forbidden: Only coaches and admins can access profiles' });
  }

  try {
    const [userRows] = await pool.query('SELECT id, username, role FROM users WHERE id = ?', [userId]);
    if (!userRows[0]) {
      console.log('User not found for userId:', userId);
      return res.status(404).json({ error: 'User not found' });
    }

    if (userRows[0].role !== 'coach' && role !== 'admin') {
      console.log('User is not a coach:', userRows[0].role, 'userId:', userId);
      return res.status(403).json({ error: 'User is not a coach' });
    }

    const [profileRows] = await pool.query(
      'SELECT user_id, game_type, bio, price_per_hour, lol_highest_rank, valorant_highest_rank, ' +
      'lol_preferred_lanes, lol_preferred_champions, valorant_preferred_roles, valorant_preferred_agents ' +
      'FROM coach_profiles WHERE user_id = ?',
      [userId]
    );

    const profile = profileRows[0] || {
      user_id: userId,
      game_type: null,
      bio: null,
      price_per_hour: null,
      lol_highest_rank: null,
      valorant_highest_rank: null,
      lol_preferred_lanes: null,
      lol_preferred_champions: null,
      valorant_preferred_roles: null,
      valorant_preferred_agents: null
    };

    const response = {
      ...profile,
      username: userRows[0].username || 'Unknown'
    };

    console.log('Fetched profile for userId:', userId, 'Profile:', response);
    res.json(response);
  } catch (error) {
    console.error('Error fetching coach profile:', error.message);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});
app.get('/api/my-coaching-orders', authenticate, checkRole(['coach', 'admin']), async (req, res) => {
  try {
    const userId = req.user.id;
    console.log(`Fetching coaching orders for coachId: ${userId}`);
    const [rows] = await pool.query(
      `SELECT order_id, user_id, booked_hours, game_type, total_price, coach_name, cashback,status, 
              DATE_FORMAT(created_at, "%Y-%m-%dT%H:%i:%s.000Z") AS created_at
       FROM coaching_orders
       WHERE coach_id = ?`,
      [userId]
    );
    console.log(`Coaching orders found for coachId ${userId}: ${rows.length}`, rows);
    res.json(rows);
  } catch (error) {
    console.error('Error fetching coaching orders:', error.message);
    res.status(500).json({ error: 'Failed to fetch coaching orders', details: error.message });
  }
});
app.post('/api/coach-profile', authenticate, async (req, res) => {
  console.log('POST /api/coach-profile called for userId:', req.user?.id, 'Body:', req.body);
  const userId = req.user.id;
  const role = req.user.role;
  const {
    game_type,
    bio,
    price_per_hour,
    lol_highest_rank,
    valorant_highest_rank,
    lol_preferred_lanes,
    lol_preferred_champions,
    valorant_preferred_roles,
    valorant_preferred_agents
  } = req.body;
  if (role !== 'coach') {
    console.log('Forbidden: User role is', role, 'userId:', userId);
    return res.status(403).json({ error: 'Forbidden' });
  }
  if (!game_type || !price_per_hour || isNaN(parseFloat(price_per_hour)) || price_per_hour <= 0) {
    console.log('Validation failed:', { game_type, price_per_hour });
    return res.status(400).json({ error: 'Missing or invalid required fields' });
  }
  try {
    const [existing] = await pool.query('SELECT * FROM coach_profiles WHERE user_id = ?', [userId]);
    if (existing.length > 0) {
      const [result] = await pool.query(
        `UPDATE coach_profiles SET
          game_type = ?, bio = ?, price_per_hour = ?,
          lol_highest_rank = ?, valorant_highest_rank = ?,
          lol_preferred_lanes = ?, lol_preferred_champions = ?,
          valorant_preferred_roles = ?, valorant_preferred_agents = ?,
          updated_at = NOW()
        WHERE user_id = ?`,
        [
          game_type, bio || '', parseFloat(price_per_hour),
          lol_highest_rank || null, valorant_highest_rank || null,
          lol_preferred_lanes || null, lol_preferred_champions || null,
          valorant_preferred_roles || null, valorant_preferred_agents || null,
          userId
        ]
      );
      if (result.affectedRows === 0) {
        return res.status(500).json({ error: 'Failed to update profile' });
      }
    } else {
      const [result] = await pool.query(
        `INSERT INTO coach_profiles (
          user_id, game_type, bio, price_per_hour,
          lol_highest_rank, valorant_highest_rank,
          lol_preferred_lanes, lol_preferred_champions,
          valorant_preferred_roles, valorant_preferred_agents,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [
          userId, game_type, bio || '', parseFloat(price_per_hour),
          lol_highest_rank || null, valorant_highest_rank || null,
          lol_preferred_lanes || null, lol_preferred_champions || null,
          valorant_preferred_roles || null, valorant_preferred_agents || null
        ]
      );
      if (result.affectedRows === 0) {
        return res.status(500).json({ error: 'Failed to create profile' });
      }
    }
    console.log('Profile saved for userId:', userId);
    res.json({ message: 'Profile saved successfully' });
  } catch (error) {
    console.error('Error saving coach profile:', error);
    res.status(500).json({ error: 'Failed to save profile' });
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
      WHERE u.role IN ('booster', 'admin')
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
    lol_highest_rank,
    valorant_highest_rank,
    lol_preferred_lanes,
    lol_preferred_champions,
    valorant_preferred_roles,
    valorant_preferred_agents,
    language,
    bio
  } = req.body;
  try {
    await pool.query(
      `INSERT INTO booster_profiles (
        user_id, lol_highest_rank, valorant_highest_rank, 
        lol_preferred_lanes, lol_preferred_champions, 
        valorant_preferred_roles, valorant_preferred_agents,
        language, bio, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
      ON DUPLICATE KEY UPDATE
        lol_highest_rank = VALUES(lol_highest_rank),
        valorant_highest_rank = VALUES(valorant_highest_rank),
        lol_preferred_lanes = VALUES(lol_preferred_lanes),
        lol_preferred_champions = VALUES(lol_preferred_champions),
        valorant_preferred_roles = VALUES(valorant_preferred_roles),
        valorant_preferred_agents = VALUES(valorant_preferred_agents),
        language = VALUES(language),
        bio = VALUES(bio),
        updated_at = NOW()`,
      [
        req.user.id,
        lol_highest_rank || null,
        valorant_highest_rank || null,
        lol_preferred_lanes || null,
        lol_preferred_champions || null,
        valorant_preferred_roles || null,
        valorant_preferred_agents || null,
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

app.post('/admin/update-role', async (req, res) => {
    const { userId, newRole, adminUserId } = req.body;

    try {
        const [adminRows] = await pool.query('SELECT role FROM users WHERE id = ?', [adminUserId]);
        if (!adminRows.length || adminRows[0].role !== 'admin') {
            return res.status(403).json({ error: 'Unauthorized: Only admins can update roles' });
        }

        await pool.query('UPDATE users SET role = ? WHERE id = ?', [newRole, userId]);
        console.log(`Updated user ${userId} to role ${newRole} by admin ${adminUserId}`);
        res.json({ success: true });
    } catch (err) {
        console.error('Error updating user role:', err.message);
        res.status(500).json({ error: 'Database error', details: err.message });
    }
});

app.get('/admin/users', authenticate, checkRole(['admin']), async (req, res) => {
  try {
    const [users] = await pool.query('SELECT id, username, email, role, account_balance FROM users');
    res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error.message);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});


app.get('/api/coupons', authenticate, checkRole(['admin']), async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM coupons');
    res.json(rows);
  } catch (error) {
    console.error('Error fetching coupons:', error.message);
    res.status(500).json({ error: 'Database error', details: error.message });
  }
});

app.post('/api/coupons', authenticate, checkRole(['admin']), async (req, res) => {
  const { code, lol_discount_percentage, valorant_discount_percentage } = req.body;
  try {
    if (!code || lol_discount_percentage < 0 || valorant_discount_percentage < 0) {
      return res.status(400).json({ error: 'Invalid input' });
    }
    const [existing] = await pool.query('SELECT id FROM coupons WHERE code = ?', [code.toUpperCase()]);
    if (existing.length > 0) {
      return res.status(400).json({ error: 'Coupon code already exists' });
    }
    await pool.query(
      'INSERT INTO coupons (code, lol_discount_percentage, valorant_discount_percentage) VALUES (?, ?, ?)',
      [code.toUpperCase(), lol_discount_percentage, valorant_discount_percentage]
    );
    res.json({ message: 'Coupon created' });
  } catch (error) {
    console.error('Error creating coupon:', error.message);
    res.status(500).json({ error: 'Database error', details: error.message });
  }
});

app.delete('/api/coupons/:id', authenticate, checkRole(['admin']), async (req, res) => {
  const { id } = req.params;
  try {
    const [result] = await pool.query('DELETE FROM coupons WHERE id = ?', [id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Coupon not found' });
    }
    res.json({ message: 'Coupon deleted' });
  } catch (error) {
    console.error('Error deleting coupon:', error.message);
    res.status(500).json({ error: 'Failed to delete coupon', details: error.message });
  }
});

app.post('/api/apply-coupon', async (req, res) => {
  const { code, game } = req.body;
  try {
    const [rows] = await pool.query('SELECT * FROM coupons WHERE code = ?', [code.toUpperCase()]);
    if (rows.length === 0) {
      return res.status(400).json({ error: 'Invalid coupon code' });
    }
    const coupon = rows[0];
    const discount = game === 'lol' ? coupon.lol_discount_percentage : coupon.valorant_discount_percentage;
    if (discount <= 0) {
      return res.status(400).json({ error: `No discount available for ${game}` });
    }
    res.json({ discount_percentage: discount });
  } catch (error) {
    console.error('Error applying coupon:', error.message);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

app.get('/api/coupons/latest', async (req, res) => {
  const { game } = req.query;
  if (!game || !['league', 'valorant'].includes(game.toLowerCase())) {
    return res.status(400).json({ error: 'Missing or invalid game parameter' });
  }

  try {
    const field = game === 'league' ? 'lol_discount_percentage' : 'valorant_discount_percentage';
    const [rows] = await pool.query(`
      SELECT code, ${field} AS discount
      FROM coupons
      WHERE ${field} > 0
      ORDER BY created_at DESC
      LIMIT 1
    `);
    
    if (rows.length === 0) {
      return res.status(404).json({ error: 'No coupons found' });
    }

    res.json(rows[0]);
  } catch (err) {
    console.error('Error fetching latest coupon:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});


const PORT = process.env.PORT || 3000;

// GET latest coupon for League or Valorant
app.get('/api/latest-coupon', async (req, res) => {
  const game = req.query.game;
  if (!['League', 'Valorant'].includes(game)) {
    return res.status(400).json({ error: 'Invalid game type' });
  }

  try {
    const [rows] = await pool.query(`
      SELECT code, lol_discount_percentage, valorant_discount_percentage
      FROM coupons ORDER BY created_at DESC LIMIT 1
    `);
    if (!rows.length) return res.json({ code: '', discount: 0 });

    const latest = rows[0];
    const discount = game === 'League' ? latest.lol_discount_percentage : latest.valorant_discount_percentage;
    res.json({ code: latest.code, discount });
  } catch (err) {
    console.error('Error fetching latest coupon:', err.message);
    res.status(500).json({ error: 'Failed to fetch latest coupon' });
  }
});
// Clean URLs for other pages
app.get('/league', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'league-services.html'));
});
app.get('/valorant', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'valorant-services.html'));
});
app.get('/checkout', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'checkout.html'));
});
app.get('/boosters', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'boosters.html'));
});
app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});
app.get('/confirmation', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'confirmation.html'));
});
app.get('/coaching', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'coaching.html'));
});
app.get('/application', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'application.html'));
});

// Redirect .html to clean URLs
app.get('/index.html', (req, res) => {
    res.redirect(301, '/');
});
app.get('/league-services.html', (req, res) => {
    res.redirect(301, '/league');
});
app.get('/valorant-services.html', (req, res) => {
    res.redirect(301, '/valorant');
});
app.get('/checkout.html', (req, res) => {
    res.redirect(301, '/checkout');
});
app.get('/boosters.html', (req, res) => {
    res.redirect(301, '/boosters');
});
app.get('/dashboard.html', (req, res) => {
    res.redirect(301, '/dashboard');
});
app.get('/confirmation.html', (req, res) => {
    res.redirect(301, '/confirmation');
});
app.get('/coaching.html', (req, res) => {
    res.redirect(301, '/coaching');
});
app.get('/application.html', (req, res) => {
    res.redirect(301, '/application');
});

// 404 for unknown routes
app.get('*', (req, res) => {
    res.status(404).sendFile(path.join(__dirname, 'public', '404.html'));
});

app.listen(PORT, async () => {
    console.log(`Server running on port ${PORT}`);
    await initializeDatabase();
});