module github.com/rprtr258/apiary

go 1.24.5

// tool github.com/wailsapp/wails/v2/cmd/wails // TODO: shit not working
replace github.com/rprtr258/fun => ../fun // TODO: remove eto gavno

require (
	github.com/ClickHouse/clickhouse-go/v2 v2.40.3
	github.com/fullstorydev/grpcurl v1.9.3
	github.com/go-sql-driver/mysql v1.9.3
	github.com/golang/protobuf v1.5.4
	github.com/itchyny/gojq v0.12.17
	github.com/jchenry/goldmark-pikchr v0.1.0
	github.com/jhump/protoreflect v1.17.0
	github.com/kr/pretty v0.3.1
	github.com/lib/pq v1.10.9
	github.com/matoous/go-nanoid/v2 v2.1.0
	github.com/pkg/errors v0.9.1
	github.com/redis/go-redis/v9 v9.14.1
	github.com/rprtr258/fun v0.0.31
	github.com/rs/zerolog v1.34.0
	github.com/tenkoh/goldmark-img64 v0.1.2
	github.com/wailsapp/wails/v2 v2.10.2
	github.com/wyatt915/goldmark-treeblood v0.0.1
	github.com/yuin/goldmark v1.7.13
	github.com/yuin/goldmark-emoji v1.0.6
	github.com/yuin/goldmark-highlighting/v2 v2.0.0-20230729083705-37449abec8cc
	go.abhg.dev/goldmark/mermaid v0.6.0
	go.abhg.dev/goldmark/toc v0.12.0
	google.golang.org/grpc v1.76.0
	google.golang.org/protobuf v1.36.10
	modernc.org/sqlite v1.39.1
)

require (
	filippo.io/edwards25519 v1.1.0 // indirect
	github.com/ClickHouse/ch-go v0.69.0 // indirect
	github.com/alecthomas/chroma/v2 v2.20.0 // indirect
	github.com/andybalholm/brotli v1.2.0 // indirect
	github.com/bep/debounce v1.2.1 // indirect
	github.com/bufbuild/protocompile v0.14.1 // indirect
	github.com/cespare/xxhash/v2 v2.3.0 // indirect
	github.com/cncf/xds/go v0.0.0-20251022180443-0feb69152e9f // indirect
	github.com/dgryski/go-rendezvous v0.0.0-20200823014737-9f7001d12a5f // indirect
	github.com/dlclark/regexp2 v1.11.5 // indirect
	github.com/dustin/go-humanize v1.0.1 // indirect
	github.com/envoyproxy/go-control-plane/envoy v1.35.0 // indirect
	github.com/envoyproxy/protoc-gen-validate v1.2.1 // indirect
	github.com/gabriel-vasile/mimetype v1.4.10 // indirect
	github.com/gebv/pikchr v1.0.2 // indirect
	github.com/go-faster/city v1.0.1 // indirect
	github.com/go-faster/errors v0.7.1 // indirect
	github.com/go-jose/go-jose/v4 v4.1.3 // indirect
	github.com/go-ole/go-ole v1.3.0 // indirect
	github.com/godbus/dbus/v5 v5.1.0 // indirect
	github.com/google/uuid v1.6.0 // indirect
	github.com/gorilla/websocket v1.5.3 // indirect
	github.com/itchyny/timefmt-go v0.1.7 // indirect
	github.com/jchv/go-winloader v0.0.0-20250406163304-c1995be93bd1 // indirect
	github.com/klauspost/compress v1.18.1 // indirect
	github.com/kr/text v0.2.0 // indirect
	github.com/labstack/echo/v4 v4.13.4 // indirect
	github.com/labstack/gommon v0.4.2 // indirect
	github.com/leaanthony/go-ansi-parser v1.6.1 // indirect
	github.com/leaanthony/gosod v1.0.4 // indirect
	github.com/leaanthony/slicer v1.6.0 // indirect
	github.com/leaanthony/u v1.1.1 // indirect
	github.com/mattn/go-colorable v0.1.14 // indirect
	github.com/mattn/go-isatty v0.0.20 // indirect
	github.com/ncruces/go-strftime v1.0.0 // indirect
	github.com/paulmach/orb v0.12.0 // indirect
	github.com/pierrec/lz4/v4 v4.1.22 // indirect
	github.com/pkg/browser v0.0.0-20240102092130-5ac0b6a4141c // indirect
	github.com/planetscale/vtprotobuf v0.6.1-0.20240319094008-0393e58bdf10 // indirect
	github.com/remyoudompheng/bigfft v0.0.0-20230129092748-24d4a6f8daec // indirect
	github.com/rivo/uniseg v0.4.7 // indirect
	github.com/rogpeppe/go-internal v1.14.1 // indirect
	github.com/samber/lo v1.52.0 // indirect
	github.com/segmentio/asm v1.2.1 // indirect
	github.com/shopspring/decimal v1.4.0 // indirect
	github.com/spiffe/go-spiffe/v2 v2.6.0 // indirect
	github.com/tkrajina/go-reflector v0.5.8 // indirect
	github.com/valyala/bytebufferpool v1.0.0 // indirect
	github.com/valyala/fasttemplate v1.2.2 // indirect
	github.com/wailsapp/go-webview2 v1.0.22 // indirect
	github.com/wailsapp/mimetype v1.4.1 // indirect
	github.com/wyatt915/treeblood v0.1.16 // indirect
	go.opentelemetry.io/otel v1.38.0 // indirect
	go.opentelemetry.io/otel/trace v1.38.0 // indirect
	go.yaml.in/yaml/v3 v3.0.4 // indirect
	golang.org/x/crypto v0.43.0 // indirect
	golang.org/x/exp v0.0.0-20251017212417-90e834f514db // indirect
	golang.org/x/net v0.46.0 // indirect
	golang.org/x/sync v0.17.0 // indirect
	golang.org/x/sys v0.37.0 // indirect
	golang.org/x/text v0.30.0 // indirect
	google.golang.org/genproto/googleapis/rpc v0.0.0-20251022142026-3a174f9686a8 // indirect
	gopkg.in/check.v1 v1.0.0-20201130134442-10cb98267c6c // indirect
	modernc.org/libc v1.66.10 // indirect
	modernc.org/mathutil v1.7.1 // indirect
	modernc.org/memory v1.11.0 // indirect
)
