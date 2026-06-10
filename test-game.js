import { chromium } from "https://deno.land/x/playwright@v1.40.0/mod.ts";

const browser = await chromium.launch({ headless: false });
const context = await browser.newContext({ viewport: { width: 1200, height: 800 } });
const page = await context.newPage();

await page.goto("http://localhost:8000");
await page.waitForLoadState("networkidle");

// Wait for game to be ready
await page.waitForSelector(".chip", { timeout: 5000 });

// Get the initial state to see what difficulty we're on
const difficultyEl = await page.$(".difficulty");
if (difficultyEl) {
  const difficulty = await difficultyEl.textContent();
  console.log("Current difficulty:", difficulty);
}

// Play for a bit to get enemies on screen
for (let i = 0; i < 5; i++) {
  // Get all chips
  const chips = await page.$$(".chip");
  if (chips.length === 0) break;
  
  // Click a random chip to answer
  const randomChip = chips[Math.floor(Math.random() * chips.length)];
  await randomChip.click();
  await page.waitForTimeout(300);
  
  // Check if game is over
  const gameOver = await page.$(".game-over");
  if (gameOver) break;
}

// Take a screenshot of the chip row
const screenshot = await page.screenshot({ path: "/tmp/chips-screenshot.png", fullPage: false });
console.log("Screenshot saved to /tmp/chips-screenshot.png");

// Get the current chips to analyze their last digits
const chipElements = await page.$$(".chip");
const chipValues = [];
for (const chip of chipElements) {
  const text = await chip.textContent();
  const num = parseInt(text.trim());
  if (!isNaN(num)) chipValues.push(num);
}

console.log("Chip values:", chipValues);
console.log("Last digits:", chipValues.map(v => v % 10));

// Count the last digits
const digitCounts = {};
for (const digit of chipValues.map(v => v % 10)) {
  digitCounts[digit] = (digitCounts[digit] || 0) + 1;
}
console.log("Last digit distribution:", digitCounts);

// Verify max 4 enemies
const enemies = await page.$$(".enemy");
console.log("Enemy count:", enemies.length);
if (enemies.length > 4) {
  console.error("ERROR: More than 4 enemies on screen!");
} else {
  console.log("✓ Max 4 enemies constraint working");
}

await browser.close();
