-- ============================================
-- TEMPSENSE DATABASE SCHEMA
-- Maxworth Techserv - Cold Chain IoT Platform
-- ============================================

-- 1. ACCOUNTS (Top-level organizations)
CREATE TABLE IF NOT EXISTS accounts (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(200) NOT NULL,
  created_at  TIMESTAMP DEFAULT NOW()
);

-- 2. SITES (Facilities / Warehouses)
CREATE TABLE IF NOT EXISTS sites (
  id          SERIAL PRIMARY KEY,
  account_id  INT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name        VARCHAR(200) NOT NULL,
  location    VARCHAR(300),
  created_at  TIMESTAMP DEFAULT NOW()
);

-- 3. ROOMS (Cold storage chambers within a site)
CREATE TABLE IF NOT EXISTS rooms (
  id          SERIAL PRIMARY KEY,
  site_id     INT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  name        VARCHAR(200) NOT NULL,
  created_at  TIMESTAMP DEFAULT NOW()
);

-- 4. NODES (Sensor hardware units mapped to rooms)
CREATE TABLE IF NOT EXISTS nodes (
  id              SERIAL PRIMARY KEY,
  room_id         INT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  device_id       INT NOT NULL UNIQUE,
  name            VARCHAR(200) NOT NULL,
  ip_address      VARCHAR(45),
  tcp_port        INT DEFAULT 1024,
  sampling_interval INT DEFAULT 5,
  temp_high       FLOAT DEFAULT 30.0,
  temp_low        FLOAT DEFAULT 2.0,
  humidity_high   FLOAT DEFAULT 80.0,
  humidity_low    FLOAT DEFAULT 20.0,
  is_active       BOOLEAN DEFAULT TRUE,
  last_seen       TIMESTAMP,
  created_at      TIMESTAMP DEFAULT NOW()
);

-- 5. USERS (Role-Based Access Control)
CREATE TABLE IF NOT EXISTS users (
  id          SERIAL PRIMARY KEY,
  account_id  INT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  email       VARCHAR(255) NOT NULL UNIQUE,
  password    VARCHAR(255) NOT NULL,
  name        VARCHAR(200) NOT NULL,
  role        VARCHAR(20) NOT NULL DEFAULT 'viewer'
              CHECK (role IN ('super_admin', 'site_admin', 'viewer')),
  site_ids    INT[] DEFAULT '{}',
  created_at  TIMESTAMP DEFAULT NOW()
);

-- 6. SENSOR DATA (Time-series readings)
CREATE TABLE IF NOT EXISTS sensor_data (
  id          BIGSERIAL PRIMARY KEY,
  node_id     INT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  t1          FLOAT,
  t2          FLOAT,
  td          FLOAT,
  humidity    FLOAT,
  recorded_at TIMESTAMP DEFAULT NOW()
);

-- Index for fast time-range queries
CREATE INDEX IF NOT EXISTS idx_sensor_data_node_time
  ON sensor_data (node_id, recorded_at DESC);

-- 7. ALERTS (Email alert log - one per hour per node enforcement)
CREATE TABLE IF NOT EXISTS alerts (
  id          BIGSERIAL PRIMARY KEY,
  node_id     INT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  alert_type  VARCHAR(50) NOT NULL,
  message     TEXT,
  sent_to     VARCHAR(255),
  sent_at     TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alerts_node_time
  ON alerts (node_id, sent_at DESC);

-- Seed: Default account & super admin
INSERT INTO accounts (name) VALUES ('Maxworth Techserv')
  ON CONFLICT DO NOTHING;
