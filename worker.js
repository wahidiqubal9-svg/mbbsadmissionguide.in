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
  return String(value ?? '').replace(/[&<>\"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);
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
      if (String(lead?.website || '').trim()) return json({ ok: true });

      // Common fields
      const name  = String(lead?.name || '').trim();
      const phone = String(lead?.phone || '').trim();
      const neet  = String(lead?.neet || '').trim();
      const path  = (String(lead?.path || '').toLowerCase() === 'india') ? 'india' : 'abroad';

      // Common validation
      if (!name || name.length > 100) {
        return json({ ok: false, error: 'Please enter your name.' }, 400);
      }
      if (!/^[0-9]{10}$/.test(phone)) {
        return json({ ok: false, error: 'Please enter a valid 10-digit mobile number.' }, 400);
      }
      if (!neet || neet.length > 50) {
        return json({ ok: false, error: 'Please select your NEET status.' }, 400);
      }

      // Path-specific validation & message building
      let extraLines = [];
      let leadType = '';

      if (path === 'india') {
        const indiaPath = String(lead?.indiaPath || '').trim();
        const neetScore = String(lead?.neetScore || '').trim();

        if (!indiaPath || indiaPath.length > 60) {
          return json({ ok: false, error: 'Please select your preferred India admission route.' }, 400);
        }
        if (!neetScore || neetScore.length > 30) {
          return json({ ok: false, error: 'Please select your NEET score range.' }, 400);
        }

        leadType = '🇮🇳 <b>New India MBBS Lead</b>';
        extraLines = [
          `🛣️ <b>Admission Route:</b> ${escapeHtml(indiaPath)}`,
          `📊 <b>NEET Score:</b> ${escapeHtml(neetScore)}`
        ];
      } else {
        const country = String(lead?.country || '').trim();
        const budget  = String(lead?.budget || '').trim();

        if (!country || country.length > 50) {
          return json({ ok: false, error: 'Please select your preferred country.' }, 400);
        }
        if (!budget || budget.length > 50) {
          return json({ ok: false, error: 'Please select your budget.' }, 400);
        }

        leadType = '🌍 <b>New Abroad MBBS Lead</b>';
        extraLines = [
          `🌏 <b>Country:</b> ${escapeHtml(country)}`,
          `💰 <b>Budget:</b> ${escapeHtml(budget)}`
        ];
      }

      // Telegram secrets
      const botToken = env.TELEGRAM_BOT_TOKEN;
      const chatId = env.TELEGRAM_CHAT_ID;
      if (!botToken || !chatId) {
        console.error('Telegram secrets are not configured');
        return json({ ok: false, error: 'Service is temporarily unavailable.' }, 500);
      }

      // Sanitize phone for links (ensure only digits)
      const sanitizedDigits = phone.replace(/\D/g, '');
      const telLink = sanitizedDigits.length === 10 ? `+91${sanitizedDigits}` : `+91${sanitizedDigits}`;
      const waLink = sanitizedDigits.length === 10 ? `91${sanitizedDigits}` : `91${sanitizedDigits}`;

      const timestamp = new Date().toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short'
      });

      const message = [
        leadType,
        '━━━━━━━━━━━━━━━━━━',
        `👤 <b>Name:</b> ${escapeHtml(name)}`,
        `📱 <b>Phone:</b> <code>${escapeHtml(phone)}</code>`,
        `📝 <b>NEET Status:</b> ${escapeHtml(neet)}`,
        ...extraLines,
        '━━━━━━━━━━━━━━━━━━',
        `🕒 ${timestamp} IST`,
        '📍 Source: mbbsadmissionguide.in',
        '',
        `<a href="tel:${telLink}">📞 Call Now</a> · <a href="https://wa.me/${waLink}">💬 WhatsApp</a>`
      ].join('\n');

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
