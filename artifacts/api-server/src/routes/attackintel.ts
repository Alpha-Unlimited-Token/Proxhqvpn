// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
// Attack Intelligence Engine — real-time attacker IP probe + banner grab + exploit mapping
import { Router } from "express";
import net from "net";
import { z } from "zod";

const router = Router();

// ── Exploit / CVE intelligence dictionary ──────────────────────────────────
interface PortIntel {
  service: string;
  description: string;
  cves: string[];
  exploitDbUrl: string;
  hacktricksUrl: string;
  nistUrl: string;
  severity: "critical" | "high" | "medium" | "low";
  mitre: string[];
}

const PORT_INTEL: Record<number, PortIntel> = {
  21:    { service:"FTP",                severity:"high",     cves:["CVE-2010-1938","CVE-2015-3306","CVE-2020-9273"],    description:"File Transfer Protocol — plaintext credentials, anonymous login, directory traversal",                        exploitDbUrl:"https://www.exploit-db.com/search?q=ftp&type=remote",                    hacktricksUrl:"https://book.hacktricks.xyz/network-services-pentesting/pentesting-ftp",                                 nistUrl:"https://nvd.nist.gov/vuln/search/results?query=ftp",                                            mitre:["T1190","T1078"] },
  22:    { service:"SSH",                severity:"medium",   cves:["CVE-2023-38408","CVE-2018-15473","CVE-2023-48795"], description:"Secure Shell — brute force, key enumeration, Terrapin attack, OpenSSH version exploits",                  exploitDbUrl:"https://www.exploit-db.com/search?q=openssh&type=remote",                 hacktricksUrl:"https://book.hacktricks.xyz/network-services-pentesting/pentesting-ssh",                                 nistUrl:"https://nvd.nist.gov/vuln/search/results?query=openssh",                                        mitre:["T1110","T1021.004"] },
  23:    { service:"Telnet",             severity:"critical", cves:["CVE-2020-10188","CVE-2011-4862"],                   description:"Telnet — completely plaintext, credential capture in transit, zero encryption",                            exploitDbUrl:"https://www.exploit-db.com/search?q=telnet&type=remote",                  hacktricksUrl:"https://book.hacktricks.xyz/network-services-pentesting/pentesting-telnet",                              nistUrl:"https://nvd.nist.gov/vuln/search/results?query=telnet",                                         mitre:["T1040","T1078"] },
  25:    { service:"SMTP",               severity:"medium",   cves:["CVE-2020-14679","CVE-2021-38371"],                  description:"Email — open relay abuse, VRFY/EXPN user enumeration, mail injection",                                     exploitDbUrl:"https://www.exploit-db.com/search?q=smtp&type=remote",                    hacktricksUrl:"https://book.hacktricks.xyz/network-services-pentesting/pentesting-smtp",                                nistUrl:"https://nvd.nist.gov/vuln/search/results?query=smtp",                                           mitre:["T1566","T1114"] },
  53:    { service:"DNS",                severity:"high",     cves:["CVE-2020-1350","CVE-2021-25216","CVE-2023-2911"],   description:"DNS — zone transfer leak, cache poisoning, amplification DDoS (75-100× amplification)",                    exploitDbUrl:"https://www.exploit-db.com/search?q=dns&type=remote",                     hacktricksUrl:"https://book.hacktricks.xyz/network-services-pentesting/pentesting-dns",                                 nistUrl:"https://nvd.nist.gov/vuln/search/results?query=dns+server",                                     mitre:["T1071.004","T1584.002"] },
  80:    { service:"HTTP",               severity:"high",     cves:["CVE-2021-41773","CVE-2021-42013","CVE-2022-22947"], description:"Web server — SQLi, XSS, LFI/RFI, path traversal, SSRF, command injection",                             exploitDbUrl:"https://www.exploit-db.com/search?q=apache+http&type=webapps",            hacktricksUrl:"https://book.hacktricks.xyz/network-services-pentesting/pentesting-web",                                 nistUrl:"https://nvd.nist.gov/vuln/search/results?query=apache+http+server",                             mitre:["T1190","T1059"] },
  110:   { service:"POP3",               severity:"medium",   cves:["CVE-2003-0264","CVE-2007-1616"],                    description:"Email retrieval — plaintext credentials, buffer overflow on older servers",                                exploitDbUrl:"https://www.exploit-db.com/search?q=pop3&type=remote",                    hacktricksUrl:"https://book.hacktricks.xyz/network-services-pentesting/pentesting-pop",                                 nistUrl:"https://nvd.nist.gov/vuln/search/results?query=pop3",                                           mitre:["T1114","T1078"] },
  135:   { service:"MSRPC",              severity:"high",     cves:["CVE-2003-0352","CVE-2017-8461"],                    description:"Microsoft RPC — DCOM interface exploits, lateral movement via WMI/DCOM",                                  exploitDbUrl:"https://www.exploit-db.com/search?q=msrpc&type=remote",                   hacktricksUrl:"https://book.hacktricks.xyz/network-services-pentesting/135-pentesting-msrpc",                           nistUrl:"https://nvd.nist.gov/vuln/search/results?query=windows+rpc",                                    mitre:["T1021.003","T1069"] },
  139:   { service:"NetBIOS-SSN",        severity:"critical", cves:["CVE-2017-0144","CVE-2017-0145","CVE-2020-0796"],    description:"NetBIOS SMB — EternalBlue/WannaCry, null session enumeration, credential relay",                          exploitDbUrl:"https://www.exploit-db.com/search?q=netbios+smb&type=remote",             hacktricksUrl:"https://book.hacktricks.xyz/network-services-pentesting/137-138-139-pentesting-netbios",                 nistUrl:"https://nvd.nist.gov/vuln/search/results?query=smb+netbios",                                    mitre:["T1021.002","T1557"] },
  143:   { service:"IMAP",               severity:"medium",   cves:["CVE-2021-38371","CVE-2017-14461"],                  description:"Email — plaintext credentials, IMAP injection, folder enumeration",                                       exploitDbUrl:"https://www.exploit-db.com/search?q=imap&type=remote",                    hacktricksUrl:"https://book.hacktricks.xyz/network-services-pentesting/pentesting-imap",                                nistUrl:"https://nvd.nist.gov/vuln/search/results?query=imap",                                           mitre:["T1114","T1078"] },
  443:   { service:"HTTPS",              severity:"medium",   cves:["CVE-2014-0160","CVE-2016-2107","CVE-2022-0778"],    description:"HTTPS — Heartbleed, BEAST, ROBOT attack, weak cipher suites, cert validation bypass",                      exploitDbUrl:"https://www.exploit-db.com/search?q=ssl+tls&type=webapps",                hacktricksUrl:"https://book.hacktricks.xyz/network-services-pentesting/pentesting-web",                                 nistUrl:"https://nvd.nist.gov/vuln/search/results?query=openssl",                                        mitre:["T1190","T1552"] },
  445:   { service:"SMB",                severity:"critical", cves:["CVE-2017-0144","CVE-2020-0796","CVE-2021-1675","CVE-2021-36942"], description:"SMB — EternalBlue, SMBGhost, PrintNightmare, PetitPotam, NTLM relay",                   exploitDbUrl:"https://www.exploit-db.com/search?q=smb+windows&type=remote",             hacktricksUrl:"https://book.hacktricks.xyz/network-services-pentesting/pentesting-smb",                                 nistUrl:"https://nvd.nist.gov/vuln/search/results?query=smb+windows",                                    mitre:["T1021.002","T1210"] },
  993:   { service:"IMAPS",              severity:"low",      cves:["CVE-2021-38371"],                                   description:"IMAP over SSL — TLS downgrade attacks, expired certificate exploitation",                                exploitDbUrl:"https://www.exploit-db.com/search?q=imap+ssl&type=remote",                hacktricksUrl:"https://book.hacktricks.xyz/network-services-pentesting/pentesting-imap",                                nistUrl:"https://nvd.nist.gov/vuln/search/results?query=imap+ssl",                                       mitre:["T1114"] },
  995:   { service:"POP3S",              severity:"low",      cves:["CVE-2021-38371"],                                   description:"POP3 over SSL — TLS downgrade, certificate bypass",                                                     exploitDbUrl:"https://www.exploit-db.com/search?q=pop3+ssl&type=remote",                hacktricksUrl:"https://book.hacktricks.xyz/network-services-pentesting/pentesting-pop",                                 nistUrl:"https://nvd.nist.gov/vuln/search/results?query=pop3+ssl",                                       mitre:["T1114"] },
  1433:  { service:"MSSQL",              severity:"critical", cves:["CVE-2020-0618","CVE-2021-1636"],                    description:"Microsoft SQL Server — SA brute force, xp_cmdshell OS command execution, linked server pivoting",       exploitDbUrl:"https://www.exploit-db.com/search?q=mssql+sql+server&type=remote",        hacktricksUrl:"https://book.hacktricks.xyz/network-services-pentesting/pentesting-mssql-microsoft-sql-server",          nistUrl:"https://nvd.nist.gov/vuln/search/results?query=sql+server",                                     mitre:["T1505","T1078"] },
  1723:  { service:"PPTP",               severity:"high",     cves:["CVE-2012-2120"],                                    description:"PPTP VPN — MS-CHAPv2 broken crypto, offline brute force, tunnel injection",                             exploitDbUrl:"https://www.exploit-db.com/search?q=pptp&type=remote",                    hacktricksUrl:"https://book.hacktricks.xyz/network-services-pentesting/pentesting-pptp",                                nistUrl:"https://nvd.nist.gov/vuln/search/results?query=pptp",                                           mitre:["T1021.005"] },
  2049:  { service:"NFS",                severity:"high",     cves:["CVE-2021-3178","CVE-2022-40307"],                   description:"Network File System — unauthenticated mount, path traversal, UID spoofing",                              exploitDbUrl:"https://www.exploit-db.com/search?q=nfs&type=remote",                     hacktricksUrl:"https://book.hacktricks.xyz/network-services-pentesting/nfs-service-pentesting",                         nistUrl:"https://nvd.nist.gov/vuln/search/results?query=nfs",                                            mitre:["T1039","T1190"] },
  3306:  { service:"MySQL",              severity:"critical", cves:["CVE-2012-2122","CVE-2021-2307","CVE-2022-21455"],   description:"MySQL — auth bypass CVE-2012-2122, UDF RCE, arbitrary file read via LOAD DATA",                         exploitDbUrl:"https://www.exploit-db.com/search?q=mysql&type=remote",                   hacktricksUrl:"https://book.hacktricks.xyz/network-services-pentesting/pentesting-mysql",                               nistUrl:"https://nvd.nist.gov/vuln/search/results?query=mysql",                                          mitre:["T1190","T1078"] },
  3389:  { service:"RDP",                severity:"critical", cves:["CVE-2019-0708","CVE-2019-1182","CVE-2021-34535"],   description:"Remote Desktop — BlueKeep RCE, DejaBlue, brute force, clipboard hijack",                                 exploitDbUrl:"https://www.exploit-db.com/search?q=rdp+remote+desktop&type=remote",      hacktricksUrl:"https://book.hacktricks.xyz/network-services-pentesting/pentesting-rdp",                                 nistUrl:"https://nvd.nist.gov/vuln/search/results?query=remote+desktop+protocol",                        mitre:["T1021.001","T1110"] },
  4444:  { service:"Meterpreter/RAT",    severity:"critical", cves:[],                                                   description:"⚠ ACTIVE COMPROMISE INDICATOR — Metasploit default listener / RAT C2 beacon port",                   exploitDbUrl:"https://www.exploit-db.com/search?q=metasploit+meterpreter",              hacktricksUrl:"https://book.hacktricks.xyz/generic-methodologies-and-resources/reverse-shells/msfvenom",               nistUrl:"https://attack.mitre.org/techniques/T1571/",                                                    mitre:["T1571","T1219"] },
  4899:  { service:"Radmin",             severity:"high",     cves:["CVE-2002-0111"],                                    description:"Radmin remote admin — legacy auth bypass, cleartext session",                                            exploitDbUrl:"https://www.exploit-db.com/search?q=radmin&type=remote",                  hacktricksUrl:"https://book.hacktricks.xyz/network-services-pentesting/pentesting-rdp",                                 nistUrl:"https://nvd.nist.gov/vuln/search/results?query=radmin",                                         mitre:["T1021"] },
  5432:  { service:"PostgreSQL",         severity:"high",     cves:["CVE-2019-10164","CVE-2021-23214"],                  description:"PostgreSQL — COPY TO/FROM PROGRAM OS RCE, privilege escalation, CRLF injection",                        exploitDbUrl:"https://www.exploit-db.com/search?q=postgresql&type=remote",              hacktricksUrl:"https://book.hacktricks.xyz/network-services-pentesting/pentesting-postgresql",                          nistUrl:"https://nvd.nist.gov/vuln/search/results?query=postgresql",                                     mitre:["T1190","T1078"] },
  5900:  { service:"VNC",                severity:"critical", cves:["CVE-2006-2369","CVE-2019-15681"],                   description:"VNC — authentication bypass, weak/null password, full screen capture, desktop hijack",                   exploitDbUrl:"https://www.exploit-db.com/search?q=vnc&type=remote",                     hacktricksUrl:"https://book.hacktricks.xyz/network-services-pentesting/pentesting-vnc",                                 nistUrl:"https://nvd.nist.gov/vuln/search/results?query=vnc",                                            mitre:["T1021.005"] },
  6379:  { service:"Redis",              severity:"critical", cves:["CVE-2022-0543","CVE-2021-32761"],                   description:"Redis — unauthenticated access, Lua RCE, master-slave replication abuse, SSRF",                         exploitDbUrl:"https://www.exploit-db.com/search?q=redis&type=remote",                   hacktricksUrl:"https://book.hacktricks.xyz/network-services-pentesting/6379-pentesting-redis",                          nistUrl:"https://nvd.nist.gov/vuln/search/results?query=redis",                                          mitre:["T1190","T1552"] },
  8080:  { service:"HTTP-ALT",           severity:"high",     cves:["CVE-2022-22947","CVE-2021-44228"],                  description:"Alternate HTTP — admin panels, Tomcat/Jetty, Apache proxy, Log4Shell (8080 Solr/Logstash)",             exploitDbUrl:"https://www.exploit-db.com/search?q=tomcat+jetty&type=webapps",           hacktricksUrl:"https://book.hacktricks.xyz/network-services-pentesting/pentesting-web",                                 nistUrl:"https://nvd.nist.gov/vuln/search/results?query=web+server+8080",                                mitre:["T1190"] },
  8443:  { service:"HTTPS-ALT",          severity:"medium",   cves:["CVE-2021-44228","CVE-2021-42013"],                  description:"Alternate HTTPS — management consoles, self-signed certificates, Kubernetes API",                       exploitDbUrl:"https://www.exploit-db.com/search?q=https+8443&type=webapps",             hacktricksUrl:"https://book.hacktricks.xyz/network-services-pentesting/pentesting-web",                                 nistUrl:"https://nvd.nist.gov/vuln/search/results?query=https+8443",                                     mitre:["T1190"] },
  8880:  { service:"HTTP-Proxy/Custom",  severity:"high",     cves:["CVE-2021-41773","CVE-2022-22947","CVE-2021-44228"], description:"Custom HTTP port 8880 — honeypot bait port, web proxies, alternative web servers, scanner infrastructure. Apache/nginx misconfig common.", exploitDbUrl:"https://www.exploit-db.com/search?q=http+8880&type=webapps", hacktricksUrl:"https://book.hacktricks.xyz/network-services-pentesting/pentesting-web", nistUrl:"https://nvd.nist.gov/vuln/search/results?query=http+8880", mitre:["T1190","T1102"] },
  8888:  { service:"HTTP-Dev",           severity:"medium",   cves:["CVE-2021-44228"],                                   description:"Development server — Jupyter notebook (often unauth), custom dev APIs",                                 exploitDbUrl:"https://www.exploit-db.com/search?q=jupyter+notebook&type=webapps",      hacktricksUrl:"https://book.hacktricks.xyz/network-services-pentesting/pentesting-web",                                 nistUrl:"https://nvd.nist.gov/vuln/search/results?query=jupyter",                                        mitre:["T1190"] },
  7070:  { service:"RealServer/AnyConnect", severity:"medium",cves:["CVE-2020-3556","CVE-2021-1551"],                    description:"Cisco AnyConnect / RealNetworks — VPN infrastructure port, IKE/SSL VPN scanning target",                  exploitDbUrl:"https://www.exploit-db.com/search?q=cisco+anyconnect&type=remote",       hacktricksUrl:"https://book.hacktricks.xyz/network-services-pentesting/pentesting-web",                                 nistUrl:"https://nvd.nist.gov/vuln/search/results?query=cisco+anyconnect",               mitre:["T1190","T1133"] },
  2222:  { service:"SSH-ALT",            severity:"medium",   cves:["CVE-2023-38408","CVE-2018-15473"],                  description:"SSH on alternate port — brute force target, misconfigured servers, IoT devices",                          exploitDbUrl:"https://www.exploit-db.com/search?q=openssh&type=remote",                hacktricksUrl:"https://book.hacktricks.xyz/network-services-pentesting/pentesting-ssh",                                 nistUrl:"https://nvd.nist.gov/vuln/search/results?query=openssh",                        mitre:["T1110","T1021.004"] },
  10000: { service:"Webmin",             severity:"critical", cves:["CVE-2019-15107","CVE-2022-36446"],                  description:"Webmin admin panel — RCE without auth (CVE-2019-15107), arbitrary file read, command injection",           exploitDbUrl:"https://www.exploit-db.com/search?q=webmin&type=remote",                 hacktricksUrl:"https://book.hacktricks.xyz/network-services-pentesting/10000-network-data-management-protocol-ndmp",    nistUrl:"https://nvd.nist.gov/vuln/search/results?query=webmin",                         mitre:["T1190","T1059"] },
  9200:  { service:"Elasticsearch",      severity:"critical", cves:["CVE-2015-1427","CVE-2021-22147"],                   description:"Elasticsearch — unauthenticated data access, Groovy sandbox escape RCE, SSRF pivot",                  exploitDbUrl:"https://www.exploit-db.com/search?q=elasticsearch&type=remote",           hacktricksUrl:"https://book.hacktricks.xyz/network-services-pentesting/9200-pentesting-elasticsearch",                  nistUrl:"https://nvd.nist.gov/vuln/search/results?query=elasticsearch",                                  mitre:["T1190","T1552"] },
  27017: { service:"MongoDB",            severity:"critical", cves:["CVE-2019-2386","CVE-2021-20327"],                   description:"MongoDB — unauthenticated access, collection dump, auth bypass on older versions",                      exploitDbUrl:"https://www.exploit-db.com/search?q=mongodb&type=remote",                 hacktricksUrl:"https://book.hacktricks.xyz/network-services-pentesting/27017-27018-mongodb",                            nistUrl:"https://nvd.nist.gov/vuln/search/results?query=mongodb",                                        mitre:["T1190","T1078"] },
  50000: { service:"SAP Dispatcher",     severity:"critical", cves:["CVE-2020-6207","CVE-2022-22536"],                   description:"SAP Application Server — unauthenticated RCE, ICMAD memory corruption",                                  exploitDbUrl:"https://www.exploit-db.com/search?q=sap+icm&type=remote",                 hacktricksUrl:"https://book.hacktricks.xyz/network-services-pentesting/pentesting-sap",                                 nistUrl:"https://nvd.nist.gov/vuln/search/results?query=sap",                                            mitre:["T1190"] },
};

