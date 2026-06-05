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
  app.get("/api/healthz", (_req, res) => {
    res.json({ status: "ok", version: "1.0.0", timestamp: n() });
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
    const nd: any = queryOne("SELECT * FROM nodes WHERE id=?", [parseInt(req.params.id)]);
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
    const id = parseInt(req.params.id);
    const nd: any = queryOne("SELECT * FROM nodes WHERE id=?", [id]);
    if (!nd) return res.status(404).json({ error: "Node not found" });
    const body = z.object({ name: z.string().optional(), region: z.string().optional(), status: z.string().optional(), hasBeacon: z.boolean().optional(), hasSpider: z.boolean().optional(), hasWorm: z.boolean().optional() }).parse(req.body);
    run(`UPDATE nodes SET name=COALESCE(?,name), region=COALESCE(?,region), status=COALESCE(?,status), has_beacon=COALESCE(?,has_beacon), has_spider=COALESCE(?,has_spider), has_worm=COALESCE(?,has_worm), last_seen=? WHERE id=?`,
      [body.name??null, body.region??null, body.status??null, body.hasBeacon!=null?body.hasBeacon?1:0:null, body.hasSpider!=null?body.hasSpider?1:0:null, body.hasWorm!=null?body.hasWorm?1:0:null, n(), id]);
    res.json(queryOne("SELECT * FROM nodes WHERE id=?", [id]));
  });

  app.delete("/api/nodes/:id", mutateLimiter, (req, res) => {
    run("DELETE FROM nodes WHERE id=?", [parseInt(req.params.id)]);
    res.json({ deleted: true });
  });

  app.post("/api/nodes/:id/rotate-ip", mutateLimiter, (req, res) => {
    const id = parseInt(req.params.id);
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
    const id = parseInt(req.params.id);
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
    const id = parseInt(req.params.id);
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
    const id = parseInt(req.params.id);
    const r: any = queryOne("SELECT * FROM firewall_rules WHERE id=?", [id]);
    if (!r) return res.status(404).json({ error: "Rule not found" });
    const body = z.object({ name: z.string().optional(), enabled: z.boolean().optional(), priority: z.number().optional(), description: z.string().optional() }).parse(req.body);
    run("UPDATE firewall_rules SET name=COALESCE(?,name), enabled=COALESCE(?,enabled), priority=COALESCE(?,priority), description=COALESCE(?,description) WHERE id=?",
      [body.name??null, body.enabled!=null?body.enabled?1:0:null, body.priority??null, body.description??null, id]);
    res.json(queryOne("SELECT * FROM firewall_rules WHERE id=?", [id]));
  });

  app.delete("/api/firewall/rules/:id", mutateLimiter, (req, res) => {
    run("DELETE FROM firewall_rules WHERE id=?", [parseInt(req.params.id)]);
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
    run("DELETE FROM blocked_ips WHERE id=?", [parseInt(req.params.id)]);
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
  const PROCS = ["wireguard","ghostnet","node","nginx","sshd","systemd","tor","wg-quick"];
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

  // ─── SQL Interface ────────────────────────────────────────────────────────
  const ALLOWED_TABLES = ["nodes","beacon_alerts","silk_web","silk_routes","trapped_attackers","firewall_rules","firewall_status","blocked_ips"];

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
      const layers = body.mode === "proxhqvpn-onion" ? ["Your Device","ProxhqVPN Relay ×7","Destination"] : body.mode === "tor-gateway" ? ["Your Device","Tor Guard","Tor Relay","Tor Exit","Destination"] : body.mode === "double-layer" ? ["Your Device","GhostNet ×3","Tor Guard","Tor Relay","Tor Exit","Destination"] : ["Direct","Destination"];
      res.json({ html, url: body.url, statusCode: resp.status, timingMs: Date.now()-start, layers, title: "" });
    } catch (e: any) {
      res.json({ html: `<html><body style="background:#000;color:#0f0;font-family:monospace;padding:40px"><h2>Error</h2><p>${e.message}</p></body></html>`, url: body.url, statusCode: 0, timingMs: Date.now()-start, layers: [], title: "Error", error: e.message });
    }
  });

  // ─── Static frontend ──────────────────────────────────────────────────────
  const FRONTEND_DIRS = [
    path.join(process.cwd(), "frontend"),
    path.join(path.dirname(process.execPath), "frontend"),
  ];
  let servedFrontend = false;
  for (const dir of FRONTEND_DIRS) {
    if (fs.existsSync(dir)) {
      app.use(express.static(dir));
      app.get("*", (_req, res) => res.sendFile(path.join(dir, "index.html")));
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
