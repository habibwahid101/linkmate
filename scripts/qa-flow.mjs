import { chromium } from "playwright";

const browser = await chromium.launch({ args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
page.on("pageerror", (e) => console.log("PAGEERROR", e.message));
page.on("console", (m) => {
  if (m.type() === "error") console.log("CONSOLE", m.text());
});

await page.goto("http://127.0.0.1:8080/signup", { waitUntil: "networkidle" });
await page.screenshot({ path: "/workspace/screenshots/signup.png", fullPage: true });

const email = `rafi.${Date.now()}@linkmate.test`;
await page.getByLabel("Full name").fill("Rafi Ahmed");
await page.getByLabel("Email").fill(email);
await page.getByLabel("Password").fill("Password123!");
await page.getByRole("button", { name: "Create account" }).click();
await page.waitForURL(/\/app/, { timeout: 20000 }).catch(() => {});
await page.waitForTimeout(1500);
console.log("after signup", page.url());
await page.screenshot({ path: "/workspace/screenshots/app-empty.png", fullPage: true });

const sample = page.getByRole("button", { name: /Load Turbo sample/i });
if (await sample.count()) {
  await sample.click();
  await page.waitForTimeout(4000);
}
console.log("after sample", page.url(), await page.locator("body").innerText().then(t => t.slice(0, 500)));
await page.screenshot({ path: "/workspace/screenshots/dashboard.png", fullPage: true });

await page.goto("http://127.0.0.1:8080/app/wallet", { waitUntil: "networkidle" });
await page.waitForTimeout(800);
await page.screenshot({ path: "/workspace/screenshots/wallet.png", fullPage: true });

await page.goto("http://127.0.0.1:8080/app/team", { waitUntil: "networkidle" });
await page.waitForTimeout(800);
await page.screenshot({ path: "/workspace/screenshots/team.png", fullPage: true });

await page.goto("http://127.0.0.1:8080/app/packages", { waitUntil: "networkidle" });
await page.waitForTimeout(800);
await page.screenshot({ path: "/workspace/screenshots/packages.png", fullPage: true });

await page.goto("http://127.0.0.1:8080/admin", { waitUntil: "networkidle" });
await page.waitForTimeout(800);
console.log("admin", page.url(), await page.locator("body").innerText().then(t => t.slice(0, 400)));
await page.screenshot({ path: "/workspace/screenshots/admin.png", fullPage: true });

await page.setViewportSize({ width: 1280, height: 800 });
await page.goto("http://127.0.0.1:8080/app", { waitUntil: "networkidle" });
await page.waitForTimeout(800);
await page.screenshot({ path: "/workspace/screenshots/dashboard-desktop.png", fullPage: true });

await browser.close();
console.log("DONE");
