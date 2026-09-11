const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const SCREENSHOTS_DIR = path.resolve(__dirname, '..', 'assets', 'screenshots');

if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function capture() {
  console.log('Launching browser at:', EDGE_PATH);
  const browser = await puppeteer.launch({
    executablePath: EDGE_PATH,
    headless: 'new',
    defaultViewport: { width: 1440, height: 920, deviceScaleFactor: 2 },
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--hide-scrollbars']
  });

  const page = await browser.newPage();

  // 1. Capture Login Portal (before auth injection)
  console.log('Capturing 05_login_portal.png...');
  await page.goto('http://localhost:3000/login', { waitUntil: 'domcontentloaded', timeout: 15000 });
  await sleep(2500);
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '05_login_portal.png'), fullPage: false });

  // Inject Supervisor Authentication
  await page.evaluate(() => {
    const supervisor = {
      id: 'SUPERVISOR',
      username: 'supervisor01',
      email: 'supervisor@nciipc.gov.in',
      name: 'S. Sengupta',
      role: 'SUPERVISOR',
      roleLabel: 'NCIIPC Chief Supervisor',
      designation: 'National Supervisory Authority',
      organization: 'NCIIPC',
      avatar: 'SS'
    };
    localStorage.setItem('aegis_user', JSON.stringify(supervisor));
    localStorage.setItem('aegis_token', 'offline_demo_token_supervisor');
    localStorage.setItem('aegis_auth_mode', 'offline');
  });

  // 2. Decision Room (Overview)
  console.log('Capturing 01_decision_room.png...');
  await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded', timeout: 15000 });
  await sleep(2500);
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '01_decision_room.png'), fullPage: false });

  // 3. Multi-CSE Benchmarking
  console.log('Capturing 02_multi_cse_comparator.png...');
  await page.goto('http://localhost:3000/benchmarking', { waitUntil: 'domcontentloaded', timeout: 15000 });
  await sleep(2500);
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '02_multi_cse_comparator.png'), fullPage: false });

  // 4. Data Ingestion & SIEM Normalization
  console.log('Capturing 03_data_ingestion_siem.png...');
  await page.goto('http://localhost:3000/ingestion', { waitUntil: 'domcontentloaded', timeout: 15000 });
  await sleep(2500);
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '03_data_ingestion_siem.png'), fullPage: false });

  // 5. Air-Gapped Security Monitoring
  console.log('Capturing 04_airgap_security.png...');
  await page.goto('http://localhost:3000/security-monitoring', { waitUntil: 'domcontentloaded', timeout: 15000 });
  await sleep(2500);
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '04_airgap_security.png'), fullPage: false });

  // 6. Comprehensive Supervisory Assessment Report
  console.log('Capturing 06_supervisory_report.png...');
  await page.goto('http://localhost:3000/reports', { waitUntil: 'domcontentloaded', timeout: 15000 });
  await sleep(2500);
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '06_supervisory_report.png'), fullPage: false });

  // 7. Evidence Traceability & Investigation Workspace
  console.log('Capturing 07_evidence_investigation.png...');
  await page.goto('http://localhost:3000/evidence', { waitUntil: 'domcontentloaded', timeout: 15000 });
  await sleep(2500);
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '07_evidence_investigation.png'), fullPage: false });

  // 8. Negative-Space & Missing Telemetry Analysis
  console.log('Capturing 08_negative_space.png...');
  await page.goto('http://localhost:3000/negative-space', { waitUntil: 'domcontentloaded', timeout: 15000 });
  await sleep(2500);
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '08_negative_space.png'), fullPage: false });

  // 9. Critical Alert Escalation Gateway
  console.log('Capturing 09_critical_escalation.png...');
  await page.goto('http://localhost:3000/escalation', { waitUntil: 'domcontentloaded', timeout: 15000 });
  await sleep(2500);
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '09_critical_escalation.png'), fullPage: false });

  // 10. Single CSE Deep-Dive Analytics (PowerGrid CSE-07)
  console.log('Capturing 10_cse_deepdive.png...');
  await page.goto('http://localhost:3000/cse/CSE-07', { waitUntil: 'domcontentloaded', timeout: 15000 });
  await sleep(2500);
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '10_cse_deepdive.png'), fullPage: false });

  console.log('ALL 10 SCREENSHOTS CAPTURED SUCCESSFULLY!');
  await browser.close();
}

capture().catch(err => {
  console.error('Error during screenshot capture:', err);
  process.exit(1);
});
