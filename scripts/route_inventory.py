#!/usr/bin/env python3
"""Route inventory scanner — list all Express router.METHOD() calls across the codebase."""
import os, re, json, sys

root = sys.argv[1] if len(sys.argv) > 1 else "."
routes = []

for dp, dirs, fs in os.walk(root):
    dirs[:] = [d for d in dirs if d not in {"node_modules", ".git", "dist", ".vite"}]
    for f in fs:
        if not f.endswith((".ts", ".tsx", ".js")): continue
        p = os.path.join(dp, f)
        try:
            txt = open(p, errors="ignore").read()
        except Exception:
            continue
        for m in re.finditer(
            r"router\.(get|post|put|delete|patch|use)\(\s*[`'\"]([^`'\"]+)",
            txt,
            re.IGNORECASE,
        ):
            routes.append({"file": p, "method": m.group(1).upper(), "path": m.group(2)})

print(json.dumps(routes, indent=2))
print(f"\n# Total routes found: {len(routes)}", file=sys.stderr)
