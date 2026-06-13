---
name: Creating api-type artifacts
description: How to create a custom Express API server as a new Replit artifact when createArtifact doesn't support "api" type.
---

`createArtifact` only supports: expo, data-visualization, mockup-sandbox, react-vite, slides, video-js.

For a new standalone Express API artifact (e.g. a labs-server or microservice):

1. Scaffold the directory manually: `mkdir -p artifacts/<slug>/.replit-artifact artifacts/<slug>/src`
2. Write all source files normally (package.json, tsconfig.json, src/index.ts, etc.)
3. Write the desired artifact.toml content to `artifacts/<slug>/.replit-artifact/artifact.edit.toml` using the write tool
4. Use bash to bootstrap: `cp artifact.edit.toml artifact.toml` — this satisfies the "file must exist" requirement
5. Call `verifyAndReplaceArtifactToml({ tempFilePath: ".../artifact.edit.toml", artifactTomlPath: ".../artifact.toml" })` to register it officially
6. The workflow is auto-created when the artifact is registered; use `restart_workflow` to start it

**Why:** verifyAndReplaceArtifactToml requires the target artifact.toml to already exist (it's a replace, not a create). createArtifact doesn't support custom server types. Bash copy is the bootstrap workaround.

**How to apply:** Any time the user needs a second Express/Node API server (microservices, security boundaries, separate auth domains).
