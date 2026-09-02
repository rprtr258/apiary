FROM oven/bun:1
WORKDIR /app
COPY package.json ./
COPY server.ts ./
RUN bun install
ENV MCP_TRANSPORT=http
ENV MCP_PORT=3001
EXPOSE 3001
CMD ["bun", "run", "server.ts"]
