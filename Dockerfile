# hs-femtech-mcp : local stdio MCP server for registry crawlers (Glama etc.)
# Runs the server (src/worker.js, the same code that serves https://femtech.horizonshield.dev) in-process
# over stdio via stdio.js. Introspection (initialize, tools/list) needs no external egress and no KV;
# without the FEMTECH_KV binding the server runs in its documented volatile mode (registry seed only,
# register results not persisted). Tool names and schemas are the same 9 the live endpoint advertises (tools/list).
# Build context is the repository root.
FROM node:22-slim
WORKDIR /app
COPY package.json ./package.json
COPY src ./src
COPY stdio.js ./stdio.js
CMD ["node", "stdio.js"]
