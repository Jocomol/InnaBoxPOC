import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_URL = "http://127.0.0.1:4010/mock-prodega/v1/products";
const DEFAULT_JSON_OUTPUT = "output/products.json";
const DEFAULT_MONGO_OUTPUT = "output/products.mongo.js";

const ALLOWED_CAPABILITIES = new Set([
  "coffee",
  "finger-food",
  "juice",
  "napkin",
  "non-alcoholic-drink",
  "ready-to-heat",
  "ready-to-serve",
  "water"
]);

const ALLOWED_DIETARY_CAPABILITIES = new Set([
  "gluten-free",
  "halal",
  "lactose-free",
  "nut-free",
  "vegan",
  "vegetarian"
]);

const SUSTAINABILITY_SCORES = {
  A: 0.95,
  B: 0.8,
  C: 0.65,
  D: 0.45,
  E: 0.25
};

function normalizeText(value) {
  return String(value ?? "").trim();
}

function slug(value) {
  return normalizeText(value)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizedTags(values, allowed) {
  return [...new Set((values ?? [])
    .map(value => slug(value))
    .filter(value => allowed.has(value)))]
    .sort();
}

function normalizePackage(pack) {
  const quantity = Number(pack?.quantity);
  const unit = normalizeText(pack?.unit).toUpperCase();
  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new Error("pack.quantity must be a positive number");
  }

  const conversions = {
    G: { multiplier: 1, unit: "g" },
    KG: { multiplier: 1000, unit: "g" },
    ML: { multiplier: 1, unit: "ml" },
    L: { multiplier: 1, unit: "liter" },
    PCS: { multiplier: 1, unit: "piece" },
    PIECE: { multiplier: 1, unit: "piece" }
  };
  const conversion = conversions[unit];
  if (!conversion) throw new Error(`unsupported package unit '${unit}'`);

  return {
    amount: quantity * conversion.multiplier,
    unit: conversion.unit
  };
}

function priceScore(amount) {
  return Number(Math.max(0.1, Math.min(1, 1 - Number(amount) / 60)).toFixed(2));
}

function preparationScore(tags) {
  if (tags.includes("ready-to-serve")) return 1;
  if (tags.includes("ready-to-heat")) return 0.9;
  if (tags.includes("ready-to-use")) return 0.85;
  return 0.65;
}

export function transformProduct(rawProduct) {
  const externalProductId = normalizeText(rawProduct.productId);
  const sku = normalizeText(rawProduct.articleNumber);
  const name = normalizeText(rawProduct.displayName);
  const concept = slug(rawProduct.ingredientConcept);
  const originCountry = normalizeText(rawProduct.countryOfOrigin).toUpperCase() || null;
  const priceAmount = Number(rawProduct.salesPrice?.gross);
  const currency = normalizeText(rawProduct.salesPrice?.currency).toUpperCase();

  if (!externalProductId) throw new Error("productId is required");
  if (!sku) throw new Error("articleNumber is required");
  if (!name) throw new Error("displayName is required");
  if (!concept) throw new Error("ingredientConcept is required");
  if (!Number.isFinite(priceAmount) || priceAmount < 0) {
    throw new Error("salesPrice.gross must be a non-negative number");
  }
  if (currency !== "CHF") throw new Error(`unsupported currency '${currency}'`);
  if (originCountry && !/^[A-Z]{2}$/.test(originCountry)) {
    throw new Error("countryOfOrigin must be an ISO alpha-2 code");
  }

  const sourceTags = (rawProduct.tags ?? []).map(value => slug(value));
  const sustainability = SUSTAINABILITY_SCORES[
    normalizeText(rawProduct.sustainabilityGrade).toUpperCase()
  ] ?? 0.5;

  return {
    id: `prodega-${slug(externalProductId)}`,
    sku,
    name,
    concept,
    originCountry,
    package: normalizePackage(rawProduct.pack),
    price: {
      amount: Number(priceAmount.toFixed(2)),
      currency
    },
    capabilities: normalizedTags(sourceTags, ALLOWED_CAPABILITIES),
    dietaryCapabilities: normalizedTags(
      rawProduct.dietaryClaims,
      ALLOWED_DIETARY_CAPABILITIES
    ),
    scores: {
      price: priceScore(priceAmount),
      swiss: originCountry === "CH" ? 1 : 0,
      presentation: sourceTags.includes("finger-food") ? 0.85 : 0.65,
      prepEase: preparationScore(sourceTags),
      sustainability
    },
    externalReferences: {
      provider: "prodega-mock",
      productId: externalProductId
    }
  };
}

