---
# https://vitepress.dev/reference/default-theme-home-page
layout: home

hero:
  name: "Apiary"
  text: "One tool for all your API needs"
  tagline: Manage HTTP, SQL, gRPC, Redis, JQ, Markdown, and more with a single unified interface.
  image:
    src: /logo.svg
    alt: Apiary Logo
  actions:
    - theme: brand
      text: Download Now
      link: /download/
    - theme: alt
      text: View on GitHub
      link: https://github.com/rprtr258/apiary

features:
  - title: Multiple Request Types
    details: Supports HTTP, SQL, gRPC, Redis, JQ, Markdown, SQLSource, and HTTPSource plugins. Extensible plugin system for custom request types.
    icon: 🚀
  - title: Cross-Platform
    details: Available for Linux, macOS, and Windows. Built with Go and TypeScript using Wails for native desktop experience.
    icon: 💻
  - title: JSON Database
    details: Simple file-based storage with automatic versioning. All requests and responses stored in a single db.json file.
    icon: 💾
  - title: Modern Interface
    details: Dark theme by default, sleek minimal design, tabbed interface with GoldenLayout, and CodeMirror editors.
    icon: 🎨
  - title: Request sources
    details: |
      *Source requests provide you all requests from you OpenAPI specs, SQL database, or Markdown directory, and etc.
    icon: 📦
  - title: Plugin Architecture
    details: Extensible request/response system with built-in plugins. Add new request types like k8s resources, Kafka streams, or MCP servers.
    icon: 🔌

---

## Quick Start

### Download Pre-built Binaries

Get the latest release for your platform:

<div class="download-buttons">
  <a class="button button-primary download-button" href="https://github.com/rprtr258/apiary/releases/latest">
    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24"><!-- Icon from MingCute Icon by MingCute Design - https://github.com/Richard9394/MingCute/blob/main/LICENSE --><g fill="none" fill-rule="evenodd"><path d="m12.594 23.258l-.012.002l-.071.035l-.02.004l-.014-.004l-.071-.036q-.016-.004-.024.006l-.004.01l-.017.428l.005.02l.01.013l.104.074l.015.004l.012-.004l.104-.074l.012-.016l.004-.017l-.017-.427q-.004-.016-.016-.018m.264-.113l-.014.002l-.184.093l-.01.01l-.003.011l.018.43l.005.012l.008.008l.201.092q.019.005.029-.008l.004-.014l-.034-.614q-.005-.019-.02-.022m-.715.002a.02.02 0 0 0-.027.006l-.006.014l-.034.614q.001.018.017.024l.015-.002l.201-.093l.01-.008l.003-.011l.018-.43l-.003-.012l-.01-.01z"/><path fill="currentColor" d="M8.264 15.29a1 1 0 0 1 .822.522l1.892 3.493a1.809 1.809 0 0 1-1.856 2.65l-3.93-.582a1 1 0 0 1-.672-1.563l.623-.89l-.174-.984a1 1 0 0 1 .811-1.159l.985-.173l.623-.89a1 1 0 0 1 .876-.425Zm6.347-.024a1 1 0 0 1 .858-.043l.116.057l.94.543l.966-.259a1 1 0 0 1 1.188.596l.037.111l.259.966l.94.543a1 1 0 0 1 .154 1.623l-.103.078l-3.315 2.188a1.809 1.809 0 0 1-2.805-1.46l.003-.158l.238-3.965a1 1 0 0 1 .524-.82M12 2a4 4 0 0 1 4 4v1c0 1.214.502 2.267 1.166 3.354l.736 1.165c.1.16.195.315.28.457c.32.541.628 1.14.788 1.781a7 7 0 0 1 .194 1.358a2 2 0 0 0-1.932-.516l-.565.151l-.582-.336a2 2 0 0 0-2.996 1.613l-.238 3.965c-.021.345.022.684.121 1.003l-.269.005h-.406q-.114 0-.226-.004c.22-.71.152-1.492-.214-2.167l-1.891-3.493a2 2 0 0 0-3.397-.195l-.385.55l-.33.058a5.4 5.4 0 0 1 .024-1.16c.037-.285.086-.567.152-.832c.198-.792.535-1.459.857-2.02l.437-.74C7.74 10.28 8 9.722 8 9V6a4 4 0 0 1 4-4m-1.438 5.778l-.822.41c.224.597.572 1.156.897 1.6l.204.269l.184.225l.081.094l.25-.141l.329-.197c.176-.109.368-.232.566-.367c.604-.412 1.225-.91 1.662-1.427l-2.316-.58a1.5 1.5 0 0 0-1.035.114"/></g></svg>
    Linux
  </a>
  <a class="button button-primary download-button" href="https://github.com/rprtr258/apiary/releases/latest">
    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 16 16"><!-- Icon from Gravity UI Icons by YANDEX LLC - https://github.com/gravity-ui/icons/blob/main/LICENSE --><path fill="currentColor" fill-rule="evenodd" d="M9.063 3.5H12A1.5 1.5 0 0 1 13.5 5v6a1.5 1.5 0 0 1-1.5 1.5h-1.441l-.029-.03c-.75-.75-.78-1.425-.78-3.22A.75.75 0 0 0 9 8.5H7.753c.018-1.895.162-3.441 1.31-5m-1.777 0H4A1.5 1.5 0 0 0 2.5 5v6A1.5 1.5 0 0 0 4 12.5h4.714c-.38-.76-.45-1.574-.462-2.5H7a.75.75 0 0 1-.75-.75v-.07c0-1.89 0-3.791 1.036-5.68M1 5a3 3 0 0 1 3-3h8a3 3 0 0 1 3 3v6a3 3 0 0 1-3 3H4a3 3 0 0 1-3-3zm9.25 2.25a.75.75 0 0 0 1.5 0v-1a.75.75 0 0 0-1.5 0zM4.75 8A.75.75 0 0 1 4 7.25v-1a.75.75 0 0 1 1.5 0v1a.75.75 0 0 1-.75.75" clip-rule="evenodd"/></svg>
    macOS
  </a>
  <a class="button button-primary download-button" href="https://github.com/rprtr258/apiary/releases/latest">
    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24"><!-- Icon from Unicons by Iconscout - https://github.com/Iconscout/unicons/blob/master/LICENSE --><path fill="currentColor" d="M22 2L11.2 3.6v8l10.8-.1zM10.2 12.5L2 12.4v6.8l8.1 1.1zM2 4.8v6.8h8.1V3.7zm9.1 7.7v7.9L22 22v-9.4z"/></svg>
    Windows
  </a>
