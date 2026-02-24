const SQL_INIT = `
CREATE TABLE IF NOT EXISTS users (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  email           TEXT,
  username        TEXT,
  password_hash   TEXT,
  role            TEXT NOT NULL DEFAULT 'user',
  status          INTEGER NOT NULL DEFAULT 0,
  deleted_at      INTEGER,
  created_at      INTEGER NOT NULL,
  updated_at      INTEGER
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
CREATE TABLE IF NOT EXISTS api_tokens (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id         INTEGER NOT NULL,
  name            TEXT,
  token_hash      TEXT NOT NULL,
  scopes          TEXT,
  status          INTEGER NOT NULL DEFAULT 0,
  last_used_at    INTEGER,
  expires_at      INTEGER,
  created_at      INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_api_tokens_token_hash ON api_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_api_tokens_user_id ON api_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_api_tokens_status ON api_tokens(status);
CREATE INDEX IF NOT EXISTS idx_api_tokens_expires_at ON api_tokens(expires_at);
CREATE TABLE IF NOT EXISTS domains (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  host            TEXT NOT NULL,
  is_active       INTEGER NOT NULL DEFAULT 0,
  is_default      INTEGER NOT NULL DEFAULT 0,
  notes           TEXT,
  error_template_id       INTEGER,
  password_template_id    INTEGER,
  interstitial_template_id INTEGER,
  created_at      INTEGER NOT NULL,
  updated_at      INTEGER
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_domains_host ON domains(host);
CREATE INDEX IF NOT EXISTS idx_domains_active ON domains(is_active);
CREATE INDEX IF NOT EXISTS idx_domains_default ON domains(is_default);
CREATE INDEX IF NOT EXISTS idx_domains_error_tpl ON domains(error_template_id);
CREATE INDEX IF NOT EXISTS idx_domains_password_tpl ON domains(password_template_id);
CREATE INDEX IF NOT EXISTS idx_domains_interstitial_tpl ON domains(interstitial_template_id);
CREATE TABLE IF NOT EXISTS redirect_templates (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  name            TEXT NOT NULL,
  content_type    INTEGER NOT NULL DEFAULT 0,
  html_content    TEXT,
  main_file       TEXT,
  asset_prefix    TEXT,
  is_active       INTEGER NOT NULL DEFAULT 1,
  type            INTEGER,
  created_by      INTEGER,
  created_at      INTEGER NOT NULL,
  updated_at      INTEGER
);
CREATE INDEX IF NOT EXISTS idx_redirect_templates_active ON redirect_templates(is_active);
CREATE INDEX IF NOT EXISTS idx_redirect_templates_created_by ON redirect_templates(created_by);
CREATE INDEX IF NOT EXISTS idx_redirect_templates_asset_prefix ON redirect_templates(asset_prefix);
CREATE INDEX IF NOT EXISTS idx_redirect_templates_content_type ON redirect_templates(content_type);
CREATE TABLE IF NOT EXISTS short_links (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  domain_id          INTEGER NOT NULL,
  code               TEXT NOT NULL,
  target_url         TEXT NOT NULL,
  owner_user_id      INTEGER NOT NULL,
  redirect_http_code INTEGER NOT NULL DEFAULT 302,
  use_interstitial   INTEGER NOT NULL DEFAULT 0,
  interstitial_delay INTEGER NOT NULL DEFAULT 0,
  force_interstitial INTEGER NOT NULL DEFAULT 0,
  template_id        INTEGER,
  error_template_id    INTEGER,
  password_template_id INTEGER,
  password          TEXT,
  max_visits        INTEGER,
  expire_at         INTEGER,
  is_disabled       INTEGER NOT NULL DEFAULT 0,
  deleted_at        INTEGER,
  remark            TEXT,
  created_at        INTEGER NOT NULL,
  updated_at        INTEGER,
  total_clicks      INTEGER NOT NULL DEFAULT 0,
  last_access_at    INTEGER
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_short_links_domain_code ON short_links(domain_id, code);
CREATE INDEX IF NOT EXISTS idx_short_links_owner ON short_links(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_short_links_deleted ON short_links(deleted_at);
CREATE INDEX IF NOT EXISTS idx_short_links_disabled ON short_links(is_disabled);
CREATE INDEX IF NOT EXISTS idx_short_links_expire_at ON short_links(expire_at);
CREATE INDEX IF NOT EXISTS idx_short_links_template ON short_links(template_id);
CREATE INDEX IF NOT EXISTS idx_short_links_error_tpl ON short_links(error_template_id);
CREATE INDEX IF NOT EXISTS idx_short_links_password_tpl ON short_links(password_template_id);
CREATE INDEX IF NOT EXISTS idx_short_links_last_access ON short_links(last_access_at);
CREATE INDEX IF NOT EXISTS idx_short_links_force_interstitial ON short_links(force_interstitial);
CREATE TABLE IF NOT EXISTS tags (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT NOT NULL,
  created_at    INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_tags_name ON tags(name);
CREATE TABLE IF NOT EXISTS short_link_tags (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  short_link_id INTEGER NOT NULL,
  tag_id        INTEGER NOT NULL,
  created_at    INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_slt_unique ON short_link_tags(short_link_id, tag_id);
CREATE INDEX IF NOT EXISTS idx_slt_short_link ON short_link_tags(short_link_id);
CREATE INDEX IF NOT EXISTS idx_slt_tag ON short_link_tags(tag_id);
CREATE TABLE IF NOT EXISTS link_visit_events (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  short_link_id   INTEGER NOT NULL,
  domain_id       INTEGER NOT NULL,
  code            TEXT NOT NULL,
  visited_at      INTEGER NOT NULL,
  ip              TEXT,
  ua              TEXT,
  referer         TEXT,
  country         TEXT,
  region          TEXT,
  city            TEXT,
  device_type     TEXT,
  os              TEXT,
  browser         TEXT,
  is_blocked      INTEGER NOT NULL DEFAULT 0,
  block_reason    TEXT,
  http_status     INTEGER
);
CREATE INDEX IF NOT EXISTS idx_lve_link_time ON link_visit_events(short_link_id, visited_at);
CREATE INDEX IF NOT EXISTS idx_lve_time ON link_visit_events(visited_at);
CREATE INDEX IF NOT EXISTS idx_lve_domain_code_time ON link_visit_events(domain_id, code, visited_at);
CREATE INDEX IF NOT EXISTS idx_lve_country ON link_visit_events(country);
CREATE INDEX IF NOT EXISTS idx_lve_blocked ON link_visit_events(is_blocked);
CREATE TABLE IF NOT EXISTS link_visit_stats_daily (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  short_link_id   INTEGER NOT NULL,
  day             TEXT NOT NULL,
  clicks          INTEGER NOT NULL DEFAULT 0,
  blocked         INTEGER NOT NULL DEFAULT 0,
  unique_ips      INTEGER NOT NULL DEFAULT 0,
  unique_users    INTEGER NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_lvsd_unique ON link_visit_stats_daily(short_link_id, day);
CREATE INDEX IF NOT EXISTS idx_lvsd_day ON link_visit_stats_daily(day);
CREATE TABLE IF NOT EXISTS app_settings (
  key         TEXT PRIMARY KEY,
  value       TEXT NOT NULL,
  updated_at  INTEGER
);
CREATE TABLE IF NOT EXISTS template_assets (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  asset_prefix    TEXT NOT NULL,
  filename        TEXT NOT NULL,
  content_type    TEXT,
  size            INTEGER,
  checksum        TEXT,
  storage_type    INTEGER NOT NULL DEFAULT 0,
  content         BLOB,
  r2_key          TEXT,
  is_public       INTEGER NOT NULL DEFAULT 0,
  alt_text        TEXT,
  created_at      INTEGER NOT NULL,
  updated_at      INTEGER
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_template_assets_prefix_filename ON template_assets(asset_prefix, filename);
CREATE UNIQUE INDEX IF NOT EXISTS idx_template_assets_r2_key ON template_assets(r2_key);
CREATE INDEX IF NOT EXISTS idx_template_assets_prefix ON template_assets(asset_prefix);
CREATE INDEX IF NOT EXISTS idx_template_assets_checksum ON template_assets(checksum);
CREATE INDEX IF NOT EXISTS idx_template_assets_storage_type ON template_assets(storage_type);
CREATE INDEX IF NOT EXISTS idx_template_assets_public ON template_assets(is_public);
`;

