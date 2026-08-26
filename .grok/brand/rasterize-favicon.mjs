import { chromium } from "playwright";
import { pathToFileURL } from "node:url";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { writeFileSync } from "node:fs";

const dir = dirname(fileURLToPath(import.meta.url));
const svgUrl = pathToFileURL(join(dir, "favicon.svg")).href;

const browser = await chromium.launch();
for (const size of [16, 32, 64]) {
  const page = await browser.newPage({
    viewport: { width: size, height: size },
    deviceScaleFactor: 1,
  });
  await page.setContent(
    `<html><body style="margin:0;background:transparent">
       <img src="${svgUrl}" width="${size}" height="${size}" style="display:block"/>
     </body></html>`,
    { waitUntil: "load" },
  );
  await page.locator("img").screenshot({
    path: join(dir, `favicon-svg-${size}.png`),
    omitBackground: true,
  });
  await page.close();
}
await browser.close();
console.log("rasterized favicon svg");
