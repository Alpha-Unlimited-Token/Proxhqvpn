---
name: Offensive tool audit cleanup
description: What was removed in the June 2026 security audit and patterns for bulk TSX section removal
---

## What was removed (June 2026)
All offensive/attack tooling deleted: AlphaTools, SocialBreach, PayloadGen, AgentStrike, LlmProbe, HackAnon, ImAutomation, AnonAuth/Dashboard/Upgrade, DirectoryFuzzer, SubdomainScan, Intruder, SqliScanner, WafBypass, OastTester, OastServer, TokenSequencer, HttpInterceptor, omega keylogger/screen-capture/remote-commands pages.

Backend routes deleted: anon, attackintel, alpha, dirfuzzer, subdomainscan, intruder, interceptor, oasttester, oastserver, sqli-scanner, tokensequencer, wafbypass, imautomation, social-account.

AgentStrike + LLMProbe endpoints removed from ai-security.ts.

## What stays (defensive only)
SilkWeb honeypot, GhostTrace, GhostChain, Ghost Nodes, Ghost Trap, OSINT Recon, Canary Tokens, WAF Analyzer, SIEM, Security Audit, HTTP Probe, Encoder, CVE Lookup, JWT Analyzer, SAST, IaC Scan, Dep Scanner, WebSocket Tester, API Tester.

## Python pattern for bulk section removal from large TSX files
Use brace-depth tracking to find section object boundaries, then delete by line index set — see session for the exact script. The key pattern: walk backward from `id: "sectionId"` line to find the opening `{`, then walk forward tracking `{`/`}` depth until it returns to 0.

**Why:** Section objects in TSX arrays contain JSX so regex-based matching fails on multiline content. Brace-depth tracking is reliable.

## Gotcha: don't include kept-tool IDs in category-array cleanup lists
When cleaning up category arrays that reference deleted manual IDs, accidentally including a kept tool's ID (e.g. "http-probe-manual") strips the `id:` value from that object, causing a TS syntax error on the next line. Always verify the removal list against the kept-tool list before running.