const TEMPLATE_DATA = [
	{ id: 1, name: 'error', type: 0 },
	{ id: 2, name: 'password', type: 1 },
	{ id: 3, name: 'middle', type: 2 },
	{ id: 4, name: 'error-cn', type: 2 },
	{ id: 5, name: 'password-cn', type: 1 },
	{ id: 6, name: 'middle-cn', type: 2 }
];

export async function initializeDatabase(db: D1Database): Promise<void> {
	try {
		await db.prepare("SELECT 1 FROM users LIMIT 1").first();
		console.log('Database already initialized');
		return;
	} catch (error: any) {
		if (!error.message?.includes('no such table')) {
			console.error('Unexpected error checking database:', error);
			return;
		}
	}

	console.log('Initializing database...');

	const statements = SQL_INIT.split(';').filter(s => s.trim().length > 0);
	let successCount = 0;
	let failCount = 0;

	for (const statement of statements) {
		try {
			await db.prepare(statement).run();
			successCount++;
		} catch (error) {
			console.error('Failed to execute statement:', statement, error);
			failCount++;
			throw error;
		}
	}

	console.log(`Database schema created: ${successCount} statements executed, ${failCount} failed`);

	const now = Math.floor(Date.now() / 1000);
	let templateSuccessCount = 0;

	for (const template of TEMPLATE_DATA) {
		try {
			await db.prepare(
				`INSERT INTO redirect_templates (id, name, content_type, type, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`
			).bind(template.id, template.name, 0, template.type, 1, now, now).run();
			templateSuccessCount++;
		} catch (error) {
			console.error('Failed to insert template:', template.name, error);
			throw error;
		}
	}

	console.log(`Default templates inserted: ${templateSuccessCount}/${TEMPLATE_DATA.length}`);
	console.log('Database initialized successfully');

	try {
		const testTables = await db.prepare(
			"SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
		).all<{ name: string }>();
		console.log('Tables in database:', testTables.results.map(t => t.name));
	} catch (error) {
		console.error('Failed to list tables:', error);
	}
}
