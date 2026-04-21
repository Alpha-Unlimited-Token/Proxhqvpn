import { Router } from "express";
import { exec, execSync } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);
const router = Router();

// ─────────────────────────────────────────────────────────────────────────────
// ProxhqVPN Auto-Installer
//
// Every dependency the platform needs is automatically installed here.
// Users never see a script, download, or install instruction — the server
// handles everything silently on first startup or via the setup endpoint.
// ─────────────────────────────────────────────────────────────────────────────

export interface DependencyStatus {
  name: string;
  label: string;
  installed: boolean;
  version?: string;
  purpose: string;
}

function checkCmd(cmd: string): { installed: boolean; version?: string } {
  try {
    const v = execSync(`${cmd} --version 2>&1 || ${cmd} -v 2>&1 || echo ""`, {
      timeout: 3000,
      encoding: "utf-8",
    }).trim().split("\n")[0];
    return { installed: true, version: v.slice(0, 60) };
  } catch {
    return { installed: false };
  }
}

function checkBinary(bin: string): boolean {
  try {
    execSync(`which ${bin} 2>/dev/null`, { timeout: 2000 });
    return true;
  } catch {
    return false;
  }
}

export async function getDependencyStatus(): Promise<DependencyStatus[]> {
  return [
    {
      name: "openvpn",
      label: "OpenVPN",
      purpose: "VPNGate double-hop connections and Ghost Chain relay",
      ...checkCmd("openvpn"),
    },
    {
      name: "proxychains4",
      label: "Proxychains4",
      purpose: "Ghost Chain multi-veil routing (Tor → VPNGate → Exit)",
      installed: checkBinary("proxychains4") || checkBinary("proxychains"),
    },
    {
      name: "wireguard",
      label: "WireGuard",
      purpose: "Primary encrypted tunnel for all subscriber connections",
      installed: checkBinary("wg") || checkBinary("wg-quick"),
    },
    {
      name: "tor",
      label: "Tor",
      purpose: "Mask 1 — Tor Veil for Ghost Chain anonymity",
      ...checkCmd("tor"),
    },
    {
      name: "curl",
      label: "curl",
      purpose: "Connectivity checks and VPNGate API polling",
      ...checkCmd("curl"),
    },
    {
      name: "iptables",
      label: "iptables",
      purpose: "Kill switch and firewall rules",
      installed: checkBinary("iptables"),
    },
  ];
}

router.get("/status", async (_req, res) => {
  try {
    const deps = await getDependencyStatus();
    const allInstalled = deps.every((d) => d.installed);
    res.json({
      allInstalled,
      readyForProduction: allInstalled,
      dependencies: deps,
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/install", async (_req, res) => {
  // Stream the install log back as newline-delimited JSON events
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const send = (event: object) => {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  };

  try {
    send({ step: "start", message: "Auto-installer started" });

    // Detect package manager
    const hasBrew = checkBinary("brew");
    const hasApt = checkBinary("apt-get");
    const hasYum = checkBinary("yum");
    const hasDnf = checkBinary("dnf");

    let pkgInstall: (pkgs: string[]) => string;
    let pkgManager = "unknown";

    if (hasApt) {
      pkgManager = "apt";
      pkgInstall = (pkgs) => `DEBIAN_FRONTEND=noninteractive apt-get install -y ${pkgs.join(" ")}`;
    } else if (hasDnf) {
      pkgManager = "dnf";
      pkgInstall = (pkgs) => `dnf install -y ${pkgs.join(" ")}`;
    } else if (hasYum) {
      pkgManager = "yum";
      pkgInstall = (pkgs) => `yum install -y ${pkgs.join(" ")}`;
    } else if (hasBrew) {
      pkgManager = "brew";
      pkgInstall = (pkgs) => `brew install ${pkgs.join(" ")}`;
    } else {
      send({ step: "error", message: "No supported package manager found (apt/dnf/yum/brew). Contact support." });
      res.end();
      return;
    }

    send({ step: "info", message: `Package manager: ${pkgManager}` });

    const installSteps: { name: string; packages: string[]; altPackages?: string[] }[] = [
      { name: "OpenVPN", packages: ["openvpn"] },
      { name: "Proxychains4", packages: ["proxychains4"], altPackages: ["proxychains"] },
      { name: "WireGuard", packages: ["wireguard", "wireguard-tools"] },
      { name: "Tor", packages: ["tor"] },
      { name: "curl", packages: ["curl"] },
      { name: "iptables", packages: ["iptables"] },
    ];

    // Update package index first (apt only)
    if (hasApt) {
      send({ step: "progress", message: "Updating package index..." });
      try {
        await execAsync("DEBIAN_FRONTEND=noninteractive apt-get update -qq", { timeout: 60000 });
        send({ step: "progress", message: "Package index updated" });
      } catch {
        send({ step: "warn", message: "Package index update failed — continuing anyway" });
      }
    }

    for (const step of installSteps) {
      const pkgs = step.packages;
      const isInstalled = pkgs.some((p) => checkBinary(p));
      if (isInstalled) {
        send({ step: "skip", name: step.name, message: `${step.name} already installed — skipping` });
        continue;
      }

      send({ step: "installing", name: step.name, message: `Installing ${step.name}...` });
      const cmd = pkgInstall(pkgs);

      try {
        await execAsync(cmd, { timeout: 120000 });
        send({ step: "done", name: step.name, message: `${step.name} installed successfully` });
      } catch (e: any) {
        if (step.altPackages) {
          const altCmd = pkgInstall(step.altPackages);
          try {
            await execAsync(altCmd, { timeout: 120000 });
            send({ step: "done", name: step.name, message: `${step.name} installed (alternate package)` });
          } catch (e2: any) {
            send({ step: "warn", name: step.name, message: `${step.name} install failed — may not be available on this OS` });
          }
        } else {
          send({ step: "warn", name: step.name, message: `${step.name} install failed — ${e.message?.slice(0, 80)}` });
        }
      }
    }

    // Start and enable services (Linux systemd only)
    const services = ["tor", "openvpn"];
    for (const svc of services) {
      try {
        await execAsync(`systemctl enable ${svc} 2>/dev/null && systemctl start ${svc} 2>/dev/null`, { timeout: 15000 });
        send({ step: "service", name: svc, message: `${svc} service enabled and started` });
      } catch {
        // Silently skip — may not be systemd
      }
    }

    // Write a global proxychains config for Ghost Chain
    const proxychainsConf = `# ProxhqVPN — Auto-configured proxychains4
# Ghost Chain routing: Tor SOCKS → VPNGate Relay → VPNGate Exit
strict_chain
proxy_dns
remote_dns_subnet 224
tcp_read_time_out 15000
tcp_connect_time_out 8000

[ProxyList]
# Tor Veil (Mask 1)
socks5 127.0.0.1 9050
`;
    try {
      await execAsync(`echo '${proxychainsConf}' > /etc/proxychains4.conf`, { timeout: 5000 });
      send({ step: "config", message: "Proxychains4 configured for Ghost Chain routing" });
    } catch {
      // Non-fatal
    }

    // Final status check
    const finalStatus = await getDependencyStatus();
    const allDone = finalStatus.every((d) => d.installed);

    send({
      step: "complete",
      message: allDone
        ? "All dependencies installed. ProxhqVPN is fully operational."
        : "Installation complete with some warnings. See status page.",
      dependencies: finalStatus,
      allInstalled: allDone,
    });
  } catch (e: any) {
    send({ step: "error", message: `Install failed: ${e.message}` });
  }

  res.end();
});

export default router;
