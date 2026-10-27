# One image for every agent. docker-compose.yml decides which agent each container runs.
FROM node:22-slim

WORKDIR /app

# 1. Install dependencies first. These layers are cached and only rebuilt
#    when a package.json or the lockfile changes, not on every code change.
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/a2a/package.json packages/a2a/
COPY packages/importer/package.json packages/importer/
COPY packages/mcp-server/package.json packages/mcp-server/
COPY agents/categorizer/package.json agents/categorizer/
COPY agents/analyst/package.json agents/analyst/
COPY agents/orchestrator/package.json agents/orchestrator/
RUN npm ci

# 2. Then copy the code
COPY tsconfig.base.json ./
COPY packages ./packages
COPY agents ./agents