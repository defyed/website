-- schema.sql for chboosting.com
-- Run in MySQL Workbench to update the database
-- Preserves existing data

CREATE DATABASE IF NOT EXISTS chboosting_new;
USE chboosting_new;

CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role ENUM('user', 'booster', 'admin') DEFAULT 'user',
    account_balance DECIMAL(10,2) DEFAULT 0.00,
    last_activity DATETIME DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS orders (
    order_id VARCHAR(255) PRIMARY KEY,
    user_id INT NOT NULL,
    current_rank VARCHAR(50) NOT NULL,
    desired_rank VARCHAR(50) NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    status ENUM('Pending', 'Claimed', 'In Progress', 'Completed') DEFAULT 'Pending',
    cashback DECIMAL(10,2) DEFAULT 0.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    current_lp INT DEFAULT 0,
    desired_lp INT DEFAULT 0,
    current_master_lp INT DEFAULT 0,
    desired_master_lp INT DEFAULT 0,
    extras JSON DEFAULT NULL,
    payout_status ENUM('Pending', 'Paid') DEFAULT 'Pending',
    game_type VARCHAR(50) NOT NULL DEFAULT 'League of Legends',
    CONSTRAINT orders_ibfk_1 FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

ALTER TABLE orders MODIFY game_type VARCHAR(50) NOT NULL DEFAULT 'League of Legends';

CREATE TABLE IF NOT EXISTS booster_orders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_id VARCHAR(255) NOT NULL,
    booster_id INT NOT NULL,
    claimed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT booster_orders_ibfk_1 FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE,
    CONSTRAINT booster_orders_ibfk_2 FOREIGN KEY (booster_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS order_credentials (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_id VARCHAR(255) NOT NULL,
    account_username VARCHAR(255) NOT NULL,
    account_password_hash VARCHAR(255) NOT NULL,
    plaintext_password VARCHAR(255) NOT NULL,
    summoner_name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT order_credentials_ibfk_1 FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE
);

ALTER TABLE order_credentials DROP PRIMARY KEY, ADD id INT AUTO_INCREMENT PRIMARY KEY FIRST, MODIFY order_id VARCHAR(255) NOT NULL;

CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    token VARCHAR(36) NOT NULL,
    expires DATETIME NOT NULL,
    CONSTRAINT password_reset_tokens_ibfk_1 FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_id (user_id),
    INDEX idx_token (token)
);

CREATE TABLE IF NOT EXISTS order_messages (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_id VARCHAR(255) NOT NULL,
    sender_id INT NOT NULL,
    message TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT order_messages_ibfk_1 FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE,
    CONSTRAINT order_messages_ibfk_2 FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS payout_requests (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    status ENUM('pending', 'approved', 'rejected', 'paid') DEFAULT 'pending',
    payment_method VARCHAR(50) DEFAULT NULL,
    payment_details VARCHAR(255) DEFAULT NULL,
    requested_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    processed_at DATETIME DEFAULT NULL,
    admin_notes TEXT,
    CONSTRAINT payout_requests_ibfk_1 FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_payout_requests_user_id (user_id),
    INDEX idx_payout_requests_status (status)
);

CREATE TABLE IF NOT EXISTS booster_profiles (
    user_id INT PRIMARY KEY,
    online_status TINYINT(1) DEFAULT 0,
    lol_highest_rank VARCHAR(50) DEFAULT NULL,
    valorant_highest_rank VARCHAR(50) DEFAULT NULL,
    lol_preferred_lanes TEXT,
    lol_preferred_champions TEXT,
    valorant_preferred_agents TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    valorant_preferred_roles TEXT,
    language TEXT,
    bio TEXT,
    CONSTRAINT booster_profiles_ibfk_1 FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS credential_access_log (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_id VARCHAR(255) NOT NULL,
    booster_id INT NOT NULL,
    accessed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT credential_access_log_ibfk_1 FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE,
    CONSTRAINT credential_access_log_ibfk_2 FOREIGN KEY (booster_id) REFERENCES users(id) ON DELETE CASCADE
);