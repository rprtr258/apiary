import * as grpc from "@grpc/grpc-js";
import protobuf from "protobufjs";
import "protobufjs/ext/descriptor";
import type {GRPCRequest, GRPCResponse, grpcServiceMethods, JSONSchema, KV} from "@/types/models.ts";
import type {JSONValue} from "@/types/types.ts";
import descriptorJson from "protobufjs/google/protobuf/descriptor.json" with {type: "json"};
import reflectionProtoDefinition from "./reflection.proto" with {type: "text"};

// ---------------------------------------------------------------------------
// Reflection protocol support
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Reflection message types (lazily initialized)
// ---------------------------------------------------------------------------

let reflectionReqType: protobuf.Type | undefined;
let reflectionRespType: protobuf.Type | undefined;

function ensureReflectionTypes(): void {
  if (reflectionReqType !== undefined) {
    return;
  }
  const root = protobuf.parse(reflectionProtoDefinition).root;
  reflectionReqType = root.lookupType("grpc.reflection.v1alpha.ServerReflectionRequest");
  reflectionRespType = root.lookupType("grpc.reflection.v1alpha.ServerReflectionResponse");
}

// ---------------------------------------------------------------------------
// gRPC reflection client helper
// ---------------------------------------------------------------------------

/**
 * Make a single request to the gRPC reflection service and return the response.
 *
 * The reflection service uses a bidi streaming RPC (ServerReflectionInfo)
 * where each request produces exactly one response.
 */
function makeReflectionCall(
  client: grpc.Client,
  request: Record<string, unknown>,
  deadlineMs: number,
): Promise<Record<string, unknown>> {
  ensureReflectionTypes();
  const reqType = reflectionReqType!;
  const respType = reflectionRespType!;

  const deadline = Date.now() + deadlineMs;

  return new Promise<Record<string, unknown>>((resolve, reject) => {
    return client.makeUnaryRequest<Record<string, unknown>, Record<string, unknown>>(
      "/grpc.reflection.v1alpha.ServerReflection/ServerReflectionInfo",
      (req: Record<string, unknown>): Buffer => Buffer.from(reqType.encode(req).finish()),
      (data: Buffer): Record<string, unknown> => respType.decode(data) as unknown as Record<string, unknown>,
      request,
      new grpc.Metadata(),
      {deadline},
      (err, resp) => {
        if (err !== null) {
          reject(err);
        }
        resolve(resp!);
      },
    );
  });
}

// ---------------------------------------------------------------------------
// Reflection-style service discovery
// ---------------------------------------------------------------------------

/**
 * List all gRPC services available on the target server via reflection.
 */
async function listServicesReflection(target: string, deadlineMs: number): Promise<string[]> {
  const client = new grpc.Client(target, grpc.credentials.createInsecure());

  try {
    console.log({host: "", listServices: ""});
    const response = await makeReflectionCall(
      client,
      {host: "", listServices: ""},
      deadlineMs,
    );

    const listResp = response["listServicesResponse"] as Record<string, unknown> | undefined;
    if (listResp === undefined) {
      throw new Error("Unexpected reflection response: missing list_services_response");
    }

    const services = listResp["service"] as Array<Record<string, unknown>>;
    return services.map(s => s["name"] as string);
  } finally {
    client.close();
  }
}

/**
 * Get the file descriptor for a symbol (fully qualified service or method name)
 * using gRPC reflection.
 */
async function getFileDescriptorSetBytes(
  target: string,
  symbol: string,
  deadlineMs: number,
): Promise<Uint8Array[]> {
  const client = new grpc.Client(target, grpc.credentials.createInsecure());

  try {
    const response = await makeReflectionCall(
      client,
      {host: "", fileContainingSymbol: symbol},
      deadlineMs,
    );

    const fdResp = response["fileDescriptorResponse"] as Record<string, unknown> | undefined;
    if (fdResp === undefined) {
      throw new Error(
        `Unexpected reflection response for symbol "${symbol}": missing file_descriptor_response`,
      );
    }

    return fdResp["fileDescriptorProto"] as Uint8Array[];
  } finally {
    client.close();
  }
}

