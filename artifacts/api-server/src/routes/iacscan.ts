import { Router } from "express";

const router = Router();

type Severity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO";
type FileType = "dockerfile" | "terraform" | "kubernetes" | "githubactions" | "unknown";

interface Finding {
  ruleId: string;
  title: string;
  severity: Severity;
  line: number;
  snippet: string;
  description: string;
  remediation: string;
}

function detectFileType(filename: string, content: string): FileType {
  const lower = filename.toLowerCase();
  if (lower === "dockerfile" || lower.startsWith("dockerfile")) return "dockerfile";
  if (lower.endsWith(".tf")) return "terraform";
  if (lower.endsWith(".yml") || lower.endsWith(".yaml")) {
    if (content.includes("apiVersion:") && (content.includes("kind: Pod") || content.includes("kind: Deployment") || content.includes("kind: DaemonSet") || content.includes("kind: StatefulSet"))) return "kubernetes";
    if (content.includes("on:") && (content.includes("runs-on:") || content.includes("uses:"))) return "githubactions";
    if (content.includes("apiVersion:")) return "kubernetes";
  }
  return "unknown";
}

function scanDockerfile(lines: string[]): Finding[] {
  const findings: Finding[] = [];

  lines.forEach((line, i) => {
    const l = line.trim();

    if (/^FROM .+:latest\b/i.test(l)) {
      findings.push({ ruleId: "DF001", severity: "MEDIUM", title: "Using :latest tag", line: i + 1, snippet: l, description: "The :latest tag is mutable and can cause unpredictable builds.", remediation: "Pin to a specific image digest or version tag: FROM node:20.11.0-alpine." });
    }
    if (/^USER root$/i.test(l) || (/^FROM/i.test(l) && !lines.slice(i).some(ll => /^USER /i.test(ll.trim())))) {
      if (/^FROM/i.test(l) && !lines.slice(i + 1).some(ll => /^USER\s+(?!root)/i.test(ll.trim()))) {
        findings.push({ ruleId: "DF002", severity: "HIGH", title: "Running as root", line: i + 1, snippet: l, description: "Container processes run as root by default, increasing blast radius if compromised.", remediation: "Add: USER nonroot or RUN adduser -D appuser && USER appuser" });
      }
    }
    if (/^COPY\s+\.\s+/i.test(l)) {
      findings.push({ ruleId: "DF003", severity: "MEDIUM", title: "COPY . copies entire context", line: i + 1, snippet: l, description: "Copying the full build context may include sensitive files (.env, credentials).", remediation: "Use a .dockerignore file to exclude sensitive paths, or copy only needed files." });
    }
    if (/^ADD\s+https?:\/\//i.test(l)) {
      findings.push({ ruleId: "DF004", severity: "MEDIUM", title: "ADD with remote URL", line: i + 1, snippet: l, description: "ADD fetches remote URLs without integrity checking.", remediation: "Use RUN curl -fsSL <url> | sha256sum to verify downloads." });
    }
    if (/--no-check-certificate|curl\s+-k\b|wget\s+--no-check/i.test(l)) {
      findings.push({ ruleId: "DF005", severity: "HIGH", title: "TLS verification disabled", line: i + 1, snippet: l, description: "Disabling TLS verification in downloads exposes the build to MITM attacks.", remediation: "Remove --no-check-certificate / -k flags. Fix the certificate issue instead." });
    }
    if (/chmod\s+777/i.test(l)) {
      findings.push({ ruleId: "DF006", severity: "HIGH", title: "World-writable permissions (chmod 777)", line: i + 1, snippet: l, description: "chmod 777 grants full write access to all users.", remediation: "Use the minimum necessary permissions (e.g., chmod 755 or 640)." });
    }
    if (/(AWS_SECRET|PRIVATE_KEY|PASSWORD|SECRET_KEY|TOKEN)\s*=\s*\S+/i.test(l)) {
      findings.push({ ruleId: "DF007", severity: "CRITICAL", title: "Hardcoded secret in Dockerfile", line: i + 1, snippet: l.replace(/=\S+/, "=***"), description: "Secrets baked into images are exposed to anyone with image access.", remediation: "Use Docker secrets or runtime environment injection. Never bake credentials into images." });
    }
    if (/^EXPOSE\s+22\b/.test(l)) {
      findings.push({ ruleId: "DF008", severity: "MEDIUM", title: "SSH port exposed", line: i + 1, snippet: l, description: "Exposing port 22 inside containers encourages bad SSH-into-container habits.", remediation: "Use docker exec or a sidecar. Avoid running SSH in containers." });
    }
  });

  return findings;
}