const PROBE_PORTS = Object.keys(PORT_INTEL).map(Number);

// ── HTTP ports that get a real HTTP GET banner grab ───────────────────────────
const HTTP_PORTS = new Set([80, 443, 8080, 8443, 8880, 8888, 3000, 7070, 10000, 2080, 8008, 9090]);
const HTTPS_PORTS = new Set([443, 8443]);

interface BannerResult {
  open: boolean;
  banner: string | null;
  httpStatus?: number;
  httpServer?: string;
  httpPoweredBy?: string;
  rawHeaders?: string;
}

// Grab raw service banner — reads first 1024 bytes after connect.
// For HTTP ports: sends a HEAD / request and returns response headers.
function grabBanner(ip: string, port: number, timeoutMs = 3000): Promise<BannerResult> {
  return new Promise(resolve => {
    const isHttp = HTTP_PORTS.has(port);
    const sock = net.createConnection({ host: ip, port });
    let raw = Buffer.alloc(0);
    const timer = setTimeout(() => {
      sock.destroy();
      // If we have some data already, still return it as a partial banner
      if (raw.length > 0) {
        resolve({ open: true, banner: raw.toString("utf8", 0, Math.min(raw.length, 1024)).trim() });
      } else {
        resolve({ open: false, banner: null });
      }
    }, timeoutMs);

    sock.on("connect", () => {
      if (isHttp) {
        // Send HTTP HEAD request to get Server header
        const req = `HEAD / HTTP/1.0\r\nHost: ${ip}:${port}\r\nUser-Agent: Mozilla/5.0 (compatible; Infrawatch/1.0)\r\nAccept: */*\r\nConnection: close\r\n\r\n`;
        sock.write(req);
      }
      // For non-HTTP: just wait for banner (SSH/FTP/SMTP send on connect)
    });

    sock.on("data", (chunk: Buffer) => {
      raw = Buffer.concat([raw, chunk]);
      if (raw.length >= 2048) {
        clearTimeout(timer);
        sock.destroy();
        parseAndResolve();
      }
    });

    sock.on("end", () => {
      clearTimeout(timer);
      parseAndResolve();
    });

    sock.on("error", () => {
      clearTimeout(timer);
      if (raw.length > 0) {
        parseAndResolve();
      } else {
        resolve({ open: false, banner: null });
      }
    });

    function parseAndResolve() {
      if (raw.length === 0) { resolve({ open: false, banner: null }); return; }
      const text = raw.toString("utf8", 0, Math.min(raw.length, 2048));
      if (isHttp && text.startsWith("HTTP/")) {
        // Parse HTTP response
        const lines = text.split(/\r?\n/);
        const statusLine = lines[0] ?? "";
        const statusMatch = statusLine.match(/HTTP\/[\d.]+\s+(\d+)/);
        const httpStatus = statusMatch ? parseInt(statusMatch[1]) : undefined;
        const headers: Record<string, string> = {};
        for (let i = 1; i < lines.length; i++) {
          if (!lines[i]?.trim()) break;
          const colonIdx = lines[i].indexOf(":");
          if (colonIdx > 0) {
            const key = lines[i].substring(0, colonIdx).trim().toLowerCase();
            const val = lines[i].substring(colonIdx + 1).trim();
            headers[key] = val;
          }
        }
        const rawHeaders = lines.slice(0, 20).filter(Boolean).join("\n");
        resolve({
          open: true,
          banner: `${statusLine}\n${rawHeaders}`,
          httpStatus,
          httpServer: headers["server"],
          httpPoweredBy: headers["x-powered-by"],
          rawHeaders,
        });
      } else {
        // Raw banner (SSH: "SSH-2.0-OpenSSH_8.9p1\r\n", FTP: "220 ProFTPd ...", etc.)
        const banner = text.split(/\r?\n/)[0]?.trim() || text.substring(0, 256).trim();
        resolve({ open: true, banner, rawHeaders: text.substring(0, 512) });
      }
    }
  });
}

