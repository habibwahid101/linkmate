import { chromium } from "playwright";

const BASE = "http://127.0.0.1:8080";
const widths = [320, 360, 375, 390, 414, 480, 768, 1024, 1280, 1440];

function stamp() {
  return Date.now().toString(36);
}

async function signup(page, { name, email, password, ref }) {
  await page.goto(`${BASE}/signup`, { waitUntil: "networkidle" });
  await page.getByLabel("Full name").fill(name);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  if (ref) await page.getByLabel(/Referral/i).fill(ref);
  await page.getByRole("button", { name: "Create account" }).click();
  try {
    await page.waitForURL(/\/app/, { timeout: 25000 });
  } catch (e) {
    console.log("signup failed", page.url(), await page.locator("body").innerText().then((t) => t.slice(0, 500)));
    throw e;
  }
}

async function login(page, { email, password }) {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/app/, { timeout: 25000 });
  await page.waitForTimeout(800);
}

async function signOut(page) {
  await page.goto(`${BASE}/app/profile`, { waitUntil: "networkidle" });
  await page.waitForTimeout(400);
  const btn = page.getByRole("button", { name: "Sign out" });
  if (await btn.count()) {
    await btn.click();
    await page.waitForURL(/\/login/, { timeout: 15000 }).catch(() => {});
  } else {
    await page.goto(`${BASE}/login`);
  }
  await page.waitForTimeout(600);
}

async function uniqueMemberIds(page) {
  const texts = await page.locator("p.font-mono.text-sm.font-semibold").allTextContents();
  return [...new Set(texts.map((t) => t.trim()).filter((t) => /^LM-\d+$/.test(t)))];
}

async function overflowAt(page, width) {
  await page.setViewportSize({ width, height: width >= 1024 ? 800 : 844 });
  await page.waitForTimeout(200);
  return page.evaluate(() => {
    const doc = document.documentElement;
    return {
      client: doc.clientWidth,
      scroll: doc.scrollWidth,
      overflow: doc.scrollWidth > doc.clientWidth + 1,
    };
  });
}

const findings = [];
function pass(name) {
  console.log("PASS", name);
}
function fail(name, detail) {
  findings.push({ name, detail });
  console.log("FAIL", name, detail);
}

