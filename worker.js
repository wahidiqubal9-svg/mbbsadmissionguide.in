const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const JSON_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
  ...CORS_HEADERS
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: JSON_HEADERS });
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Handle CORS preflight requests
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    if (url.pathname === '/api/lead') {
      if (request.method !== 'POST') return json({ ok: false, error: 'Method not allowed' }, 405);

      let lead;
      try { lead = await request.json(); }
      catch { return json({ ok: false, error: 'Invalid request' }, 400); }

      if (String(lead?.website || '').trim()) return json({ ok: true });

      const name = String(lead?.name || '').trim();
      const phone = String(lead?.phone || '').trim();
      const neet = String(lead?.neet || '').trim();
      const country = String(lead?.country || '').trim();
      const budget = String(lead?.budget || '').trim();

      if (!name || name.length > 100 || !/^[0-9]{10}$/.test(phone) ||
          !neet || neet.length > 50 || !country || country.length > 50 ||
          !budget || budget.length > 50) {
        return json({ ok: false, error: 'Please check your details and try again.' }, 400);
      }

      const botToken = env.TELEGRAM_BOT_TOKEN;
      const chatId = env.TELEGRAM_CHAT_ID;
      if (!botToken || !chatId) {
        console.error('Telegram secrets are not configured');
        return json({ ok: false, error: 'Service is temporarily unavailable.' }, 500);
      }

      const message = [
        '🎓 <b>New MBBS Abroad Lead</b>',
        '━━━━━━━━━━━━━━━━━━',
        `👤 <b>Name:</b> ${escapeHtml(name)}`,
        `📱 <b>Phone:</b> ${escapeHtml(phone)}`,
        `📝 <b>NEET:</b> ${escapeHtml(neet)}`,
        `🌍 <b>Country:</b> ${escapeHtml(country)}`,
        `💰 <b>Budget:</b> ${escapeHtml(budget)}`,
        '━━━━━━━━━━━━━━━━━━',
        `🕒 ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' })} IST`,
        '📍 Source: mbbsadmissionguide.in'
      ].join('\n');

      try {
        const telegramResponse = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: chatId, text: message, parse_mode: 'HTML', disable_web_page_preview: true })
        });
        const telegramData = await telegramResponse.json().catch(() => ({}));
        if (!telegramResponse.ok || !telegramData.ok) {
          console.error('Telegram API error:', telegramData?.description || telegramResponse.status);
          return json({ ok: false, error: 'Unable to send your request right now.' }, 502);
        }
        return json({ ok: true });
      } catch (error) {
        console.error('Telegram request failed:', error);
        return json({ ok: false, error: 'Unable to send your request right now.' }, 502);
      }
    }

    if (url.pathname.startsWith('/api/')) return json({ ok: false, error: 'Not found' }, 404);

    return env.ASSETS.fetch(request);
  }
};
