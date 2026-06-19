// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
// Serves per-server install scripts — authenticated via NODE_AGENT_PSK.
// Usage on Vultr server:
//   curl -H "X-Node-Agent-PSK: <psk>" https://<domain>/api/node-scripts/<nodeId> | bash
import { Router, type Request, type Response } from "express";
import fs from "fs";
import path from "path";

const router = Router();

const NODE_AGENT_PSK = process.env.NODE_AGENT_PSK ?? "";

// __dirname at runtime = artifacts/api-server/dist/
// ../../../ walks up to workspace root, then into standalone/server-scripts
const SCRIPTS_DIR = fs.existsSync(
  path.resolve(__dirname, "../../../standalone/server-scripts")
)
  ? path.resolve(__dirname, "../../../standalone/server-scripts")
  : path.resolve(process.cwd(), "../../standalone/server-scripts");

const NODE_SCRIPT_MAP: Record<string, string> = {
  "proxhqvpn-node-2":         "install-node-2-london.sh",
  "proxhqvpn-tokyo-01":       "install-tokyo-01.sh",
  "proxhqvpn-los-angeles-01": "install-la-01.sh",
  "proxhqvpn-chicago":        "install-chicago.sh",
};

function validatePsk(req: Request): boolean {
  if (!NODE_AGENT_PSK) return false;
  const header = (req.headers["x-node-agent-psk"] as string | undefined) ?? "";
  if (header.length !== NODE_AGENT_PSK.length) return false;
  let diff = 0;
  for (let i = 0; i < header.length; i++)
    diff |= header.charCodeAt(i) ^ NODE_AGENT_PSK.charCodeAt(i);
  return diff === 0;
}

router.get("/:nodeId", (req: Request, res: Response) => {
  if (!validatePsk(req)) {
    res.status(401).type("text/plain").send("Unauthorized\n");
    return;
  }

  const nodeId = (req.params.nodeId as string).toLowerCase();
  const filename = NODE_SCRIPT_MAP[nodeId];

  if (!filename) {
    const available = Object.keys(NODE_SCRIPT_MAP).join(", ");
    res
      .status(404)
      .type("text/plain")
      .send(`Unknown node ID: ${req.params.nodeId}\nAvailable: ${available}\n`);
    return;
  }

  const scriptPath = path.join(SCRIPTS_DIR, filename);

  if (!fs.existsSync(scriptPath)) {
    res
      .status(503)
      .type("text/plain")
      .send(`Script file not found on server: ${filename}\n`);
    return;
  }

  const script = fs.readFileSync(scriptPath, "utf-8");
  res.status(200).type("text/plain").send(script);
});

export default router;
