// Bitcoin / UTXO-chain ECDSA Nonce Reuse Scanner
// Supports: Bitcoin (BTC), Litecoin (LTC), Dogecoin (DOGE), Bitcoin Cash (BCH)
// Uses public block explorer APIs — no key required
// Parses DER-encoded secp256k1 signatures from scriptSig and witness data

import type { TxSignatureData } from "./nonce-recovery";

const EXPLORERS: Record<string, { api: string; name: string }> = {
  bitcoin:      { api: "https://mempool.space/api",                    name: "Bitcoin"       },
  litecoin:     { api: "https://litecoinspace.org/api",                name: "Litecoin"      },
  dogecoin:     { api: "https://dogechain.info/api/v1",                name: "Dogecoin"      },
  bitcoincash:  { api: "https://api.blockchair.com/bitcoin-cash",      name: "Bitcoin Cash"  },
};

async function apiFetch(url: string): Promise<unknown> {
  const r = await fetch(url, {
    headers: { "User-Agent": "QuantumAudit/1.0" },
    signal: AbortSignal.timeout(12000),
  });
  if (!r.ok) throw new Error(`HTTP ${r.status} from ${url}`);
  return r.json();
}

// ── DER signature parser ──────────────────────────────────────────────────────
// DER format: 30 [total-len] 02 [r-len] [r-bytes] 02 [s-len] [s-bytes] [sighash]

export function parseDERSignature(hex: string): { r: string; s: string; sigHashType: number } | null {
  try {
    const buf = Buffer.from(hex.replace(/^0x/, ""), "hex");
    if (buf[0] !== 0x30) return null;

    let offset = 2; // skip 0x30 and length byte
    if (buf[offset] !== 0x02) return null;

    const rLen = buf[offset + 1];
    offset += 2;
    // Skip leading zero padding (DER uses it for positive integers starting with high bit)
    const rStart = buf[offset] === 0x00 ? offset + 1 : offset;
    const rEnd   = offset + rLen;
    const r = "0x" + buf.slice(rStart, rEnd).toString("hex").padStart(64, "0");
    offset += rLen;

    if (buf[offset] !== 0x02) return null;
    const sLen = buf[offset + 1];
    offset += 2;
    const sStart = buf[offset] === 0x00 ? offset + 1 : offset;
    const sEnd   = offset + sLen;
    const s = "0x" + buf.slice(sStart, sEnd).toString("hex").padStart(64, "0");
    offset += sLen;

    const sigHashType = buf[offset] ?? 1;
    return { r, s, sigHashType };
  } catch {
    return null;
  }
}

// Extract hex signatures from P2PKH scriptSig ASM
// P2PKH scriptSig ASM: "<sig> <pubkey>"
function extractSigFromScriptSigAsm(asm: string): string | null {
  if (!asm) return null;
  const parts = asm.trim().split(" ");
  // First part is usually the signature in hex (DER + sighash byte)
  if (parts[0] && parts[0].length > 10) return parts[0];
  return null;
}

// Extract hex signatures from scriptSig hex directly
function extractSigsFromScriptHex(hex: string): string[] {
  const sigs: string[] = [];
  if (!hex || hex.length < 8) return sigs;
  try {
    const buf = Buffer.from(hex, "hex");
    let i = 0;
    while (i < buf.length - 2) {
      // OP_PUSH followed by data length
      const pushLen = buf[i];
      if (pushLen >= 0x47 && pushLen <= 0x49) { // 71, 72, 73 bytes — typical DER sig lengths
        const sigEnd = i + 1 + pushLen;
        if (sigEnd <= buf.length) {
          const sigHex = buf.slice(i + 1, sigEnd).toString("hex");
          if (sigHex.startsWith("30")) sigs.push(sigHex);
        }
        i = i + 1 + pushLen;
      } else {
        i++;
      }
    }
  } catch {}
  return sigs;
}

// Extract from witness (P2WPKH, P2WSH)
function extractSigsFromWitness(witness: string[]): string[] {
  const sigs: string[] = [];
  for (const item of witness) {
    if (typeof item === "string" && item.startsWith("30") && item.length >= 140) {
      sigs.push(item);
    }
  }
  return sigs;
}

