import { mkdtemp, cp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { startMockProdegaApi } from "./mock-prodega-api.mjs";
import { runImport } from "./import-products.mjs";

const outputDirectory = resolve("output");
const temporaryDirectory = await mkdtemp(join(tmpdir(), "event-in-a-box-import-"));
const { server, url } = await startMockProdegaApi({ port: 0 });

try {
  console.log(`1/3 Mock catalog API started: ${url}`);
  const result = await runImport({
    url,
    jsonOutput: join(temporaryDirectory, "products.json"),
    mongoOutput: join(temporaryDirectory, "products.mongo.js")
  });
  console.log(`2/3 Transformed and validated ${result.products.length} products.`);
  await cp(temporaryDirectory, outputDirectory, { recursive: true, force: true });
  console.log(`3/3 Wrote MongoDB outputs to ${outputDirectory}`);
  console.log("Demo complete: mock API → adapter → validated MongoDB entries.");
} finally {
  await new Promise(resolveClose => server.close(resolveClose));
}
