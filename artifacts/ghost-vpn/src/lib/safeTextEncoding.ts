// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
// Pure string-based HTML entity decoder — no DOM, no innerHTML, no XSS surface.

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'",
  nbsp: "\u00a0", copy: "©", reg: "®", trade: "™",
  hellip: "…", mdash: "—", ndash: "–", laquo: "«", raquo: "»",
};

export function decodeHtmlEntities(input: string): string {
  return input.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (_match, token: string) => {
    if (token.startsWith("#")) {
      const isHex = token[1]?.toLowerCase() === "x";
      const code = Number.parseInt(isHex ? token.slice(2) : token.slice(1), isHex ? 16 : 10);
      return Number.isFinite(code) && code > 0 ? String.fromCodePoint(code) : _match;
    }
    return NAMED_ENTITIES[token] ?? _match;
  });
}

export function encodeHtmlEntities(input: string): string {
  return input.replace(/[&<>"']/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#x27;" }[c] ?? c
  ));
}
