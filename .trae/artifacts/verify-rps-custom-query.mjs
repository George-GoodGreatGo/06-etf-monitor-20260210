import { chromium } from "playwright";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const url = "http://localhost:4173/dev/rps-custom-query-live";
let customQueryRequestCount = 0;

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 2200 }, deviceScaleFactor: 1 });

await page.route("**/api/rps/custom-query**", async (route) => {
  customQueryRequestCount += 1;
  if (customQueryRequestCount === 2) await sleep(600);
  await route.continue();
});

const getStyle = async (selector) => page.locator(selector).evaluate((el) => {
  const s = getComputedStyle(el);
  return { backgroundColor: s.backgroundColor, borderColor: s.borderColor, boxShadow: s.boxShadow };
});

const getTooltipText = async () => page.evaluate(() => {
  const candidates = [...document.querySelectorAll("div")]
    .filter((el) => {
      const txt = el.textContent || "";
      return txt.includes("前复权价格") && txt.includes("放量倍数") && txt.includes("2024-");
    })
    .map((el) => (el.textContent || "").replace(/\s+/g, " ").trim())
    .sort((a, b) => a.length - b.length);
  return candidates[0] || "";
});

const getPanelMetrics = async (prefix) => page.evaluate((prefix) => {
  const badge = [...document.querySelectorAll("div")].find((el) => {
    const txt = (el.textContent || "").replace(/\s+/g, " ").trim();
    return txt.startsWith(prefix);
  });
  if (!(badge instanceof HTMLDivElement)) return null;
  let panel = badge.parentElement;
  while (panel) {
    if (panel instanceof HTMLDivElement && panel.style && panel.style.height) {
      const cs = getComputedStyle(panel);
      return {
        styleHeight: panel.style.height,
        rectHeight: Math.round(panel.getBoundingClientRect().height),
        opacity: cs.opacity,
      };
    }
    panel = panel.parentElement;
  }
  return null;
}, prefix);

await page.goto(url, { waitUntil: "domcontentloaded" });
await page.getByRole("button", { name: "查询" }).waitFor({ timeout: 15000 });
await page.getByText("查询结果摘要").waitFor({ timeout: 15000 });
await page.waitForTimeout(800);

const shellSelector = "form > div";
const inputSelector = "input[placeholder*='输入 ETF 代码']";
const defaultStyle = await getStyle(shellSelector);
const shellBox = await page.locator(shellSelector).boundingBox();
if (!shellBox) throw new Error("未找到搜索栏容器");
await page.mouse.move(shellBox.x + shellBox.width / 2, shellBox.y + shellBox.height / 2);
await page.waitForTimeout(120);
const hoverStyle = await getStyle(shellSelector);
await page.locator(inputSelector).click();
await page.waitForTimeout(120);
const focusStyle = await getStyle(shellSelector);

await page.locator(inputSelector).fill("510300");
await page.getByRole("button", { name: "查询" }).click();
await page.getByRole("button", { name: "查询中..." }).waitFor({ timeout: 5000 });
const loadingStyle = await getStyle(shellSelector);
const loadingState = {
  buttonDisabled: await page.getByRole("button", { name: "查询中..." }).isDisabled(),
  buttonText: (await page.getByRole("button", { name: "查询中..." }).textContent())?.trim() || "",
};
await page.getByRole("button", { name: "查询" }).waitFor({ timeout: 15000 });
await page.waitForTimeout(1200);

const chartButtons = (await page.locator("button").evaluateAll((els) =>
  els.map((el) => (el.textContent || "").replace(/\s+/g, " ").trim()).filter(Boolean),
)).filter((text) => ["SMA20", "SMA60", "SMA250", "RPS Score", "RPS起点归一", "RSI(14)", "价格线"].includes(text));

const canvasBox = await page.locator("canvas").first().boundingBox();
if (!canvasBox) throw new Error("未找到主图 canvas");
const hoverChart = async () => {
  await page.mouse.move(canvasBox.x + canvasBox.width * 0.82, canvasBox.y + canvasBox.height * 0.35);
  await page.waitForTimeout(150);
  return getTooltipText();
};

const tooltipDefault = await hoverChart();
await page.getByRole("button", { name: "SMA20" }).click();
const tooltipWithoutSma20 = await hoverChart();
await page.getByRole("button", { name: "SMA20" }).click();
const tooltipWithSma20Again = await hoverChart();

const requestCountBeforePaneToggle = customQueryRequestCount;
const scoreBefore = await getPanelMetrics("RPS Score（副图）");
await page.getByRole("button", { name: "RPS Score" }).click();
await page.waitForTimeout(250);
const scoreHidden = await getPanelMetrics("RPS Score（副图）");
const tooltipScoreHidden = await hoverChart();
await page.getByRole("button", { name: "RPS Score" }).click();
await page.waitForTimeout(250);
const scoreShownAgain = await getPanelMetrics("RPS Score（副图）");
const tooltipScoreShownAgain = await hoverChart();

const relativeBefore = await getPanelMetrics("RPS起点归一（副图）");
await page.getByRole("button", { name: "RPS起点归一" }).click();
await page.waitForTimeout(250);
const relativeHidden = await getPanelMetrics("RPS起点归一（副图）");
await page.getByRole("button", { name: "RPS起点归一" }).click();
await page.waitForTimeout(250);
const relativeShownAgain = await getPanelMetrics("RPS起点归一（副图）");

const rsiBefore = await getPanelMetrics("RSI(14)（副图）");
await page.getByRole("button", { name: "RSI(14)" }).click();
await page.waitForTimeout(250);
const rsiHidden = await getPanelMetrics("RSI(14)（副图）");
await page.getByRole("button", { name: "RSI(14)" }).click();
await page.waitForTimeout(250);
const rsiShownAgain = await getPanelMetrics("RSI(14)（副图）");

const requestCountAfterPaneToggle = customQueryRequestCount;
const result = {
  url,
  customQueryRequestCount,
  searchStyles: { defaultStyle, hoverStyle, focusStyle, loadingStyle, loadingState },
  chartButtons,
  tooltipChecks: { tooltipDefault, tooltipWithoutSma20, tooltipWithSma20Again, tooltipScoreHidden, tooltipScoreShownAgain },
  panelChecks: { scoreBefore, scoreHidden, scoreShownAgain, relativeBefore, relativeHidden, relativeShownAgain, rsiBefore, rsiHidden, rsiShownAgain },
  paneToggleRequestDelta: requestCountAfterPaneToggle - requestCountBeforePaneToggle,
};
await page.screenshot({ path: ".trae/artifacts/verify-rps-custom-query-check.png", fullPage: true });
await browser.close();
process.stdout.write(JSON.stringify(result, null, 2));
