import {Message} from "google-protobuf";

export class HelloRequest extends Message {
  getName(): string;
  setName(value: string): void;
}

export class HelloReply extends Message {
  getMessage(): string;
  setMessage(value: string): void;
}
