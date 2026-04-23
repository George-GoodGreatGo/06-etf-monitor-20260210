import { chromium } from "playwright";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1800 } });
let count = 0;
await page.route("**/api/rps/custom-query**", async (route) => { count += 1; await route.continue(); });
await page.goto("http://localhost:4173/dev/rps-custom-query-live", { waitUntil: "domcontentloaded" });
await page.getByText("查询结果摘要").waitFor({ timeout: 15000 });
await page.waitForTimeout(1000);
const chartButtons = await page.locator("button").evaluateAll((els) => els.map((el) => (el.textContent || "").replace(/\s+/g, " ").trim()).filter(Boolean));
const canvas = page.locator("canvas").first();
const box = await canvas.boundingBox();
if (!box) throw new Error("missing canvas");
const tooltipText = async () => page.evaluate(() => {
  const el = [...document.querySelectorAll("div")].find((node) => {
    const txt = (node.textContent || "").replace(/\s+/g, " ");
    return txt.includes("前复权价格") && txt.includes("放量倍数") && txt.includes("RPS MA50起点归一");
  });
  return (el?.textContent || "").replace(/\s+/g, " ").trim();
});
const hover = async () => {
  await page.mouse.move(box.x + box.width * 0.82, box.y + box.height * 0.35);
  await page.waitForTimeout(150);
  return tooltipText();
};
const getHeight = async (prefix) => {
  const locator = page.locator(`xpath=//div[contains(normalize-space(.), '${prefix}')]/ancestor::div[@style][1]`).first();
  return {
    style: await locator.getAttribute('style'),
    height: await locator.evaluate((el) => Math.round(el.getBoundingClientRect().height)),
  };
};
const initialTooltip = await hover();
await page.getByRole("button", { name: "SMA20" }).click();
const noSma20Tooltip = await hover();
await page.getByRole("button", { name: "SMA20" }).click();
const yesSma20Tooltip = await hover();
const scoreBefore = await getHeight('RPS Score（副图）');
await page.getByRole("button", { name: "RPS Score" }).click();
await page.waitForTimeout(250);
const scoreHidden = await getHeight('RPS Score（副图）');
const scoreHiddenTooltip = await hover();
await page.getByRole("button", { name: "RPS Score" }).click();
await page.waitForTimeout(250);
const scoreShown = await getHeight('RPS Score（副图）');
const scoreShownTooltip = await hover();
const relativeBefore = await getHeight('RPS起点归一（副图）');
await page.getByRole("button", { name: "RPS起点归一" }).click();
await page.waitForTimeout(250);
const relativeHidden = await getHeight('RPS起点归一（副图）');
await page.getByRole("button", { name: "RPS起点归一" }).click();
await page.waitForTimeout(250);
const relativeShown = await getHeight('RPS起点归一（副图）');
const rsiBefore = await getHeight('RSI(14)（副图）');
await page.getByRole("button", { name: "RSI(14)" }).click();
await page.waitForTimeout(250);
const rsiHidden = await getHeight('RSI(14)（副图）');
await page.getByRole("button", { name: "RSI(14)" }).click();
await page.waitForTimeout(250);
const rsiShown = await getHeight('RSI(14)（副图）');
console.log(JSON.stringify({
  requestCount: count,
  chartButtons,
  hasPriceToggle: chartButtons.includes('价格线'),
  tooltipHasSma20Initially: initialTooltip.includes('SMA20'),
  tooltipDropsSma20AfterToggle: !noSma20Tooltip.includes('SMA20'),
  tooltipRecoversSma20AfterRetoggle: yesSma20Tooltip.includes('SMA20'),
  tooltipDropsScoreWhenPaneHidden: !scoreHiddenTooltip.includes('RPS Score'),
  tooltipRecoversScoreWhenPaneShown: scoreShownTooltip.includes('RPS Score'),
  scoreBefore,
  scoreHidden,
  scoreShown,
  relativeBefore,
  relativeHidden,
  relativeShown,
  rsiBefore,
  rsiHidden,
  rsiShown,
}, null, 2));
await browser.close();
