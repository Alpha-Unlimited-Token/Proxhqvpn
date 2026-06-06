import express, { type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import pinoHttp from "pino-http";
import pino from "pino";
import { exec } from "child_process";
import { promisify } from "util";
import os from "os";
import crypto from "crypto";
import * as path from "path";
import * as fs from "fs";
import { z } from "zod";

import { initDb, query, queryOne, run, lastInsertId, saveDb } from "./db.js";

const execAsync = promisify(exec);

const DATA_DIR = process.env.PROXHQVPN_DATA
  ? path.resolve(process.env.PROXHQVPN_DATA)
  : path.join(process.cwd(), "data");

const PORT = parseInt(process.env.PORT || "7474");

// ─── Helpers ──────────────────────────────────────────────────────────────────
function ri(layer: string, hopIndex: number): string {
  if (layer === "outer") return `10.${Math.floor(hopIndex/10)}.${hopIndex%10}.${Math.floor(Math.random()*254)+1}`;
  return `172.16.${hopIndex}.${Math.floor(Math.random()*254)+1}`;
}
function genPri() { return crypto.randomBytes(32).toString("base64"); }
function genPub(p: string) { return crypto.createHash("sha256").update(p).digest("base64"); }
function rb(min: number, max: number) { return Math.round((Math.random()*(max-min)+min)*10)/10; }
function randIp() { return `${rb(10,200)}.${rb(0,254)}.${rb(0,254)}.${rb(1,254)}`; }
function randFingerprint() {
  const os_s = ["Linux/5.15","Windows/11","macOS/14","FreeBSD/13"][Math.floor(Math.random()*4)];
  return `OS:${os_s}|TTL:${[64,128,255][Math.floor(Math.random()*3)]}|UA:${Math.random().toString(36).substring(7)}`;
}
function n() { return new Date().toISOString(); }

const PROBES = ["ping","port_scan","traceroute","packet_sniff","tunnel_probe"] as const;
const SEVS = ["low","medium","high","critical"] as const;
const ROUTE_TYPES = ["highway","dead_end","decoy","collapse_zone"] as const;
const SIMULATED_EXT_IP = `${rb(100,200)}.${rb(0,254)}.${rb(0,254)}.${rb(1,254)}`;

type ProxyMode = "direct" | "proxhqvpn-onion" | "tor-gateway" | "double-layer";
let proxyConfig = { mode: "proxhqvpn-onion" as ProxyMode, socks5Host: "127.0.0.1", socks5Port: 9050 };

async function createApp() {
  // Initialize database
  await initDb(DATA_DIR);

  const logger = pino({ level: "info" });
  const app = express();

  app.use(pinoHttp({ logger,
    serializers: {
      req(req) { return { method: req.method, url: req.url?.split("?")[0] }; },
      res(res) { return { statusCode: res.statusCode }; },
    },
  }));

  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "blob:"],
        connectSrc: ["'self'"],
        fontSrc: ["'self'", "data:"],
        objectSrc: ["'none'"],
        frameSrc: ["'self'"],
      },
    },
    crossOriginEmbedderPolicy: false,
  }));

  app.use(cors({ origin: true, credentials: true }));
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: false }));

  const globalLimiter = rateLimit({ windowMs: 60_000, max: 500 });
  const mutateLimiter = rateLimit({ windowMs: 60_000, max: 100 });
  const terminalLimiter = rateLimit({ windowMs: 60_000, max: 30 });
  const sqlLimiter = rateLimit({ windowMs: 60_000, max: 60 });
  app.use(globalLimiter);

  // ─── Health ──────────────────────────────────────────────────────────────
  const APP_VERSION = "2.0.0";

  app.get("/api/healthz", (_req, res) => {
    res.json({ status: "ok", version: APP_VERSION, timestamp: n() });
  });

  // ─── Update check (standalone auto-updater) ──────────────────────────────
  app.get("/api/update/check", (_req, res) => {
    res.json({
      version: APP_VERSION,
      releaseDate: "2026-06-05",
      changelog: [
        "Ghost Trap honeypot — personal device mode (IP:port lure URLs) and website/server mode (domain path lure URLs)",
        "Per-user Ghost Trap isolation — each user's probes, beacons, and config are completely private",
        "Auto-detects device type and builds trap URLs accordingly",
        "Deploy configs: nginx proxy block (server mode) and iptables/Linux (device mode)",
        "Instant law-enforcement incident report download for every attacker probe",
        "JWT Analyzer — JWKS injection, X5U injection, Embedded JWK, kid SQL/path injection, Claim Escalation attacks",
        "Subdomain Scanner — 9 passive OSINT sources (crt.sh, AlienVault OTX, HackerTarget, URLScan.io, Wayback, AnubisDB, RapidDNS, ThreatCrowd, BufferOver)",
        "Directory Fuzzer — recursive scanning up to depth 3, response-size filtering",
        "Canary Tokens — 12 token types including AWS Key, Redirect URL, SQL Token, PowerShell, PDF, Slack Webhook",
        "Kill Switch — full IPv6 leak protection with ip6tables mirroring",
        "DNS Sinkhole — Pi-hole style per-category blocking (Ads/Trackers/Malware/Phishing/Cryptomining/Botnet/Adult)",
        "Network Monitor — real-time traffic flow analysis across all VPN nodes",
        "Security Event Log (SIEM) — unified event timeline with severity filtering",
        "OSINT Recon — DNS, TLS, HTTP headers, email security, ASN fingerprinting",
        "QuantumAudit — standalone blockchain security auditing for classical + post-quantum vulnerabilities",
      ],
      downloadUrls: {
        windows: "/downloads/ProxhqVPN-Windows-x64.zip",
        macArm64: "/downloads/ProxhqVPN-macOS-arm64.zip",
        macX64:   "/downloads/ProxhqVPN-macOS-x64.zip",
        linux:    "/downloads/ProxhqVPN-Linux-x64.zip",
        universal:"/downloads/ProxhqVPN-Universal-NodeJS.zip",
        all:      "/downloads/ProxhqVPN-ALL-PLATFORMS.zip",
      },
    });
  });

  // ─── Nodes ───────────────────────────────────────────────────────────────
  app.get("/api/nodes", (req, res) => {
    const { layer } = req.query as { layer?: string };
    const all = query("SELECT * FROM nodes ORDER BY layer, hop_index");
    const filtered = layer && layer !== "all" ? all.filter((nd: any) => nd.layer === layer) : all;
    const mapped = filtered.map((nd: any) => ({ ...nd, hasBeacon: !!nd.has_beacon, hasSpider: !!nd.has_spider, hasWorm: !!nd.has_worm, hopIndex: nd.hop_index, ipAddress: nd.ip_address, publicKey: nd.public_key, privateKey: nd.private_key, listenPort: nd.listen_port, latencyMs: nd.latency_ms, lastSeen: nd.last_seen, createdAt: nd.created_at }));
    res.json({ nodes: mapped, total: mapped.length, outerCount: all.filter((n: any) => n.layer==="outer").length, innerCount: all.filter((n: any) => n.layer==="inner").length });
  });

  app.get("/api/nodes/:id", (req, res) => {
    const nd: any = queryOne("SELECT * FROM nodes WHERE id=?", [parseInt(String(req.params.id))]);
    if (!nd) return res.status(404).json({ error: "Node not found" });
    res.json({ ...nd, hasBeacon: !!nd.has_beacon, hasSpider: !!nd.has_spider, hasWorm: !!nd.has_worm });
  });

  app.post("/api/nodes", mutateLimiter, (req, res) => {
    const body = z.object({ name: z.string(), layer: z.enum(["outer","inner"]), region: z.string(), hasBeacon: z.boolean().default(true), hasSpider: z.boolean().default(true), hasWorm: z.boolean().default(true) }).parse(req.body);
    const existing = query("SELECT id FROM nodes WHERE layer=?", [body.layer]);
    const hopIndex = existing.length + 1;
    const priv = genPri();
    run(`INSERT INTO nodes (name, layer, hop_index, region, ip_address, public_key, private_key, listen_port, status, has_beacon, has_spider, has_worm, latency_ms, last_seen, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [body.name, body.layer, hopIndex, body.region, ri(body.layer, hopIndex), genPub(priv), priv, 51820+hopIndex, "active", body.hasBeacon?1:0, body.hasSpider?1:0, body.hasWorm?1:0, rb(5,80), n(), n()]);
    res.status(201).json({ id: lastInsertId(), ...body, hopIndex, status: "active" });
  });

  app.put("/api/nodes/:id", mutateLimiter, (req, res) => {
    const id = parseInt(String(req.params.id));
    const nd: any = queryOne("SELECT * FROM nodes WHERE id=?", [id]);
    if (!nd) return res.status(404).json({ error: "Node not found" });
    const body = z.object({ name: z.string().optional(), region: z.string().optional(), status: z.string().optional(), hasBeacon: z.boolean().optional(), hasSpider: z.boolean().optional(), hasWorm: z.boolean().optional() }).parse(req.body);
    run(`UPDATE nodes SET name=COALESCE(?,name), region=COALESCE(?,region), status=COALESCE(?,status), has_beacon=COALESCE(?,has_beacon), has_spider=COALESCE(?,has_spider), has_worm=COALESCE(?,has_worm), last_seen=? WHERE id=?`,
      [body.name??null, body.region??null, body.status??null, body.hasBeacon!=null?body.hasBeacon?1:0:null, body.hasSpider!=null?body.hasSpider?1:0:null, body.hasWorm!=null?body.hasWorm?1:0:null, n(), id]);
    res.json(queryOne("SELECT * FROM nodes WHERE id=?", [id]));
  });

  app.delete("/api/nodes/:id", mutateLimiter, (req, res) => {
    run("DELETE FROM nodes WHERE id=?", [parseInt(String(req.params.id))]);
    res.json({ deleted: true });
  });

  app.post("/api/nodes/:id/rotate-ip", mutateLimiter, (req, res) => {
    const id = parseInt(String(req.params.id));
    const nd: any = queryOne("SELECT * FROM nodes WHERE id=?", [id]);
    if (!nd) return res.status(404).json({ error: "Node not found" });
    const prevIp = nd.ip_address;
    const newIp = ri(nd.layer, nd.hop_index);
    run("UPDATE nodes SET ip_address=?, status='active', last_seen=? WHERE id=?", [newIp, n(), id]);
    res.json({ previousIp: prevIp, newIp, node: queryOne("SELECT * FROM nodes WHERE id=?", [id]) });
  });

  app.post("/api/nodes/bulk-rotate", mutateLimiter, (req, res) => {
    const { layer } = req.body as { layer?: string };
    const nodes: any[] = layer ? query("SELECT * FROM nodes WHERE layer=?", [layer]) : query("SELECT * FROM nodes");
    const ts = n();
    for (const nd of nodes) run("UPDATE nodes SET ip_address=?, last_seen=? WHERE id=?", [ri(nd.layer, nd.hop_index), ts, nd.id]);
    res.json({ rotated: nodes.length, layer: layer ?? "all" });
  });

  app.post("/api/nodes/:id/replace", mutateLimiter, (req, res) => {
    const id = parseInt(String(req.params.id));
    const nd: any = queryOne("SELECT * FROM nodes WHERE id=?", [id]);
    if (!nd) return res.status(404).json({ error: "Node not found" });
    const priv = genPri();
    run("UPDATE nodes SET ip_address=?, private_key=?, public_key=?, listen_port=?, latency_ms=?, status='active', last_seen=? WHERE id=?",
      [ri(nd.layer, nd.hop_index), priv, genPub(priv), 51820+nd.hop_index+Math.floor(Math.random()*50), rb(3,80), n(), id]);
    res.json(queryOne("SELECT * FROM nodes WHERE id=?", [id]));
  });

  app.post("/api/nodes/shuffle-all", mutateLimiter, (req, res) => {
    const nodes: any[] = query("SELECT * FROM nodes");
    const ts = n();
    for (const nd of nodes) run("UPDATE nodes SET ip_address=?, status='active', last_seen=? WHERE id=?", [ri(nd.layer, nd.hop_index), ts, nd.id]);
    res.json({ shuffled: nodes.length, timestamp: ts });
  });

  // ─── Beacons ──────────────────────────────────────────────────────────────
  app.get("/api/beacons", (req, res) => {
    const { status } = req.query as { status?: string };
    let alerts = query("SELECT * FROM beacon_alerts ORDER BY detected_at DESC");
    if (status && status !== "all") alerts = alerts.filter((a: any) => a.status === status);
    const mapped = alerts.map((a: any) => ({ ...a, silkWebTrapped: !!a.silk_web_trapped, nodeId: a.node_id, nodeName: a.node_name, nodeLayer: a.node_layer, attackerIp: a.attacker_ip, attackerFingerprint: a.attacker_fingerprint, probeType: a.probe_type, detectedAt: a.detected_at }));
    res.json({ alerts: mapped, total: mapped.length, activeCount: mapped.filter((a: any) => a.status==="active").length });
  });

  function insertAlert(nodeId: number, nodeName: string, nodeLayer: string, attackerIp: string, probeType: string, severity: string, trapped: boolean) {
    const ts = n();
    run(`INSERT INTO beacon_alerts (node_id, node_name, node_layer, attacker_ip, attacker_fingerprint, probe_type, severity, status, silk_web_trapped, raw_data, detected_at)
         VALUES (?,?,?,?,?,?,?,'active',?,?,?)`,
      [nodeId, nodeName, nodeLayer, attackerIp, randFingerprint(), probeType, severity, trapped?1:0, JSON.stringify({ timestamp: ts, ip: attackerIp }), ts]);
    return lastInsertId();
  }

  app.post("/api/beacons/trigger", mutateLimiter, (req, res) => {
    const body = z.object({ nodeId: z.number(), simulatedIp: z.string().optional(), probeType: z.enum(PROBES) }).parse(req.body);
    const nd: any = queryOne("SELECT * FROM nodes WHERE id=?", [body.nodeId]);
    if (!nd) return res.status(404).json({ error: "Node not found" });
    const id = insertAlert(body.nodeId, nd.name, nd.layer, body.simulatedIp||randIp(), body.probeType, SEVS[Math.floor(Math.random()*4)], Math.random()>0.5);
    res.status(201).json(queryOne("SELECT * FROM beacon_alerts WHERE id=?", [id]));
  });

  app.post("/api/beacons/simulate", mutateLimiter, (req, res) => {
    const nodes: any[] = query("SELECT * FROM nodes");
    if (!nodes.length) return res.status(400).json({ error: "No nodes" });
    const count = Math.floor(Math.random()*5)+1;
    const ids = [];
    for (let i = 0; i < count; i++) {
      const nd = nodes[Math.floor(Math.random()*nodes.length)];
      ids.push(insertAlert(nd.id, nd.name, nd.layer, randIp(), PROBES[Math.floor(Math.random()*5)], SEVS[Math.floor(Math.random()*4)], Math.random()>0.5));
    }
    res.json({ simulated: count, alerts: ids.map(id => queryOne("SELECT * FROM beacon_alerts WHERE id=?", [id])) });
  });

  app.patch("/api/beacons/:id/dismiss", mutateLimiter, (req, res) => {
    const id = parseInt(String(req.params.id));
    const a: any = queryOne("SELECT * FROM beacon_alerts WHERE id=?", [id]);
    if (!a) return res.status(404).json({ error: "Alert not found" });
    run("UPDATE beacon_alerts SET status='dismissed' WHERE id=?", [id]);
    res.json(queryOne("SELECT * FROM beacon_alerts WHERE id=?", [id]));
  });

  app.delete("/api/beacons/clear-dismissed", mutateLimiter, (_req, res) => {
    run("DELETE FROM beacon_alerts WHERE status='dismissed'", []);
    res.json({ cleared: true });
  });

  app.get("/api/beacons/stats", (_req, res) => {
    const alerts: any[] = query("SELECT * FROM beacon_alerts");
    res.json({ total: alerts.length, active: alerts.filter(a => a.status==="active").length, dismissed: alerts.filter(a => a.status==="dismissed").length,
      bySeverity: { critical: alerts.filter(a => a.severity==="critical").length, high: alerts.filter(a => a.severity==="high").length, medium: alerts.filter(a => a.severity==="medium").length, low: alerts.filter(a => a.severity==="low").length },
      silkWebTrapped: alerts.filter(a => a.silk_web_trapped).length });
  });

  // ─── Silk Web ─────────────────────────────────────────────────────────────
  function ensureWeb() {
    let web: any = queryOne("SELECT * FROM silk_web ORDER BY created_at DESC LIMIT 1");
    if (web) return web;
    const nodes: any[] = query("SELECT * FROM nodes");
    const genId = crypto.randomUUID().substring(0,8).toUpperCase();
    const totalRoutes = Math.min(nodes.length*2, 200);
    const deadEnds = Math.floor(totalRoutes*0.4);
    run(`INSERT INTO silk_web (generation_id, total_routes, dead_end_routes, active_highways, intersections, created_at) VALUES (?,?,?,?,?,?)`,
      [genId, totalRoutes, deadEnds, Math.floor(totalRoutes*0.3), Math.floor(totalRoutes*0.2), n()]);
    const webId = lastInsertId();
    if (nodes.length >= 2) {
      let cnt = 0;
      for (let i = 0; i < Math.min(totalRoutes, 50); i++) {
        const from = nodes[Math.floor(Math.random()*nodes.length)];
        const to = nodes[Math.floor(Math.random()*nodes.length)];
        if (from.id !== to.id) {
          run("INSERT INTO silk_routes (web_id, from_node_id, to_node_id, route_type, is_active) VALUES (?,?,?,?,1)",
            [webId, from.id, to.id, i < deadEnds ? "dead_end" : ROUTE_TYPES[Math.floor(Math.random()*4)]]);
          cnt++;
        }
      }
      run("UPDATE silk_web SET total_routes=? WHERE id=?", [cnt, webId]);
    }
    return queryOne("SELECT * FROM silk_web WHERE id=?", [webId]);
  }

  app.get("/api/silkweb", (_req, res) => {
    const web = ensureWeb();
    const routes = query("SELECT * FROM silk_routes WHERE web_id=? LIMIT 20", [(web as any).id]);
    const attackers = query("SELECT * FROM trapped_attackers");
    res.json({ web, routes, trappedAttackers: attackers, stats: { totalRoutes: (web as any).total_routes, deadEndRoutes: (web as any).dead_end_routes, activeHighways: (web as any).active_highways, intersections: (web as any).intersections, trappedCount: attackers.length } });
  });

  app.post("/api/silkweb/regenerate", mutateLimiter, (_req, res) => {
    run("DELETE FROM silk_routes", []);
    run("DELETE FROM silk_web", []);
    res.json({ regenerated: true, web: ensureWeb() });
  });

  app.post("/api/silkweb/trap", mutateLimiter, (req, res) => {
    const body = z.object({ ip: z.string(), fingerprint: z.string().optional(), entryNodeId: z.number() }).parse(req.body);
    run("INSERT INTO trapped_attackers (ip, fingerprint, entry_node_id, loop_count, trapped_at, data_collected) VALUES (?,?,?,1,?,?)",
      [body.ip, body.fingerprint||randFingerprint(), body.entryNodeId, n(), JSON.stringify({ capturedAt: n(), ip: body.ip })]);
    res.status(201).json(queryOne("SELECT * FROM trapped_attackers WHERE id=?", [lastInsertId()]));
  });

  app.post("/api/silkweb/collapse", mutateLimiter, (_req, res) => {
    const ts = n();
    run("UPDATE silk_web SET last_collapsed_at=?", [ts]);
    run("UPDATE silk_routes SET is_active=0", []);
    res.json({ collapsed: true, timestamp: ts });
  });

  // ─── Firewall ─────────────────────────────────────────────────────────────
  function getOrCreateStatus(): any {
    let s: any = queryOne("SELECT * FROM firewall_status LIMIT 1");
    if (s) return s;
    run("INSERT INTO firewall_status (enabled, mode, packets_blocked, packets_allowed, isp_masquerade_active, localhost_hidden, dns_masked, last_updated) VALUES (1,'stealth',0,0,1,1,1,?)", [n()]);
    return queryOne("SELECT * FROM firewall_status LIMIT 1");
  }

  app.get("/api/firewall/rules", (_req, res) => {
    const rules: any[] = query("SELECT * FROM firewall_rules ORDER BY priority ASC");
    res.json({ rules, total: rules.length, enabledCount: rules.filter(r => r.enabled).length });
  });

  app.post("/api/firewall/rules", mutateLimiter, (req, res) => {
    const body = z.object({ name: z.string(), direction: z.enum(["inbound","outbound","both"]), action: z.enum(["allow","deny","drop","reject","masquerade","log"]), protocol: z.enum(["tcp","udp","icmp","any"]), sourceIp: z.string().optional(), sourcePort: z.string().optional(), destIp: z.string().optional(), destPort: z.string().optional(), priority: z.number().default(100), description: z.string().optional(), isIspMasquerade: z.boolean().default(false) }).parse(req.body);
    run("INSERT INTO firewall_rules (name, direction, action, protocol, source_ip, source_port, dest_ip, dest_port, priority, description, is_isp_masquerade, enabled, hit_count, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,1,0,?)",
      [body.name, body.direction, body.action, body.protocol, body.sourceIp??null, body.sourcePort??null, body.destIp??null, body.destPort??null, body.priority, body.description??null, body.isIspMasquerade?1:0, n()]);
    res.status(201).json(queryOne("SELECT * FROM firewall_rules WHERE id=?", [lastInsertId()]));
  });

  app.put("/api/firewall/rules/:id", mutateLimiter, (req, res) => {
    const id = parseInt(String(req.params.id));
    const r: any = queryOne("SELECT * FROM firewall_rules WHERE id=?", [id]);
    if (!r) return res.status(404).json({ error: "Rule not found" });
    const body = z.object({ name: z.string().optional(), enabled: z.boolean().optional(), priority: z.number().optional(), description: z.string().optional() }).parse(req.body);
    run("UPDATE firewall_rules SET name=COALESCE(?,name), enabled=COALESCE(?,enabled), priority=COALESCE(?,priority), description=COALESCE(?,description) WHERE id=?",
      [body.name??null, body.enabled!=null?body.enabled?1:0:null, body.priority??null, body.description??null, id]);
    res.json(queryOne("SELECT * FROM firewall_rules WHERE id=?", [id]));
  });

  app.delete("/api/firewall/rules/:id", mutateLimiter, (req, res) => {
    run("DELETE FROM firewall_rules WHERE id=?", [parseInt(String(req.params.id))]);
    res.json({ deleted: true });
  });

  app.get("/api/firewall/status", (_req, res) => {
    const s: any = getOrCreateStatus();
    res.json({ ...s, enabled: !!s.enabled, ispMasqueradeActive: !!s.isp_masquerade_active, localhostHidden: !!s.localhost_hidden, dnsMasked: !!s.dns_masked });
  });

  app.put("/api/firewall/status", mutateLimiter, (req, res) => {
    const body = z.object({ enabled: z.boolean().optional(), mode: z.string().optional(), ispMasqueradeActive: z.boolean().optional(), localhostHidden: z.boolean().optional(), dnsMasked: z.boolean().optional() }).parse(req.body);
    const s: any = getOrCreateStatus();
    run("UPDATE firewall_status SET enabled=COALESCE(?,enabled), mode=COALESCE(?,mode), isp_masquerade_active=COALESCE(?,isp_masquerade_active), localhost_hidden=COALESCE(?,localhost_hidden), dns_masked=COALESCE(?,dns_masked), last_updated=? WHERE id=?",
      [body.enabled!=null?body.enabled?1:0:null, body.mode??null, body.ispMasqueradeActive!=null?body.ispMasqueradeActive?1:0:null, body.localhostHidden!=null?body.localhostHidden?1:0:null, body.dnsMasked!=null?body.dnsMasked?1:0:null, n(), s.id]);
    res.json(queryOne("SELECT * FROM firewall_status WHERE id=?", [s.id]));
  });

  app.get("/api/firewall/blocked-ips", (_req, res) => {
    const ips = query("SELECT * FROM blocked_ips ORDER BY blocked_at DESC");
    res.json({ blockedIps: ips, total: ips.length });
  });

  app.post("/api/firewall/blocked-ips", mutateLimiter, (req, res) => {
    const body = z.object({ ip: z.string(), reason: z.string(), autoBlocked: z.boolean().default(false) }).parse(req.body);
    run("INSERT INTO blocked_ips (ip, reason, auto_blocked, hit_count, blocked_at) VALUES (?,?,?,1,?)", [body.ip, body.reason, body.autoBlocked?1:0, n()]);
    res.status(201).json(queryOne("SELECT * FROM blocked_ips WHERE id=?", [lastInsertId()]));
  });

  app.delete("/api/firewall/blocked-ips/:id", mutateLimiter, (req, res) => {
    run("DELETE FROM blocked_ips WHERE id=?", [parseInt(String(req.params.id))]);
    res.json({ deleted: true });
  });

  app.post("/api/firewall/simulate-attack", mutateLimiter, (req, res) => {
    const body = z.object({ attackerIp: z.string().optional(), attackType: z.string().optional() }).parse(req.body);
    const ip = body.attackerIp || randIp();
    const blocked = Math.random() > 0.3;
    const s: any = getOrCreateStatus();
    if (blocked) run("UPDATE firewall_status SET packets_blocked=packets_blocked+1 WHERE id=?", [s.id]);
    else run("UPDATE firewall_status SET packets_allowed=packets_allowed+1 WHERE id=?", [s.id]);
    res.json({ attackerIp: ip, blocked, attackType: body.attackType || "port_scan", timestamp: n() });
  });

  // ─── Monitor ──────────────────────────────────────────────────────────────
  const PROCS = ["wireguard","proxhqvpn","node","nginx","sshd","systemd","tor","wg-quick"];
  const STATES = ["ESTABLISHED","LISTEN","TIME_WAIT","CLOSE_WAIT"];
  const PROTOS = ["TCP","UDP","WireGuard"];

  app.get("/api/monitor/connections", (_req, res) => {
    const count = Math.floor(Math.random()*12)+8;
    const connections = Array.from({ length: count }, (_, i) => ({
      id: String(i+1), localAddress: `0.0.0.0:${[51820,51821,8080,443,80,22,9050][Math.floor(Math.random()*7)]}`,
      remoteAddress: `${randIp()}:${Math.floor(Math.random()*60000)+1024}`,
      protocol: PROTOS[Math.floor(Math.random()*3)], state: STATES[Math.floor(Math.random()*4)],
      process: PROCS[Math.floor(Math.random()*8)], pid: Math.floor(Math.random()*9000)+1000,
    }));
    res.json({ connections, total: connections.length });
  });

  app.get("/api/monitor/stats", async (_req, res) => {
    const totalMem = os.totalmem(), freeMem = os.freemem(), uptimeSecs = os.uptime();
    let cpuPercent = rb(15, 55);
    try { const { stdout } = await execAsync("top -bn1 | grep 'Cpu(s)' | awk '{print $2}' | cut -d'%' -f1"); const p = parseFloat(stdout.trim()); if (!isNaN(p)) cpuPercent = p; } catch {}
    res.json({
      cpuPercent, platform: `${os.platform()} ${os.arch()}`,
      memoryPercent: Math.round(((totalMem-freeMem)/totalMem)*100*10)/10,
      memoryUsedMb: Math.round((totalMem-freeMem)/1024/1024),
      memoryTotalMb: Math.round(totalMem/1024/1024),
      networkInMbps: rb(2,80), networkOutMbps: rb(1,40),
      uptime: `${Math.floor(uptimeSecs/3600)}h ${Math.floor((uptimeSecs%3600)/60)}m`,
      activeUsers: Math.floor(Math.random()*4)+1, wireguardTunnels: Math.floor(Math.random()*50)+10,
      externalIp: SIMULATED_EXT_IP,
    });
  });

  // ─── Terminal ─────────────────────────────────────────────────────────────
  const ALLOWED = new Set(["ls","pwd","whoami","hostname","uname","ps","netstat","ifconfig","ip","date","uptime","df","free","echo"]);

  app.post("/api/terminal/execute", terminalLimiter, async (req, res) => {
    const { command } = z.object({ command: z.string().max(512) }).parse(req.body);
    const cmd = command.trim().split(" ")[0].toLowerCase();
    if (!ALLOWED.has(cmd)) {
      return res.json({ output: `proxhqvpn@standalone:~$ ${command}\nAccess denied: '${cmd}' not in allowlist.\nAllowed: ${[...ALLOWED].join(", ")}`, exitCode: 1 });
    }
    try {
      const { stdout, stderr } = await execAsync(command, { timeout: 5000 });
      res.json({ output: `proxhqvpn@standalone:~$ ${command}\n${stdout||stderr}`, exitCode: 0 });
    } catch (e: any) {
      res.json({ output: `proxhqvpn@standalone:~$ ${command}\n${e.stderr||e.message}`, exitCode: e.code||1 });
    }
  });

  // ─── Ghost Trap ───────────────────────────────────────────────────────────
  function gtTarpit(ms: number) { return new Promise(r => setTimeout(r, ms)); }

  function gtGetIp(req: Request): string {
    const fwd = req.headers["x-forwarded-for"];
    const fwdStr = Array.isArray(fwd) ? fwd[0] : fwd;
    return fwdStr?.split(",")[0]?.trim() || req.socket?.remoteAddress || "unknown";
  }

  function gtIsPrivate(ip: string): boolean {
    return /^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|127\.|::1$|fc00:|fe80:)/.test(ip);
  }

  function gtDetectAttack(data: string): { type: string; vector: string } | null {
    if (!data) return null;
    const s = data.toLowerCase();
    if (/union\s+select|'\s*or\s+['"]?\d|;\s*(drop|delete|insert|update)\s/i.test(s)) return { type: "sql_injection", vector: "SQL injection" };
    if (/<script[\s>]|javascript:|on\w+\s*=|document\.cookie/i.test(s)) return { type: "xss", vector: "XSS" };
    if (/;\s*(ls|cat|id|whoami|wget|curl)\b|\|\s*(ls|cat|id)\b|\$\([^)]+\)/i.test(s)) return { type: "cmd_injection", vector: "command injection" };
    if (/\.\.(\/|%2f)|\/etc\/passwd|\/proc\/self/i.test(s)) return { type: "path_traversal", vector: "path traversal" };
    return null;
  }

  function gtFakeResponse(endpoint: string, fakeSite: string, fakeDb: string): string {
    const ep = endpoint.toLowerCase();
    if (ep.includes("login") || ep.includes("admin")) return JSON.stringify({ error: "Invalid credentials", site: fakeSite, db: fakeDb });
    if (ep.includes(".env")) return `DB_HOST=localhost\nDB_USER=admin\nDB_PASS=hunter2\nAPP_KEY=base64:${crypto.randomBytes(32).toString("base64")}`;
    if (ep.includes(".git")) return `[core]\n\trepositoryformatversion = 0\n\tfilemode = true\n\tbare = false`;
    if (ep.includes("backup") || ep.includes(".sql")) return `-- ${fakeDb} dump\n-- Host: localhost\nCREATE TABLE users (id INT, email VARCHAR(255), password_hash VARCHAR(255));`;
    return JSON.stringify({ status: "ok", server: fakeSite, version: "2.1.4", db: fakeDb });
  }

  function gtGetOrCreateConfig() {
    let cfg = queryOne("SELECT * FROM ghost_trap_config WHERE id=1") as any;
    if (!cfg) {
      const token = crypto.randomBytes(24).toString("hex");
      run("INSERT INTO ghost_trap_config (user_token, device_mode, enabled, tarpit_min_ms, tarpit_max_ms, auto_block_after, silk_trap_after, fake_site_name, fake_db_version, updated_at) VALUES (?,?,1,1500,8000,5,3,'AdminPanel v2.1','MySQL 5.7.39-log',?)", [token, "personal", n()]);
      cfg = queryOne("SELECT * FROM ghost_trap_config WHERE id=1");
    }
    return cfg;
  }

  async function gtHandleProbe(req: Request, res: Response, trapPath: string) {
    const cfg = gtGetOrCreateConfig();
    if (!cfg?.enabled) { res.status(404).send("Not found"); return; }

    const ip = gtGetIp(req);
    const probeId = crypto.randomUUID();
    const probe = gtDetectAttack(`${req.url} ${JSON.stringify(req.body ?? "")} ${JSON.stringify(req.query)}`);
    const probeType = probe?.type ?? "recon";
    const fakeResp = gtFakeResponse(trapPath, cfg.fake_site_name, cfg.fake_db_version);

    // Count prior probes from this IP
    const priorCount = ((queryOne("SELECT COUNT(*) c FROM ghost_trap_probes WHERE attacker_ip=?", [ip]) as any)?.c ?? 0) as number;
    const autoBlock = priorCount >= (cfg.auto_block_after ?? 5);
    const silkTrap = priorCount >= (cfg.silk_trap_after ?? 3);

    const tarpitMs = Math.floor(Math.random() * ((cfg.tarpit_max_ms ?? 8000) - (cfg.tarpit_min_ms ?? 1500)) + (cfg.tarpit_min_ms ?? 1500));
    const xffRaw = req.headers["x-forwarded-for"];
    const xffStr = Array.isArray(xffRaw) ? xffRaw.join(",") : (xffRaw ?? "");
    const hopChain = xffStr ? JSON.stringify(xffStr.split(",").map((h: string) => h.trim())) : null;
    const ua = Array.isArray(req.headers["user-agent"]) ? req.headers["user-agent"][0] : (req.headers["user-agent"] ?? null);

    run(`INSERT INTO ghost_trap_probes (probe_id, attacker_ip, attacker_port, attacker_ua, method, endpoint, probe_type, attack_vector, fake_response, tarpit_ms, auto_blocked, silk_trapped, beacon_fired, hop_chain, probe_headers, probed_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,0,?,?,?)`,
      [probeId, ip, req.socket?.remotePort ?? null, ua, req.method, trapPath, probeType, probe?.vector ?? null, fakeResp, tarpitMs, autoBlock ? 1 : 0, silkTrap ? 1 : 0, hopChain, JSON.stringify(req.headers), n()]);

    if (autoBlock) {
      run("INSERT OR IGNORE INTO blocked_ips (ip, reason, auto_blocked, hit_count, blocked_at) VALUES (?,?,1,?,?)", [ip, "Ghost Trap auto-block", priorCount + 1, n()]);
    }

    await gtTarpit(tarpitMs);

    // Fire beacon after tarpit (non-blocking)
    setImmediate(() => {
      run("UPDATE ghost_trap_probes SET beacon_fired=1, beacon_fired_at=? WHERE probe_id=?", [n(), probeId]);
      run("INSERT INTO ghost_trap_beacons (probe_id, attacker_ip, beacon_type, payload, fired_at) VALUES (?,?,?,?,?)",
        [probeId, ip, "http", JSON.stringify({ endpoint: trapPath, ua }), n()]);
    });

    res.setHeader("Content-Type", "application/json");
    res.setHeader("X-Powered-By", cfg.fake_site_name);
    res.status(200).send(fakeResp);
  }

  // Platform lure routes — PUBLIC, no auth
  const GT_TRAP_PATHS = ["/ssh","/http","/admin","/rdp","/ftp","/device","/secure-admin","/vnc","/wp-admin","/.env","/phpmyadmin","/api/users","/.git","/config.php","/api/login","/login","/backup.sql","/api/data"];
  for (const tp of GT_TRAP_PATHS) {
    app.all(`/api/ghost-trap/lure${tp}`, (req, res) => gtHandleProbe(req, res, tp));
  }
  app.all("/api/ghost-trap/lure/*splat", (req, res) => {
    const splat = Array.isArray((req.params as any).splat) ? (req.params as any).splat[0] : (req.params as any).splat;
    gtHandleProbe(req, res, `/${splat ?? "unknown"}`);
  });

  // Per-user lure (token-based)
  app.all("/api/ghost-trap/u/:token/lure/*splat", async (req, res) => {
    const { token } = req.params as { token: string };
    const cfg = queryOne("SELECT * FROM ghost_trap_config WHERE user_token=?", [token]) as any;
    if (!cfg) { res.status(404).send("Not found"); return; }
    const splat = Array.isArray((req.params as any).splat) ? (req.params as any).splat[0] : (req.params as any).splat;
    await gtHandleProbe(req, res, `/${splat ?? "unknown"}`);
  });

  // Ghost Trap config
  app.get("/api/ghost-trap/config", (_req, res) => {
    res.json(gtGetOrCreateConfig());
  });

  app.post("/api/ghost-trap/config", mutateLimiter, (req, res) => {
    const cfg = gtGetOrCreateConfig();
    const b = req.body as Record<string, unknown>;
    const fields: string[] = [];
    const vals: unknown[] = [];
    if (b.enabled !== undefined)       { fields.push("enabled=?");         vals.push(b.enabled ? 1 : 0); }
    if (b.tarpitMinMs !== undefined)   { fields.push("tarpit_min_ms=?");   vals.push(Number(b.tarpitMinMs)); }
    if (b.tarpitMaxMs !== undefined)   { fields.push("tarpit_max_ms=?");   vals.push(Number(b.tarpitMaxMs)); }
    if (b.autoBlockAfter !== undefined){ fields.push("auto_block_after=?");vals.push(Number(b.autoBlockAfter)); }
    if (b.silkTrapAfter !== undefined) { fields.push("silk_trap_after=?"); vals.push(Number(b.silkTrapAfter)); }
    if (b.fakeSiteName)                { fields.push("fake_site_name=?");  vals.push(String(b.fakeSiteName)); }
    if (b.fakeDbVersion)               { fields.push("fake_db_version=?"); vals.push(String(b.fakeDbVersion)); }
    if (b.deviceMode === "personal" || b.deviceMode === "server") { fields.push("device_mode=?"); vals.push(b.deviceMode); }
    if (b.userDomain !== undefined)    { fields.push("user_domain=?");     vals.push(b.userDomain || null); }
    if (fields.length) {
      fields.push("updated_at=?"); vals.push(n()); vals.push(cfg.id);
      run(`UPDATE ghost_trap_config SET ${fields.join(",")} WHERE id=?`, vals);
    }
    res.json(gtGetOrCreateConfig());
  });

  // Ghost Trap probes
  app.get("/api/ghost-trap/probes", (_req, res) => {
    const limit = 200;
    const probes = query("SELECT * FROM ghost_trap_probes ORDER BY probed_at DESC LIMIT ?", [limit]);
    const allP = query("SELECT * FROM ghost_trap_probes") as any[];
    const stats = {
      total: allP.length,
      uniqueIps: new Set(allP.map((p: any) => p.attacker_ip)).size,
      sqlCount: allP.filter((p: any) => p.probe_type === "sql_injection").length,
      xssCount: allP.filter((p: any) => p.probe_type === "xss").length,
      cmdCount: allP.filter((p: any) => p.probe_type === "cmd_injection").length,
      blocked: allP.filter((p: any) => p.auto_blocked).length,
      silkTrapped: allP.filter((p: any) => p.silk_trapped).length,
      beaconFires: allP.filter((p: any) => p.beacon_fired).length,
      vpnCount: allP.filter((p: any) => p.vpn_detected).length,
      avgTarpit: allP.length ? Math.round(allP.reduce((s: number, p: any) => s + (p.tarpit_ms ?? 0), 0) / allP.length) : 0,
    };
    const mapped = (probes as any[]).map((p: any) => ({
      id: p.id, probeId: p.probe_id, attackerIp: p.attacker_ip, attackerPort: p.attacker_port,
      attackerUa: p.attacker_ua, method: p.method, endpoint: p.endpoint, probeType: p.probe_type,
      attackVector: p.attack_vector, fakeResponse: p.fake_response, tarpitMs: p.tarpit_ms,
      autoBlocked: !!p.auto_blocked, silkTrapped: !!p.silk_trapped, beaconFired: !!p.beacon_fired,
      beaconFiredAt: p.beacon_fired_at, hopChain: p.hop_chain,
      vpnDetected: !!p.vpn_detected, torDetected: !!p.tor_detected,
      geoCountry: p.geo_country, geoCity: p.geo_city, geoIsp: p.geo_isp,
      geoOrg: p.geo_org, geoAsn: p.geo_asn, probedAt: p.probed_at,
    }));
    res.json({ probes: mapped, stats });
  });

  app.delete("/api/ghost-trap/probes", mutateLimiter, (_req, res) => {
    run("DELETE FROM ghost_trap_probes");
    run("DELETE FROM ghost_trap_beacons");
    res.json({ ok: true });
  });

  // Ghost Trap backtrace (simplified for standalone)
  app.get("/api/ghost-trap/backtrace/:ip", (req, res) => {
    const { ip } = req.params;
    const probes = query("SELECT probe_headers, hop_chain FROM ghost_trap_probes WHERE attacker_ip=? ORDER BY probed_at DESC LIMIT 5", [ip]) as any[];
    const hopIps = new Set<string>();
    for (const p of probes) {
      if (p.hop_chain) { try { (JSON.parse(p.hop_chain) as string[]).forEach(h => hopIps.add(h)); } catch {} }
    }
    const chain = Array.from(hopIps).filter(h => h !== ip).map(h => ({
      ip: h, port: null, rdns: null, isp: null, org: null, country: null, city: null, asn: null,
      nodeType: gtIsPrivate(h) ? "private_network" : "unknown", vpnProvider: null, confidence: 40, isPrivate: gtIsPrivate(h),
    }));
    res.json({ targetIp: ip, hopChain: chain, vpnDetected: false, vpnNodes: [], likelyRealOrigin: chain[0] ?? null, portHints: [], summary: `Attacker ${ip} — ${chain.length} hops recorded`, analysedAt: n() });
  });

  // Ghost Trap report
  app.get("/api/ghost-trap/report/:ip", (req, res) => {
    const { ip } = req.params;
    const probes = query("SELECT * FROM ghost_trap_probes WHERE attacker_ip=? ORDER BY probed_at ASC", [ip]) as any[];
    const isDownload = req.query.download === "1";
    const report = [
      "═══════════════════════════════════════════════════════════",
      "  PROXHQVPN — CYBER ATTACK INCIDENT REPORT",
      "  © 2026 Alpha Unlimited Technologies LLC",
      "═══════════════════════════════════════════════════════════",
      `Report generated: ${n()}`,
      `Attacker IP address: ${ip}`,
      `Total probe attempts: ${probes.length}`,
      `First seen: ${probes[0]?.probed_at ?? "N/A"}`,
      `Last seen: ${probes[probes.length - 1]?.probed_at ?? "N/A"}`,
      "",
      "ATTACK TIMELINE:",
      ...probes.map((p: any, i: number) => `  ${i + 1}. [${p.probed_at}] ${p.method} ${p.endpoint} — ${p.probe_type} — tarpit ${p.tarpit_ms}ms`),
      "",
      "LEGAL DECLARATION:",
      "This report documents unauthorized computer access attempts in",
      "violation of 18 U.S.C. § 1030 (Computer Fraud and Abuse Act).",
      "All data is recorded by automated security systems.",
      "",
      "For law enforcement inquiries, file at: www.ic3.gov",
      "═══════════════════════════════════════════════════════════",
    ].join("\n");

    if (isDownload) {
      res.setHeader("Content-Disposition", `attachment; filename="proxhqvpn-incident-${ip.replace(/[.:]/g, "_")}.txt"`);
      res.setHeader("Content-Type", "text/plain");
    }
    res.send(report);
  });

  // ─── SQL Interface ────────────────────────────────────────────────────────
  const ALLOWED_TABLES = ["nodes","beacon_alerts","silk_web","silk_routes","trapped_attackers","firewall_rules","firewall_status","blocked_ips","ghost_trap_config","ghost_trap_probes","ghost_trap_beacons"];

  app.post("/api/sql/query", sqlLimiter, (req, res) => {
    const { query: q } = z.object({ query: z.string().max(2000) }).parse(req.body);
    if (/^\s*(drop|delete|truncate|alter|insert|update|create|pragma)\s/i.test(q)) {
      return res.json({ error: "Only SELECT queries allowed.", rows: [], columns: [] });
    }
    try {
      const rows = query(q);
      const columns = rows.length > 0 ? Object.keys(rows[0] as object) : [];
      res.json({ rows, columns, count: rows.length });
    } catch (e: any) {
      res.json({ error: e.message, rows: [], columns: [] });
    }
  });

  app.get("/api/sql/tables", (_req, res) => {
    const tables = ALLOWED_TABLES.map(t => {
      try { return { name: t, rowCount: (queryOne(`SELECT COUNT(*) c FROM ${t}`) as any)?.c ?? 0 }; }
      catch { return { name: t, rowCount: 0 }; }
    });
    res.json({ tables });
  });

  // ─── Proxy Browser ────────────────────────────────────────────────────────
  app.get("/api/proxy-browser/config", (_req, res) => res.json(proxyConfig));

  app.post("/api/proxy-browser/config", mutateLimiter, (req, res) => {
    const body = z.object({ mode: z.enum(["direct","proxhqvpn-onion","tor-gateway","double-layer"]), socks5Host: z.string().default("127.0.0.1"), socks5Port: z.number().default(9050) }).parse(req.body);
    proxyConfig = body;
    res.json(proxyConfig);
  });

  app.post("/api/proxy-browser/fetch", async (req, res) => {
    const body = z.object({ url: z.string().url(), mode: z.enum(["direct","proxhqvpn-onion","tor-gateway","double-layer"]), socks5Host: z.string().default("127.0.0.1"), socks5Port: z.number().default(9050) }).parse(req.body);
    const start = Date.now();
    try {
      const fetch = (await import("node-fetch")).default;
      const opts: any = { method: "GET", headers: { "User-Agent": "Mozilla/5.0 (compatible; ProxhqVPN/1.0)" }, redirect: "follow", signal: AbortSignal.timeout(12000) };
      if (body.mode !== "direct") {
        try { const { SocksProxyAgent } = await import("socks-proxy-agent"); opts.agent = new SocksProxyAgent(`socks5://${body.socks5Host}:${body.socks5Port}`); } catch {}
      }
      const resp = await fetch(body.url, opts);
      const html = await resp.text();
      const layers = body.mode === "proxhqvpn-onion" ? ["Your Device","ProxhqVPN Relay ×7","Destination"] : body.mode === "tor-gateway" ? ["Your Device","Tor Guard","Tor Relay","Tor Exit","Destination"] : body.mode === "double-layer" ? ["Your Device","ProxhqVPN ×3","Tor Guard","Tor Relay","Tor Exit","Destination"] : ["Direct","Destination"];
      res.json({ html, url: body.url, statusCode: resp.status, timingMs: Date.now()-start, layers, title: "" });
    } catch (e: any) {
      res.json({ html: `<html><body style="background:#000;color:#0f0;font-family:monospace;padding:40px"><h2>Error</h2><p>${e.message}</p></body></html>`, url: body.url, statusCode: 0, timingMs: Date.now()-start, layers: [], title: "Error", error: e.message });
    }
  });

  // ─── Update banner injected into index.html for standalone clients ────────
  // This script runs in the browser the moment index.html loads — no React
  // dependency — so users with an older downloaded build see a native DOM
  // banner pointing them to the newest release.
  const STANDALONE_UPDATE_SCRIPT = `
<script id="proxhq-updater">
(function(){
  var LATEST="2.0.0";
  var SK="proxhq_update_dismissed_v";
  function gt(a,b){var pa=a.split(".").map(Number),pb=b.split(".").map(Number);for(var i=0;i<3;i++){if((pa[i]||0)>(pb[i]||0))return true;if((pa[i]||0)<(pb[i]||0))return false;}return false;}
  function show(running){
    if(localStorage.getItem(SK+LATEST)==="1")return;
    var d=document.createElement("div");
    d.id="proxhq-update-banner";
    d.style.cssText="position:fixed;top:0;left:0;right:0;z-index:2147483647;background:#0d1a0f;border-bottom:1.5px solid rgba(0,255,136,.4);padding:9px 16px;display:flex;align-items:center;justify-content:space-between;gap:12px;font-family:system-ui,-apple-system,sans-serif;font-size:13px;color:#fff;box-shadow:0 2px 12px rgba(0,0,0,.6)";
    d.innerHTML='<div style="display:flex;align-items:center;gap:10px;min-width:0"><div style="width:28px;height:28px;border-radius:8px;background:rgba(0,255,136,.12);border:1px solid rgba(0,255,136,.25);display:flex;align-items:center;justify-content:center;flex-shrink:0"><svg width="14" height="14" fill="none" stroke="#00ff88" stroke-width="2.2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg></div><div style="min-width:0"><span style="font-weight:700;color:#00ff88">ProxhqVPN v'+LATEST+' is available</span><span style="color:rgba(255,255,255,.55);margin-left:8px;font-size:12px">You are running v'+running+' &mdash; Ghost Trap, DNS Sinkhole, SIEM, Network Monitor, QuantumAudit, security fixes</span></div></div><div style="display:flex;align-items:center;gap:8px;flex-shrink:0"><a href="/downloads" style="background:#00ff88;color:#000;font-weight:700;font-size:11px;padding:6px 13px;border-radius:6px;text-decoration:none;white-space:nowrap">Download Update</a><button id="proxhq-upd-dismiss" style="background:none;border:1px solid rgba(255,255,255,.15);color:rgba(255,255,255,.5);font-size:11px;padding:5px 10px;border-radius:6px;cursor:pointer;white-space:nowrap">Dismiss</button></div>';
    document.body.prepend(d);
    document.body.style.paddingTop=(d.offsetHeight||44)+"px";
    document.getElementById("proxhq-upd-dismiss").onclick=function(){localStorage.setItem(SK+LATEST,"1");d.remove();document.body.style.paddingTop="";};
  }
  fetch("/api/update/check").then(function(r){return r.json();}).then(function(data){
    var running=data.version||"0.0.0";
    if(gt(LATEST,running))show(running);
  }).catch(function(){});
})();
</script>`;

  // ─── Static frontend ──────────────────────────────────────────────────────
  const FRONTEND_DIRS = [
    path.join(process.cwd(), "frontend"),
    path.join(path.dirname(process.execPath), "frontend"),
  ];
  let servedFrontend = false;
  for (const dir of FRONTEND_DIRS) {
    if (fs.existsSync(dir)) {
      app.use(express.static(dir));
      // Serve index.html with the update-check script injected before </body>
      app.get("*", (_req, res) => {
        const indexPath = path.join(dir, "index.html");
        try {
          let html = fs.readFileSync(indexPath, "utf8");
          if (html.includes("</body>")) {
            html = html.replace("</body>", `${STANDALONE_UPDATE_SCRIPT}</body>`);
          }
          res.setHeader("Content-Type", "text/html; charset=utf-8");
          res.send(html);
        } catch {
          res.sendFile(indexPath);
        }
      });
      servedFrontend = true;
      break;
    }
  }
  if (!servedFrontend) {
    app.get("*", (_req, res) => {
      res.send(`<!DOCTYPE html><html><head><title>ProxhqVPN</title><style>*{margin:0;padding:0}body{background:#000;color:#00ff41;font-family:'Courier New',monospace;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:40px}.box{border:1px solid #00ff41;padding:40px;max-width:600px;text-align:center}h1{margin-bottom:24px;letter-spacing:.3em}p{color:#00ff4199;line-height:1.8;margin-bottom:16px}code{color:#0ff}</style></head><body><div class="box"><h1>PROXHQVPN</h1><p>Server running. API at <code>/api</code></p><p>Place the <code>frontend/</code> folder next to the executable.</p><p><code>GET /api/healthz</code></p></div></body></html>`);
    });
  }

  // ─── Error handler ────────────────────────────────────────────────────────
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    logger.error({ err }, "Unhandled error");
    if (err && typeof err === "object" && "name" in err && (err as any).name === "ZodError")
      return res.status(400).json({ error: "Invalid input", details: (err as any).issues });
    res.status(500).json({ error: "Internal server error" });
  });

  // ─── Start ────────────────────────────────────────────────────────────────
  app.listen(PORT, "0.0.0.0", () => {
    logger.info({ port: PORT, data: DATA_DIR }, "ProxhqVPN standalone server started");
    console.log(`\n  ██████╗ ██╗  ██╗ ██████╗ ███████╗████████╗███╗   ██╗███████╗████████╗`);
    console.log(`  ██╔════╝ ██║  ██║██╔═══██╗██╔════╝╚══██╔══╝████╗  ██║██╔════╝╚══██╔══╝`);
    console.log(`  ██║  ███╗███████║██║   ██║███████╗   ██║   ██╔██╗ ██║█████╗     ██║   `);
    console.log(`  ██║   ██║██╔══██║██║   ██║╚════██║   ██║   ██║╚██╗██║██╔══╝     ██║   `);
    console.log(`  ╚██████╔╝██║  ██║╚██████╔╝███████║   ██║   ██║ ╚████║███████╗   ██║   `);
    console.log(`   ╚═════╝ ╚═╝  ╚═╝ ╚═════╝ ╚══════╝   ╚═╝   ╚═╝  ╚═══╝╚══════╝   ╚═╝`);
    console.log(`\n  ProxhqVPN — Standalone Edition`);
    console.log(`  Dashboard: http://localhost:${PORT}`);
    console.log(`  Data directory:    ${DATA_DIR}\n`);
  });
}

createApp().catch(e => { console.error("Fatal:", e); process.exit(1); });
