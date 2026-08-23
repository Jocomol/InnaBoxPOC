import { readFile } from "node:fs/promises";
import { runImport } from "./import-products.mjs";

const fixture = JSON.parse(await readFile(
  new URL("../fixtures/prodega-products.json", import.meta.url),
  "utf8"
));

const mockFetch = async url => {
  const cursor = Number(new URL(url).searchParams.get("cursor") ?? 0);
  const pageSize = 2;
  const items = fixture.products.slice(cursor, cursor + pageSize);
  const nextCursor = cursor + pageSize < fixture.products.length
    ? String(cursor + pageSize)
    : null;
  return new Response(JSON.stringify({ items, nextCursor }), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  });
};

const result = await runImport({
  url: "http://mock.local/mock-prodega/v1/products",
  fetchImplementation: mockFetch
});

console.log(`Generated ${result.products.length} validated MongoDB product entries from the fixture.`);
console.log(`MongoDB JSON: ${result.jsonPath}`);
console.log(`mongosh upsert script: ${result.mongoPath}`);
