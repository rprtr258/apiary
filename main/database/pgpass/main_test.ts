import {expect, test} from "bun:test";
import {find_password, parse_passfile} from "./main.ts";

test("parse_passfile", () => {
  const buf = `# A comment
test1:5432:larrydb:larry:whatstheidea
test1:5432:moedb:moe:imbecile
test1:5432:curlydb:curly:nyuknyuknyuk
test2:5432:*:shemp:heymoe
test2:5432:*:*:test\\\\ing\\:
localhost:*:*:*:sesam
`;

  const passfile = parse_passfile(buf);
  expect(passfile).toHaveLength(6);

  expect(find_password(passfile, "test1", "5432", "larrydb", "larry")).toBe("whatstheidea");
  expect(find_password(passfile, "test1", "5432", "moedb", "moe")).toBe("imbecile");
  expect(find_password(passfile, "test2", "5432", "something", "else")).toBe(`test\\ing:`);
  expect(find_password(passfile, "localhost", "9999", "foo", "bare")).toBe("sesam");

  expect(find_password(passfile, "wrong", "5432", "larrydb", "larry")).toBeNull();
  expect(find_password(passfile, "test1", "wrong", "larrydb", "larry")).toBeNull();
  expect(find_password(passfile, "test1", "5432", "wrong", "larry")).toBeNull();
  expect(find_password(passfile, "test1", "5432", "larrydb", "wrong")).toBeNull();
});