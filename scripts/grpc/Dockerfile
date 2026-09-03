FROM oven/bun:1
WORKDIR /app
COPY ./ ./
RUN bun install --ignore-scripts --frozen-lockfile
EXPOSE 50051
CMD ["bun", "run", "server.ts"]