const browser = await chromium.launch({ args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
page.on("pageerror", (e) => console.log("PAGEERROR", e.message));

try {
  await page.goto(BASE, { waitUntil: "networkidle" });
  for (const w of widths) {
    const o = await overflowAt(page, w);
    if (o.overflow) fail(`overflow landing ${w}`, o);
    else pass(`overflow landing ${w}`);
  }
  await page.setViewportSize({ width: 390, height: 844 });

  await page.goto(`${BASE}/forgot-password`, { waitUntil: "networkidle" });
  if (await page.getByRole("heading", { name: /Reset password/i }).count()) pass("forgot password screen");
  else fail("forgot password screen", await page.locator("body").innerText().then((t) => t.slice(0, 200)));

  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.getByLabel("Email").fill("nobody@linkmate.test");
  await page.getByLabel("Password").fill("wrong-password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForTimeout(1500);
  const loginErr = await page.locator("body").innerText();
  if (/failed|invalid|incorrect|not found|credentials/i.test(loginErr) && !/\/app/.test(page.url())) {
    pass("invalid password rejected");
  } else if (page.url().includes("/login")) {
    pass("invalid password stayed on login");
  } else fail("invalid password", page.url() + " " + loginErr.slice(0, 200));

  const t = stamp();
  const sponsorEmail = `sponsor.${t}@linkmate.test`;
  const buyerEmail = `buyer.${t}@linkmate.test`;
  const password = "Password123!";

  await signup(page, { name: "Sponsor Ali", email: sponsorEmail, password });
  await page.goto(`${BASE}/app/packages`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Select" }).first().click();
  await page.getByRole("button", { name: "Cancel" }).click();
  await page.waitForTimeout(400);
  if (page.url().includes("/packages")) pass("cancelled purchase stays on packages");
  else fail("cancelled purchase", page.url());

  await page.getByRole("button", { name: "Select" }).first().click();
  await page.getByRole("button", { name: /Pay/ }).click();
  try {
    await page.waitForURL(/\/app\/ids/, { timeout: 25000 });
  } catch (e) {
    console.log("builder pay failed", page.url(), await page.locator("body").innerText().then((t) => t.slice(0, 800)));
    throw e;
  }
  await page.waitForTimeout(800);
  const builderIds = await uniqueMemberIds(page);
  if (builderIds.length !== 1) fail("builder creates exactly 1 ID", builderIds.join(","));
  else pass("builder creates exactly 1 ID");

  await page.goto(`${BASE}/app/invite`, { waitUntil: "networkidle" });
  await page.waitForTimeout(600);
  const inviteText = await page.locator("body").innerText();
  const codeMatch = inviteText.match(/\b[A-Z0-9]{6}\b/);
  const refCode = codeMatch?.[0];
  if (!refCode) fail("referral code visible", inviteText.slice(0, 300));
  else pass(`referral code ${refCode}`);

  await page.goto(`${BASE}/app/packages`, { waitUntil: "networkidle" });
  const turbo = page.getByRole("button", { name: /Select|Buy again/ }).nth(1);
  await turbo.click();
  const pay = page.getByRole("button", { name: /Pay ৳44,000/ });
  await Promise.all([pay.click(), pay.click().catch(() => {})]);
  await page.waitForURL(/\/app\/ids/, { timeout: 25000 }).catch(() => {});
  await page.waitForTimeout(1500);
  await page.goto(`${BASE}/app/ids`, { waitUntil: "networkidle" });
  await page.waitForTimeout(600);
  const afterTurbo = await uniqueMemberIds(page);
  if (afterTurbo.length !== 5) fail("duplicate turbo protection (expect 5 IDs)", `got ${afterTurbo.length}: ${afterTurbo.join(",")}`);
  else pass("duplicate turbo click issued 4 IDs (5 total)");

  await signOut(page);

  await signup(page, { name: "Buyer Bina", email: buyerEmail, password, ref: refCode });
  await page.goto(`${BASE}/app/packages`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Select" }).nth(1).click();
  await page.waitForTimeout(300);
  const refInput = page.getByLabel(/Referral/i);
  if (await refInput.count()) {
    await refInput.fill(refCode);
  }
  await page.getByRole("button", { name: /Pay ৳44,000/ }).click();
  await page.waitForURL(/\/app\/ids/, { timeout: 25000 });
  await page.waitForTimeout(1200);
  const buyerIds = await uniqueMemberIds(page);
  if (buyerIds.length !== 4) fail("turbo buyer exactly 4 IDs", buyerIds.join(","));
  else pass("turbo buyer exactly 4 IDs");

  await signOut(page);
  await login(page, { email: sponsorEmail, password });
  await page.goto(`${BASE}/app`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1000);
  const sponsorDash = await page.locator("body").innerText();
  const held880 = sponsorDash.includes("৳880");
  const l1partial = /1\s*\/\s*3/.test(sponsorDash);
  const gen2held = sponsorDash.includes("৳1,980") || sponsorDash.includes("৳1980");
  if (held880 && l1partial) {
    pass("external sponsor L1 1/3 ৳880 HELD from root");
  } else fail("external sponsor L1 1/3 ৳880 HELD from root", sponsorDash.slice(0, 600));
  if (gen2held || /3\s*\/\s*9/.test(sponsorDash)) {
    pass("external sponsor L2 3/9 from turbo internals");
  } else fail("external sponsor L2 3/9 from turbo internals", sponsorDash.slice(0, 600));
  if (sponsorDash.includes("Available") && /৳2,640/.test(sponsorDash.split("Available")[1] ?? "")) {
    fail("possible sponsor leak of turbo internals into available", sponsorDash.slice(0, 400));
  }

  await signOut(page);

  const demoEmail = `demo.${t}@linkmate.test`;
  await signup(page, { name: "Demo User", email: demoEmail, password });
  await page.goto(`${BASE}/app`, { waitUntil: "networkidle" });
  const sampleBtn = page.getByRole("button", { name: /Load Turbo sample/i });
  try {
    await sampleBtn.waitFor({ timeout: 15000 });
    await sampleBtn.click();
    await page.getByText(/Loading sample/i).waitFor({ timeout: 5000 }).catch(() => {});
    await page.getByText("৳3,960", { exact: false }).first().waitFor({ timeout: 90000 });
  } catch (e) {
    fail("sample load", await page.locator("body").innerText().then((t) => t.slice(0, 800)));
    console.log("sample error", e instanceof Error ? e.message : e);
  }
  await page.goto(`${BASE}/app`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1000);
  const dash = await page.locator("body").innerText();
  if (dash.includes("৳2,640")) pass("sample available/released ৳2,640");
  else fail("sample missing ৳2,640", dash.slice(0, 500));
  if (dash.includes("৳3,960")) pass("sample held ৳3,960");
  else fail("sample missing ৳3,960", dash.slice(0, 500));
  if (dash.includes("6 / 9") || dash.includes("6/9")) pass("sample L2 6/9");
  else fail("sample missing 6/9", dash.slice(0, 500));

  await page.screenshot({ path: "/workspace/screenshots/qa-dashboard.png", fullPage: true });

  for (let i = 0; i < 3; i++) {
    await page.goto(`${BASE}/app/team`, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: /Simulate join/i }).click();
    await page.waitForTimeout(400);
    const select = page.locator("#sp");
    const options = await select.locator("option").allTextContents();
    const internals = options
      .map((label, idx) => ({ label, idx }))
      .filter((o) => /internal/i.test(o.label));
    const pick = internals[i % Math.max(internals.length, 1)];
    if (pick) await select.selectOption({ index: pick.idx });
    await page.getByLabel("Member name").fill(`Closer ${i + 1}`);
    await page.getByRole("button", { name: "Add member" }).click();
    await page.waitForTimeout(1800);
  }
  await page.goto(`${BASE}/app`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1000);
  const after = await page.locator("body").innerText();
  if (after.includes("9 / 9") || after.includes("9/9")) pass("L2 reached 9/9");
  else fail("L2 9/9 missing", after.slice(0, 700));
  if (after.includes("৳5,940") || after.includes("৳8,580")) pass("L2 full amount visible");
  else fail("L2 full release amount missing", after.slice(0, 600));

  await page.goto(`${BASE}/app/packages`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /Select|Buy again/ }).last().click();
  await page.getByRole("button", { name: /Pay ৳242,000/ }).click();
  await page.waitForURL(/\/app\/ids/, { timeout: 40000 });
  await page.waitForTimeout(1500);
  const hyper = await page.locator("body").innerText();
  const unplaced = (hyper.match(/Unplaced/g) || []).length;
  if (unplaced === 0) pass("hyper turbo all 22 placed");
  else fail("hyper turbo still shows unplaced IDs", `unplaced=${unplaced}`);

  await page.goto(`${BASE}/admin`, { waitUntil: "networkidle" });
  await page.waitForTimeout(600);
  const adminText = await page.locator("body").innerText();
  if (/Forbidden|No access|Back to app/i.test(adminText) && !/Joining value|Held commission/i.test(adminText)) {
    pass("non-admin blocked from admin");
  } else fail("non-admin reached admin", adminText.slice(0, 400));

  for (const path of ["/app", "/app/packages", "/app/team", "/app/wallet", "/app/ids"]) {
    await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(400);
    for (const w of [320, 390, 768, 1280]) {
      const o = await overflowAt(page, w);
      if (o.overflow) fail(`overflow ${path} ${w}`, o);
      else pass(`overflow ${path} ${w}`);
    }
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${BASE}/app`, { waitUntil: "networkidle" });
  await page.screenshot({ path: "/workspace/screenshots/qa-final-mobile.png", fullPage: true });
} catch (err) {
  fail("runner", err instanceof Error ? err.message : String(err));
} finally {
  await browser.close();
}

console.log("\nFINDINGS", JSON.stringify(findings, null, 2));
 if (findings.length) process.exit(1);
