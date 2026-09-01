const JSON_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store'
};

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

const LEAD_SCRIPT = `
<script>
(function () {
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
      budget: document.getElementById('leadBudget')?.value || ''
    };

    try {
      const response = await fetch('/api/lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(details)
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok) {
        throw new Error(data.error || 'Unable to send your request right now.');
      }

      if (typeof window.showLeadSuccess === 'function') {
        window.showLeadSuccess();
      } else {
        const form = document.getElementById('leadForm');
        if (form) {
          form.innerHTML = '<div class="success-box"><div class="success-icon">✓</div><h3 class="serif">Thank you.</h3><p>Your request has been received.<br/>A doctor-founder will call you within <b>15 minutes</b>.</p></div>';
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
        alert(error.message);
      }
    }
  }

  window.submitLead = submitLead;
})();
</script>`;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/api/lead') {
      if (request.method === 'OPTIONS') {
        return new Response(null, {
          status: 204,
          headers: {
            'Access-Control-Allow-Origin': url.origin,
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type'
          }
        });
      }

      if (request.method !== 'POST') {
        return json({ ok: false, error: 'Method not allowed' }, 405);
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
        !neet || neet.length > 50 ||
        !country || country.length > 50 ||
        !budget || budget.length > 50
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
    if (!contentType.includes('text/html')) {
      return response;
    }

    return new HTMLRewriter()
      .on('body', {
        element(element) {
          element.append(LEAD_SCRIPT, { html: true });
        }
      })
      .transform(response);
  }
};
