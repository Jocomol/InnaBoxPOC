#!/usr/bin/env node

import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { readFile, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const chromiumBinary = process.env.CHROMIUM_BIN || "chromium";
const frontendRoot = fileURLToPath(new URL("../frontend/", import.meta.url));
const screenshotPath = process.env.SCREENSHOT_PATH;
const formScreenshotPath = process.env.FORM_SCREENSHOT_PATH;
const sliderScreenshotPath = process.env.SLIDER_SCREENSHOT_PATH;
const phoneWidth = Number(process.env.PHONE_WIDTH || 390);
const phoneHeight = Number(process.env.PHONE_HEIGHT || 844);
const resolveRequests = [];
const fixtureRequestLog = [];

assert.ok(Number.isInteger(phoneWidth) && phoneWidth >= 280, "PHONE_WIDTH must be an integer of at least 280");
assert.ok(Number.isInteger(phoneHeight) && phoneHeight >= 320, "PHONE_HEIGHT must be an integer of at least 320");

const fixtureMeals = [
  ["caprese-skewers", "Caprese Skewers"],
  ["falafel-bites", "Falafel Bites"],
  ["mini-spinach-quiche", "Mini Spinach Quiche"],
  ["vegetable-samosas", "Vegetable Samosas"],
  ["fruit-skewers", "Fresh Fruit Skewers"],
  ["gluten-free-bruschetta", "Gluten-free Bruschetta"],
  ["stuffed-mushrooms", "Stuffed Mushrooms"],
].map(([id, name], index) => ({ id, name, index }));

function sendJson(response, value, statusCode = 200) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  response.end(JSON.stringify(value));
}

async function readJson(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function fixturePlan(request) {
  const requiredIds = new Set(request.requiredMealIds || []);
  const excludedIds = new Set(request.excludedMealIds || []);
  const selected = [
    ...fixtureMeals.filter(meal => requiredIds.has(meal.id)),
    ...fixtureMeals.filter(meal => !requiredIds.has(meal.id) && !excludedIds.has(meal.id)),
  ].slice(0, request.mealCount || 5);

  return {
    event: {
      templateId: "business-apero",
      templateName: "Business Apéro",
      guestCount: request.guestCount,
      servingsPerGuest: request.servingsPerGuest,
      requiredMealIds: [...requiredIds],
      excludedMealIds: [...excludedIds],
    },
    selectedMeals: selected.map(meal => ({
      requirementId: requiredIds.has(meal.id) ? `guaranteed-${meal.id}` : `menu-slot-${meal.index + 1}`,
      mealId: meal.id,
      name: meal.name,
      servings: request.guestCount,
      targetQuantity: { amount: request.guestCount, unit: "piece" },
      matchedCapabilities: ["apero", "finger-food"],
      matchedDietaryCapabilities: meal.id === "gluten-free-bruschetta" ? ["gluten-free"] : [],
      scoreComponents: { price: 0.8 - meal.index * 0.03 },
      finalWeightedScore: 0.8 - meal.index * 0.03,
      guaranteed: requiredIds.has(meal.id),
    })),
    constraintConflicts: [],
    fulfilledRequirements: [],
    ingredientRequirements: [],
    shoppingItems: [],
    usedExistingInventory: [],
    unusedExistingInventory: [],
    totals: {
      totalCost: { amount: 125, currency: "CHF" },
      costPerGuest: { amount: 6.25, currency: "CHF" },
      budgetDifference: { amount: request.budget - 125, currency: "CHF" },
      budgetStatus: "UNDER_BUDGET",
    },
    warnings: [],
  };
}

async function startFixtureServer() {
  const apiFixtures = new Map([
    ["/api/templates", [{
      id: "business-apero",
      name: "Business Apéro",
      description: "Browser smoke-test event template.",
      defaults: { mealCount: 5 },
      weights: { price: 1 },
    }]],
    ["/api/priorities", [{
      id: "price",
      label: "Affordability",
      description: "Prefer economical options.",
      displayOrder: 10,
      defaultWeight: 1,
      lowLabel: "Premium",
      highLabel: "Economical",
    }]],
    ["/api/dietary-constraints", []],
    ["/api/meal-categories", []],
    ["/api/meal-capabilities", ["apero", "finger-food"]],
  ]);
  const staticFiles = new Map([
    ["/", "index.html"],
    ["/index.html", "index.html"],
    ["/app.js", "app.js"],
    ["/styles.css", "styles.css"],
  ]);
  const contentTypes = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
  };

  const server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url, "http://127.0.0.1");
      fixtureRequestLog.push(`${request.method} ${url.pathname}`);
      if (request.method === "POST" && url.pathname === "/api/plans/resolve") {
        const body = await readJson(request);
        resolveRequests.push(body);
        sendJson(response, fixturePlan(body));
        return;
      }
      if (request.method === "GET" && apiFixtures.has(url.pathname)) {
        sendJson(response, apiFixtures.get(url.pathname));
        return;
      }
      if (request.method === "GET" && staticFiles.has(url.pathname)) {
        const filename = staticFiles.get(url.pathname);
        const body = await readFile(resolve(frontendRoot, filename));
        response.writeHead(200, {
          "Content-Type": contentTypes[extname(filename)],
          "Cache-Control": "no-store",
        });
        response.end(body);
        return;
      }
      response.writeHead(404);
      response.end();
    } catch (error) {
      sendJson(response, { detail: error.message }, 500);
    }
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  return server;
}

