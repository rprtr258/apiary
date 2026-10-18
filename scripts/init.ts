import {
  HTTPRequest, SQLRequest,
  Database, Kind, RequestID,
} from "@/types.ts";
import {EmptyRequest} from "../main/database/md.ts";
import {create, load, Request} from "../main/db.ts";

function json(v: unknown): string {
  return JSON.stringify(v, null, 2);
}

const db = await load();

function h(url: string, method: string, body: string, headers: [string, string][]): [Kind.HTTP, HTTPRequest] {
  return [Kind.HTTP, {url, method, body, headers: headers.map(([key, value]) => ({key, value}))}];
}

function s(dsn: string, database: Database, query: string): [Kind.SQL, SQLRequest] {
  return [Kind.SQL, {dsn, database, query}];
}

const ids: Record<string, RequestID> = {};
for (const [path, [kind, data]] of Object.entries({
  "test-jq": [Kind.JQ, {
    query: ". + 1 | . * 3",
    json:  "2\n3",
  }],
  "readme": [Kind.MD, EmptyRequest],
  "test-grpc": [Kind.GRPC, {
    target: "localhost:50051",
    method: "helloworld.Greeter.SayHello",
    payload: json({
      "mast":        2,
      "name":        "+++++++++++++++++++++++++++",
      "z1a1l1u1p1a": "ODIN",
      "z2a2l2u2p2a": "DWA",
    }),
    metadata: [],
  }],
  "test-create":               h("http://localhost:8080/dice", "GET", "", []),
  "ymusic":                    h("https://api.music.yandex.net:443/tracks/", "POST", "track-ids=7019818,29238706&with-positions=false", []),
  "Pokemon API/three Pokemon": h("https://pokeapi.co/api/v2/pokemon/beedrill", "GET", "", []),
  "Postman API/get":           h("https://postman-echo.com/get?k=v&arg=1&arg=b", "GET", "", []),
  "Sanya/create-post":         h("https://jsonplaceholder.typicode.com/posts", "POST", json({"title": "foo", "body": "bxar", "userId": 1}), [["Content-type", "application/json; charset=UTF-8"]]),
  "Sanya/github":              h("https://api.github.com/repositories/498770377", "GET", "{}", []),
  "Sanya/google":              h("http://google.com", "POST", "", []),
  "Sanya/sanya_1":             h("http://google.com", "GET", "", []),
  "Sanya/subdir/test-create":  h("https://webhook-test.mautic.com/1kzqk261", "POST", "axaxaxaxa", [["xxx", "yyy"]]),
  "sqlborn": s("host=localhost user=postgres password=a port=5432 dbname=infrastructure-api-team sslmode=disable", "postgres", `-- select * from resource_type
-- select * from environment
select now();`),
  "Sanya/test-sql": s("host=localhost user=postgres password=a port=5432 dbname=infrastructure-api-team sslmode=disable", "postgres", `SELECT *
FROM environment
ORDER BY id`),
  "work-beekeeper": [Kind.SQLSource, {
    "dsn": "/home/rprtr258/Downloads/home/.config/beekeeper-studio/app.db",
    "database": "sqlite",
    "readOnly": false,
  }],
} as Record<string, [Kind, Request["Data"]]>)) {
  const id = await create(db, kind, path, data);
  ids[path] = id;
}

