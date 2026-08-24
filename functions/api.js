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
      // remove apiUrl from payload
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

    // Clean URL
    targetUrl = targetUrl.trim();

    // Server-to-server request to Google Apps Script (Follows all 302 redirects with NO CORS limitations)
    const gasResponse = await fetch(targetUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
      redirect: 'follow'
    });

    const responseText = await gasResponse.text();
    let responseData;
    try {
      responseData = JSON.parse(responseText);
    } catch(e) {
      // If GAS returned HTML or text
      return new Response(JSON.stringify({ 
        success: false, 
        message: 'Google Apps Script ส่งข้อมูลกลับมาไม่ถูกต้อง: ' + responseText.substring(0, 300) 
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