// Compute Bitcoin P2PKH sighash (double SHA256 of serialized tx + subscript)
// For full sighash computation we use the prevout scriptPubKey
async function computeBitcoinSighash(
  txid: string,
  inputIndex: number,
  apiBase: string
): Promise<string | null> {
  try {
    // Fetch raw transaction hex
    const rawHex = await apiFetch(`${apiBase}/tx/${txid}/hex`) as string;
    const txData = await apiFetch(`${apiBase}/tx/${txid}`) as Record<string, unknown>;
    const inputs = txData.vin as Record<string, unknown>[];

    if (inputIndex >= inputs.length) return null;
    const input = inputs[inputIndex];
    const prevTxid = String(input.txid ?? "");
    const prevVout = Number(input.vout ?? 0);

    // Fetch the previous transaction to get the scriptPubKey
    const prevTx = await apiFetch(`${apiBase}/tx/${prevTxid}`) as Record<string, unknown>;
    const prevOutputs = prevTx.vout as Record<string, unknown>[];
    if (prevVout >= prevOutputs.length) return null;
    const scriptPubKey = String((prevOutputs[prevVout].scriptpubkey as string) ?? "");

    // Use crypto.subtle (available in Node 18+) or a manual double-SHA256
    // For simplicity, encode the data and compute the hash
    const { createHash } = await import("crypto");

    // Build the transaction for signing (simplified SIGHASH_ALL)
    // We'll serialize: version + inputs (with subscript for our input) + outputs + locktime + sighash_type
    const rawBuf = Buffer.from(rawHex, "hex");

    // Parse version (4 bytes LE)
    const version = rawBuf.readInt32LE(0);

    // Re-serialize transaction with subscript
    // This is a simplified serialization — for production use bitcoinjs-lib
    // We use the raw hex and replace the scriptSig of our input with the subscript
    // For P2PKH, subscript = scriptPubKey of the previous output

    // Build the preimage
    const parts: Buffer[] = [];

    // Version
    const versionBuf = Buffer.alloc(4);
    versionBuf.writeInt32LE(version, 0);
    parts.push(versionBuf);

    // Parse and serialize inputs
    let offset = 4;

    // Read input count (varint)
    const inputCount = rawBuf[offset];
    offset += 1;

    const inputCountBuf = Buffer.alloc(1);
    inputCountBuf.writeUInt8(inputCount, 0);
    parts.push(inputCountBuf);

    for (let i = 0; i < inputCount; i++) {
      // txid (32 bytes) + vout (4 bytes)
      parts.push(rawBuf.slice(offset, offset + 36));
      offset += 36;

      // scriptSig length and data
      const scriptLen = rawBuf[offset];
      offset += 1;

      if (i === inputIndex) {
        // Replace with subscript (previous output's scriptPubKey)
        const subscript = Buffer.from(scriptPubKey, "hex");
        const subscriptLenBuf = Buffer.alloc(1);
        subscriptLenBuf.writeUInt8(subscript.length, 0);
        parts.push(subscriptLenBuf);
        parts.push(subscript);
      } else {
        // Empty scriptSig for other inputs
        parts.push(Buffer.from([0x00]));
      }
      offset += scriptLen;

      // Sequence (4 bytes)
      parts.push(rawBuf.slice(offset, offset + 4));
      offset += 4;
    }

    // Parse and add outputs
    const outputCount = rawBuf[offset];
    offset += 1;
    const outputCountBuf = Buffer.alloc(1);
    outputCountBuf.writeUInt8(outputCount, 0);
    parts.push(outputCountBuf);

    for (let i = 0; i < outputCount; i++) {
      // value (8 bytes)
      parts.push(rawBuf.slice(offset, offset + 8));
      offset += 8;
      const scriptLen = rawBuf[offset];
      offset += 1;
      parts.push(Buffer.from([scriptLen]));
      parts.push(rawBuf.slice(offset, offset + scriptLen));
      offset += scriptLen;
    }

    // Locktime (4 bytes)
    parts.push(rawBuf.slice(offset, offset + 4));

    // SIGHASH_ALL (4 bytes LE)
    parts.push(Buffer.from([0x01, 0x00, 0x00, 0x00]));

    const preimage = Buffer.concat(parts);
    const hash1 = createHash("sha256").update(preimage).digest();
    const hash2 = createHash("sha256").update(hash1).digest();
    return "0x" + hash2.toString("hex");
  } catch {
    return null;
  }
}

// ── Main scanner ──────────────────────────────────────────────────────────────

