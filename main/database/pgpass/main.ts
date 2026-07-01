// Package pgpass is a parser PostgreSQL .pgpass files.
import {readFileSync} from "fs";

// Line in PG passfile.
type Entry = {
  hostname: string,
  port:     string,
  database: string,
  username: string,
  password: string,
};

// In-memory data structure representing PG passfile.
type Passfile = Entry[];

// ReadPassfile reads the file at path and parses it into a Passfile.
export function read_passfile(path: string): Passfile {
  const f = readFileSync(path);
  return parse_passfile(f.toString());
}

// ParsePassfile reads r and parses it into a Passfile.
export function parse_passfile(r: string): Passfile {
  return r.split("\n").map(parse_line).filter(entry => entry !== null);
}

// Parses a line into an Entry. It returns null on comment lines or any other unparsable line.
function parse_line(line: string): Entry | null {
  line = line.trim();

  if (line.startsWith("#")) {
    return null;
  }

  line = line.replace(/\\\\/g, "\r").replace(/\\:/g, "\n");

  let parts = line.split(":");
  if (parts.length !== 5) {
    return null;
  }

  // Unescape escaped colons and backslashes
  parts = parts.map(part => part.replace(/\r/g, "\\").replace(/\n/g, ":"));

  return {
    hostname: parts[0],
    port:     parts[1],
    database: parts[2],
    username: parts[3],
    password: parts[4],
  };
}

// Finds the password for the provided hostname, port, database, and username.
// For a Unix domain socket hostname must be set to "localhost". Null will be returned if no match is found.
//
// See https://www.postgresql.org/docs/current/libpq-pgpass.html for more password file information.
export function find_password(pf: Passfile, hostname: string, port: string, database: string, username: string): string | null {
  const entry = pf.find(e => (
    (e.hostname === "*" || e.hostname === hostname) &&
    (e.port     === "*" || e.port     === port    ) &&
    (e.database === "*" || e.database === database) &&
    (e.username === "*" || e.username === username)
  ));
  return entry?.password ?? null;
}
