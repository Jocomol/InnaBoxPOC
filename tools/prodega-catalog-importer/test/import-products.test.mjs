import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runImport, transformProduct } from "../src/import-products.mjs";

const normalized = transformProduct({
  productId: "P-42",
  articleNumber: "SKU-42",
  displayName: "Test Product",
  ingredientConcept: "Test Ingredient",
  countryOfOrigin: "CH",
  pack: { quantity: 1.5, unit: "KG" },
  salesPrice: { gross: 12.5, currency: "CHF" },
  tags: ["ready-to-heat", "finger-food"],
  dietaryClaims: ["vegetarian", "gluten-free"],
  sustainabilityGrade: "B"
});

assert.equal(normalized.id, "prodega-p-42");
assert.deepEqual(normalized.package, { amount: 1500, unit: "g" });
assert.equal(normalized.scores.swiss, 1);
assert.equal(normalized.scores.prepEase, 0.9);
assert.deepEqual(normalized.capabilities, ["finger-food", "ready-to-heat"]);
assert.deepEqual(normalized.dietaryCapabilities, ["gluten-free", "vegetarian"]);

const temporaryDirectory = await mkdtemp(join(tmpdir(), "prodega-import-test-"));
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
  jsonOutput: join(temporaryDirectory, "products.json"),
  mongoOutput: join(temporaryDirectory, "products.mongo.js"),
  fetchImplementation: mockFetch
});
assert.equal(result.products.length, 5);
assert.equal(new Set(result.products.map(product => product.id)).size, 5);
assert.equal(new Set(result.products.map(product => product.sku)).size, 5);

const jsonOutput = JSON.parse(await readFile(result.jsonPath, "utf8"));
const mongoOutput = await readFile(result.mongoPath, "utf8");
assert.equal(jsonOutput.length, 5);
assert.match(mongoOutput, /db\.products\.replaceOne/);
assert.match(mongoOutput, /P-MOCK-1001/);

console.log("PASS: mock API products transform into validated Event in a Box MongoDB entries");
