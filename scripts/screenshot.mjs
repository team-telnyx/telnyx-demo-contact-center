#!/usr/bin/env node
/* Playwright screenshot tool — captures every dashboard page. */
import { chromium } from 'playwright';
import { mkdir } from 'fs/promises';
import path from 'path';
import process from 'process';

const OUT_DIR = process.argv[2] || '.redesign-screenshots/after';
const BASE = process.env.BASE_URL || 'http://localhost:3000';

const PAGES = [
  { name: 'login', path: '/login', auth: false },
  { name: 'phone', path: '/phone' },
  { name: 'inbox', path: '/inbox' },
  { name: 'broadcasts', path: '/broadcasts' },
  { name: 'ivr', path: '/ivr' },
  { name: 'history', path: '/history' },
  { name: 'recordings', path: '/recordings' },
  { name: 'contacts', path: '/contacts' },
  { name: 'coaching', path: '/coaching' },
  { name: 'wallboard', path: '/wallboard' },
  { name: 'agents', path: '/agents' },
  { name: 'queues', path: '/queues' },
  { name: 'numbers', path: '/numbers' },
  { name: 'workflows', path: '/workflows' },
  { name: 'profile', path: '/profile' },
  { name: 'team-chat', path: '/team-chat' },
];

async function login(page) {
  // Hit the API directly and seed localStorage so the layout's auth check passes.
  const res = await page.request.post(`${BASE.replace('3000','3001')}/api/auth/login`, {
    data: { username: 'admin', password: 'admin1234' },
    headers: { 'content-type': 'application/json' },
  });
  const body = await res.json();
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(({ token, user }) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
  }, body);
}

async function shoot(page, name, outDir) {
  const file = path.join(outDir, `${name}.png`);
  try {
    await page.screenshot({ path: file, fullPage: true, animations: 'disabled' });
    console.log(`✓ ${name} → ${file}`);
  } catch (e) {
    console.log(`✗ ${name} failed: ${e.message}`);
  }
}

(async () => {
  await mkdir(OUT_DIR, { recursive: true });
  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
  });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('pageerror:', e.message));

  // Login page first (no auth)
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);
  await shoot(page, 'login', OUT_DIR);

  // Authenticate
  await login(page);

  for (const p of PAGES) {
    if (!p.path || p.name === 'login') continue;
    try {
      await page.goto(`${BASE}${p.path}`, { waitUntil: 'domcontentloaded', timeout: 20000 });
      await page.waitForTimeout(1500);
      await shoot(page, p.name, OUT_DIR);
    } catch (e) {
      console.log(`✗ ${p.name} nav failed: ${e.message}`);
    }
  }

  await browser.close();
  console.log('Done.');
})();
