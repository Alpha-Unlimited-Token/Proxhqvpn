# ProxhqVPN Vulnerability Disclosure Policy

**Effective:** 2026-06-13
**Contact:** security@proxhqvpn.com (see `SECURITY_CONTACT_EMAIL` env var)
**Operator:** Alpha Unlimited Technologies LLC

---

## Introduction

Alpha Unlimited Technologies LLC ("ProxhqVPN") welcomes reports of security vulnerabilities in our systems. We are committed to working with the security research community to identify and remediate issues that affect our users.

---

## Scope

This policy applies to:

- `proxhqvpn.com` and all subdomains
- ProxhqVPN API infrastructure (`api.proxhqvpn.com`)
- ProxhqVPN mobile applications (iOS and Android)
- ProxhqVPN desktop applications
- ProxhqVPN VPN node infrastructure (ProxhqVPN-operated only)

**Out of scope:**

- Third-party services integrated with ProxhqVPN (report directly to the third party)
- Customer-controlled infrastructure
- Social engineering attacks
- Physical security attacks
- Denial-of-service attacks

---

## How to Report

Email: **security@proxhqvpn.com** (set via `SECURITY_CONTACT_EMAIL` environment variable)

Include in your report:
1. A clear description of the vulnerability
2. Steps to reproduce the issue
3. The potential impact or severity
4. Any proof-of-concept code (do not execute destructive actions)
5. Your contact information (for follow-up)

---

## Response Timeline

| Milestone | Target |
|-----------|--------|
| Acknowledgment | 72 hours |
| Initial assessment | 7 days |
| Status update | 14 days |
| Remediation (critical) | 30 days |
| Remediation (high) | 60 days |
| Remediation (medium/low) | 90 days |

---

## Safe Harbor

Alpha Unlimited Technologies LLC will not pursue legal action against security researchers who:

1. Report vulnerabilities through this policy in good faith
2. Avoid accessing, modifying, or exfiltrating user data
3. Do not perform denial-of-service attacks
4. Do not publicly disclose the vulnerability before we have remediated it
5. Act in accordance with all applicable laws

---

## Rules of Engagement

**Permitted:**
- Testing ProxhqVPN-owned web applications and APIs
- Testing ProxhqVPN-owned infrastructure with care not to disrupt service
- Passive observation of network traffic from your own ProxhqVPN connection

**Prohibited:**
- Testing against systems not owned by ProxhqVPN
- Testing against other users' accounts or data
- Accessing, modifying, or deleting user data
- Running automated scanners that cause performance degradation
- Social engineering of ProxhqVPN employees or customers
- Physical security testing

---

## Recognition

We appreciate all valid, responsible disclosures. We will acknowledge researchers in our security changelog (with their permission) and may offer recognition in our trust center.

We do not currently operate a paid bug bounty program. Researchers engage voluntarily and cannot claim compensation.

---

## Encryption

For sensitive reports, request our PGP public key by emailing security@proxhqvpn.com.

---

*This policy is subject to change. The current version is always available at proxhqvpn.com/trust-center#disclosure*
