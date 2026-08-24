export async function onRequest(context) {
  const { request, env } = context;

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    let targetUrl = '';
    let payload = {};
    const url = new URL(request.url);

    if (request.method === 'POST') {
      const data = await request.json();
      targetUrl = data.apiUrl || url.searchParams.get('apiUrl') || env.GAS_API_URL || '';
      payload = data.payload || data;
      if (payload.apiUrl) delete payload.apiUrl;
    } else {
      targetUrl = url.searchParams.get('apiUrl') || env.GAS_API_URL || '';
      const action = url.searchParams.get('action') || 'getAppInitialData';
      const period = url.searchParams.get('period') || '';
      payload = { action, period };
    }

    if (!targetUrl) {
      return new Response(JSON.stringify({ 
        success: false, 
        message: 'กรุณาระบุ Google Apps Script Web App URL ในหน้าต่าง "ตั้งค่า API"' 
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    targetUrl = targetUrl.trim();
    const action = payload.action || 'getAppInitialData';
    const period = payload.period || '';

    // Append action to URL query params so that if Google redirects 302 -> GET, doGet will still return JSON
    const cleanUrl = targetUrl.replace(/\/+$/, '');
    const sep = cleanUrl.indexOf('?') >= 0 ? '&' : '?';
    const gasFullUrl = `${cleanUrl}${sep}action=${encodeURIComponent(action)}&period=${encodeURIComponent(period)}&api=1`;

    // Server-to-server request to Google Apps Script
    const gasResponse = await fetch(gasFullUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
      redirect: 'follow'
    });

    const responseText = await gasResponse.text();
    let responseData;
    try {
      responseData = JSON.parse(responseText);
    } catch (parseError) {
      // If response is HTML, check if it is Google Sign-in or Script Error
      const isGoogleLogin = responseText.includes('ServiceLogin') || responseText.includes('accounts.google.com');
      const isHtmlPage = responseText.includes('<!DOCTYPE html>') || responseText.includes('<html');

      if (isGoogleLogin) {
        return new Response(JSON.stringify({
          success: false,
          message: 'Google Apps Script ติดสิทธิ์ล็อกอิน: กรุณาไปที่ Google Apps Script > Deploy > New deployment > เลือก "Who has access" เป็น "Anyone (ทุกคน)" เท่านั้น'
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      if (isHtmlPage) {
        // Try fallback GET directly with action
        try {
          const fallbackRes = await fetch(gasFullUrl, { method: 'GET', redirect: 'follow' });
          const fallbackText = await fallbackRes.text();
          const fallbackData = JSON.parse(fallbackText);
          return new Response(JSON.stringify(fallbackData), {
            status: 200,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });
        } catch (e2) {
          return new Response(JSON.stringify({
            success: false,
            message: 'กรุณาอัปเดตโค้ดใน Code.gs ให้เป็นเวอร์ชันล่าสุด แล้วกด Deploy > New version อีกครั้ง'
          }), {
            status: 200,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });
        }
      }

      return new Response(JSON.stringify({
        success: false,
        message: 'Google Apps Script Response Error: ' + responseText.substring(0, 200)
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    return new Response(JSON.stringify(responseData), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  } catch (err) {
    return new Response(JSON.stringify({ 
      success: false, 
      message: 'Proxy Error: ' + err.message 
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}