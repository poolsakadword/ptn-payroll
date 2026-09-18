# ==============================================================================
# PTN Payroll System V3.0 - One-Click Deploy Script for Cloudflare & GitHub
# ==============================================================================

Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force
$env:PATH = "C:\Program Files\Git\cmd;C:\Program Files\GitHub CLI;C:\Program Files\nodejs;" + $env:PATH

Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "  PTN Payroll System V3.0 - Deployment Manager" -ForegroundColor Yellow
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "1. Deploy to Cloudflare Pages (Direct via Wrangler)"
Write-Host "2. Create & Push to GitHub Repository"
Write-Host "3. Update & Commit all changes locally"
Write-Host "4. Exit"
Write-Host "========================================================" -ForegroundColor Cyan

$choice = Read-Host "เลือกตัวเลือก (1, 2, 3 หรือ 4)"

if ($choice -eq "1") {
    Write-Host "`n[1/3] กำลัง Deploy ไปยัง Cloudflare Pages (Branch: main)..." -ForegroundColor Green
    npx.cmd wrangler pages deploy public --project-name=ptn-payroll --branch=main
    Write-Host "`n[2/3] กำลัง Deploy ไปยัง Cloudflare Pages (Branch: master)..." -ForegroundColor Green
    npx.cmd wrangler pages deploy public --project-name=ptn-payroll --branch=master
    Write-Host "`n[3/3] การ Deploy ไปยังทั้ง 2 URL (main & master) เสร็จสิ้นสมบูรณ์!" -ForegroundColor Green
}
elseif ($choice -eq "2") {
    Write-Host "`n[1/3] ตรวจสอบการ Login ของ GitHub CLI..." -ForegroundColor Green
    gh auth login
    Write-Host "`n[2/3] กำลังสร้าง GitHub Repository และ Push ข้อมูล..." -ForegroundColor Green
    gh repo create ptn-payroll --public --source=. --remote=origin --push
    Write-Host "`n[3/3] อัปโหลดโปรเจกต์ขึ้น GitHub สำเร็จเรียบร้อย!" -ForegroundColor Green
}
elseif ($choice -eq "3") {
    Write-Host "`nกำลังบันทึกการเปลี่ยนแปลงใน Git..." -ForegroundColor Green
    git add .
    git commit -m "update: sync latest payroll changes"
    Write-Host "บันทึกข้อมูลเรียบร้อย!" -ForegroundColor Green
}
else {
    Write-Host "ออกจากการทำงาน" -ForegroundColor Gray
}