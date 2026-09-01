const JSON_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store'
};

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

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...JSON_HEADERS, ...extraHeaders }
  });
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

function securityHeaders(headers) {
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('X-Frame-Options', 'DENY');
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  return headers;
}

const LEAD_SCRIPT = `
<script>
(function () {
  const WHATSAPP_NUMBER = '918942954415';

  function showLeadSuccess() {
    const card = document.getElementById('leadForm');
    if (!card) return;
    card.innerHTML = '<div class="success-box"><div class="success-icon">✓</div><h3 class="serif">Thank you.</h3><p>Your request has been received.<br/>A doctor-founder will call you within <b>15 minutes</b>.</p></div>';
  }

  function showLeadError(details) {
    const form = document.getElementById('leadFormEl');
    if (!form) return;

    let box = document.getElementById('leadErrorBox');
    if (!box) {
      box = document.createElement('div');
      box.id = 'leadErrorBox';
      box.style.cssText = 'background:#FBF1E7;border:1px solid #EBD3AE;color:#6B4A17;border-radius:10px;padding:12px;font-size:12.5px;margin-bottom:10px;line-height:1.6';
      form.prepend(box);
    }

    const waText = encodeURIComponent(
      'Hi, I want MBBS abroad details.\\n' +
      'Name: ' + details.name + '\\n' +
      'Phone: ' + details.phone + '\\n' +
      'NEET: ' + details.neet + '\\n' +
      'Country: ' + details.country + '\\n' +
      'Budget: ' + details.budget
    );

    box.innerHTML = '⚠️ <b>Couldn\'t send just now.</b> Please try again, or reach us instantly:<br/><a href="https://wa.me/' + WHATSAPP_NUMBER + '?text=' + waText + '" target="_blank" rel="noopener" style="color:#0E7C5B;font-weight:700;text-decoration:underline">Continue on WhatsApp →</a>';
  }

  async function submitLead(e) {
    e.preventDefault();

    const btn = document.getElementById('leadSubmitBtn');
    const originalHTML = btn ? btn.innerHTML : '';
    if (btn) {
      btn.disabled = true;
      btn.style.opacity = '.7';
      btn.innerHTML = 'Sending…';
    }

    const details = {
      name: document.getElementById('leadName')?.value.trim() || '',
      phone: document.getElementById('leadPhone')?.value.trim() || '',
      neet: document.getElementById('leadNeet')?.value || '',
      country: document.getElementById('countrySelect')?.value || '',
      budget: document.getElementById('leadBudget')?.value || '',
      website: ''
    };

    try {
      const response = await fetch('/api/lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(details)
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok) {
        throw new Error(data.error || 'Unable to send your request right now.');
      }

      showLeadSuccess();
    } catch (error) {
      if (btn) {
        btn.disabled = false;
        btn.style.opacity = '1';
        btn.innerHTML = originalHTML;
      }
      showLeadError(details);
    }
  }

  window.submitLead = submitLead;
  window.showLeadSuccess = showLeadSuccess;
})();
</script>`;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/api/lead') {
      if (request.method === 'OPTIONS') {
        const headers = new Headers({
          'Access-Control-Allow-Origin': url.origin,
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Max-Age': '86400'
        });
        securityHeaders(headers);
        return new Response(null, { status: 204, headers });
      }

      if (request.method !== 'POST') {
        return json({ ok: false, error: 'Method not allowed' }, 405, {
          Allow: 'POST, OPTIONS'
        });
      }

      const origin = request.headers.get('Origin');
      if (origin && origin !== url.origin) {
        return json({ ok: false, error: 'Forbidden' }, 403);
      }

      const contentType = request.headers.get('Content-Type') || '';
      if (!contentType.toLowerCase().includes('application/json')) {
        return json({ ok: false, error: 'Invalid request' }, 415);
      }

      let lead;
      try {
        lead = await request.json();
      } catch {
        return json({ ok: false, error: 'Invalid request' }, 400);
      }

      if (String(lead?.website || '').trim()) {
        return json({ ok: true });
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
          return json({ ok: false, error: 'Unable to send your request right now.' }, 502);
        }

        return json({ ok: true });
      } catch (error) {
        console.error('Telegram request failed:', error);
        return json({ ok: false, error: 'Unable to send your request right now.' }, 502);
      }
    }

    const response = await env.ASSETS.fetch(request);
    const contentType = response.headers.get('content-type') || '';
    const headers = securityHeaders(new Headers(response.headers));

    if (!contentType.includes('text/html')) {
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers
      });
    }

    return new HTMLRewriter()
      .on('body > script:last-of-type', {
        element(element) {
          element.remove();
        }
      })
      .on('body', {
        element(element) {
          element.append(LEAD_SCRIPT, { html: true });
        }
      })
      .transform(new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers
      }));
  }
};
