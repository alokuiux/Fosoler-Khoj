CREATE DATABASE IF NOT EXISTS fosoler_khoj
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE fosoler_khoj;

CREATE TABLE IF NOT EXISTS users (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(190) NOT NULL UNIQUE,
  phone VARCHAR(25),
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('farmer','buyer','expert','supplier','admin') NOT NULL,
  status ENUM('active','suspended') NOT NULL DEFAULT 'active',
  division VARCHAR(80),
  district VARCHAR(80),
  village VARCHAR(120),
  bio VARCHAR(500),
  language ENUM('en','bn') NOT NULL DEFAULT 'en',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS listings (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  farmer_id INT UNSIGNED NOT NULL,
  crop_name VARCHAR(160) NOT NULL,
  quantity DECIMAL(14,2) NOT NULL,
  unit VARCHAR(30) NOT NULL DEFAULT 'kg',
  price DECIMAL(14,2) NOT NULL,
  location VARCHAR(200),
  selling_info VARCHAR(500),
  status ENUM('available','sold','hidden') NOT NULL DEFAULT 'available',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_listings_farmer (farmer_id),
  INDEX idx_listings_status (status),
  CONSTRAINT fk_listings_farmer FOREIGN KEY (farmer_id) REFERENCES users(id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
