module github.com/rprtr258/apiary/internal/redissql/wasm

go 1.25

require (
	github.com/dolthub/go-mysql-server v0.20.0
	github.com/rprtr258/apiary v0.0.0
)

require (
	github.com/cespare/xxhash/v2 v2.3.0 // indirect
	github.com/dolthub/flatbuffers/v23 v23.3.3-dh.2 // indirect
	github.com/dolthub/go-icu-regex v0.0.0-20250327004329-6799764f2dad // indirect
	github.com/dolthub/jsonpath v0.0.2-0.20240227200619-19675ab05c71 // indirect
	github.com/dolthub/vitess v0.0.0-20250512224608-8fb9c6ea092c // indirect
	github.com/google/uuid v1.6.0 // indirect
	github.com/hashicorp/golang-lru v0.5.4 // indirect
	github.com/lestrrat-go/strftime v1.0.4 // indirect
	github.com/pkg/errors v0.9.1 // indirect
	github.com/pmezard/go-difflib v1.0.0 // indirect
	github.com/shopspring/decimal v1.4.0 // indirect
	github.com/sirupsen/logrus v1.9.3 // indirect
	github.com/tetratelabs/wazero v1.8.2 // indirect
	go.opentelemetry.io/otel v1.39.0 // indirect
	go.opentelemetry.io/otel/trace v1.39.0 // indirect
	golang.org/x/mod v0.32.0 // indirect
	golang.org/x/sync v0.19.0 // indirect
	golang.org/x/sys v0.41.0 // indirect
	golang.org/x/telemetry v0.0.0-20260109210033-bd525da824e2 // indirect
	golang.org/x/text v0.34.0 // indirect
	golang.org/x/tools v0.41.0 // indirect
	google.golang.org/genproto/googleapis/rpc v0.0.0-20251202230838-ff82c1b0f217 // indirect
	google.golang.org/grpc v1.79.2 // indirect
	google.golang.org/protobuf v1.36.11 // indirect
	gopkg.in/src-d/go-errors.v1 v1.0.0 // indirect
)

// The engine needs the whole dolthub/vitess module, whose go/mysql package
// references syscall.SIGHUP - a constant that does not exist on js/wasm (and
// the auth-server code using it is dead in a wasm build with no wire server).
// scripts/build-wasm.ts generates a shimmed copy under build/vitess-js
// (syscall.SIGHUP -> syscall.Signal(1), identical value) and the replace makes
// the wasm build use it. Only this module is affected; native builds use
// upstream vitess untouched.
replace github.com/dolthub/vitess => ../../../build/vitess-js

replace github.com/rprtr258/apiary => ../../..
