[
  {
    name: "apiary-backend",
    command: "go",
    args: ["run", "cmd/main.go"],
    autorestart: false,
    watch: "\\.go$",
    tags: ["apiary"],
  },
  {
    name: "apiary-frontend",
    command: "bun",
    args: ["dev"],
    cwd: "frontend",
    tags: ["apiary"],
  },
]
