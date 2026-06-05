import initSqlJs, { type Database } from "sql.js";
import crypto from "crypto";
import * as fs from "fs";
import * as path from "path";

// CJS-compatible __dirname (works after esbuild CJS bundle)
declare const __dirname: string;

export let db: Database;
let dbFilePath: string;

function now(): string { return new Date().toISOString(); }
function ri(l: string, i: number): string {
  if (l === "outer") return `10.${Math.floor(i/10)}.${i%10}.${Math.floor(Math.random()*254)+1}`;
  return `172.16.${i}.${Math.floor(Math.random()*254)+1}`;
}
function gPri() { return crypto.randomBytes(32).toString("base64"); }
function gPub(p: string) { return crypto.createHash("sha256").update(p).digest("base64"); }

const REGIONS = [
  "US-East","US-West","EU-North","EU-Central","EU-South",
  "AP-Tokyo","AP-Singapore","AP-Seoul","SA-Brazil","AU-Sydney",
  "CA-Toronto","UK-London","DE-Frankfurt","FR-Paris","NL-Amsterdam",
  "SE-Stockholm","JP-Osaka","KR-Seoul","IN-Mumbai","ZA-Johannesburg",
];

export function saveDb(): void {
  if (!db || !dbFilePath) return;
  const data = db.export();
  fs.writeFileSync(dbFilePath, Buffer.from(data));
}

function initSchema(): void {
  db.run(`
    CREATE TABLE IF NOT EXISTS nodes (
      id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, layer TEXT NOT NULL,
      hop_index INTEGER NOT NULL, region TEXT NOT NULL, ip_address TEXT NOT NULL,
      public_key TEXT NOT NULL, private_key TEXT NOT NULL, listen_port INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'active', has_beacon INTEGER NOT NULL DEFAULT 1,
      has_spider INTEGER NOT NULL DEFAULT 1, has_worm INTEGER NOT NULL DEFAULT 1,
      latency_ms REAL NOT NULL DEFAULT 0, last_seen TEXT, created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS beacon_alerts (
      id INTEGER PRIMARY KEY AUTOINCREMENT, node_id INTEGER NOT NULL,
      node_name TEXT NOT NULL, node_layer TEXT NOT NULL, attacker_ip TEXT NOT NULL,
      attacker_fingerprint TEXT NOT NULL, probe_type TEXT NOT NULL, severity TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active', silk_web_trapped INTEGER NOT NULL DEFAULT 0,
      raw_data TEXT, detected_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS silk_web (
      id INTEGER PRIMARY KEY AUTOINCREMENT, generation_id TEXT NOT NULL,
      total_routes INTEGER NOT NULL DEFAULT 0, dead_end_routes INTEGER NOT NULL DEFAULT 0,
      active_highways INTEGER NOT NULL DEFAULT 0, intersections INTEGER NOT NULL DEFAULT 0,
      last_collapsed_at TEXT, created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS silk_routes (
      id INTEGER PRIMARY KEY AUTOINCREMENT, web_id INTEGER NOT NULL,
      from_node_id INTEGER NOT NULL, to_node_id INTEGER NOT NULL,
      route_type TEXT NOT NULL, is_active INTEGER NOT NULL DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS trapped_attackers (
      id INTEGER PRIMARY KEY AUTOINCREMENT, ip TEXT NOT NULL, fingerprint TEXT NOT NULL,
      entry_node_id INTEGER NOT NULL, loop_count INTEGER NOT NULL DEFAULT 0,
      trapped_at TEXT NOT NULL, data_collected TEXT NOT NULL DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS firewall_rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, direction TEXT NOT NULL,
      action TEXT NOT NULL, protocol TEXT NOT NULL, source_ip TEXT, source_port TEXT,
      dest_ip TEXT, dest_port TEXT, priority INTEGER NOT NULL DEFAULT 100,
      enabled INTEGER NOT NULL DEFAULT 1, hit_count INTEGER NOT NULL DEFAULT 0,
      description TEXT, is_isp_masquerade INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS firewall_status (
      id INTEGER PRIMARY KEY AUTOINCREMENT, enabled INTEGER NOT NULL DEFAULT 1,
      mode TEXT NOT NULL DEFAULT 'stealth', packets_blocked INTEGER NOT NULL DEFAULT 0,
      packets_allowed INTEGER NOT NULL DEFAULT 0,
      isp_masquerade_active INTEGER NOT NULL DEFAULT 1,
      localhost_hidden INTEGER NOT NULL DEFAULT 1, dns_masked INTEGER NOT NULL DEFAULT 1,
      last_updated TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS blocked_ips (
      id INTEGER PRIMARY KEY AUTOINCREMENT, ip TEXT NOT NULL, reason TEXT NOT NULL,
      auto_blocked INTEGER NOT NULL DEFAULT 0, hit_count INTEGER NOT NULL DEFAULT 1,
      blocked_at TEXT NOT NULL, expires_at TEXT
    );
    CREATE TABLE IF NOT EXISTS ghost_trap_config (
      id INTEGER PRIMARY KEY AUTOINCREMENT, user_token TEXT UNIQUE,
      device_mode TEXT NOT NULL DEFAULT 'personal',
      user_domain TEXT, user_detected_ip TEXT,
      enabled INTEGER NOT NULL DEFAULT 1,
      tarpit_min_ms INTEGER NOT NULL DEFAULT 1500,
      tarpit_max_ms INTEGER NOT NULL DEFAULT 8000,
      auto_block_after INTEGER NOT NULL DEFAULT 5,
      silk_trap_after INTEGER NOT NULL DEFAULT 3,
      fake_site_name TEXT NOT NULL DEFAULT 'AdminPanel v2.1',
      fake_db_version TEXT NOT NULL DEFAULT 'MySQL 5.7.39-log',
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS ghost_trap_probes (
      id INTEGER PRIMARY KEY AUTOINCREMENT, probe_id TEXT NOT NULL UNIQUE,
      attacker_ip TEXT NOT NULL, attacker_port INTEGER,
      attacker_ua TEXT, method TEXT NOT NULL, endpoint TEXT NOT NULL,
      probe_type TEXT NOT NULL DEFAULT 'other', attack_vector TEXT,
      fake_response TEXT, tarpit_ms INTEGER NOT NULL DEFAULT 0,
      auto_blocked INTEGER NOT NULL DEFAULT 0, silk_trapped INTEGER NOT NULL DEFAULT 0,
      beacon_fired INTEGER NOT NULL DEFAULT 0, beacon_fired_at TEXT,
      hop_chain TEXT, probe_headers TEXT,
      vpn_detected INTEGER NOT NULL DEFAULT 0, tor_detected INTEGER NOT NULL DEFAULT 0,
      geo_country TEXT, geo_city TEXT, geo_isp TEXT, geo_org TEXT,
      geo_asn TEXT, geo_timezone TEXT,
      probed_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS ghost_trap_beacons (
      id INTEGER PRIMARY KEY AUTOINCREMENT, probe_id TEXT NOT NULL,
      attacker_ip TEXT NOT NULL, beacon_type TEXT NOT NULL DEFAULT 'http',
      payload TEXT, fired_at TEXT NOT NULL
    );
  `);
}

