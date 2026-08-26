import { chromium } from "playwright";
const browser = await chromium.launch({ args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
page.on("pageerror", (e) => console.log("PAGEERROR", e.message));
page.on("console", (m) => { if (m.type() === "error") console.log("CONSOLE", m.text()); });

const email = `sample.${Date.now()}@linkmate.test`;
await page.goto("http://127.0.0.1:8080/signup", { waitUntil: "networkidle" });
await page.getByLabel("Full name").fill("Nusrat Jahan");
await page.getByLabel("Email").fill(email);
await page.getByLabel("Password").fill("Password123!");
await page.getByRole("button", { name: "Create account" }).click();
await page.getByText("No membership yet").waitFor({ timeout: 20000 });
await page.screenshot({ path: "/workspace/screenshots/empty-ready.png" });

await page.getByRole("button", { name: /Load Turbo sample/ }).click();
try {
  await page.getByText("Level 1").waitFor({ timeout: 20000 });
  console.log("LEVEL1 visible");
} catch (e) {
  console.log("no level1", await page.locator("body").innerText());
}
await page.screenshot({ path: "/workspace/screenshots/dashboard-sample.png" });
console.log("DASH", (await page.locator("body").innerText()).slice(0, 1200));

await page.goto("http://127.0.0.1:8080/app/wallet");
await page.getByText("Held commission").first().waitFor({ timeout: 10000 });
await page.screenshot({ path: "/workspace/screenshots/wallet-sample.png" });
console.log("WALLET", (await page.locator("body").innerText()).slice(0, 800));

await page.goto("http://127.0.0.1:8080/app/team");
await page.getByText("Level 1").waitFor({ timeout: 10000 });
await page.screenshot({ path: "/workspace/screenshots/team-sample.png" });

await page.goto("http://127.0.0.1:8080/app/packages");
await page.getByText("Turbo").first().waitFor({ timeout: 10000 });
await page.screenshot({ path: "/workspace/screenshots/packages-ready.png" });

await page.setViewportSize({ width: 1280, height: 800 });
await page.goto("http://127.0.0.1:8080/app");
await page.getByText("Held commission").first().waitFor({ timeout: 10000 });
await page.screenshot({ path: "/workspace/screenshots/dashboard-desktop-sample.png" });

await page.goto("http://127.0.0.1:8080/admin");
await page.getByText("Joining value").waitFor({ timeout: 10000 });
await page.screenshot({ path: "/workspace/screenshots/admin-sample.png" });
console.log("ADMIN", (await page.locator("body").innerText()).slice(0, 900));

await browser.close();