export function validateProducts(products) {
  const ids = new Set();
  const skus = new Set();
  const errors = [];

  products.forEach((product, index) => {
    const prefix = `products[${index}]`;
    if (ids.has(product.id)) errors.push(`${prefix}: duplicate id '${product.id}'`);
    if (skus.has(product.sku)) errors.push(`${prefix}: duplicate sku '${product.sku}'`);
    ids.add(product.id);
    skus.add(product.sku);

    if (!product.id || !product.sku || !product.name || !product.concept) {
      errors.push(`${prefix}: id, sku, name and concept are required`);
    }
    if (!(product.package.amount > 0)) errors.push(`${prefix}: package amount must be positive`);
    if (!(product.price.amount >= 0)) errors.push(`${prefix}: price must be non-negative`);
    Object.entries(product.scores).forEach(([key, value]) => {
      if (!Number.isFinite(value) || value < 0 || value > 1) {
        errors.push(`${prefix}: score '${key}' must be between 0 and 1`);
      }
    });
  });

  if (errors.length) throw new Error(`MongoDB product validation failed:\n- ${errors.join("\n- ")}`);
  return products;
}

export async function fetchAllProducts(url, fetchImplementation = fetch) {
  const products = [];
  let nextUrl = url;

  while (nextUrl) {
    const response = await fetchImplementation(nextUrl, {
      headers: { Accept: "application/json" }
    });
    if (!response.ok) throw new Error(`catalog API returned HTTP ${response.status}`);
    const page = await response.json();
    if (!Array.isArray(page.items)) throw new Error("catalog API response must contain an items array");
    products.push(...page.items);
    nextUrl = page.nextCursor
      ? `${url}${url.includes("?") ? "&" : "?"}cursor=${encodeURIComponent(page.nextCursor)}`
      : null;
  }

  return products;
}

export function mongoScript(products) {
  return `db = db.getSiblingDB("catering");\n\n` +
    `const importedProducts = ${JSON.stringify(products, null, 2)};\n\n` +
    `for (const product of importedProducts) {\n` +
    `  db.products.replaceOne({ id: product.id }, product, { upsert: true });\n` +
    `}\n\n` +
    `print(\`Imported \${importedProducts.length} mock Prodega products into catering.products\`);\n`;
}

async function writeOutput(path, content) {
  const absolutePath = resolve(path);
  await mkdir(dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, content, "utf8");
  return absolutePath;
}

export async function runImport({
  url = DEFAULT_URL,
  jsonOutput = DEFAULT_JSON_OUTPUT,
  mongoOutput = DEFAULT_MONGO_OUTPUT,
  fetchImplementation = fetch
} = {}) {
  const rawProducts = await fetchAllProducts(url, fetchImplementation);
  const products = validateProducts(rawProducts.map((rawProduct, index) => {
    try {
      return transformProduct(rawProduct);
    } catch (error) {
      throw new Error(`Could not transform upstream product at index ${index}: ${error.message}`);
    }
  }));

  const jsonPath = await writeOutput(jsonOutput, `${JSON.stringify(products, null, 2)}\n`);
  const mongoPath = await writeOutput(mongoOutput, mongoScript(products));
  return { products, jsonPath, mongoPath };
}

function parseArguments(argumentsList) {
  const options = {};
  for (let index = 0; index < argumentsList.length; index += 1) {
    const argument = argumentsList[index];
    if (argument === "--url") options.url = argumentsList[++index];
    else if (argument === "--json-out") options.jsonOutput = argumentsList[++index];
    else if (argument === "--mongo-out") options.mongoOutput = argumentsList[++index];
    else throw new Error(`Unknown argument '${argument}'`);
  }
  return options;
}

const isDirectRun = process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectRun) {
  try {
    const result = await runImport(parseArguments(process.argv.slice(2)));
    console.log(`Imported ${result.products.length} products from the mock catalog API.`);
    console.log(`MongoDB JSON: ${result.jsonPath}`);
    console.log(`mongosh upsert script: ${result.mongoPath}`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

export { parseArguments };
