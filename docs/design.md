I want to build a multi database and api client app
core features:
- named "Apiary"
- there is collection of requests/datasources, which can be grouped by directories
- requests can be opened, edited, then performed to see their responses
- new requests can be created with given name and query/datasource type
- query can be renamed/deleted/moved between directories by dragging them in tree view
- requests include HTTP requests, GRPC requests, SQL queries with tables as responses, with connectors to different relational databases, e.g. sqlite, postgres, clickhouse, REDIS queries with their responses, JQ queries on json with json responses, MD(markdown) with markdown file as request and rendered page as response, extensible with diagrams, etc
- along with requests, there might be "datasources" such as collection of HTTP requests, got from openapi definition user loaded, or SQL schema got from given database, or MD filesystem with given files, these collections can't be edited in collection of requests sidebar, since they are externally defined, but can be opened, edited and sent as well, e.g. user can open table in SQL schema collection and view it
- plugin system for every pluggable "query"/"datasource" type, every described query/datasource type above is just preinstalled builtin plugin, with possibility to extend with new query types, such as k8s resources, other databases, log viewer/querying, kafka stream viewer, diagramming langs like kroki, image filters, language interpreterse, MCP servers, s3 buckets/objects viewer, etc
- accessible via gui, or via web interface
- queries and datasources are saved locally in single json file, using nanoid to identify queries/datasources/directories, storage format must be dictionary of flat lists separate for queries, datasources, directories structures, etc
- autosave every edit
- tabbed, fluid interface, allowing to open many requests, open just response to view, place them side by side, etc.
- autocompletion when available, for HTTP if user provided openapi definition, autocomplete json body, for SQL autocomplete queries from schema, for GRPC autocomplete from schema retrieved from reflection api or given files, etc.
- response of any query can be represented as json, so under response there must be field for jq query on given response, which displays result in-place, by default query is empty and full response is rendered, in case result is not json (e.g. picture) then jq operates on raw bytes, or there might be some other querying langs being used
- requests addresses/datasources can be easily reused in other queries, so that in new query i can choose existing used address, insted of copy-pasting it manually
- dark theme by default, sleek minimal interface design, theme chooser with addable custom themes
- there is little colored badge next to each query for indicating its type, datasources also highlighted separately
- Ctrl-Shift-P to call command bar with all available features, if creating new request through it, then another command bar is used to select query/datasource type first

http plugin features:
- curl can be inserted into freshly created http request and parsed immediately, http requests can also be copied as curl
- openapi definition can be used in creating http datasource, from local file or remote address, to create http datasource, that is editable requests collection, user can edit everything in these requests except route being called, server address is picked in datasource, so it also cant be edited in queries
- for response html pages there is separate tab to "render" them, image responses are rendered as is, other byte data responses are shown as hex viewer with metadata tab like "file type", "size", etc

sql plugin features:
- queries can be written in raw sql, as well as using prql or pql langs or other query adapter and translated internally to sql, with ability to see result query in interface
- sql responses rendered as navigatable table, which supports inline filtering, sorting, etc
- sql datasource is  created by defining and connecting to database, then displaying all tables, views, etc in it similar to requests, databases similar to directories
- sql tables in sql datasources are also opened as just navigatable table and can be edited in place, in this case edits shouldnt be performed immediately since it is "query performing", and there must be "perform" button to apply made changes
- opening table in sql datasource opens just table pane, no request is edited, as it is just table viewer/editor

advanced features:
- canvas with ability to connect requests between one another to allow scripting of some sort, so that some requests could use results of requests before them
- some proxy to intercept and save queries into given collection for ease of query creation

implementation details
- golang for backend logic and requests storing/performing
- wails for gui/frontend
- no frontend frameworks used, just plain vanilla javascript, and bun for building
- golden-layout for tabbed interface
- codemirror for request body/sql query/etc editors
- single page, shell layout for whole application, full screen, whole layout consists of:
  - sidebar with all collections tree on left side, there is also tab to view all recently made requests to open them
  - rest of screen is query tabs layout, inside queries there are
    - "navigation line" with following: "method" selection: method for HTTP, method for GRPC got from reflection, database kind/query lang for SQL queries, etc. then "address bar" with HTTP server address, GRPC server address, SQL DSN, REDIS server address, etc. Then "perform" button to send request and update response view, advanced setting is allowed through modal, e.g. dsn params as key-value pairs, or read only connection
  - under navigation line there is split view with request data on one side, and response on other side
  - request is text editor for SQL, tabbed "body"/"query params"/"headers" etc for HTTP requests, etc.
  - response is syntax highlighted response, with tabs for response HTTP headers/GRPC metadata; for metadata like response time, code, etc there is "pseudo tab" with such info, or informer or status line
- response components must be reusable, e.g. sql query responses and sql datasource tables are almost same, so should reuse same component; jq response, http json response, grpc response are all json and should reuse same json view component, etc.
