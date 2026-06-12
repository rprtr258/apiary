import * as grpc from "@grpc/grpc-js";
import type {GRPCRequest, GRPCResponse, grpcServiceMethods} from "../shared/types/models.ts";
import {JSONValue} from "../shared/types/types.ts";

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
        if (error !== null) {
          resolve({
            response: `details: ${error.details}, message: ${error.message}, cause: ${error.cause as string}`,
            code: error.code,
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

function splitService(serviceName: string): [pkg: string, short: string] {
  const dotI = serviceName.lastIndexOf(".");
  return [serviceName.substring(0, dotI), serviceName.substring(dotI+1)];
}

function trimPrefix(s: string, prefix: string): string {
  return s.startsWith(prefix) ? s.substring(prefix.length) : s;
}

export async function grpcMethods(_target: string): Promise<grpcServiceMethods[]> {
  // reflSource, cc, err := database.Connect(a.ctx, request.Data.(database.GRPCRequest).Target)
  // if err != nil {
  //   return nil, errors.Wrap(err, "connect")
  // }
  // defer cc.Close()

  const services: string[] = [];
  // services, err := grpcurl.ListServices(reflSource)
  // if err != nil {
  //   return nil, errors.Wrap(err, "list services")
  // }

  return services.map(service => {
    const [pkg, serviceName] = splitService(service);

    const methods: string[] = [];
  //   methods, err := grpcurl.ListMethods(reflSource, service)
  //   if err != nil {
  //     return nil, errors.Wrapf(err, "list service %s methods", service)
  //   }

    const prefix = pkg + "." + serviceName + ".";
    return {
      service,
      methods: [
        ...methods, // TODO: do we need that?
        ...methods.map(method => trimPrefix(method, prefix)),
      ],
    };
  });
}

function ConvertMessageToJSONSchema(/*msg: protoreflect.Message*/): JSONSchema {
  // return convertObjectToJSONSchema(msg.Descriptor())
  return {type: "string"};
}

function newFake(js: JSONSchema): JSONValue {
  switch (js.type) {
  case "object":
    return Object.fromEntries(Object.entries(js.properties).map(([k, v]) => {
      const itemSchema =
        v.type === "object" && v.oneOf !== undefined ?
        v.oneOf[Math.random() * v.oneOf.length] :
        v;
      return [k, newFake(itemSchema)];
    }));
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

// JSONSchema represents the structure of a JSON schema
type JSONSchema = { // TODO: reuse from lib
  type: "object",
  properties: Record<string, JSONSchema>,
  oneOf?: JSONSchema[],
} | {
  type: "array",
  items: JSONSchema,
} | {
  type: "number" | "integer" | "string",
};

// func convertFieldToJSONSchema(field protoreflect.FieldDescriptor) (JSONSchema, error) {
//   var fieldSchema JSONSchema
//   switch field.Kind() {
//   case protoreflect.BoolKind:
//     fieldSchema.Type = "boolean"
//   case protoreflect.Int32Kind, protoreflect.Int64Kind,
//     protoreflect.Uint32Kind, protoreflect.Uint64Kind,
//     protoreflect.Sint32Kind, protoreflect.Sint64Kind,
//     protoreflect.Sfixed32Kind, protoreflect.Sfixed64Kind,
//     protoreflect.Fixed32Kind, protoreflect.Fixed64Kind:
//     fieldSchema.Type = "integer"
//   case protoreflect.FloatKind,
//     protoreflect.DoubleKind:
//     fieldSchema.Type = "number"
//   case protoreflect.StringKind:
//     fieldSchema.Type = "string"
//   case protoreflect.BytesKind:
//     fieldSchema.Type = "string"
//     // TODO: support bytes
//   case protoreflect.MessageKind:
//     var err error
//     fieldSchema, err = convertObjectToJSONSchema(field.Message())
//     if err != nil {
//       return JSONSchema{}, err
//     }
//   case protoreflect.EnumKind:
//     fieldSchema.Type = "string"
//     vals := field.Enum().Values()
//     for i := 0; i < vals.Len(); i++ {
//       val := vals.Get(i)
//       fmt.Println("ENUM", i, val.Name())
//     }
//   default:
//     return JSONSchema{}, errors.Errorf("unsupported field kind: %v", field.Kind())
//   }

//   if field.IsList() {
//     return JSONSchema{
//       Type:  "array",
//       Items: &fieldSchema,
//     }, nil
//   }

//   return fieldSchema, nil
// }

// func convertObjectToJSONSchema(msg protoreflect.MessageDescriptor) (JSONSchema, error) {
//   fields := msg.Fields()
//   properties := make(map[string]JSONSchema, fields.Len())
//   for i := 0; i < fields.Len(); i++ {
//     field := fields.Get(i)
//     fieldSchema, err := convertFieldToJSONSchema(field)
//     if err != nil {
//       return JSONSchema{}, err
//     }

//     if oneof := field.ContainingOneof(); oneof != nil {
//       oneofName := string(oneof.Name())
//       if _, ok := properties[oneofName]; !ok {
//         properties[oneofName] = JSONSchema{
//           Type:  "object",
//           OneOf: []JSONSchema{},
//         }
//       }
//       m := properties[oneofName]
//       m.OneOf = append(m.OneOf, JSONSchema{
//         Type:       "object",
//         Properties: map[string]JSONSchema{string(field.Name()): fieldSchema},
//       })
//       properties[oneofName] = m
//     } else {
//       properties[string(field.Name())] = fieldSchema
//     }
//   }

//   return JSONSchema{
//     Type:       "object",
//     Properties: properties,
//     Items:      nil,
//   }, nil
// }

export async function grpcQueryFake(
  _target: string,
  _method: string, // NOTE: fully qualified
): Promise<string> {
  //   reflSource, cc, err := database.Connect(a.ctx, Target)
  //   if err != nil {
  //     return "", errors.Wrap(err, "connect")
  //   }
  //   defer cc.Close()

  //   dsc, err := reflSource.FindSymbol(Method)
  //   if err != nil {
  //     return "", errors.Wrap(err, "find method")
  //   }

  //   methodDesc := dsc.(*desc.MethodDescriptor)
  //   // fmt.Println("    IN", strings.TrimPrefix(inputType.GetFullyQualifiedName(), pkg+"."))
  //   // fmt.Println("    OUT", strings.TrimPrefix(methodDesc.GetOutputType().GetFullyQualifiedName(), pkg+"."))
  //   m := dynamicpb.NewMessage(methodDesc.GetInputType().UnwrapMessage())

  const schema = ConvertMessageToJSONSchema(/*m*/);
  // schema["$schema"]= "http://json-schema.org/schema#"

  return JSON.stringify(newFake(schema), null, 2);
}

export async function grpcQueryValidate(_target: string, _method: string, payload: string): Promise<void> {
  // TODO: implement
  JSON.parse(payload);
}
