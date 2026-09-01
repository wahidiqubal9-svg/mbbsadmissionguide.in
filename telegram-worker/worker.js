const JSON_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store'
};

const ALLOWED_ORIGINS = new Set([
  'https://mbbsadmissionguide.in',
  'https://www.mbbsadmissionguide.in'
]);

const ALLOWED_NEET = new Set(['Qualified', 'Appearing 2026', 'Not Appeared']);
const ALLOWED_COUNTRIES = new Set([
  'Russia',
  'Georgia',
  'Kazakhstan',
  'Uzbekistan',
  'Philippines',
  'Kyrgyzstan',
  'Not Sure'
]);
const ALLOWED_BUDGETS = new Set([
  'Under 3 Lakh',
  '3 – 5 Lakh',
  '5 – 8 Lakh',
  'Above 8 Lakh'
]);

function json(data, status = 200, origin = null) {
  const headers = new Headers(JSON_HEADERS);
  if (origin) {
    headers.set('Access-Control-Allow-Origin', origin);
    headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    headers.set('Access-Control-Allow-Headers', 'Content-Type');
    headers.set('Access-Control-Max-Age', '86400');
    headers.set('Vary', 'Origin');
  }
  return new Response(JSON.stringify(data), { status, headers });
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[char]);
}

function getAllowedOrigin(request) {
  const origin = request.headers.get('Origin');
  if (!origin) return null;
  try {
    return ALLOWED_ORIGINS.has(new URL(origin).origin) ? new URL(origin).origin : false;
  } catch {
    return false;
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname !== '/api/lead') {
      return json({ ok: false, error: 'Not found' }, 404);
    }

    const origin = getAllowedOrigin(request);

    if (request.method === 'OPTIONS') {
      if (origin === false) return json({ ok: false, error: 'Forbidden' }, 403);
      return new Response(null, {
        status: 204,
        headers: {
          ...Object.fromEntries(Object.entries(JSON_HEADERS)),
          ...(origin ? {
            'Access-Control-Allow-Origin': origin,
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Access-Control-Max-Age': '86400',
            'Vary': 'Origin'
          } : {})
        }
      });
    }

    if (request.method !== 'POST') {
      return json({ ok: false, error: 'Method not allowed' }, 405, origin || null);
    }

    if (origin === false) {
      return json({ ok: false, error: 'Forbidden' }, 403);
    }

    const contentType = request.headers.get('Content-Type') || '';
    if (!contentType.toLowerCase().includes('application/json')) {
      return json({ ok: false, error: 'Invalid request' }, 415, origin || null);
    }

    let lead;
    try {
      lead = await request.json();
    } catch {
      return json({ ok: false, error: 'Invalid request' }, 400, origin || null);
    }

    if (String(lead?.website || '').trim()) {
      return json({ ok: true }, 200, origin || null);
    }

    const name = String(lead?.name || '').trim();
    const phone = String(lead?.phone || '').trim();
    const neet = String(lead?.neet || '').trim();
    const country = String(lead?.country || '').trim();
    const budget = String(lead?.budget || '').trim();

    if (
      !name || name.length > 100 ||
      !/^[0-9]{10}$/.test(phone) ||
      !ALLOWED_NEET.has(neet) ||
      !ALLOWED_COUNTRIES.has(country) ||
      !ALLOWED_BUDGETS.has(budget)
    ) {
      return json({ ok: false, error: 'Please check your details and try again.' }, 400, origin || null);
    }

    const botToken = env.TELEGRAM_BOT_TOKEN;
    const chatId = env.TELEGRAM_CHAT_ID;

    if (!botToken || !chatId) {
      console.error('Telegram secrets are not configured');
      return json({ ok: false, error: 'Service is temporarily unavailable.' }, 500, origin || null);
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
      `🕒 ${new Date().toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata',
        dateStyle: 'medium',
        timeStyle: 'short'
      })} IST`,
      '📍 Source: mbbsadmissionguide.in'
    ].join('\n');

    try {
      const telegramResponse = await fetch(
        `https://api.telegram.org/bot${botToken}/sendMessage`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: message,
            parse_mode: 'HTML',
            disable_web_page_preview: true
          })
        }
      );

      const telegramData = await telegramResponse.json().catch(() => ({}));

      if (!telegramResponse.ok || !telegramData.ok) {
        console.error(
          'Telegram API error:',
          telegramData?.description || telegramResponse.status
        );
        return json({ ok: false, error: 'Unable to send your request right now.' }, 502, origin || null);
      }

      return json({ ok: true }, 200, origin || null);
    } catch (error) {
      console.error('Telegram request failed:', error);
      return json({ ok: false, error: 'Unable to send your request right now.' }, 502, origin || null);
    }
  }
};
