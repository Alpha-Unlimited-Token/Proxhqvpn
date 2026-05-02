// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { Router } from "express";
import * as crypto from "crypto";
import * as https from "https";
import * as http from "http";
import { URL } from "url";

const router = Router();

interface EntropyResult {
  tokens: string[];
  count: number;
  avgLength: number;
  uniqueCount: number;
  duplicateCount: number;
  bitsOfEntropy: number;
  shannonEntropy: number;
  charsetAnalysis: {
    hasUpper: boolean;
    hasLower: boolean;
    hasDigit: boolean;
    hasSpecial: boolean;
    effectiveAlphabet: number;
  };
  patternAnalysis: {
    hasSequentialChars: boolean;
    hasRepeatingBlocks: boolean;
    isPossiblyTimeBased: boolean;
    hasUuidFormat: boolean;
    hasBase64Pattern: boolean;
  };
  bigramFrequency: Record<string, number>;
  topBigrams: { bigram: string; count: number; pct: number }[];
  verdict: "WEAK" | "MODERATE" | "STRONG" | "VERY_STRONG";
  verdict_explanation: string;
  recommendations: string[];
}

function shannonEntropy(tokens: string[]): number {
  const combined = tokens.join("");
  const freq: Record<string, number> = {};
  for (const c of combined) freq[c] = (freq[c] || 0) + 1;
  const len = combined.length;
  return -Object.values(freq).reduce((sum, f) => {
    const p = f / len;
    return sum + p * Math.log2(p);
  }, 0);
}

