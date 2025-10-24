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
	    IDs: string[];
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
	
	export enum ColumnType {
	    STRING = "string",
	    NUMBER = "number",
	    TIME = "time",
	    BOOLEAN = "boolean",
	}
	export enum Kind {
	    HTTP = "http",
	    SQL = "sql",
	    JQ = "jq",
	    MD = "md",
	    REDIS = "redis",
	    GRPC = "grpc",
	}
	export enum Database {
	    POSTGRES = "postgres",
	    MYSQL = "mysql",
	    SQLITE = "sqlite",
	    CLICKHOUSE = "clickhouse",
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
	export class HistoryEntry {
	    // Go type: time
	    sent_at: any;
	    // Go type: time
	    received_at: any;
	    request: any;
	    response: any;
	
	    static createFrom(source: any = {}) {
	        return new HistoryEntry(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.sent_at = this.convertValues(source["sent_at"], null);
	        this.received_at = this.convertValues(source["received_at"], null);
	        this.request = source["request"];
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
	export class Request {
	    ID: string;
	    Data: any;
	    History: HistoryEntry[];
	
	    static createFrom(source: any = {}) {
	        return new Request(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.ID = source["ID"];
	        this.Data = source["Data"];
	        this.History = this.convertValues(source["History"], HistoryEntry);
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

}

