export namespace app {
	
	export class GetResponse {
	    Request: database.Request;
	    History: any[];
	
	    static createFrom(source: any = {}) {
	        return new GetResponse(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.Request = this.convertValues(source["Request"], database.Request);
	        this.History = source["History"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class requestPreview {
	    Kind: database.Kind;
	    SubKind: string;
	
	    static createFrom(source: any = {}) {
	        return new requestPreview(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.Kind = source["Kind"];
	        this.SubKind = source["SubKind"];
	    }
	}
	export class Tree {
	    IDs: Record<string, string>;
	    Dirs: Record<string, Tree>;
	
	    static createFrom(source: any = {}) {
	        return new Tree(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.IDs = source["IDs"];
	        this.Dirs = this.convertValues(source["Dirs"], Tree, true);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class ListResponse {
	    Tree: Tree;
	    Requests: Record<string, requestPreview>;
	
	    static createFrom(source: any = {}) {
	        return new ListResponse(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.Tree = this.convertValues(source["Tree"], Tree);
	        this.Requests = this.convertValues(source["Requests"], requestPreview, true);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class ResponseNewRequest {
	    id: string;
	
	    static createFrom(source: any = {}) {
	        return new ResponseNewRequest(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	    }
	}
	
	export class grpcServiceMethods {
	    service: string;
	    methods: string[];
	
	    static createFrom(source: any = {}) {
	        return new grpcServiceMethods(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.service = source["service"];
	        this.methods = source["methods"];
	    }
	}

}

export namespace database {
	
	export enum Kind {
	    JQ = "jq",
	    MD = "md",
	    REDIS = "redis",
	    GRPC = "grpc",
	    SQLSource = "sql-source",
	    HTTPSource = "http-source",
	    HTTP = "http",
	    SQL = "sql",
	}
	export enum Database {
	    POSTGRES = "postgres",
	    MYSQL = "mysql",
	    SQLITE = "sqlite",
	    CLICKHOUSE = "clickhouse",
	}
	export enum ColumnType {
	    STRING = "string",
	    NUMBER = "number",
	    TIME = "time",
	    BOOLEAN = "boolean",
	}
	export class AuthConfig {
	    type: string;
	    username?: string;
	    password?: string;
	    token?: string;
	    keyName?: string;
	    keyValue?: string;
	
	    static createFrom(source: any = {}) {
	        return new AuthConfig(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.type = source["type"];
	        this.username = source["username"];
	        this.password = source["password"];
	        this.token = source["token"];
	        this.keyName = source["keyName"];
	        this.keyValue = source["keyValue"];
	    }
	}
	export class ColumnInfo {
	    name: string;
	    type: string;
	    nullable: boolean;
	    defaultValue: string;
	
	    static createFrom(source: any = {}) {
	        return new ColumnInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.type = source["type"];
	        this.nullable = source["nullable"];
	        this.defaultValue = source["defaultValue"];
	    }
	}
	export class ConstraintInfo {
	    name: string;
	    type: string;
	    definition: string;
	
	    static createFrom(source: any = {}) {
	        return new ConstraintInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.type = source["type"];
	        this.definition = source["definition"];
	    }
	}
	export class ResponseInfo {
	    description: string;
	    content?: Record<string, MediaTypeInfo>;
	
	    static createFrom(source: any = {}) {
	        return new ResponseInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.description = source["description"];
	        this.content = this.convertValues(source["content"], MediaTypeInfo, true);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class MediaTypeInfo {
	    schema: Record<string, any>;
	    example?: any;
	
	    static createFrom(source: any = {}) {
	        return new MediaTypeInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.schema = source["schema"];
	        this.example = source["example"];
	    }
	}
	export class RequestBodyInfo {
	    description: string;
	    required: boolean;
	    content: Record<string, MediaTypeInfo>;
	
	    static createFrom(source: any = {}) {
	        return new RequestBodyInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.description = source["description"];
	        this.required = source["required"];
	        this.content = this.convertValues(source["content"], MediaTypeInfo, true);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class ParameterInfo {
	    name: string;
	    in: string;
	    description: string;
	    required: boolean;
	    schema: Record<string, any>;
	    example?: any;
	
	    static createFrom(source: any = {}) {
	        return new ParameterInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.in = source["in"];
	        this.description = source["description"];
	        this.required = source["required"];
	        this.schema = source["schema"];
	        this.example = source["example"];
	    }
	}
	export class EndpointInfo {
	    path: string;
	    method: string;
	    summary: string;
	    parameters: ParameterInfo[];
	    requestBody?: RequestBodyInfo;
	    responses: Record<string, ResponseInfo>;
	
	    static createFrom(source: any = {}) {
	        return new EndpointInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.path = source["path"];
	        this.method = source["method"];
	        this.summary = source["summary"];
	        this.parameters = this.convertValues(source["parameters"], ParameterInfo);
	        this.requestBody = this.convertValues(source["requestBody"], RequestBodyInfo);
	        this.responses = this.convertValues(source["responses"], ResponseInfo, true);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class ForeignKey {
	    column: string;
	    table: string;
	    to: string;
	
	    static createFrom(source: any = {}) {
	        return new ForeignKey(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.column = source["column"];
	        this.table = source["table"];
	        this.to = source["to"];
	    }
	}
	export class KV {
	    key: string;
	    value: string;
	
	    static createFrom(source: any = {}) {
	        return new KV(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.key = source["key"];
	        this.value = source["value"];
	    }
	}
	export class GRPCRequest {
	    target: string;
	    method: string;
	    payload: string;
	    metadata: KV[];
	
	    static createFrom(source: any = {}) {
	        return new GRPCRequest(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.target = source["target"];
	        this.method = source["method"];
	        this.payload = source["payload"];
	        this.metadata = this.convertValues(source["metadata"], KV);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class GRPCResponse {
	    response: string;
	    code: number;
	    metadata: KV[];
	
	    static createFrom(source: any = {}) {
	        return new GRPCResponse(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.response = source["response"];
	        this.code = source["code"];
	        this.metadata = this.convertValues(source["metadata"], KV);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class HTTPRequest {
	    url: string;
	    method: string;
	    body: string;
	    headers: KV[];
	
	    static createFrom(source: any = {}) {
	        return new HTTPRequest(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.url = source["url"];
	        this.method = source["method"];
	        this.body = source["body"];
	        this.headers = this.convertValues(source["headers"], KV);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class HTTPResponse {
	    code: number;
	    body: string;
	    headers: KV[];
	
	    static createFrom(source: any = {}) {
	        return new HTTPResponse(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.code = source["code"];
	        this.body = source["body"];
	        this.headers = this.convertValues(source["headers"], KV);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class HTTPSourceRequest {
	    serverUrl: string;
	    specSource: string;
	    specData: string;
	    auth: AuthConfig;
	
	    static createFrom(source: any = {}) {
	        return new HTTPSourceRequest(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.serverUrl = source["serverUrl"];
	        this.specSource = source["specSource"];
	        this.specData = source["specData"];
	        this.auth = this.convertValues(source["auth"], AuthConfig);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class IndexInfo {
	    name: string;
	    definition: string;
	
	    static createFrom(source: any = {}) {
	        return new IndexInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.definition = source["definition"];
	    }
	}
	export class JQRequest {
	    query: string;
	    json: string;
	
	    static createFrom(source: any = {}) {
	        return new JQRequest(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.query = source["query"];
	        this.json = source["json"];
	    }
	}
	export class JQResponse {
	    response: string[];
	
	    static createFrom(source: any = {}) {
	        return new JQResponse(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.response = source["response"];
	    }
	}
	
	export class MDRequest {
	    data: string;
	
	    static createFrom(source: any = {}) {
	        return new MDRequest(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.data = source["data"];
	    }
	}
	export class MDResponse {
	    data: string;
	
	    static createFrom(source: any = {}) {
	        return new MDResponse(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.data = source["data"];
	    }
	}
	
	
	export class RedisRequest {
	    dsn: string;
	    query: string;
	
	    static createFrom(source: any = {}) {
	        return new RedisRequest(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.dsn = source["dsn"];
	        this.query = source["query"];
	    }
	}
	export class RedisResponse {
	    response: string;
	
	    static createFrom(source: any = {}) {
	        return new RedisResponse(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.response = source["response"];
	    }
	}
	export class Response {
	    // Go type: time
	    sent_at: any;
	    // Go type: time
	    received_at: any;
	    response: any;
	
	    static createFrom(source: any = {}) {
	        return new Response(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.sent_at = this.convertValues(source["sent_at"], null);
	        this.received_at = this.convertValues(source["received_at"], null);
	        this.response = source["response"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class Request {
	    ID: string;
	    Path: string;
	    Data: any;
	    Responses: Response[];
	
	    static createFrom(source: any = {}) {
	        return new Request(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.ID = source["ID"];
	        this.Path = source["Path"];
	        this.Data = source["Data"];
	        this.Responses = this.convertValues(source["Responses"], Response);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	
	
	
	export class SQLRequest {
	    dsn: string;
	    database: Database;
	    query: string;
	
	    static createFrom(source: any = {}) {
	        return new SQLRequest(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.dsn = source["dsn"];
	        this.database = source["database"];
	        this.query = source["query"];
	    }
	}
	export class SQLResponse {
	    columns: string[];
	    types: string[];
	    rows: any[][];
	
	    static createFrom(source: any = {}) {
	        return new SQLResponse(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.columns = source["columns"];
	        this.types = source["types"];
	        this.rows = source["rows"];
	    }
	}
	export class SQLSourceRequest {
	    database: Database;
	    dsn: string;
	
	    static createFrom(source: any = {}) {
	        return new SQLSourceRequest(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.database = source["database"];
	        this.dsn = source["dsn"];
	    }
	}
	export class TableInfo {
	    name: string;
	    rowCount: number;
	    sizeBytes: number;
	
	    static createFrom(source: any = {}) {
	        return new TableInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.rowCount = source["rowCount"];
	        this.sizeBytes = source["sizeBytes"];
	    }
	}
	export class TableSchema {
	    columns: ColumnInfo[];
	    constraints: ConstraintInfo[];
	    foreign_keys: ForeignKey[];
	    indexes: IndexInfo[];
	
	    static createFrom(source: any = {}) {
	        return new TableSchema(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.columns = this.convertValues(source["columns"], ColumnInfo);
	        this.constraints = this.convertValues(source["constraints"], ConstraintInfo);
	        this.foreign_keys = this.convertValues(source["foreign_keys"], ForeignKey);
	        this.indexes = this.convertValues(source["indexes"], IndexInfo);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}

}

