/**
 * Configuration for PTN Payroll System (Cloudflare Pages & GitHub)
 * Google Apps Script Web App API Endpoint
 */
const CONFIG = {
  // วาง URL ของ Google Apps Script Web App ที่ Deploy แล้วที่นี่
  // ตัวอย่าง: 'https://script.google.com/macros/s/AKfycbx.../exec'
  DEFAULT_API_URL: '',

  // ดึง API URL จาก LocalStorage หรือค่าเริ่มต้น
  getApiUrl: function() {
    var customUrl = localStorage.getItem('ptn_payroll_api_url');
    return (customUrl && customUrl.trim()) ? customUrl.trim() : this.DEFAULT_API_URL;
  },

  setApiUrl: function(url) {
    if (url) {
      localStorage.setItem('ptn_payroll_api_url', url.trim());
    } else {
      localStorage.removeItem('ptn_payroll_api_url');
    }
  }
};