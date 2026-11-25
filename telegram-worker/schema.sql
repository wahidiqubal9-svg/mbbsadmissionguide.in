CREATE TABLE IF NOT EXISTS leads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  name TEXT, phone TEXT, neet TEXT, path TEXT, state TEXT,
  india_path TEXT, neet_score TEXT, country TEXT, budget TEXT, note TEXT,
  utm_source TEXT, utm_medium TEXT, utm_campaign TEXT, landing TEXT,
  referrer TEXT, gclid TEXT, ip_country TEXT, ua TEXT,
  score INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'new',
  called_at TEXT, closed_won INTEGER NOT NULL DEFAULT 0, closed_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_leads_created ON leads(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status, created_at DESC);
