-- SQLite counterpart to the operational entities documented in
-- WBI_BUSINESS_AND_DATA_REFERENCE.md, section 7. This is a local reporting
-- schema; it is not a replacement for the authoritative PostgreSQL database.
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS date_dim (
  date_id INTEGER PRIMARY KEY,
  calendar_date TEXT NOT NULL UNIQUE
);
CREATE TABLE IF NOT EXISTS time_dim (
  time_id INTEGER PRIMARY KEY,
  time_value TEXT NOT NULL UNIQUE
);
CREATE TABLE IF NOT EXISTS shift (
  shift_id INTEGER PRIMARY KEY,
  shift_name TEXT NOT NULL UNIQUE,
  start_time TEXT,
  end_time TEXT
);
-- Legacy BW lookup entities remain separate from the newer list tables.
CREATE TABLE IF NOT EXISTS operator (
  operator_id INTEGER PRIMARY KEY,
  operator_name TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS machine (
  machine_id INTEGER PRIMARY KEY,
  machine_code TEXT NOT NULL UNIQUE
);
CREATE TABLE IF NOT EXISTS product (
  product_id INTEGER PRIMARY KEY,
  product_name TEXT NOT NULL UNIQUE
);
CREATE TABLE IF NOT EXISTS status (
  status_id INTEGER PRIMARY KEY,
  status_name TEXT NOT NULL UNIQUE
);
CREATE TABLE IF NOT EXISTS role (
  role_id INTEGER PRIMARY KEY,
  role_name TEXT NOT NULL UNIQUE
);
CREATE TABLE IF NOT EXISTS machine_type (
  machine_type_id INTEGER PRIMARY KEY,
  type_name TEXT NOT NULL UNIQUE
);
CREATE TABLE IF NOT EXISTS operator_role (
  operator_id INTEGER NOT NULL REFERENCES operator(operator_id),
  role_id INTEGER NOT NULL REFERENCES role(role_id),
  PRIMARY KEY (operator_id,role_id)
);
CREATE TABLE IF NOT EXISTS machine_type_map (
  machine_id INTEGER NOT NULL REFERENCES machine(machine_id),
  machine_type_id INTEGER NOT NULL REFERENCES machine_type(machine_type_id),
  PRIMARY KEY (machine_id,machine_type_id)
);
CREATE TABLE IF NOT EXISTS product_status (
  status_id INTEGER PRIMARY KEY,
  status_name TEXT NOT NULL UNIQUE
);
CREATE TABLE IF NOT EXISTS product_status_map (
  product_id INTEGER NOT NULL REFERENCES product(product_id),
  status_id INTEGER NOT NULL REFERENCES product_status(status_id),
  PRIMARY KEY (product_id,status_id)
);
CREATE TABLE IF NOT EXISTS status_list (
  status_id INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  status_code TEXT,
  description TEXT,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0,1)),
  created_at TEXT,
  updated_at TEXT
);
CREATE TABLE IF NOT EXISTS products_list (
  product_id INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  product_code TEXT,
  description TEXT,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0,1)),
  created_at TEXT,
  updated_at TEXT
);
CREATE TABLE IF NOT EXISTS operators_list (
  operator_id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  employee_code TEXT,
  operator_type TEXT NOT NULL CHECK (operator_type IN ('HB','BW')),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0,1)),
  created_at TEXT,
  updated_at TEXT
);
CREATE TABLE IF NOT EXISTS machine_list (
  machine_id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  machine_type TEXT NOT NULL CHECK (machine_type IN ('HB','BW')),
  location TEXT,
  machine_code TEXT UNIQUE,
  ideal_rate_per_hour REAL CHECK (ideal_rate_per_hour IS NULL OR ideal_rate_per_hour >= 0),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0,1)),
  created_at TEXT,
  updated_at TEXT
);
CREATE TABLE IF NOT EXISTS raw_material (
  raw_material_id INTEGER PRIMARY KEY,
  raw_material_name TEXT NOT NULL UNIQUE,
  min_level REAL CHECK (min_level IS NULL OR min_level >= 0),
  max_level REAL CHECK (max_level IS NULL OR max_level >= 0),
  CHECK (min_level IS NULL OR max_level IS NULL OR min_level <= max_level)
);
CREATE TABLE IF NOT EXISTS manufacturing_bw (
  manufacturing_id INTEGER PRIMARY KEY,
  date_id INTEGER REFERENCES date_dim(date_id),
  operator_id INTEGER REFERENCES operator(operator_id),
  machine_id INTEGER REFERENCES machine(machine_id),
  shift_id INTEGER REFERENCES shift(shift_id),
  product_id INTEGER REFERENCES product(product_id),
  status_id INTEGER REFERENCES status(status_id),
  weight_produced REAL NOT NULL CHECK (weight_produced > 0),
  start_time TEXT,
  end_time TEXT,
  downtime_minutes REAL CHECK (downtime_minutes IS NULL OR downtime_minutes >= 0),
  downtime_reason TEXT,
  good_weight REAL CHECK (good_weight IS NULL OR good_weight >= 0),
  scrap_weight REAL CHECK (scrap_weight IS NULL OR scrap_weight >= 0),
  rejection_reason TEXT,
  rework_flag INTEGER CHECK (rework_flag IS NULL OR rework_flag IN (0,1)),
  created_at TEXT,
  updated_at TEXT,
  deleted_at TEXT
);
CREATE TABLE IF NOT EXISTS manufacturing_hb (
  manufacturing_id INTEGER PRIMARY KEY,
  date_id INTEGER REFERENCES date_dim(date_id),
  operator_id INTEGER REFERENCES operators_list(operator_id),
  machine_id INTEGER REFERENCES machine_list(machine_id),
  shift_id INTEGER REFERENCES shift(shift_id),
  product_id INTEGER REFERENCES products_list(product_id),
  role_id INTEGER REFERENCES role(role_id),
  status TEXT,
  weight_produced REAL NOT NULL CHECK (weight_produced > 0),
  start_time TEXT,
  end_time TEXT,
  downtime_minutes REAL CHECK (downtime_minutes IS NULL OR downtime_minutes >= 0),
  downtime_reason TEXT,
  good_weight REAL CHECK (good_weight IS NULL OR good_weight >= 0),
  scrap_weight REAL CHECK (scrap_weight IS NULL OR scrap_weight >= 0),
  rejection_reason TEXT,
  rework_flag INTEGER CHECK (rework_flag IS NULL OR rework_flag IN (0,1)),
  created_at TEXT,
  updated_at TEXT,
  deleted_at TEXT
);
CREATE TABLE IF NOT EXISTS stock_position (
  stock_position_id INTEGER PRIMARY KEY,
  raw_material_id INTEGER REFERENCES raw_material(raw_material_id),
  date_id INTEGER REFERENCES date_dim(date_id),
  time_id INTEGER REFERENCES time_dim(time_id),
  weight REAL NOT NULL CHECK (weight >= 0),
  deleted_at TEXT
);
CREATE TABLE IF NOT EXISTS machine_maintenance (
  maintenance_id INTEGER PRIMARY KEY,
  machine_id INTEGER NOT NULL REFERENCES machine_list(machine_id),
  maintenance_date TEXT NOT NULL,
  maintenance_type TEXT NOT NULL CHECK (maintenance_type IN ('planned','unplanned')),
  description TEXT,
  downtime_minutes REAL NOT NULL DEFAULT 0 CHECK (downtime_minutes >= 0),
  cost REAL CHECK (cost IS NULL OR cost >= 0),
  performed_by TEXT,
  created_at TEXT,
  updated_at TEXT,
  deleted_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_mfg_bw_date ON manufacturing_bw(date_id);
CREATE INDEX IF NOT EXISTS idx_mfg_bw_operator ON manufacturing_bw(operator_id);
CREATE INDEX IF NOT EXISTS idx_mfg_bw_machine ON manufacturing_bw(machine_id);
CREATE INDEX IF NOT EXISTS idx_mfg_hb_date ON manufacturing_hb(date_id);
CREATE INDEX IF NOT EXISTS idx_mfg_hb_operator ON manufacturing_hb(operator_id);
CREATE INDEX IF NOT EXISTS idx_mfg_hb_machine ON manufacturing_hb(machine_id);
CREATE INDEX IF NOT EXISTS idx_stock_material_date ON stock_position(raw_material_id,date_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_machine_date ON machine_maintenance(machine_id,maintenance_date);