// POST /api/attack-intel/probe
router.post("/probe", async (req, res) => {
  const body = z.object({
    ip: z.string().ip({ message: "Must be a valid IPv4 or IPv6 address" }),
    ports: z.array(z.number().int().min(1).max(65535)).optional(),
    timeout: z.number().int().min(500).max(5000).default(2500),
  }).safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: body.error.flatten() });

  const { ip, timeout } = body.data;
  const portsToProbe = body.data.ports?.length ? body.data.ports : PROBE_PORTS;
  const start = Date.now();

  // Geo / ASN lookup
  let geo: Record<string, unknown> = {};
  try {
    const geoRes = await fetch(`http://ip-api.com/json/${ip}?fields=country,countryCode,regionName,city,isp,org,as,proxy,hosting`, { signal: AbortSignal.timeout(3000) });
    if (geoRes.ok) geo = await geoRes.json() as Record<string, unknown>;
  } catch { /* graceful degradation */ }

  // Parallel port probe — all ports simultaneously, with banner grab
  const probeResults = await Promise.all(
    portsToProbe.map(async port => {
      const br = await grabBanner(ip, port, timeout);
      const intel = PORT_INTEL[port];
      return {
        port,
        open: br.open,
        banner:         br.banner         ?? null,
        httpStatus:     br.httpStatus     ?? null,
        httpServer:     br.httpServer     ?? null,
        httpPoweredBy:  br.httpPoweredBy  ?? null,
        rawHeaders:     br.rawHeaders     ?? null,
        service:        intel?.service        ?? `port-${port}`,
        description:    intel?.description    ?? "Unknown service",
        severity:       (intel?.severity      ?? "low") as PortIntel["severity"],
        cves:           intel?.cves           ?? [],
        exploitDbUrl:   intel?.exploitDbUrl   ?? `https://www.exploit-db.com/search?q=${port}`,
        hacktricksUrl:  intel?.hacktricksUrl  ?? `https://book.hacktricks.xyz/network-services-pentesting`,
        nistUrl:        intel?.nistUrl        ?? `https://nvd.nist.gov/vuln/search/results?query=port+${port}`,
        mitre:          intel?.mitre          ?? [],
      };
    })
  );

  const openPorts  = probeResults.filter(r => r.open);
  const scanDuration = Date.now() - start;

  res.json({
    ip,
    geo,
    openCount: openPorts.length,
    totalProbed: portsToProbe.length,
    scanDurationMs: scanDuration,
    scannedAt: new Date().toISOString(),
    ports: probeResults,
    openPorts,
    riskLevel: openPorts.some(p => p.severity === "critical") ? "critical"
             : openPorts.some(p => p.severity === "high")     ? "high"
             : openPorts.some(p => p.severity === "medium")   ? "medium"
             : openPorts.length > 0                           ? "low"
             : "clean",
  });
});