// ---------------------------------------------------------------------------
// Protobuf descriptor -> JSONSchema conversion
// ---------------------------------------------------------------------------

const descriptorTypesRoot: protobuf.Root = protobuf.Root.fromJSON(descriptorJson);
const FileDescriptorSetType = descriptorTypesRoot.lookupType("google.protobuf.FileDescriptorSet");

/**
 * Load a FileDescriptorProto protobuf root from raw descriptor bytes.
 */
function loadRootFromDescriptorByte(blob: Uint8Array): protobuf.Root {
  const fdp = descriptorTypesRoot.lookupType("google.protobuf.FileDescriptorProto").decode(blob);
  const set = FileDescriptorSetType.create({file: [fdp]});
  const setBytes = FileDescriptorSetType.encode(set).finish();
  // protobufjs/ext/descriptor adds fromDescriptor at runtime
  const RootCtor = protobuf.Root as unknown as {fromDescriptor(buf: Uint8Array): protobuf.Root};
  return RootCtor.fromDescriptor(setBytes);
}

/**
 * Convert a protobuf field type to a JSONSchema type string.
 */
function fieldTypeToSchemaType(field: protobuf.Field): JSONSchema | null {
  switch (field.type) {
  case "double":
  case "float":
    return {type: "number"};
  case "int32":
  case "int64":
  case "uint32":
  case "uint64":
  case "sint32":
  case "sint64":
  case "fixed32":
  case "fixed64":
  case "sfixed32":
  case "sfixed64":
    return {type: "integer"};
  case "bool":
    return {type: "string"};
  case "string":
    return {type: "string"};
  case "bytes":
    return {type: "string"};
  case "enum":
    return {type: "string"};
  case "message":
    return null; // Nested messages are handled separately
  default:
    return null;
  }
}

/**
 * Convert a protobufjs Type/Message to a JSONSchema.
 */
function convertMessageToSchema(msgType: protobuf.Type): JSONSchema {
  const properties: Record<string, JSONSchema> = {};

  for (const field of msgType.fieldsArray) {
    let fieldSchema: JSONSchema | null = fieldTypeToSchemaType(field);

    if (fieldSchema === null) {
      if (field.resolvedType instanceof protobuf.Type) {
        fieldSchema = convertMessageToSchema(field.resolvedType);
      } else {
        fieldSchema = {type: "string"};
      }
    }

    if (field.repeated === true) {
      properties[field.name] = {type: "array", items: fieldSchema};
    } else {
      properties[field.name] = fieldSchema;
    }
  }

  return {type: "object", properties};
}

// ---------------------------------------------------------------------------
// Fake payload generation (ported from Go implementation)
// ---------------------------------------------------------------------------

