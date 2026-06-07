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
  location        VARCHAR(300),
  ip_address      VARCHAR(45),
  tcp_port        INT DEFAULT 1024,
  sampling_interval INT DEFAULT 5,
  temp_high       FLOAT DEFAULT 30.0,
  temp_low        FLOAT DEFAULT 2.0,
  humidity_high   FLOAT DEFAULT 80.0,
  humidity_low    FLOAT DEFAULT 20.0,
  is_active       BOOLEAN DEFAULT TRUE,
  reboot_required BOOLEAN DEFAULT FALSE,
  last_seen       TIMESTAMP,
  notes           TEXT,
  created_at      TIMESTAMP DEFAULT NOW()
);

-- 5. USERS (Role-Based Access Control)
CREATE TABLE IF NOT EXISTS users (
  id          SERIAL PRIMARY KEY,
  account_id  INT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  email       VARCHAR(255) NOT NULL UNIQUE,
  password    VARCHAR(255) NOT NULL,
  name        VARCHAR(200) NOT NULL,
  role        VARCHAR(20) NOT NULL DEFAULT 'customer'
              CHECK (role IN ('super_admin', 'admin', 'site_manager', 'customer')),
  phone       VARCHAR(20),
  profile_completed BOOLEAN DEFAULT FALSE,
  is_hidden_super_admin BOOLEAN DEFAULT FALSE,
  site_ids    INT[] DEFAULT '{}',
  room_ids    INT[] DEFAULT '{}',
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

-- 8. SMTP SETTINGS
CREATE TABLE IF NOT EXISTS smtp_settings (
  id           SERIAL PRIMARY KEY,
  use_custom   BOOLEAN DEFAULT FALSE,
  host         VARCHAR(255),
  port         INT,
  user_email   VARCHAR(255),
  password     VARCHAR(255),
  secure       BOOLEAN DEFAULT FALSE,
  sender_name  VARCHAR(255),
  updated_at   TIMESTAMP DEFAULT NOW()
);

-- 9. SCHEDULED REPORTS
CREATE TABLE IF NOT EXISTS scheduled_reports (
  id           SERIAL PRIMARY KEY,
  name         VARCHAR(200) NOT NULL,
  frequency    VARCHAR(20) NOT NULL, -- 'daily', 'weekly', 'monthly'
  recipients   TEXT NOT NULL, -- Comma separated emails
  site_id      INT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  report_type  VARCHAR(20) DEFAULT 'pdf', -- 'pdf', 'csv', 'both'
  is_active    BOOLEAN DEFAULT TRUE,
  last_run     TIMESTAMP,
  created_at   TIMESTAMP DEFAULT NOW()
);

-- 10. EMAIL LOGS
CREATE TABLE IF NOT EXISTS email_logs (
  id           SERIAL PRIMARY KEY,
  type         VARCHAR(50), -- 'alert', 'scheduled_report'
  recipient    TEXT,
  status       VARCHAR(20), -- 'success', 'failure'
  error_message TEXT,
  sent_at      TIMESTAMP DEFAULT NOW()
);

-- 11. USER INVITATIONS (Email invitations)
CREATE TABLE IF NOT EXISTS user_invitations (
  id          SERIAL PRIMARY KEY,
  user_id     INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token       VARCHAR(255) NOT NULL UNIQUE,
  created_at  TIMESTAMP DEFAULT NOW(),
  expires_at  TIMESTAMP NOT NULL
);

-- Seed: Default account
INSERT INTO accounts (name) VALUES ('Maxworth Techserv')
  ON CONFLICT DO NOTHING;