function seedData(): void {
  const count = (db.exec("SELECT COUNT(*) c FROM nodes")[0]?.values?.[0]?.[0] ?? 0) as number;
  if (count > 0) return;

  const n = now();
  for (let i = 1; i <= 50; i++) {
    const priv = gPri();
    db.run(
      `INSERT INTO nodes (name, layer, hop_index, region, ip_address, public_key, private_key, listen_port, status, has_beacon, has_spider, has_worm, latency_ms, last_seen, created_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [`outer-node-${String(i).padStart(2,"0")}`, "outer", i, REGIONS[i % REGIONS.length],
       ri("outer", i), gPub(priv), priv, 51820+i, "active", 1, 1, 1,
       Math.round((Math.random()*80+5)*10)/10, n, n]
    );
  }
  for (let i = 1; i <= 10; i++) {
    const priv = gPri();
    db.run(
      `INSERT INTO nodes (name, layer, hop_index, region, ip_address, public_key, private_key, listen_port, status, has_beacon, has_spider, has_worm, latency_ms, last_seen, created_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [`inner-node-${String(i).padStart(2,"0")}`, "inner", i, REGIONS[(i+5) % REGIONS.length],
       ri("inner", i), gPub(priv), priv, 52820+i, "active", 1, 1, 1,
       Math.round((Math.random()*30+2)*10)/10, n, n]
    );
  }

  db.run(
    `INSERT INTO firewall_status (enabled, mode, packets_blocked, packets_allowed, isp_masquerade_active, localhost_hidden, dns_masked, last_updated)
     VALUES (1, 'stealth', 0, 0, 1, 1, 1, ?)`, [n]
  );

  const rules = [
    ["Block All Inbound", "inbound", "deny", "any", null, null, null, null, 1, "Default deny all inbound", 0],
    ["Allow WireGuard", "inbound", "allow", "udp", null, null, null, "51820", 10, "WireGuard tunnel port", 0],
    ["ISP Masquerade", "outbound", "masquerade", "any", null, null, null, null, 5, "Mask traffic as normal ISP traffic", 1],
    ["Allow Established", "inbound", "allow", "tcp", null, null, null, null, 20, "Allow established connections", 0],
    ["Block Tor Ports", "outbound", "deny", "tcp", null, null, null, "9001,9030", 15, "Block Tor exit port exposure", 0],
  ];
  for (const r of rules) {
    db.run(
      `INSERT INTO firewall_rules (name, direction, action, protocol, source_ip, source_port, dest_ip, dest_port, priority, description, is_isp_masquerade, enabled, hit_count, created_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,1,0,?)`,
      [...r, n]
    );
  }
  saveDb();
}

// ─── Query helpers ────────────────────────────────────────────────────────────
export function query<T = Record<string, unknown>>(sql: string, params: unknown[] = []): T[] {
  const stmt = db.prepare(sql);
  const rows: T[] = [];
  stmt.bind(params as any);
  while (stmt.step()) {
    rows.push(stmt.getAsObject() as T);
  }
  stmt.free();
  return rows;
}

export function queryOne<T = Record<string, unknown>>(sql: string, params: unknown[] = []): T | null {
  const rows = query<T>(sql, params);
  return rows[0] ?? null;
}

export function run(sql: string, params: unknown[] = []): void {
  db.run(sql, params as any);
  saveDb();
}

export function lastInsertId(): number {
  return (db.exec("SELECT last_insert_rowid()")[0]?.values?.[0]?.[0] ?? 0) as number;
}

export async function initDb(dataDir: string): Promise<void> {
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  dbFilePath = path.join(dataDir, "ghostnet.db");

  const SQL = await initSqlJs();
  const fileBuffer = fs.existsSync(dbFilePath) ? fs.readFileSync(dbFilePath) : undefined;
  db = new SQL.Database(fileBuffer);
  db.run("PRAGMA journal_mode = WAL");

  initSchema();
  seedData();

  setInterval(saveDb, 30_000);
}