</div>

### Building from Source

If you prefer to build from source:

```bash
git clone https://github.com/rprtr258/apiary.git
cd apiary
# go, wails and bun required
wails build
# check build/bin for built binary
```

## Features in Detail

<div class="feature-grid">
  <div class="feature-card">
    <div class="feature-title">
      <div class="feature-icon">🌐</div>
      <h3 class="feature-title">HTTP Client</h3>
    </div>
    <p class="feature-description">
      Full-featured HTTP client with support for OpenAPI imports, curl import/export,
      request/response inspection, and HTML/hex/image viewers.
    </p>
  </div>
  <div class="feature-card">
    <div class="feature-title">
      <div class="feature-icon">🗄️</div>
      <h3 class="feature-title">SQL Queries</h3>
    </div>
    <p class="feature-description">
      Connect to SQLite, PostgreSQL, ClickHouse, and more. Write raw SQL or use PRQL/PQL.
      Results displayed as interactive tables with inline filtering and sorting.
    </p>
  </div>
  <div class="feature-card">
    <div class="feature-title">
      <div class="feature-icon">⚡</div>
      <h3 class="feature-title">gRPC Support</h3>
    </div>
    <p class="feature-description">
      Connect to gRPC services via reflection or proto files. Send and receive
      structured messages with automatic JSON serialization.
    </p>
  </div>
  <div class="feature-card">
    <div class="feature-title">
      <div class="feature-icon">🔍</div>
      <h3 class="feature-title">JQ Processing</h3>
    </div>
    <p class="feature-description">
      Apply JQ queries to any JSON response. Chain transformations and extract
      data with the powerful JQ language.
    </p>
  </div>
  <div class="feature-card">
    <div class="feature-title">
      <div class="feature-icon">📝</div>
      <h3 class="feature-title">Markdown Editor</h3>
    </div>
    <p class="feature-description">
      Write and preview Markdown documents with live rendering. Perfect for
      documentation, notes, and README files.
    </p>
  </div>
  <div class="feature-card">
    <div class="feature-title">
      <div class="feature-icon">🔌</div>
      <h3 class="feature-title">Extensible Plugins</h3>
    </div>
    <p class="feature-description">
      Create custom request types with the plugin system. Add support for
      Kubernetes, Kafka, S3, MCP servers, and more.
    </p>
  </div>
</div>

## Screenshots

![](/public/screenshot.png)

## Contributing

Apiary is open source and welcomes contributions! Check out the [GitHub repository](https://github.com/rprtr258/apiary) to report issues, suggest features, or submit pull requests.

## License

Apiary is released under the MIT License.
