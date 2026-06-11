// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
// Attack Intelligence Engine — real-time attacker IP probe + exploit mapping
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
  8888:  { service:"HTTP-Dev",           severity:"medium",   cves:["CVE-2021-44228"],                                   description:"Development server — Jupyter notebook (often unauth), custom dev APIs",                                 exploitDbUrl:"https://www.exploit-db.com/search?q=jupyter+notebook&type=webapps",      hacktricksUrl:"https://book.hacktricks.xyz/network-services-pentesting/pentesting-web",                                 nistUrl:"https://nvd.nist.gov/vuln/search/results?query=jupyter",                                        mitre:["T1190"] },
  9200:  { service:"Elasticsearch",      severity:"critical", cves:["CVE-2015-1427","CVE-2021-22147"],                   description:"Elasticsearch — unauthenticated data access, Groovy sandbox escape RCE, SSRF pivot",                  exploitDbUrl:"https://www.exploit-db.com/search?q=elasticsearch&type=remote",           hacktricksUrl:"https://book.hacktricks.xyz/network-services-pentesting/9200-pentesting-elasticsearch",                  nistUrl:"https://nvd.nist.gov/vuln/search/results?query=elasticsearch",                                  mitre:["T1190","T1552"] },
  27017: { service:"MongoDB",            severity:"critical", cves:["CVE-2019-2386","CVE-2021-20327"],                   description:"MongoDB — unauthenticated access, collection dump, auth bypass on older versions",                      exploitDbUrl:"https://www.exploit-db.com/search?q=mongodb&type=remote",                 hacktricksUrl:"https://book.hacktricks.xyz/network-services-pentesting/27017-27018-mongodb",                            nistUrl:"https://nvd.nist.gov/vuln/search/results?query=mongodb",                                        mitre:["T1190","T1078"] },
  50000: { service:"SAP Dispatcher",     severity:"critical", cves:["CVE-2020-6207","CVE-2022-22536"],                   description:"SAP Application Server — unauthenticated RCE, ICMAD memory corruption",                                  exploitDbUrl:"https://www.exploit-db.com/search?q=sap+icm&type=remote",                 hacktricksUrl:"https://book.hacktricks.xyz/network-services-pentesting/pentesting-sap",                                 nistUrl:"https://nvd.nist.gov/vuln/search/results?query=sap",                                            mitre:["T1190"] },
};

const PROBE_PORTS = Object.keys(PORT_INTEL).map(Number);

function probePort(ip: string, port: number, timeoutMs = 2500): Promise<boolean> {
  return new Promise(resolve => {
    const sock = net.createConnection({ host: ip, port });
    const timer = setTimeout(() => { sock.destroy(); resolve(false); }, timeoutMs);
    sock.on("connect", () => { clearTimeout(timer); sock.destroy(); resolve(true); });
    sock.on("error", () => { clearTimeout(timer); resolve(false); });
    sock.on("timeout", () => { clearTimeout(timer); sock.destroy(); resolve(false); });
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

  // Parallel port probe — all ports simultaneously (up to 30 probes)
  const probeResults = await Promise.all(
    portsToProbe.map(async port => {
      const open = await probePort(ip, port, timeout);
      const intel = PORT_INTEL[port];
      return {
        port,
        open,
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

// GET /api/attack-intel/port-map — static exploit mapping dictionary
router.get("/port-map", (_req, res) => {
  res.json({ ports: PORT_INTEL, probePorts: PROBE_PORTS });
});

export default router;
