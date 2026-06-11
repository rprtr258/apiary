const PORT = 8080;

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

const server = Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);
    console.log(`${req.method} ${url.pathname}`);

    if (req.method === "GET" && url.pathname === "/dice") {
      await sleep(1000);
      const dice = Math.floor(Math.random() * 6) + 1;
      const timestamp = new Date().toISOString();
      return new Response(`at ${timestamp}: ${dice}`, {headers: {"content-type": "text/plain"}, status: 200});
    } else if (req.method === "POST" && url.pathname === "/sleep") {
      await sleep(5000);
      return new Response();
    } else {
      return new Response("not found", {headers: {"content-type": "text/plain"}, status: 404});
    }
  },
});
console.log(`running on ${server.url}`);
