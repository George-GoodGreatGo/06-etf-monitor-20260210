const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

(async () => {
  const outDir = path.resolve('.trae');
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } });

  await page.route('**/api/auth/me**', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ authenticated: true, username: '验收账号' })
    });
  });

  async function capture(url, prefix) {
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1200);

    const data = await page.evaluate(() => {
      const nav = document.querySelector('aside');
      const buttons = Array.from(nav?.querySelectorAll('button, a') || []).map((el) => ({
        text: (el.textContent || '').replace(/\s+/g, ' ').trim(),
        title: el.getAttribute('title'),
        ariaLabel: el.getAttribute('aria-label'),
        className: el.className,
      }));
      const submenu = Array.from(nav?.querySelectorAll('div.ml-3 button') || []).map((el) => ({
        text: (el.textContent || '').replace(/\s+/g, ' ').trim(),
        className: el.className,
      }));
      return {
        pathname: window.location.pathname,
        buttons,
        submenu,
        navText: (nav?.textContent || '').replace(/\s+/g, ' ').trim(),
      };
    });

    await page.screenshot({ path: path.join(outDir, `${prefix}.png`), fullPage: true });
    fs.writeFileSync(path.join(outDir, `${prefix}.json`), JSON.stringify(data, null, 2), 'utf8');
  }

  await capture('http://127.0.0.1:4173/market/rps', 'sidebar-rps-overview');
  await capture('http://127.0.0.1:4173/market/rps/custom-query', 'sidebar-rps-custom-query');
  await browser.close();
})();