function scanTerraform(lines: string[]): Finding[] {
  const findings: Finding[] = [];
  const content = lines.join("\n");

  lines.forEach((line, i) => {
    const l = line.trim();

    if (/cidr_blocks\s*=\s*\["0\.0\.0\.0\/0"\]/.test(l) || /source\s*=\s*"0\.0\.0\.0\/0"/.test(l)) {
      findings.push({ ruleId: "TF001", severity: "HIGH", title: "Security group open to 0.0.0.0/0", line: i + 1, snippet: l, description: "Allowing unrestricted inbound access from any IP is a critical misconfiguration.", remediation: "Restrict CIDR blocks to known IPs or VPC ranges. Use NAT gateways for outbound-only access." });
    }
    if (/acl\s*=\s*"public-read"/.test(l) || /acl\s*=\s*"public-read-write"/.test(l)) {
      findings.push({ ruleId: "TF002", severity: "CRITICAL", title: "S3 bucket publicly readable", line: i + 1, snippet: l, description: "Public ACLs expose all bucket contents to the internet.", remediation: "Set acl = 'private' and use bucket policies for controlled access." });
    }
    if (/encrypted\s*=\s*false/.test(l)) {
      findings.push({ ruleId: "TF003", severity: "HIGH", title: "Encryption disabled", line: i + 1, snippet: l, description: "Storage resource is explicitly unencrypted.", remediation: "Set encrypted = true and specify a KMS key." });
    }
    if (/deletion_protection\s*=\s*false/.test(l) && content.includes("aws_db_instance")) {
      findings.push({ ruleId: "TF004", severity: "MEDIUM", title: "RDS deletion protection disabled", line: i + 1, snippet: l, description: "Database can be accidentally or maliciously deleted.", remediation: "Set deletion_protection = true for production databases." });
    }
    if (/publicly_accessible\s*=\s*true/.test(l)) {
      findings.push({ ruleId: "TF005", severity: "HIGH", title: "RDS/resource publicly accessible", line: i + 1, snippet: l, description: "Database is exposed to the public internet.", remediation: "Set publicly_accessible = false and use VPC peering or bastion hosts." });
    }
    if (/(password|secret|api_key|access_key)\s*=\s*"[^"]{3,}"/.test(l.toLowerCase())) {
      findings.push({ ruleId: "TF006", severity: "CRITICAL", title: "Hardcoded credential in Terraform", line: i + 1, snippet: l.replace(/=\s*"[^"]+"/, '= "***"'), description: "Credentials in .tf files will be committed to version control.", remediation: "Use var.* with sensitive = true, or retrieve secrets from a secrets manager at runtime." });
    }
    if (/skip_final_snapshot\s*=\s*true/.test(l)) {
      findings.push({ ruleId: "TF007", severity: "MEDIUM", title: "RDS skips final snapshot on deletion", line: i + 1, snippet: l, description: "Deleting the database will permanently destroy all data with no recovery point.", remediation: "Set skip_final_snapshot = false or final_snapshot_identifier = 'backup'." });
    }
    if (/multi_az\s*=\s*false/.test(l) && content.includes("aws_db_instance")) {
      findings.push({ ruleId: "TF008", severity: "LOW", title: "RDS not Multi-AZ", line: i + 1, snippet: l, description: "Single-AZ deployment has no automatic failover.", remediation: "Set multi_az = true for production workloads." });
    }
  });

  return findings;
}

function scanKubernetes(lines: string[]): Finding[] {
  const findings: Finding[] = [];
  const content = lines.join("\n");

  lines.forEach((line, i) => {
    const l = line.trim();

    if (/privileged:\s*true/.test(l)) {
      findings.push({ ruleId: "K8S001", severity: "CRITICAL", title: "Privileged container", line: i + 1, snippet: l, description: "Privileged containers have full host access equivalent to root on the node.", remediation: "Remove privileged: true. Use specific capabilities instead (e.g., NET_BIND_SERVICE)." });
    }
    if (/hostNetwork:\s*true/.test(l)) {
      findings.push({ ruleId: "K8S002", severity: "HIGH", title: "hostNetwork: true", line: i + 1, snippet: l, description: "Pod shares the host network namespace — can sniff traffic and bind any port.", remediation: "Remove hostNetwork: true. Use ClusterIP services for internal communication." });
    }
    if (/hostPID:\s*true/.test(l)) {
      findings.push({ ruleId: "K8S003", severity: "HIGH", title: "hostPID: true", line: i + 1, snippet: l, description: "Pod can see and signal all host processes.", remediation: "Remove hostPID: true." });
    }
    if (/allowPrivilegeEscalation:\s*true/.test(l)) {
      findings.push({ ruleId: "K8S004", severity: "HIGH", title: "Privilege escalation allowed", line: i + 1, snippet: l, description: "Child processes can gain more privileges than the parent.", remediation: "Set allowPrivilegeEscalation: false in securityContext." });
    }
    if (/image:\s*.+:latest/.test(l)) {
      findings.push({ ruleId: "K8S005", severity: "MEDIUM", title: "Using :latest image tag", line: i + 1, snippet: l, description: ":latest is mutable and prevents reproducible deployments.", remediation: "Pin to a specific image digest: image: myapp@sha256:abc123..." });
    }
    if (!/resources:/.test(content)) {
      if (/^\s*containers:/.test(line) && i === lines.findIndex(ll => /^\s*containers:/.test(ll))) {
        findings.push({ ruleId: "K8S006", severity: "MEDIUM", title: "No resource limits defined", line: i + 1, snippet: l, description: "Without CPU/memory limits, a runaway pod can starve other workloads.", remediation: "Add resources.limits.cpu and resources.limits.memory to each container." });
      }
    }
    if (/runAsRoot:\s*true/.test(l) || (/runAsUser:\s*0/.test(l))) {
      findings.push({ ruleId: "K8S007", severity: "HIGH", title: "Container runs as root (UID 0)", line: i + 1, snippet: l, description: "Running as root increases attack surface if the container is compromised.", remediation: "Set runAsNonRoot: true and runAsUser: 1000 in securityContext." });
    }
    if (/readOnlyRootFilesystem:\s*false/.test(l) || (!/readOnlyRootFilesystem/.test(content))) {
      if (/securityContext:/.test(l)) {
        findings.push({ ruleId: "K8S008", severity: "LOW", title: "readOnlyRootFilesystem not set", line: i + 1, snippet: l, description: "Writable root filesystem allows an attacker to install tools or modify the container.", remediation: "Add readOnlyRootFilesystem: true and mount volumes for writable paths." });
      }
    }
    if (/type:\s*LoadBalancer/.test(l) && !/loadBalancerSourceRanges/.test(content)) {
      findings.push({ ruleId: "K8S009", severity: "HIGH", title: "LoadBalancer without IP allowlist", line: i + 1, snippet: l, description: "Service is exposed to the entire internet with no IP restriction.", remediation: "Add loadBalancerSourceRanges: ['10.0.0.0/8'] to restrict access." });
    }
  });

  return findings;
}

function scanGitHubActions(lines: string[]): Finding[] {
  const findings: Finding[] = [];

  lines.forEach((line, i) => {
    const l = line.trim();

    if (/on:\s*pull_request_target/.test(l) || /pull_request_target:/.test(l)) {
      findings.push({ ruleId: "GHA001", severity: "CRITICAL", title: "pull_request_target with checkout of PR code", line: i + 1, snippet: l, description: "pull_request_target runs in the base branch context with write permissions. If combined with checkout of PR head, attackers can execute code with repository secrets.", remediation: "Avoid pull_request_target for untrusted PRs. Use pull_request instead." });
    }
    if (/uses:\s+\w+\/[\w-]+@v?\d+\b(?![\.\d])/.test(l)) {
      const match = l.match(/uses:\s+(\S+)/);
      if (match && !match[1].includes("@sha256:")) {
        findings.push({ ruleId: "GHA002", severity: "HIGH", title: "Unpinned GitHub Action (mutable tag)", line: i + 1, snippet: l, description: `Action pinned to mutable tag. If the action's repo is compromised, malicious code can run in your pipeline.`, remediation: `Pin to a full commit SHA: uses: ${match[1].split("@")[0]}@<full-sha>  # tag` });
      }
    }
    if (/\$\{\{\s*github\.event\.(issue|comment|pull_request)\..*\}\}/.test(l)) {
      findings.push({ ruleId: "GHA003", severity: "HIGH", title: "Untrusted input in expression", line: i + 1, snippet: l, description: "Using user-controlled data from events (issue titles, comments) directly in expressions enables script injection.", remediation: "Pass event data through environment variables, not inline expressions." });
    }
    if (/env:\s*$/.test(l) || (/\bSECRET\b|\bPASSWORD\b|\bAPI_KEY\b/i.test(l) && !l.includes("${{ secrets."))) {
      if (!/\$\{\{\s*secrets\./.test(lines[i])) {
        if (/=\s*['"]\S{4,}['"]/.test(l) && /SECRET|PASS|KEY|TOKEN/i.test(l)) {
          findings.push({ ruleId: "GHA004", severity: "CRITICAL", title: "Hardcoded secret in workflow env", line: i + 1, snippet: l.replace(/=\s*['"][^'"]+['"]/, '= "***"'), description: "Secrets hardcoded in workflow files are exposed in the repository.", remediation: "Use ${{ secrets.MY_SECRET }} and store values in GitHub Secrets." });
        }
      }
    }
    if (/permissions:\s*write-all/.test(l) || /permissions:\s*\*/.test(l)) {
      findings.push({ ruleId: "GHA005", severity: "HIGH", title: "Overly broad permissions (write-all)", line: i + 1, snippet: l, description: "Granting write-all permissions violates principle of least privilege.", remediation: "Specify only needed permissions: permissions: { contents: read, pull-requests: write }" });
    }
    if (/curl.*\|\s*bash/.test(l) || /wget.*\|\s*sh/.test(l)) {
      findings.push({ ruleId: "GHA006", severity: "HIGH", title: "Piping remote script to shell", line: i + 1, snippet: l, description: "Fetching and executing remote scripts without integrity checking enables supply-chain attacks.", remediation: "Download the script, verify its hash, then execute it." });
    }
  });

  return findings;
}

router.post("/scan", (req, res) => {
  const { content, filename } = req.body as { content?: string; filename?: string };
  if (!content || typeof content !== "string") return res.status(400).json({ error: "content required" });

  const fname = filename || "unknown";
  const lines = content.split("\n");
  const fileType = detectFileType(fname, content);

  let findings: Finding[] = [];
  switch (fileType) {
    case "dockerfile":     findings = scanDockerfile(lines); break;
    case "terraform":      findings = scanTerraform(lines); break;
    case "kubernetes":     findings = scanKubernetes(lines); break;
    case "githubactions":  findings = scanGitHubActions(lines); break;
    default:
      // Try all
      findings = [
        ...scanDockerfile(lines),
        ...scanTerraform(lines),
        ...scanKubernetes(lines),
        ...scanGitHubActions(lines),
      ];
  }

  const counts = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0, INFO: 0 };
  findings.forEach(f => counts[f.severity]++);

  const riskScore = Math.min(100,
    counts.CRITICAL * 25 + counts.HIGH * 15 + counts.MEDIUM * 7 + counts.LOW * 2
  );

  res.json({
    filename: fname,
    fileType,
    totalLines: lines.length,
    findings: findings.sort((a, b) => {
      const order: Record<Severity, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3, INFO: 4 };
      return order[a.severity] - order[b.severity];
    }),
    summary: counts,
    riskScore,
    scannedAt: new Date().toISOString(),
  });
});

export default router;
