const mysql = require('mysql2/promise');

const config = {
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'fosoler_khoj',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  charset: 'utf8mb4'
};

let pool;

async function init() {
  // XAMPP's default MySQL/MariaDB user is usually root with an empty password.
  const admin = await mysql.createConnection({
    host: config.host, port: config.port, user: config.user,
    password: config.password, charset: 'utf8mb4'
  });
  await admin.query(
    `CREATE DATABASE IF NOT EXISTS \`${config.database.replace(/`/g, '')}\`
     CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
  );
  await admin.end();

  pool = mysql.createPool(config);

  await pool.query(`
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
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await pool.query(`
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
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await seed();
}

async function seed() {
  const [rows] = await pool.query('SELECT COUNT(*) AS n FROM users');
  if (Number(rows[0].n) > 0) return;

  const adminHash = require('bcryptjs').hashSync('Admin@123', 10);
  const demoHash = require('bcryptjs').hashSync('Demo@1234', 10);

  const [admin] = await pool.execute(
    `INSERT INTO users(name,email,phone,password_hash,role,division,district,village)
     VALUES(?,?,?,?,?,?,?,?)`,
    ['System Admin','admin@fosolerkhoj.com','01700000000',adminHash,'admin','Dhaka','Dhaka','']
  );

  const [farmer] = await pool.execute(
    `INSERT INTO users(name,email,phone,password_hash,role,division,district,village)
     VALUES(?,?,?,?,?,?,?,?)`,
    ['Abdul Karim','farmer@demo.com','01711111111',demoHash,'farmer','Rajshahi','Natore','Singra']
  );

  await pool.execute(
    `INSERT INTO users(name,email,phone,password_hash,role,division,district,village)
     VALUES(?,?,?,?,?,?,?,?)`,
    ['Rina Traders','buyer@demo.com','01722222222',demoHash,'buyer','Dhaka','Dhaka','Karwan Bazar']
  );

  await pool.execute(
    `INSERT INTO listings(farmer_id,crop_name,quantity,unit,price,location,selling_info)
     VALUES(?,?,?,?,?,?,?)`,
    [farmer.insertId,'Aman Rice',1200,'kg',48,'Singra, Natore','Harvested last week. Pickup from field or delivery within Rajshahi.']
  );
  await pool.execute(
    `INSERT INTO listings(farmer_id,crop_name,quantity,unit,price,location,selling_info)
     VALUES(?,?,?,?,?,?,?)`,
    [farmer.insertId,'Potato (Diamant)',800,'kg',32,'Singra, Natore','Cold-storage ready. Minimum order 100 kg.']
  );

  console.log('MySQL database initialized with demo accounts.');
}

async function get(sql, params = []) {
  const [rows] = await pool.execute(sql, params);
  return rows[0];
}
async function all(sql, params = []) {
  const [rows] = await pool.execute(sql, params);
  return rows;
}
async function run(sql, params = []) {
  const [result] = await pool.execute(sql, params);
  return result;
}
async function close() {
  if (pool) await pool.end();
}

module.exports = { init, get, all, run, close, config };
