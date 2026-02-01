export default {
  title: "Apiary",
  description: "Cross-platform desktop application for managing API requests",
  base: "/apiary/",
    head: [
      ["link", { rel: "icon", href: "/apiary/logo.svg", type: "image/svg+xml" }],
      ["meta", { name: "theme-color", content: "#0f172a" }]
    ],
  themeConfig: {
    logo: "/logo.svg",
    nav: [
      { text: "Home", link: "/" },
      { text: "Guide", link: "/guide/" },
      { text: "Download", link: "/download/" }
    ],
    sidebar: {
      "/guide/": [
        {
          text: "Getting Started",
          items: [
            { text: "Introduction", link: "/guide/" },
            { text: "Installation", link: "/guide/installation" },
            { text: "Usage", link: "/guide/usage" }
          ]
        },
        {
          text: "Request Types",
          items: [
            { text: "HTTP", link: "/guide/http" },
            { text: "SQL", link: "/guide/sql" },
            { text: "gRPC", link: "/guide/grpc" },
            { text: "Redis", link: "/guide/redis" },
            { text: "JQ", link: "/guide/jq" },
            { text: "Markdown", link: "/guide/markdown" },
            { text: "SQLSource", link: "/guide/sqlsource" },
            { text: "HTTPSource", link: "/guide/httpsource" }
          ]
        }
      ]
    },
    socialLinks: [
      { icon: "github", link: "https://github.com/rprtr258/apiary" }
    ],
    footer: {
      message: "Released under the MIT License.",
      copyright: "Copyright © 2025-present rprtr258"
    },
    search: {
      provider: "local"
    }
  }
}