// POST /api/attack-intel/banner — dedicated banner grab for specific ports
// Returns raw banners from a list of ports (or all common ports if none specified)
router.post("/banner", async (req, res) => {
  const body = z.object({
    ip: z.string().ip({ message: "Must be a valid IPv4 or IPv6 address" }),
    ports: z.array(z.number().int().min(1).max(65535)).optional(),
    timeout: z.number().int().min(500).max(8000).default(4000),
  }).safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: body.error.flatten() });

  const { ip, timeout } = body.data;
  // Default banner grab covers the most informative ports
  const bannerPorts = body.data.ports?.length
    ? body.data.ports
    : [21, 22, 23, 25, 80, 110, 143, 443, 445, 993, 3306, 3389, 5432, 6379, 8080, 8443, 8880, 8888, 9200, 27017];

  const start = Date.now();
  const results = await Promise.all(
    bannerPorts.map(async port => {
      const br = await grabBanner(ip, port, timeout);
      const intel = PORT_INTEL[port];
      return {
        port,
        service:      intel?.service ?? `port-${port}`,
        open:         br.open,
        banner:       br.banner,
        httpStatus:   br.httpStatus ?? null,
        httpServer:   br.httpServer ?? null,
        httpPoweredBy:br.httpPoweredBy ?? null,
        rawHeaders:   br.rawHeaders ?? null,
        severity:     intel?.severity ?? "low",
      };
    })
  );

  const openBanners = results.filter(r => r.open);
  res.json({
    ip,
    durationMs: Date.now() - start,
    scannedAt: new Date().toISOString(),
    bannerCount: openBanners.length,
    results,
    openBanners,
  });
});

// GET /api/attack-intel/port-map — static exploit mapping dictionary
router.get("/port-map", (_req, res) => {
  res.json({ ports: PORT_INTEL, probePorts: PROBE_PORTS });
});

export default router;
