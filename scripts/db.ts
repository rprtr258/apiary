import {readFileSync} from "fs";

const filename = process.argv.length > 1 ? process.argv[1] : "db.json";

const f = readFileSync(filename);
void(f);


