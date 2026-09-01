const JSON_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store'
};

const TELEGRAM_WORKER_API = 'https://mbbsadmissionguide-in.wahidiqubal9.workers.dev/api/lead';
const TELEGRAM_TOKEN_PATTERN = /\b\d{8,12}:[A-Za-z0-9_-]{20,}\b/g;

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: JSON_HEADERS });
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);
}

const SECURE_LEAD_SCRIPT = `
<script>
(function () {
  const API = '${TELEGRAM_WORKER_API}';

  window.submitLead = async function (e) {
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
      const response = await fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(details),
        credentials: 'omit'
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok) {
        throw new Error(data.error || 'Unable to send your request right now.');
      }

      if (typeof window.showLeadSuccess === 'function') {
        window.showLeadSuccess();
      } else {
        const card = document.getElementById('leadForm');
        if (card) {
          card.innerHTML = '<div class="success-box"><div class="success-icon">✓</div><h3 class="serif">Thank you.</h3><p>Your request has been received.<br/>A doctor-founder will call you within <b>15 minutes</b>.</p></div>';
        }
      }
    } catch (error) {
      if (btn) {
        btn.disabled = false;
        btn.style.opacity = '1';
        btn.innerHTML = originalHTML;
      }
      if (typeof window.showLeadError === 'function') {
        window.showLeadError(details, error.message);
      } else {
        alert('Unable to send your request right now.');
      }
    }
  };
})();
</script>`;

class TokenScrubber {
  constructor() {
    this.buffer = '';
  }

  element(element) {
    this.buffer = '';
  }

  text(text) {
    this.buffer += text.text;
    if (!text.lastInTextNode) {
      text.remove();
      return;
    }

    text.replace(this.buffer.replace(TELEGRAM_TOKEN_PATTERN, '[revoked-token-removed]'));
    this.buffer = '';
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/api/lead') {
      if (request.method !== 'POST') return json({ ok: false, error: 'Method not allowed' }, 405);

      const origin = request.headers.get('Origin');
      if (origin) {
        try {
          if (new URL(origin).host !== url.host) return json({ ok: false, error: 'Forbidden' }, 403);
        } catch {
          return json({ ok: false, error: 'Forbidden' }, 403);
        }
      }

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

    const response = await env.ASSETS.fetch(request);
    const contentType = response.headers.get('content-type') || '';

    if (!contentType.toLowerCase().includes('text/html')) {
      return response;
    }

    return new HTMLRewriter()
      .on('script', new TokenScrubber())
      .on('body', {
        element(element) {
          element.append(SECURE_LEAD_SCRIPT, { html: true });
        }
      })
      .transform(response);
  }
};
