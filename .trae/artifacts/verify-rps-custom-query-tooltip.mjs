import { chromium } from "playwright";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1800 } });
await page.goto("http://localhost:4173/dev/rps-custom-query-live", { waitUntil: "domcontentloaded" });
await page.getByText("查询结果摘要").waitFor({ timeout: 15000 });
await page.waitForTimeout(1200);
const canvas = page.locator("canvas").first();
const box = await canvas.boundingBox();
if (!box) throw new Error("missing canvas");
const tooltip = page.locator("div.pointer-events-none.absolute.right-3.top-12");
const hover = async () => {
  await page.mouse.move(box.x + box.width * 0.82, box.y + box.height * 0.35);
  await page.waitForTimeout(200);
  return (await tooltip.textContent())?.replace(/\s+/g, " ").trim() || "";
};
const initial = await hover();
await page.getByRole("button", { name: "SMA20" }).click();
const noSma20 = await hover();
await page.getByRole("button", { name: "SMA20" }).click();
const yesSma20 = await hover();
await page.getByRole("button", { name: "RPS Score" }).click();
const noScore = await hover();
await page.getByRole("button", { name: "RPS Score" }).click();
const yesScore = await hover();
console.log(JSON.stringify({
  initial,
  noSma20,
  yesSma20,
  noScore,
  yesScore,
  checks: {
    initialHasSma20: initial.includes('SMA20'),
    noSma20HasSma20: noSma20.includes('SMA20'),
    yesSma20HasSma20: yesSma20.includes('SMA20'),
    initialHasScore: initial.includes('RPS Score'),
    noScoreHasScore: noScore.includes('RPS Score'),
    yesScoreHasScore: yesScore.includes('RPS Score'),
  }
}, null, 2));
await browser.close();
