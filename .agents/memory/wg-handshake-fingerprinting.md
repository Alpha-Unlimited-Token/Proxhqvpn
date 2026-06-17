---
name: WireGuard handshake passive fingerprinting
description: How to fingerprint attacker WireGuard clients from the HandshakeInitiation packet without any outbound probing.
---

## Rule
Parse `mac2` from bytes 132–147 of the 148-byte WireGuard HandshakeInitiation packet. `mac2 == all-zeros` means the sender never completed a cookie exchange — the strongest scanner signal (masscan, zgrab, custom PoC scripts all send zero mac2).

**Why:** The WireGuard wire format (HandshakeInitiation) is:
- Bytes 0: msg_type (1)
- Bytes 1–3: reserved_zero
- Bytes 4–7: sender_index
- Bytes 8–39: unencrypted_ephemeral
- Bytes 40–87: encrypted_static (32 + 16 AEAD)
- Bytes 88–115: encrypted_timestamp (12 + 16 AEAD)
- Bytes 116–131: mac1 (16 bytes) — always set by any client
- Bytes 132–147: mac2 (16 bytes) — zero unless a cookie was exchanged

A proper WireGuard client will have a non-zero mac2 only if it previously received a CookieReply. Scanners that fire one-shot handshakes (masscan, zgrab, shodan) never do — their mac2 is all-zeros.

**How to apply:**
```python
mac2 = raw_pkt[132:148] if len(raw_pkt) >= 148 else b"\x00" * 16
mac2_zero = all(b == 0 for b in mac2)
# mac2_zero + low sender_index → masscan_or_zgrab
# mac2_zero → generic_wg_scanner
# mac2 non-zero → real wg client or cookie-aware tool
```
See `standalone/ghost-wireguard.py` → `classify_wg_client()`.

## Probe telemetry legalBasis pattern
Every row in `probe_telemetry` stores `legalBasis = "honeypot_passive_self_defense"` by default. This makes the table self-documenting for auditors and satisfies GDPR legitimate-interest record-keeping. Apply the same pattern to any future passive-capture tables.