export async function scanBitcoinAddressECDSA(
  address: string,
  chain: string = "bitcoin"
): Promise<{
  signatures: TxSignatureData[];
  totalTransactions: number;
  chain: string;
  note?: string;
}> {
  const explorer = EXPLORERS[chain] ?? EXPLORERS.bitcoin;
  const apiBase = explorer.api;

  // Fetch transactions
  let txids: string[] = [];
  try {
    // Dogecoin uses a different API
    if (chain === "dogecoin") {
      const data = await apiFetch(`https://dogechain.info/api/v1/address/transactions/${address}`) as Record<string, unknown>;
      const txs = (data.transactions as Record<string, unknown>[]) ?? [];
      txids = txs.slice(0, 30).map(tx => String(tx.hash ?? ""));
    } else if (chain === "bitcoincash") {
      const data = await apiFetch(`https://api.blockchair.com/bitcoin-cash/dashboards/address/${address}`) as Record<string, unknown>;
      const addrData = (data.data as Record<string, unknown>)?.[address] as Record<string, unknown>;
      txids = ((addrData?.transactions as string[]) ?? []).slice(0, 30);
    } else {
      // Bitcoin, Litecoin via mempool-compatible API
      const txs = await apiFetch(`${apiBase}/address/${address}/txs`) as Record<string, unknown>[];
      txids = txs.slice(0, 30).map(tx => String(tx.txid ?? ""));
    }
  } catch (e) {
    throw new Error(`Failed to fetch transactions for ${chain}: ${String(e)}`);
  }

  const signatures: TxSignatureData[] = [];

  for (const txid of txids) {
    try {
      let txData: Record<string, unknown>;
      if (chain === "bitcoincash") {
        const raw = await apiFetch(`https://api.blockchair.com/bitcoin-cash/dashboards/transaction/${txid}`) as Record<string, unknown>;
        txData = (raw.data as Record<string, unknown>)?.[txid] as Record<string, unknown> ?? {};
      } else if (chain === "dogecoin") {
        txData = await apiFetch(`https://dogechain.info/api/v1/transaction/${txid}`) as Record<string, unknown>;
        txData = (txData.transaction as Record<string, unknown>) ?? {};
      } else {
        txData = await apiFetch(`${apiBase}/tx/${txid}`) as Record<string, unknown>;
      }

      const inputs = (txData.vin as Record<string, unknown>[]) ?? [];
      const blockHeight = Number((txData.status as Record<string, unknown>)?.block_height ?? txData.block_height ?? 0);

      for (let inputIdx = 0; inputIdx < inputs.length; inputIdx++) {
        const input = inputs[inputIdx];

        // Only process inputs spent by our address
        const prevoutAddr = String((input.prevout as Record<string, unknown>)?.scriptpubkey_address ?? "");
        if (prevoutAddr !== address && prevoutAddr !== "") continue;

        // Extract signature from scriptSig
        const scriptSigHex = String(input.scriptsig ?? input.script ?? "");
        const scriptSigAsm = String(input.scriptsig_asm ?? "");
        const witness = (input.witness as string[]) ?? [];

        let sigHexes: string[] = [];

        // Try ASM first (cleaner)
        const asmSig = extractSigFromScriptSigAsm(scriptSigAsm);
        if (asmSig) sigHexes.push(asmSig);

        // Try raw scriptSig hex
        if (sigHexes.length === 0 && scriptSigHex) {
          sigHexes = extractSigsFromScriptHex(scriptSigHex);
        }

        // Try witness data (SegWit)
        if (sigHexes.length === 0 && witness.length > 0) {
          sigHexes = extractSigsFromWitness(witness);
        }

        for (const sigHex of sigHexes.slice(0, 2)) {
          const parsed = parseDERSignature(sigHex);
          if (!parsed) continue;

          // Try to compute z (sighash)
          let z = "0x" + "00".repeat(32); // placeholder
          if (chain === "bitcoin" || chain === "litecoin") {
            const computed = await computeBitcoinSighash(txid, inputIdx, apiBase).catch(() => null);
            if (computed) z = computed;
          }

          signatures.push({
            txHash: txid,
            blockNumber: blockHeight,
            from: address,
            to: null,
            value: String((input.prevout as Record<string, unknown>)?.value ?? 0),
            r: parsed.r,
            s: parsed.s,
            v: parsed.sigHashType,
            z,
            nonce: inputIdx,
            gasPrice: "0",
          });
        }
      }
    } catch {}
  }

  return {
    signatures,
    totalTransactions: txids.length,
    chain,
  };
}
