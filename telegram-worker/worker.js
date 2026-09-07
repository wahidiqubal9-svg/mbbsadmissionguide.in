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

function clean(value, max = 200) {
  return String(value ?? '').trim().slice(0, max);
}

/* Friendly labels for common form fields. Any field that is not listed
   here is still shown in the Telegram message, just with its own name. */
const FIELD_LABELS = {
  'name':        '👤 Name',
  'phone':       '📱 Phone',
  'neet':        '📝 NEET Status',
  'indiapath':   '🛣️ Admission Route',
  'neetscore':   '📊 NEET Score',
  'country':     '🌏 Country',
  'state':       '📍 State',
  'city':        '🏙️ City',
  'budget':      '💰 Budget',
  'college':     '🏥 College',
  'university':  '🎓 University',
  'course':      '📚 Course',
  'message':     '💬 Message',
  'note':        '💬 Note',
  'comment':     '💬 Comment',
};

/* Fields that are used for routing/headers, never printed as their own line. */
const META_KEYS = new Set(['path', 'form', 'source', 'website']);

function formatKey(key) {
  return String(key).replace(/[_-]+/g, ' ');
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    if (url.pathname === '/api/lead') {
      if (request.method !== 'POST') return json({ ok: false, error: 'Method not allowed' }, 405);

      let lead;
      try { lead = await request.json(); }
      catch { return json({ ok: false, error: 'Invalid request' }, 400); }

      // Honeypot - silently accept bots
      if (clean(lead?.website)) return json({ ok: true });

      const name  = clean(lead?.name, 100);
      const phone = clean(lead?.phone, 20);
      const path  = clean(lead?.path).toLowerCase() === 'india' ? 'india' : 'abroad';

      // Only real humans with a name + 10-digit mobile are forwarded.
      if (!name) return json({ ok: false, error: 'Please enter your name.' }, 400);
      if (!/^[0-9]{10}$/.test(phone)) {
        return json({ ok: false, error: 'Please enter a valid 10-digit mobile number.' }, 400);
      }

      // Build the message: every filled-in field becomes one line.
      const lines = [];
      for (const [key, raw] of Object.entries(lead)) {
        const value = clean(raw);
        if (!value) continue;
        const lk = key.toLowerCase();
        if (META_KEYS.has(lk)) continue;
        const label = FIELD_LABELS[lk];
        if (label) {
          lines.push(`<b>${label}:</b> ${escapeHtml(value)}`);
        } else {
          const shown = formatKey(key);
          lines.push(`<b>${escapeHtml(shown.charAt(0).toUpperCase() + shown.slice(1))}:</b> ${escapeHtml(value)}`);
        }
      }

      if (!lines.length) return json({ ok: false, error: 'Please fill in your details.' }, 400);

      let heading;
      if (path === 'india') heading = '🇮🇳 <b>New India Lead</b>';
      else if (clean(lead.country)) heading = '🌍 <b>New Abroad Lead</b>';
      else heading = '🔔 <b>New Lead</b>';
      const formName = clean(lead.form) || clean(lead.source);
      if (formName) heading += ` · ${escapeHtml(formName)}`;

      const timestamp = new Date().toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short'
      });

      const message = [
        heading,
        '━━━━━━━━━━━━━━━━━━',
        ...lines,
        '━━━━━━━━━━━━━━━━━━',
        `🕒 ${timestamp} IST`,
        '📍 Source: mbbsadmissionguide.in',
        '',
        `<a href="tel:+91${phone}">📞 Call Now</a> · <a href="https://wa.me/91${phone}">💬 WhatsApp</a>`
      ].join('\n');

      const botToken = env.TELEGRAM_BOT_TOKEN;
      const chatId = env.TELEGRAM_CHAT_ID;
      if (!botToken || !chatId) {
        console.error('Telegram secrets are not configured');
        return json({ ok: false, error: 'Service is temporarily unavailable.' }, 500);
      }

      try {
        const telegramResponse = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: message,
            parse_mode: 'HTML',
            disable_web_page_preview: true
          })
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