function analyzeTokens(tokens: string[]): EntropyResult {
  const cleaned = tokens.map(t => t.trim()).filter(Boolean);
  if (cleaned.length === 0) throw new Error("No valid tokens to analyze");

  const avgLength = cleaned.reduce((s, t) => s + t.length, 0) / cleaned.length;
  const unique = new Set(cleaned);
  const duplicateCount = cleaned.length - unique.size;

  // Charset
  const hasUpper   = cleaned.some(t => /[A-Z]/.test(t));
  const hasLower   = cleaned.some(t => /[a-z]/.test(t));
  const hasDigit   = cleaned.some(t => /[0-9]/.test(t));
  const hasSpecial = cleaned.some(t => /[^A-Za-z0-9]/.test(t));
  const alphabetSize = (hasUpper ? 26 : 0) + (hasLower ? 26 : 0) + (hasDigit ? 10 : 0) + (hasSpecial ? 32 : 0);

  // Estimated bits: log2(alphabet^length)
  const bitsOfEntropy = avgLength * Math.log2(Math.max(alphabetSize, 2));
  const entropy = shannonEntropy(cleaned);

  // Pattern analysis
  const seqCheck = cleaned.some(t => {
    for (let i = 0; i < t.length - 2; i++) {
      if (t.charCodeAt(i + 1) === t.charCodeAt(i) + 1 && t.charCodeAt(i + 2) === t.charCodeAt(i) + 2) return true;
    }
    return false;
  });
  const repeatCheck = cleaned.some(t => /(.{3,})\1/.test(t));
  const timeCheck = cleaned.some(t => /^[0-9]{10,13}/.test(t));
  const uuidCheck = cleaned.some(t => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(t));
  const b64Check  = cleaned.some(t => /^[A-Za-z0-9+/=_-]{20,}$/.test(t));

  // Bigram frequency
  const bigramFreq: Record<string, number> = {};
  for (const token of cleaned) {
    for (let i = 0; i < token.length - 1; i++) {
      const bg = token[i] + token[i + 1];
      bigramFreq[bg] = (bigramFreq[bg] || 0) + 1;
    }
  }
  const totalBigrams = Object.values(bigramFreq).reduce((s, n) => s + n, 0);
  const topBigrams = Object.entries(bigramFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([bg, cnt]) => ({ bigram: bg, count: cnt, pct: Math.round((cnt / totalBigrams) * 10000) / 100 }));

  // Verdict
  const recs: string[] = [];
  let verdict: "WEAK" | "MODERATE" | "STRONG" | "VERY_STRONG";
  let explain: string;

  if (duplicateCount > 0) {
    recs.push(`${duplicateCount} duplicate token(s) found — session tokens must never repeat`);
  }
  if (entropy < 3) recs.push("Shannon entropy is very low — token generation may be predictable");
  if (!hasUpper || !hasLower || !hasDigit) recs.push("Token charset is limited — use upper+lower+digits+special");
  if (avgLength < 16) recs.push("Tokens are too short — use at least 128 bits (22+ base64url chars)");
  if (seqCheck) recs.push("Sequential characters detected — counter-based generation suspected");
  if (repeatCheck) recs.push("Repeating block patterns detected — may indicate weak PRNG");
  if (timeCheck) recs.push("Tokens appear timestamp-based — predictable without additional entropy");

  if (bitsOfEntropy >= 128 && entropy >= 4.5 && !seqCheck && !repeatCheck && duplicateCount === 0) {
    verdict = "VERY_STRONG"; explain = `≥128 bits estimated entropy, high Shannon entropy (${entropy.toFixed(2)} bits/char), no patterns detected`;
  } else if (bitsOfEntropy >= 80 && entropy >= 3.5 && duplicateCount === 0) {
    verdict = "STRONG"; explain = `~${Math.round(bitsOfEntropy)} bits estimated entropy — acceptable for session tokens`;
  } else if (bitsOfEntropy >= 40 && entropy >= 2.5) {
    verdict = "MODERATE"; explain = `~${Math.round(bitsOfEntropy)} bits estimated entropy — marginally acceptable but weak for high-value sessions`;
  } else {
    verdict = "WEAK"; explain = `Only ~${Math.round(bitsOfEntropy)} bits estimated entropy — vulnerable to brute-force`;
  }

  return {
    tokens: cleaned,
    count: cleaned.length,
    avgLength: Math.round(avgLength * 100) / 100,
    uniqueCount: unique.size,
    duplicateCount,
    bitsOfEntropy: Math.round(bitsOfEntropy * 10) / 10,
    shannonEntropy: Math.round(entropy * 100) / 100,
    charsetAnalysis: { hasUpper, hasLower, hasDigit, hasSpecial, effectiveAlphabet: alphabetSize },
    patternAnalysis: { hasSequentialChars: seqCheck, hasRepeatingBlocks: repeatCheck, isPossiblyTimeBased: timeCheck, hasUuidFormat: uuidCheck, hasBase64Pattern: b64Check },
    bigramFrequency: bigramFreq,
    topBigrams,
    verdict,
    verdict_explanation: explain,
    recommendations: recs,
  };
}

router.post("/analyze", (req, res) => {
  const { tokens } = req.body;
  if (!Array.isArray(tokens) || tokens.length === 0) {
    return res.status(400).json({ error: "tokens array required" });
  }
  if (tokens.length < 2) return res.status(400).json({ error: "Provide at least 2 tokens for analysis" });
  if (tokens.length > 500) return res.status(400).json({ error: "Maximum 500 tokens per analysis" });
  try {
    const result = analyzeTokens(tokens);
    res.json(result);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// Helper: generate sample tokens of different qualities for demo
router.post("/generate-sample", (req, res) => {
  const { type = "strong", count = 20 } = req.body;
  const n = Math.min(count, 100);
  let tokens: string[];
  switch (type) {
    case "weak":
      tokens = Array.from({ length: n }, (_, i) => `session${1000 + i}`);
      break;
    case "timestamp":
      tokens = Array.from({ length: n }, () => String(Date.now() + Math.floor(Math.random() * 1000)));
      break;
    case "uuid":
      tokens = Array.from({ length: n }, () => crypto.randomUUID());
      break;
    case "strong":
      tokens = Array.from({ length: n }, () => crypto.randomBytes(32).toString("base64url"));
      break;
    case "moderate":
      tokens = Array.from({ length: n }, () => Math.random().toString(36).slice(2));
      break;
    default:
      tokens = Array.from({ length: n }, () => crypto.randomBytes(16).toString("hex"));
  }
  res.json({ tokens, type });
});

export default router;
