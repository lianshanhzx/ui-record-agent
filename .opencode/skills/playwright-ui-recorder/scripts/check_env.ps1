# check_env.ps1 - Playwright recording environment self-check
# Usage: powershell -File .opencode/skills/playwright-ui-recorder/scripts/check_env.ps1

$ErrorActionPreference = "Continue"
$Root = Split-Path -Parent $PSScriptRoot   # skill dir
$Root = Split-Path -Parent $Root           # skills
$Root = Split-Path -Parent $Root           # .opencode
$Root = Split-Path -Parent $Root           # project root
Set-Location $Root

$ok = $true

# 1. Node
$nodeVer = (node -v 2>$null)
if ($nodeVer) {
    Write-Host "[OK] node $nodeVer" -ForegroundColor Green
} else {
    Write-Host "[FAIL] node not found. Install Node.js >= 18 first." -ForegroundColor Red
    $ok = $false
}

# 2. @playwright/test
$pw = (npx playwright --version 2>$null)
if ($pw) {
    Write-Host "[OK] $pw" -ForegroundColor Green
} else {
    Write-Host "[FAIL] @playwright/test not installed. Run: npm install -D @playwright/test" -ForegroundColor Red
    $ok = $false
}

# 3. chromium browser
$browserDir = Join-Path $env:LOCALAPPDATA "ms-playwright"
$chromium = @()
if (Test-Path $browserDir) {
    $chromium = Get-ChildItem $browserDir -Directory -Filter "chromium-*" | Where-Object { $_.Name -notmatch "headless" }
}
if ($chromium) {
    Write-Host "[OK] chromium installed: $($chromium[0].Name)" -ForegroundColor Green
} else {
    Write-Host "[FAIL] chromium not installed. Run:" -ForegroundColor Red
    Write-Host '       $env:PLAYWRIGHT_DOWNLOAD_HOST="https://cdn.npmmirror.com/binaries/playwright"; npx playwright install chromium'
    $ok = $false
}

# 4. playwright.config.ts
if (Test-Path (Join-Path $Root "playwright.config.ts")) {
    Write-Host "[OK] playwright.config.ts found" -ForegroundColor Green
} else {
    Write-Host "[WARN] playwright.config.ts missing (codegen still works, but a config is recommended)" -ForegroundColor Yellow
}

# 5. tests dir
if (Test-Path (Join-Path $Root "tests")) {
    Write-Host "[OK] tests/ dir found" -ForegroundColor Green
} else {
    Write-Host "[WARN] tests/ dir missing. Create it before recording: New-Item -ItemType Directory tests" -ForegroundColor Yellow
}

# 6. Headless smoke test (skip with --skip-smoke)
if ($ok -and $args -notcontains "--skip-smoke") {
    $js = "const { chromium } = require('@playwright/test'); (async () => { const b = await chromium.launch({ headless: true }); const p = await b.newPage(); await p.setContent('<h1>ok</h1>'); console.log('SMOKE-OK'); await b.close(); })().catch(e => { console.error('SMOKE-FAIL ' + e.message); process.exit(1); });"
    # keep the script inside the project so node can resolve @playwright/test
    $tmp = Join-Path $Root ".pw-smoke-$pid.js"
    Set-Content -Path $tmp -Value $js -Encoding ASCII
    $out = & node $tmp 2>&1
    Remove-Item $tmp -Force -ErrorAction SilentlyContinue
    if ($out -match "SMOKE-OK") {
        Write-Host "[OK] chromium headless smoke test passed" -ForegroundColor Green
    } else {
        Write-Host "[FAIL] chromium launch failed: $out" -ForegroundColor Red
        $ok = $false
    }
}

if ($ok) { Write-Host "`nEnvironment ready. You can start recording." -ForegroundColor Cyan }
else { Write-Host "`nEnvironment NOT ready. Fix the issues above first." -ForegroundColor Red; exit 1 }