function newFake(js: JSONSchema): JSONValue {
  switch (js.type) {
  case "object":
    return Object.fromEntries(
      Object.entries(js.properties).map(([k, v]) => {
        const itemSchema =
          v.type === "object" && v.oneOf !== undefined ?
          v.oneOf[Math.floor(Math.random() * v.oneOf.length)] :
          v;
        return [k, newFake(itemSchema)];
      }),
    );
  case "array":
    return [newFake(js.items)];
  case "number":
    return 5.2;
  case "integer":
    return 52;
  case "string":
    return "ABOBA";
  default:
    return null;
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Send a gRPC request to the target server using reflection-based protobuf
 * serialization.
 *
 * Ported from internal/plugin_grpc.go (sendGRPC):
 *   - Go uses grpcurl.InvokeRPC with reflection-based descriptor source
 *   - TS uses reflection to discover input/output message types, then
 *     uses @grpc/grpc-js Client.makeUnaryRequest with protobufjs
 *     serialization/deserialization
 *   - Captures response trailers (via status event) as metadata
 */
export async function sendGRPC(request: GRPCRequest): Promise<GRPCResponse> {
  // Parse method: fully qualified "package.Service/Method"
  const [serviceFull, methodName] = splitMethodName(request.method);
  if (serviceFull === null || methodName === null) {
    return {
      response: `Invalid method format "${request.method}": expected "package.Service/Method"`,
      code: grpc.status.INVALID_ARGUMENT,
      metadata: [],
    };
  }

  const deadlineMs = 10000;

  // 1. Discover input/output types via reflection
  let inputType: protobuf.Type;
  let outputType: protobuf.Type;
  try {
    const fdsBlobs = await getFileDescriptorSetBytes(
      request.target,
      serviceFull,
      deadlineMs,
    );

    // Search all file descriptors for the service definition
    let inputTypeName: string | undefined;
    let outputTypeName: string | undefined;

    for (const blob of fdsBlobs) {
      const root = loadRootFromDescriptorByte(blob);

      // Look up the service definition to find method types
      const svc = root.lookupService(serviceFull);
      const method = svc.methodsArray.find(m => m.name === methodName);
      if (method === undefined) {
        continue;
      }

      inputTypeName = method.requestType;
      outputTypeName = method.responseType;
      break;
    }

    if (inputTypeName === undefined || outputTypeName === undefined) {
      // Fallback: try the method path directly without reflection
      return await sendGRPCFallback(request);
    }

    // Load the full file descriptors again to get the message types
    inputType = createTypeFromFds(fdsBlobs, inputTypeName);
    outputType = createTypeFromFds(fdsBlobs, outputTypeName);
  } catch {
    // Fallback: try the method path directly without reflection
    return await sendGRPCFallback(request);
  }

  // 2. Serialize request payload
  let parsedPayload: Record<string, unknown>;
  try {
    parsedPayload = JSON.parse(request.payload) as Record<string, unknown>;
  } catch {
    return {
      response: `Invalid JSON payload: ${request.payload}`,
      code: grpc.status.INVALID_ARGUMENT,
      metadata: [],
    };
  }

  const verifyErr = inputType.verify(parsedPayload);
  if (verifyErr !== null) {
    return {
      response: `Payload validation error: ${verifyErr}`,
      code: grpc.status.INVALID_ARGUMENT,
      metadata: [],
    };
  }

  // 3. Make the RPC call
  const client = new grpc.Client(request.target, grpc.credentials.createInsecure());

  const grpcMetadata = new grpc.Metadata();
  for (const kv of request.metadata) {
    grpcMetadata.add(kv.key, kv.value);
  }

  const methodPath = `/${request.method}`;
  const deadline = Date.now() + deadlineMs;

  return new Promise<GRPCResponse>((resolve, _reject) => {
    let statusCode = grpc.status.OK;
    let responseTrailers: KV[] = [];

    const call = client.makeUnaryRequest(
      methodPath,
      (req: Record<string, unknown>): Buffer =>
        Buffer.from(inputType.encode(req).finish()),
      (data: Buffer): Record<string, unknown> => {
        const decoded = outputType.decode(data);
        return outputType.toObject(decoded, {
          longs: String,
          enums: String,
          bytes: String,
          defaults: true,
          arrays: true,
          objects: true,
        });
      },
      parsedPayload,
      grpcMetadata,
      {deadline},
      (error, response) => {
        client.close();
        if (error !== null) {
          resolve({
            response: error.details !== "" ? error.details : error.message,
            code: error.code,
            metadata:
              responseTrailers.length > 0 ?
              responseTrailers :
              metadataToKV(error.metadata),
          });
        } else {
          const responseStr = response !== undefined
            ? JSON.stringify(response)
            : "";
          resolve({
            response: responseStr,
            code: statusCode,
            metadata: responseTrailers,
          });
        }
      },
    );

    call.on("metadata", (_md: grpc.Metadata) => {
      // Response headers - currently not captured
    });

    call.on("status", (status: grpc.StatusObject) => {
      statusCode = status.code;
      responseTrailers = metadataToKV(status.metadata);
    });
  });
}

/**
 * Fallback sendGRPC without reflection support.
 * Uses raw Buffer serialization when the reflection service is unavailable.
 */
async function sendGRPCFallback(request: GRPCRequest): Promise<GRPCResponse> {
  const client = new grpc.Client(request.target, grpc.credentials.createInsecure());

  const grpcMetadata = new grpc.Metadata();
  for (const kv of request.metadata) {
    grpcMetadata.add(kv.key, kv.value);
  }

  const methodPath = request.method.startsWith("/")
    ? request.method
    : `/${request.method}`;

  return new Promise<GRPCResponse>((resolve, _reject) => {
    const timeout = setTimeout(() => {
      client.close();
      resolve({
        response: "deadline exceeded",
        code: grpc.status.DEADLINE_EXCEEDED,
        metadata: [],
      });
    }, 10000);

    let statusCode = grpc.status.OK;
    let responseTrailers: KV[] = [];

    const call = client.makeUnaryRequest(
      methodPath,
      (val: Buffer) => val,
      (val: Buffer) => val,
      Buffer.from(request.payload, "utf-8"),
      grpcMetadata,
      (error, response) => {
        clearTimeout(timeout);
        client.close();
        if (error !== null) {
          resolve({
            response: error.details !== "" ? error.details : error.message,
            code: error.code,
            metadata:
              responseTrailers.length > 0 ?
              responseTrailers :
              metadataToKV(error.metadata),
          });
        } else {
          const responseStr = response instanceof Buffer
            ? response.toString("utf-8")
            : JSON.stringify(response);
          resolve({
            response: responseStr,
            code: statusCode,
            metadata: responseTrailers,
          });
        }
      },
    );

    call.on("metadata", (_md: grpc.Metadata) => {
      // Response headers - currently not captured
    });

    call.on("status", (status: grpc.StatusObject) => {
      statusCode = status.code;
      responseTrailers = metadataToKV(status.metadata);
    });
  });
}

/**
 * Split a fully qualified method name "package.Service/Method" into
 * [package.Service, Method].
 */
function splitMethodName(method: string): [string | null, string | null] {
  const slashIdx = method.lastIndexOf("/");
  if (slashIdx === -1) {
    return [null, null];
  }
  return [method.substring(0, slashIdx), method.substring(slashIdx + 1)];
}

/**
 * Create a protobufjs Type from a list of FileDescriptorProto blobs
 * by searching for the named type across all descriptors.
 */
function createTypeFromFds(fdsBlobs: Uint8Array[], typeName: string): protobuf.Type {
  for (const blob of fdsBlobs) {
    try {
      const root = loadRootFromDescriptorByte(blob);
      const resolvedType = root.lookupType(typeName);
      return resolvedType;
    } catch {
      // Type not in this descriptor; try next
    }
  }
  throw new Error(`Type "${typeName}" not found in any file descriptor`);
}

function metadataToKV(md: grpc.Metadata): KV[] {
  const entries: KV[] = [];
  for (const [key, raw] of Object.entries(md.getMap())) {
    const strValue = raw instanceof Buffer ? raw.toString("utf-8") : String(raw);
    entries.push({key, value: strValue});
  }
  return entries;
}

// ---------------------------------------------------------------------------
// Service / Method discovery
// ---------------------------------------------------------------------------

/**
 * List gRPC service methods via reflection.
 *
 * Ported from internal/plugin_grpc.go:
 *   - Go uses grpcreflect/grpcurl to discover services/methods
 *   - TS uses grpc.reflection.v1alpha.ServerReflection protocol
 */
export async function grpcMethods(target: string): Promise<grpcServiceMethods[]> {
  const deadlineMs = 10000;
  const services = await listServicesReflection(target, deadlineMs);
  console.log("SERVICE", services);

  return await Promise.all(services.map(async service => {
    const fdsBlobs = await getFileDescriptorSetBytes(target, service, deadlineMs);

    // Find the service definition and extract method names
    const methods = fdsBlobs.flatMap(blob => {
      const root = loadRootFromDescriptorByte(blob);
      const svc = root.lookupService(service);
      return svc.methodsArray.map(m => m.name);
    });

    return {service, methods};
  }));
}

// ---------------------------------------------------------------------------
// Fake payload generation (via reflection schema)
// ---------------------------------------------------------------------------

/**
 * Generate a fake JSON payload for a gRPC method.
 *
 * Ported from internal/plugin_grpc.go (create/update query fakes):
 *   - Go uses reflection to discover input type schema, then generates fake data
 *   - TS uses the gRPC reflection protocol to discover the input type,
 *     converts it to JSONSchema, and generates a fake payload.
 */
export async function grpcQueryFake(
  target: string,
  method: string,
): Promise<string> {
  const [serviceFull, methodName] = splitMethodName(method);
  if (serviceFull === null || methodName === null) {
    return JSON.stringify({error: `Invalid method format "${method}": expected "package.Service/Method"`}, null, 2);
  }

  const deadlineMs = 10000;

  try {
    const fdsBlobs = await getFileDescriptorSetBytes(target, serviceFull, deadlineMs);

    let inputTypeName: string | undefined;

    for (const blob of fdsBlobs) {
      const root = loadRootFromDescriptorByte(blob);
      const svc = root.lookupService(serviceFull);
      const methodDef = svc.methodsArray.find(m => m.name === methodName);
      if (methodDef !== undefined) {
        inputTypeName = methodDef.requestType;
        break;
      }
    }

    if (inputTypeName === undefined) {
      return JSON.stringify({error: `Method "${method}" not found on server`}, null, 2);
    }

    const msgType = createTypeFromFds(fdsBlobs, inputTypeName);
    const schema = convertMessageToSchema(msgType);

    return JSON.stringify(newFake(schema), null, 2);
  } catch (err) {
    return JSON.stringify(
      {error: `Failed to generate fake payload: ${(err as Error).message}`},
      null,
      2,
    );
  }
}

// ---------------------------------------------------------------------------
// Payload validation (via reflection schema)
// ---------------------------------------------------------------------------

/**
 * Validate a JSON payload for a gRPC method.
 *
 * Ported from internal/plugin_grpc.go (grpcQueryValidate):
 *   - Go validates payload against the method's input schema using reflection
 *   - TS uses the gRPC reflection protocol to discover the input type,
 *     then validates the payload against the protobuf schema.
 */
export async function grpcQueryValidate(
  target: string,
  method: string,
  payload: string,
): Promise<void> {
  const [serviceFull, methodName] = splitMethodName(method);
  if (serviceFull === null || methodName === null) {
    throw new Error(`Invalid method format "${method}": expected "package.Service/Method"`);
  }

  const deadlineMs = 10000;

  const fdsBlobs = await getFileDescriptorSetBytes(target, serviceFull, deadlineMs);

  let inputTypeName: string | undefined;

  for (const blob of fdsBlobs) {
    const root = loadRootFromDescriptorByte(blob);
    const svc = root.lookupService(serviceFull);
    const methodDef = svc.methodsArray.find(m => m.name === methodName);
    if (methodDef !== undefined) {
      inputTypeName = methodDef.requestType;
      break;
    }
  }

  if (inputTypeName === undefined) {
    throw new Error(`Method "${method}" not found on server`);
  }

  const msgType = createTypeFromFds(fdsBlobs, inputTypeName);

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(payload) as Record<string, unknown>;
  } catch (err) {
    throw new Error(`Invalid JSON: ${(err as Error).message}`);
  }

  const verifyErr = msgType.verify(parsed);
  if (verifyErr !== null) {
    throw new Error(`Validation error: ${verifyErr}`);
  }
}
