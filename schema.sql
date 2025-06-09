
-- schema.sql for chboosting.com
-- Run in MySQL Workbench to set up the database and tables

-- Create the database
CREATE DATABASE IF NOT EXISTS chboosting_new;
USE chboosting_new;

-- Drop existing tables to avoid conflicts (use with caution)
DROP TABLE IF EXISTS order_messages;
DROP TABLE IF EXISTS password_reset_tokens;
DROP TABLE IF EXISTS order_credentials;
DROP TABLE IF EXISTS booster_orders;
DROP TABLE IF EXISTS orders;
DROP TABLE IF EXISTS users;

-- Create the users table
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role ENUM('user', 'booster', 'admin') DEFAULT 'user',
    account_balance DECIMAL(10,2) DEFAULT 0.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create the orders table
CREATE TABLE orders (
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
    game_type ENUM('League of Legends', 'Valorant') NOT NULL DEFAULT 'League of Legends',
    extras JSON DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create the booster_orders table
CREATE TABLE booster_orders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_id VARCHAR(255) NOT NULL,
    booster_id INT NOT NULL,
    claimed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE,
    FOREIGN KEY (booster_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create the order_credentials table
CREATE TABLE order_credentials (
    order_id VARCHAR(255) PRIMARY KEY,
    account_username VARCHAR(255) NOT NULL,
    account_password_hash VARCHAR(255) NOT NULL,
    plaintext_password VARCHAR(255) NOT NULL,
    summoner_name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE
);

-- Create the password_reset_tokens table
CREATE TABLE password_reset_tokens (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    token VARCHAR(36) NOT NULL,
    expires DATETIME NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_id (user_id),
    INDEX idx_token (token)
);

-- Create the order_messages table
CREATE TABLE order_messages (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_id VARCHAR(255) NOT NULL,
    sender_id INT NOT NULL,
    message TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE,
    FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_order_id (order_id),
    INDEX idx_sender_id (sender_id)
);

-- Drop and recreate the MySQL user
DROP USER IF EXISTS 'chboosting_new'@'localhost';
CREATE USER 'chboosting_new'@'localhost' IDENTIFIED BY 'NewSecurePass2025!';
GRANT ALL PRIVILEGES ON chboosting_new.* TO 'chboosting_new'@'localhost';
FLUSH PRIVILEGES;