const fixtureServer = process.env.UI_BASE_URL ? null : await startFixtureServer();
const fixtureAddress = fixtureServer?.address();
const uiBaseUrl = process.env.UI_BASE_URL || `http://127.0.0.1:${fixtureAddress.port}/`;

const browser = spawn(
  chromiumBinary,
  [
    "--headless=new",
    "--no-sandbox",
    "--disable-gpu",
    "--disable-dev-shm-usage",
    "--remote-debugging-port=0",
    "--window-size=1440,1200",
    "about:blank",
  ],
  { stdio: ["ignore", "ignore", "pipe"] },
);

let pageSocket;

try {
  const browserWebSocketUrl = await new Promise((resolve, reject) => {
    let output = "";
    const timeout = setTimeout(() => reject(new Error("Chromium did not expose its DevTools endpoint")), 15_000);
    browser.stderr.on("data", chunk => {
      output += chunk.toString();
      const match = output.match(/DevTools listening on (ws:\/\/\S+)/);
      if (!match) return;
      clearTimeout(timeout);
      resolve(match[1]);
    });
    browser.once("exit", code => {
      clearTimeout(timeout);
      reject(new Error(`Chromium exited before startup with code ${code}: ${output}`));
    });
  });

  const devToolsBaseUrl = browserWebSocketUrl
    .replace(/^ws:/, "http:")
    .replace(/\/devtools\/browser\/.*$/, "");
  const target = await fetch(
    `${devToolsBaseUrl}/json/new?${encodeURIComponent(uiBaseUrl)}`,
    { method: "PUT" },
  ).then(response => response.json());

  pageSocket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    pageSocket.addEventListener("open", resolve, { once: true });
    pageSocket.addEventListener("error", reject, { once: true });
  });

  let sequence = 0;
  const pending = new Map();
  pageSocket.addEventListener("message", event => {
    const message = JSON.parse(event.data);
    if (!message.id) return;
    const callbacks = pending.get(message.id);
    if (!callbacks) return;
    pending.delete(message.id);
    if (message.error) callbacks.reject(new Error(message.error.message));
    else callbacks.resolve(message.result);
  });

  function send(method, params = {}) {
    const id = ++sequence;
    pageSocket.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
  }

  async function evaluate(callback, ...args) {
    const expression = `(${callback})(${args.map(value => JSON.stringify(value)).join(",")})`;
    const response = await send("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    if (response.exceptionDetails) {
      throw new Error(response.exceptionDetails.exception?.description || response.exceptionDetails.text);
    }
    return response.result.value;
  }

  async function waitFor(callback, description, ...args) {
    const deadline = Date.now() + 20_000;
    while (Date.now() < deadline) {
      if (await evaluate(callback, ...args)) return;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    const browserState = await evaluate(() => ({
      url: location.href,
      readyState: document.readyState,
      pageError: document.querySelector("#form-error")?.textContent,
      templateDisabled: document.querySelector("#template")?.disabled,
      selectedMealCards: document.querySelectorAll("#selected-meals .meal-card").length,
    }));
    throw new Error(
      `Timed out waiting for ${description}: ${JSON.stringify(browserState)}; requests=${fixtureRequestLog.join(", ")}`,
    );
  }

  await send("Runtime.enable");
  await send("Page.enable");
  await send("Page.navigate", { url: uiBaseUrl });
  await waitFor(
    () => document.querySelector("#template") && !document.querySelector("#template").disabled,
    "planner data",
  );

  await evaluate(() => {
    document.querySelector("#guest-count").value = "20";
    document.querySelector("#budget").value = "500";
    document.querySelector("#servings-per-guest").value = "4";
    document.querySelector("#meal-count-input").value = "5";
    document.querySelector("#planner-form").requestSubmit();
  });
  await waitFor(
    () =>
      !document.querySelector("#results").hidden &&
      document.querySelectorAll("#selected-meals .meal-card").length === 5 &&
      !document.querySelector("#regenerate-menu").disabled,
    "five selected meal cards",
  );

  const initial = await evaluate(() => ({
    ids: [...document.querySelectorAll("[data-pin-meal-id]")].map(button => button.dataset.pinMealId),
    cards: [...document.querySelectorAll("#selected-meals .meal-card")].map(card => {
      const actions = card.querySelector(".meal-actions");
      const chips = card.querySelector(".chips");
      const actionStyle = getComputedStyle(actions);
      const actionRect = actions.getBoundingClientRect();
      const buttons = [...actions.querySelectorAll("button")];
      return {
        actionDisplay: actionStyle.display,
        actionVisibility: actionStyle.visibility,
        actionOpacity: Number(actionStyle.opacity),
        actionWidth: actionRect.width,
        actionHeight: actionRect.height,
        actionsBeforeDetails: actionRect.top < chips.getBoundingClientRect().top,
        pinLabel: card.querySelector(".meal-pin .meal-action-label")?.textContent.trim(),
        removeLabel: card.querySelector(".meal-reject .meal-action-label")?.textContent.trim(),
        buttonCount: buttons.length,
        buttonsVisible: buttons.every(button => {
          const style = getComputedStyle(button);
          const rect = button.getBoundingClientRect();
          return style.display !== "none" && style.visibility === "visible" && Number(style.opacity) > 0 && rect.width > 0 && rect.height >= 44;
        }),
      };
    }),
  }));

  assert.equal(initial.cards.length, 5);
  initial.cards.forEach(card => {
    assert.notEqual(card.actionDisplay, "none");
    assert.equal(card.actionVisibility, "visible");
    assert.ok(card.actionOpacity > 0);
    assert.ok(card.actionWidth > 0 && card.actionHeight > 0);
    assert.equal(card.actionsBeforeDetails, true);
    assert.equal(card.pinLabel, "Pin");
    assert.equal(card.removeLabel, "Remove");
    assert.equal(card.buttonCount, 2);
    assert.equal(card.buttonsVisible, true);
  });

  const pinnedMealId = initial.ids[0];
  const removedMealId = initial.ids[1];
  await evaluate((pinId, removeId) => {
    document.querySelector(`[data-pin-meal-id="${pinId}"]`).click();
    document.querySelector(`[data-reject-meal-id="${removeId}"]`).click();
  }, pinnedMealId, removedMealId);
  await waitFor(
    (pinId, removeId) =>
      state.requiredMeals.has(pinId) &&
      state.excludedMealIds.has(removeId) &&
      document.querySelector(`[data-pin-meal-id="${pinId}"]`)?.getAttribute("aria-pressed") === "true" &&
      document.querySelector(`[data-pin-meal-id="${pinId}"] .meal-action-label`)?.textContent.trim() === "Unpin" &&
      !document.querySelector(`[data-reject-meal-id="${removeId}"]`) &&
      !document.querySelector("#menu-change-status").hidden,
    "pin and remove state",
    pinnedMealId,
    removedMealId,
  );

  await evaluate(() => document.querySelector("#regenerate-menu").click());
  await waitFor(
    (pinId, removeId) =>
      !document.querySelector("#regenerate-menu").disabled &&
      document.querySelector("#menu-change-status").hidden &&
      state.requiredMeals.has(pinId) &&
      state.excludedMealIds.has(removeId) &&
      document.querySelectorAll("#selected-meals .meal-card").length === 5 &&
      document.querySelector(`[data-pin-meal-id="${pinId}"]`)?.getAttribute("aria-pressed") === "true" &&
      !document.querySelector(`[data-reject-meal-id="${removeId}"]`),
    "regenerated pinned and excluded menu",
    pinnedMealId,
    removedMealId,
  );

  const regeneratedIds = await evaluate(() =>
    [...document.querySelectorAll("[data-pin-meal-id]")].map(button => button.dataset.pinMealId),
  );
  const replacementIds = regeneratedIds.filter(id => !initial.ids.includes(id));
  assert.equal(regeneratedIds.length, 5);
  assert.ok(regeneratedIds.includes(pinnedMealId));
  assert.ok(!regeneratedIds.includes(removedMealId));
  assert.ok(replacementIds.length >= 1, "regeneration did not render a replacement meal");

  if (fixtureServer) {
    assert.equal(resolveRequests.length, 2);
    assert.deepEqual(resolveRequests[1].requiredMealIds, [pinnedMealId]);
    assert.deepEqual(resolveRequests[1].excludedMealIds, [removedMealId]);
  }

  await send("Emulation.setDeviceMetricsOverride", {
    width: phoneWidth,
    height: phoneHeight,
    deviceScaleFactor: 1,
    mobile: true,
  });
  await new Promise(resolve => setTimeout(resolve, 150));
  const mobile = await evaluate(() => ({
    cardActions: [...document.querySelectorAll("#selected-meals .meal-card")].map(card => ({
      buttonCount: card.querySelectorAll(".meal-actions button").length,
      pinLabel: card.querySelector(".meal-pin .meal-action-label")?.textContent.trim(),
      removeLabel: card.querySelector(".meal-reject .meal-action-label")?.textContent.trim(),
    })),
    actionButtons: [...document.querySelectorAll(".meal-actions button")].map(button => {
      const style = getComputedStyle(button);
      const rect = button.getBoundingClientRect();
      return {
        display: style.display,
        visibility: style.visibility,
        opacity: Number(style.opacity),
        width: rect.width,
        height: rect.height,
        labelFits: button.scrollWidth <= button.clientWidth && button.scrollHeight <= button.clientHeight,
      };
    }),
    viewport: {
      screenWidth: screen.width,
      visualWidth: visualViewport?.width ?? innerWidth,
      layoutWidth: innerWidth,
      documentWidth: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
    },
    headingButtons: [...document.querySelectorAll(".action-heading button")]
      .filter(button => button.getClientRects().length > 0)
      .map(button => {
        const rect = button.getBoundingClientRect();
        const panelRect = button.closest(".panel").getBoundingClientRect();
        return {
          id: button.id,
          left: rect.left,
          right: rect.right,
          panelLeft: panelRect.left,
          panelRight: panelRect.right,
          withinPanel: rect.left >= panelRect.left && rect.right <= panelRect.right,
        };
      }),
    regenerate: (() => {
      const rect = document.querySelector("#regenerate-menu").getBoundingClientRect();
      return { width: rect.width, height: rect.height };
    })(),
  }));
  assert.ok(mobile.cardActions.length > 0);
  assert.equal(mobile.actionButtons.length, mobile.cardActions.length * 2);
  mobile.cardActions.forEach(actions => {
    assert.equal(actions.buttonCount, 2);
    assert.ok(actions.pinLabel === "Pin" || actions.pinLabel === "Unpin");
    assert.equal(actions.removeLabel, "Remove");
  });
  mobile.actionButtons.forEach(button => {
    assert.notEqual(button.display, "none");
    assert.equal(button.visibility, "visible");
    assert.ok(button.opacity > 0 && button.width > 0 && button.height >= 44);
    assert.equal(button.labelFits, true);
  });
  assert.equal(mobile.viewport.screenWidth, phoneWidth);
  assert.ok(
    mobile.viewport.documentWidth <= phoneWidth,
    `horizontal overflow at ${phoneWidth}px: ${JSON.stringify(mobile.viewport)}`,
  );
  mobile.headingButtons.forEach(button => {
    assert.equal(button.withinPanel, true, `${button.id} overflows its panel: ${JSON.stringify(button)}`);
  });
  assert.ok(mobile.regenerate.width >= phoneWidth - 40 && mobile.regenerate.height >= 46);

  if (formScreenshotPath) {
    const formClip = await evaluate(() => {
      const firstPanel = document.querySelector("#guaranteed-heading").closest(".panel").getBoundingClientRect();
      const lastPanel = document.querySelector("#inventory-heading").closest(".panel").getBoundingClientRect();
      return {
        x: Math.min(firstPanel.left, lastPanel.left) + scrollX,
        y: firstPanel.top + scrollY,
        width: Math.max(firstPanel.right, lastPanel.right) - Math.min(firstPanel.left, lastPanel.left),
        height: lastPanel.bottom - firstPanel.top,
        scale: 1,
      };
    });
    const formScreenshot = await send("Page.captureScreenshot", {
      format: "png",
      captureBeyondViewport: true,
      clip: formClip,
    });
    assert.ok(formScreenshot.data.length > 1_000);
    await writeFile(formScreenshotPath, Buffer.from(formScreenshot.data, "base64"));
  }

  await evaluate(() => {
    document.querySelector(".advanced-panel").open = true;
    const slider = document.querySelector(".weight-input");
    const sliderTop = slider.getBoundingClientRect().top + scrollY;
    window.scrollTo({ top: sliderTop - (innerHeight - slider.offsetHeight) / 2, behavior: "instant" });
  });
  await new Promise(resolve => setTimeout(resolve, 200));
  const sliderBefore = await evaluate(() => {
    const slider = document.querySelector(".weight-input");
    const rect = slider.getBoundingClientRect();
    return {
      value: Number(slider.value),
      output: slider.closest(".weight").querySelector("output").textContent.trim(),
      progress: slider.style.getPropertyValue("--range-progress").trim(),
      touchAction: getComputedStyle(slider).touchAction,
      rect: { left: rect.left, right: rect.right, top: rect.top, width: rect.width, height: rect.height },
    };
  });
  assert.ok(sliderBefore.rect.width >= 200, `slider is too narrow: ${JSON.stringify(sliderBefore.rect)}`);
  assert.ok(sliderBefore.rect.height >= 44);
  assert.equal(sliderBefore.touchAction, "pan-y");
  assert.equal(sliderBefore.progress, `${Math.round(sliderBefore.value * 100)}%`);

  const touchY = sliderBefore.rect.top + sliderBefore.rect.height / 2;
  const touchStartX = sliderBefore.rect.right - 13;
  const touchEndX = sliderBefore.rect.left + sliderBefore.rect.width * 0.25;
  await send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: touchStartX, y: touchY, radiusX: 12, radiusY: 12, force: 1, id: 1 }],
  });
  for (let step = 1; step <= 4; step += 1) {
    const x = touchStartX + (touchEndX - touchStartX) * (step / 4);
    await send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x, y: touchY, radiusX: 12, radiusY: 12, force: 1, id: 1 }],
    });
  }
  await send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await new Promise(resolve => setTimeout(resolve, 100));

  const sliderAfter = await evaluate(() => {
    const slider = document.querySelector(".weight-input");
    return {
      value: Number(slider.value),
      output: slider.closest(".weight").querySelector("output").textContent.trim(),
      progress: slider.style.getPropertyValue("--range-progress").trim(),
    };
  });
  assert.ok(sliderAfter.value < sliderBefore.value, `touch drag did not change slider: ${JSON.stringify({ sliderBefore, sliderAfter })}`);
  assert.equal(sliderAfter.output, `${Math.round(sliderAfter.value * 100)}%`);
  assert.equal(sliderAfter.progress, sliderAfter.output);

  if (sliderScreenshotPath) {
    const sliderClip = await evaluate(() => {
      const rect = document.querySelector(".weight").getBoundingClientRect();
      return {
        x: rect.left + scrollX,
        y: rect.top + scrollY,
        width: rect.width,
        height: rect.height,
        scale: 1,
      };
    });
    const sliderScreenshot = await send("Page.captureScreenshot", {
      format: "png",
      captureBeyondViewport: true,
      clip: sliderClip,
    });
    assert.ok(sliderScreenshot.data.length > 1_000);
    await writeFile(sliderScreenshotPath, Buffer.from(sliderScreenshot.data, "base64"));
  }

  const cardClip = await evaluate(pinId => {
    const card = document.querySelector(`[data-pin-meal-id="${pinId}"]`).closest(".meal-card");
    const rect = card.getBoundingClientRect();
    return {
      x: rect.left + scrollX,
      y: rect.top + scrollY,
      width: rect.width,
      height: rect.height,
      scale: 1,
    };
  }, pinnedMealId);
  const screenshot = await send("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: true,
    clip: cardClip,
  });
  assert.ok(screenshot.data.length > 1_000);
  if (screenshotPath) await writeFile(screenshotPath, Buffer.from(screenshot.data, "base64"));

  await evaluate(pinId => document.querySelector(`[data-pin-meal-id="${pinId}"]`).click(), pinnedMealId);
  assert.equal(
    await evaluate(pinId =>
      !state.requiredMeals.has(pinId) &&
      Boolean(document.querySelector(`[data-pin-meal-id="${pinId}"]`)) &&
      document.querySelector(`[data-pin-meal-id="${pinId}"]`).getAttribute("aria-pressed") === "false" &&
      document.querySelector(`[data-pin-meal-id="${pinId}"] .meal-action-label`).textContent.trim() === "Pin",
    pinnedMealId),
    true,
  );

  console.log("PASS: selected meal cards visibly render Pin/Unpin and Remove on desktop and mobile");
  console.log(`  pinned=${pinnedMealId}`);
  console.log(`  removed=${removedMealId}`);
  console.log(`  replacements=${replacementIds.join(",")}`);
  console.log(`  desktopCards=${initial.cards.length}`);
  console.log(`  phoneViewport=${phoneWidth}x${phoneHeight}, documentWidth=${mobile.viewport.documentWidth}`);
  console.log(`  mobileActionHeight=${mobile.actionButtons[0].height}`);
  console.log(`  mobileRegenerate=${mobile.regenerate.width}x${mobile.regenerate.height}`);
  console.log(`  mobileSlider=${sliderBefore.rect.width}x${sliderBefore.rect.height}, ${sliderBefore.output}->${sliderAfter.output} by touch`);
  if (fixtureServer) console.log("  API state payloads verified with an isolated fixture server (MongoDB untouched)");
  if (screenshotPath) console.log(`  screenshot=${screenshotPath}`);
  if (formScreenshotPath) console.log(`  formScreenshot=${formScreenshotPath}`);
  if (sliderScreenshotPath) console.log(`  sliderScreenshot=${sliderScreenshotPath}`);
} finally {
  pageSocket?.close();
  if (browser.exitCode === null) {
    browser.kill("SIGTERM");
    await Promise.race([once(browser, "exit"), new Promise(resolve => setTimeout(resolve, 3_000))]);
  }
  if (browser.exitCode === null) browser.kill("SIGKILL");
  if (fixtureServer) {
    await new Promise(resolveClose => {
      fixtureServer.close(resolveClose);
      fixtureServer.closeAllConnections();
    });
  }
}
