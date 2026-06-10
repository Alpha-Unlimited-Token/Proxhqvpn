#!/usr/bin/env python3
"""Import health check — detect broken relative imports in TypeScript/JS source files."""
import os, re, sys, json

root = sys.argv[1] if len(sys.argv) > 1 else "."
missing = []

SKIP_DIRS = {"node_modules", ".git", "dist", ".vite", "__pycache__"}
IMPORT_RE = re.compile(
    r"""(?:import(?:[^'"]*from)?|export[^'"]*from|require\()\s*[('"]([^'"]+)[)'"]""",
    re.MULTILINE,
)
CANDIDATES_EXTS = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".json"]
INDEX_NAMES = [f"index{e}" for e in CANDIDATES_EXTS]

for dp, dirs, fs in os.walk(root):
    dirs[:] = [d for d in dirs if d not in SKIP_DIRS]
    if "/dist/" in dp or "/.vite/" in dp:
        continue
    for f in fs:
        if not f.endswith((".ts", ".tsx", ".js", ".jsx", ".mjs")):
            continue
        p = os.path.join(dp, f)
        try:
            txt = open(p, errors="ignore").read()
        except Exception:
            continue
        for m in IMPORT_RE.finditer(txt):
            spec = m.group(1)
            if not spec.startswith("."):
                continue
            base = os.path.normpath(os.path.join(os.path.dirname(p), spec))
            candidates = [base + e for e in CANDIDATES_EXTS] + [os.path.join(base, n) for n in INDEX_NAMES]
            if not any(os.path.exists(c) for c in candidates):
                missing.append({"file": p, "import": spec})

result = {"missing_count": len(missing), "missing": missing}
print(json.dumps(result, indent=2))
if missing:
    print(f"\n✗ {len(missing)} broken relative import(s) found.", file=sys.stderr)
    sys.exit(1)
else:
    print("\n✓ All relative imports resolve correctly.", file=sys.stderr)
