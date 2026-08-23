import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const currentDirectory = fileURLToPath(new URL(".", import.meta.url));
const defaultFixturePath = resolve(currentDirectory, "../fixtures/prodega-products.json");

export async function startMockProdegaApi({
  port = 4010,
  host = "127.0.0.1",
  fixturePath = defaultFixturePath
} = {}) {
  const fixture = JSON.parse(await readFile(fixturePath, "utf8"));
  const products = fixture.products ?? [];

  const server = createServer((request, response) => {
    const url = new URL(request.url, `http://${request.headers.host ?? `${host}:${port}`}`);
    response.setHeader("Content-Type", "application/json; charset=utf-8");
    response.setHeader("Cache-Control", "no-store");

    if (request.method === "GET" && url.pathname === "/health") {
      response.writeHead(200);
      response.end(JSON.stringify({ status: "UP", mode: "MOCK" }));
      return;
    }

    if (request.method === "GET" && url.pathname === "/mock-prodega/v1/products") {
      const cursor = Number(url.searchParams.get("cursor") ?? 0);
      const pageSize = 2;
      const items = products.slice(cursor, cursor + pageSize);
      const nextCursor = cursor + pageSize < products.length
        ? String(cursor + pageSize)
        : null;
      response.writeHead(200);
      response.end(JSON.stringify({ items, nextCursor }));
      return;
    }

    response.writeHead(404);
    response.end(JSON.stringify({ error: "Not found" }));
  });

  await new Promise((resolveStart, rejectStart) => {
    server.once("error", rejectStart);
    server.listen(port, host, resolveStart);
  });

  const address = server.address();
  const actualPort = typeof address === "object" && address ? address.port : port;
  return {
    server,
    url: `http://${host}:${actualPort}/mock-prodega/v1/products`
  };
}

const isDirectRun = process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectRun) {
  try {
    const { url } = await startMockProdegaApi();
    console.log(`Mock Prodega API listening at ${url}`);
    console.log("Press Ctrl+C to stop.");
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
