FROM oven/bun:1
WORKDIR /app
COPY server.ts ./
# Deps live in apiary's root package.json (dev dependency); install the same
# pinned version here so the image stays self-contained without a manifest.
RUN bun add @modelcontextprotocol/server@2.0.0
ENV MCP_TRANSPORT=http
ENV MCP_PORT=3001
EXPOSE 3001
CMD ["bun", "run", "server.ts"]
