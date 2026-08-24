# ระบบบริหารจัดการเงินเดือน (PTN Payroll System V3.0)
**บริษัท พีทีเอ็น ฟาร์มาเซ็นเตอร์ จำกัด**

ระบบบริหารจัดการเงินเดือน, OT, กองทุนสำรองเลี้ยงชีพ (PF), ประกันสังคม, ภาษีหัก ณ ที่จ่าย, ใบแจ้งยอดเงินเดือน (Payslip A4) และแดชบอร์ดสรุปผลแบบเรียลไทม์ 

---

## 📁 โครงสร้างโปรเจกต์ (Project Structure)

```text
Sarary/
├── public/                     <-- โฟลเดอร์สำหรับ Deploy ขึ้น Cloudflare Pages & GitHub Pages
│   ├── css/
│   │   └── style.css           <-- ไฟล์สไตล์ชีตหลัก (Responsive + Print Payslip)
│   ├── js/
│   │   ├── config.js           <-- ไฟล์ตั้งค่า Google Apps Script Web App API Endpoint
│   │   └── app.js              <-- Application Engine & Calculation Logic
│   ├── _headers                <-- Cloudflare Security & Cache Headers
│   ├── _redirects              <-- Cloudflare SPA Routing
│   └── index.html              <-- ไฟล์หน้าเว็บหลัก Standalone SPA
├── .github/
│   └── workflows/
│       └── deploy.yml          <-- GitHub Actions Deploy อัตโนมัติ
├── Code.gs                     <-- Backend Script & JSON REST API (สำหรับ Google Apps Script)
├── Index.html                  <-- หน้าเว็บสำหรับรันภายใน Google Apps Script โดยตรง
├── .gitignore                  <-- Git ignore file
└── README.md                   <-- คู่มือการติดตั้งและการใช้งาน
```

---

## 🚀 คู่มือการนำขึ้น Cloudflare Pages (ง่ายและเร็วที่สุดใน 1 นาที)

### วิธีที่ 1: Direct Upload ผ่าน Cloudflare Dashboard (ไม่ต้องใช้คำสั่งใดๆ)
1. ล็อกอินเข้าสู่ [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. ที่แถบเมนูด้านซ้าย เลือก **Workers & Pages**
3. กดปุ่ม **Create application** &rarr; เลือกแท็บ **Pages**
4. เลือกแท็บ **Direct Upload** &rarr; ตั้งชื่อโปรเจกต์ เช่น `ptn-payroll`
5. **ลากโฟลเดอร์ `public`** จากคอมพิวเตอร์ของคุณไปวางในช่องอัปโหลด
6. กด **Deploy site**
7. คุณจะได้รับ URL เว็บไซต์ฟรีทันที เช่น `https://ptn-payroll.pages.dev` ✨

---

## 🐙 คู่มือการนำขึ้น GitHub Repository

### วิธีที่ 1: อัปโหลดผ่านหน้าเว็บ GitHub.com (ง่ายที่สุด)
1. ไปที่ [GitHub.com](https://github.com/) &rarr; กดสร้าง **New repository**
2. ตั้งชื่อ Repository เช่น `ptn-payroll` &rarr; ตั้งเป็น **Public** หรือ **Private** &rarr; กด **Create repository**
3. ที่หน้า Repository กดปุ่ม **uploading an existing file**
4. ลากไฟล์และโฟลเดอร์ทั้งหมดในโปรเจกต์นี้ไปวาง &rarr; กด **Commit changes**

### วิธีที่ 2: ใช้คำสั่ง Git (สำหรับผู้ที่ติดตั้ง Git บนเครื่อง)
```bash
cd c:\Mac\Home\Documents\Sarary
git init
git add .
git commit -m "Initial commit of PTN Payroll System V3.0"
git branch -M main
git remote add origin https://github.com/<YOUR_USERNAME>/ptn-payroll.git
git push -u origin main
```

---

## 🔗 วิธีผูก GitHub กับ Cloudflare Pages (Auto Deploy ทุกครั้งที่ Push)
1. ใน Cloudflare Pages เลือก **Connect to Git**
2. เลือกบัญชี GitHub และเลือก Repository `ptn-payroll`
3. ตั้งค่า Build:
   - **Framework preset**: `None`
   - **Build output directory**: `public`
4. กด **Save and Deploy**
5. ทุกครั้งที่คุณอัปเดตโค้ดบน GitHub เว็บไซต์บน Cloudflare Pages จะอัปเดตใหม่อัตโนมัติทันที!

---

## ⚙️ วิธีเชื่อมต่อระบบหน้าเว็บกับฐานข้อมูล Google Sheets
1. เปิด **Google Apps Script** &rarr; วางโค้ดจากไฟล์ `Code.gs` &rarr; กด **Deploy (ทำให้ใช้งานได้)** &rarr; **New deployment (การทำให้ใช้งานได้รายการใหม่)**
2. เลือกประเภท **Web app (เว็บแอป)**:
   - **Execute as**: `Me (ฉัน)`
   - **Who has access**: `Anyone (ทุกคน)`
3. คัดลอก **Web app URL** ที่ได้ (เช่น `https://script.google.com/macros/s/AKfycb.../exec`)
4. เปิดหน้าเว็บของคุณบน Cloudflare หรือ GitHub &rarr; กดปุ่ม **"⚙️ ตั้งค่า API"** &rarr; วาง URL &rarr; กดบันทึก
5. ระบบจะดึงและบันทึกข้อมูลกับ Google Sheets แบบ Real-time ทันที!