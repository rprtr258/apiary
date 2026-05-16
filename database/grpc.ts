import type {GRPCRequest, GRPCResponse, grpcServiceMethods} from "../types/models.ts";
import * as grpc from "@grpc/grpc-js";

export async function sendGRPC(request: GRPCRequest): Promise<GRPCResponse> {
  const metadata = new grpc.Metadata();
  for (const kv of request.metadata) {
    metadata.add(kv.key, kv.value);
  }

  const client = new grpc.Client(request.target, grpc.credentials.createInsecure());

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      client.close();
      reject(new Error("GRPC deadline exceeded"));
    }, 10000);

    client.makeUnaryRequest(
      request.method,
      (value: Buffer) => value,
      (value: Buffer) => value,
      Buffer.from(request.payload, "utf-8"),
      metadata,
      {},
      (error, response) => {
        clearTimeout(timeout);
        client.close();
        if (error) {
          resolve({
            response: error.details ?? error.message,
            code: error.code ?? grpc.status.UNKNOWN,
            metadata: [],
          });
        } else {
          const responseStr = response instanceof Buffer ? response.toString("utf-8") : JSON.stringify(response);
          resolve({
            response: responseStr,
            code: grpc.status.OK,
            metadata: [],
          });
        }
      },
    );
  });
}

export async function grpcMethods(_target: string): Promise<grpcServiceMethods[]> {
  return [];
}

export async function grpcQueryFake(
  target: string,
  method: string, // NOTE: fully qualified
): Promise<string> {
  return JSON.stringify({name: "string"}, null, 2);
  // 	reflSource, cc, err := database.Connect(a.ctx, Target)
  // 	if err != nil {
  // 		return "", errors.Wrap(err, "connect")
  // 	}
  // 	defer cc.Close()

  // 	dsc, err := reflSource.FindSymbol(Method)
  // 	if err != nil {
  // 		return "", errors.Wrap(err, "find method")
  // 	}

  // 	methodDesc := dsc.(*desc.MethodDescriptor)
  // 	// fmt.Println("    IN", strings.TrimPrefix(inputType.GetFullyQualifiedName(), pkg+"."))
  // 	// fmt.Println("    OUT", strings.TrimPrefix(methodDesc.GetOutputType().GetFullyQualifiedName(), pkg+"."))
  // 	m := dynamicpb.NewMessage(methodDesc.GetInputType().UnwrapMessage())

  // 	schema, err := ConvertMessageToJSONSchema(m)
  // 	// schema["$schema"]= "http://json-schema.org/schema#"
  // 	if err != nil {
  // 		return "", errors.Wrap(err, "convert message to json schema")
  // 	}

  // 	// jsonSchema, err := json.MarshalIndent(schema, "", "  ")
  // 	// check(err)

  // 	b, err := json.MarshalIndent(newFake(schema), "", "  ")
  // 	if err != nil {
  // 		return "", errors.Wrap(err, "marshal fake")
  // 	}
  // 	return string(b), nil
}

export async function grpcQueryValidate(_target: string, _method: string, payload: string): Promise<void> {
  JSON.parse(payload);
}
