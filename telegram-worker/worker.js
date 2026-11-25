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
  'page':        '🔗 Page',
};

const META_KEYS = new Set([
  'path', 'form', 'source', 'website', 'submit_ms',
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term',
  'gclid', 'fbclid', 'referrer', 'landing'
]);

function formatKey(key) {
  return String(key).replace(/[_-]+/g, ' ');
}

function scoreLead(lead) {
  let s = 0;
  if (lead.neet === 'Qualified') s += 35;
  else if (lead.neet === 'Appearing 2026') s += 20;
  const path = clean(lead.path).toLowerCase();
  if (path === 'abroad') s += 25;
  else s += 15;
  if (['NRI Quota', 'Deemed University', 'Private College'].includes(clean(lead.indiaPath || lead.indiapath))) s += 10;
  if (['3 - 5 Lakh', '5 - 8 Lakh', 'Above 8 Lakh'].includes(clean(lead.budget))) s += 20;
  if (['Russia', 'Georgia', 'Kazakhstan', 'Uzbekistan'].includes(clean(lead.country))) s += 5;
  if (/^[6-9][0-9]{9}$/.test(clean(lead.phone))) s += 10;
  return Math.min(s, 100);
}

async function safeDb(env, sql, ...args) {
  if (!env.DB) return null;
  try {
    return await env.DB.prepare(sql).bind(...args).first();
  } catch (error) {
    console.error('D1 error:', error);
    return null;
  }
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    if (url.pathname === '/api/lead') {
      if (request.method !== 'POST') return json({ ok: false, error: 'Method not allowed' }, 405);

      let lead;
      try { lead = await request.json(); }
      catch { return json({ ok: false, error: 'Invalid request' }, 400); }

      if (clean(lead?.website)) return json({ ok: true });

      const name  = clean(lead?.name, 100);
      const phone = clean(lead?.phone, 20).replace(/\D/g, '').slice(-10);
      const path  = clean(lead?.path).toLowerCase() === 'india' ? 'india' : 'abroad';

      if (!name) return json({ ok: false, error: 'Please enter your name.' }, 400);
      if (!/^[6-9][0-9]{9}$/.test(phone)) {
        return json({ ok: false, error: 'Please enter a valid 10-digit mobile number.' }, 400);
      }
      if (Number(lead.submit_ms) > 0 && Number(lead.submit_ms) < 1200) {
        return json({ ok: true, fast: true });
      }

      // duplicate guard: same phone in last 12h
      let isDup = false;
      if (env.RL) {
        try {
          const seen = await env.RL.get(`p:${phone}`);
          isDup = Boolean(seen);
          await env.RL.put(`p:${phone}`, '1', { expirationTtl: 43200 });
        } catch (error) { console.error('KV error:', error); }
      }

      const lines = [];
      for (const [key, raw] of Object.entries(lead)) {
        const value = clean(raw, 500);
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

      const score = scoreLead(lead);
      const badge = score >= 70 ? '🔥' : score >= 45 ? '🟡' : '⚪';

      const utm = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term']
        .map((k) => clean(lead[k], 120)).filter(Boolean);
      const source = utm.length ? utm.join(' / ') : (clean(lead.gclid) ? 'google-ads' : clean(lead.referrer, 200) || 'direct');

      let heading;
      if (path === 'india') heading = '🇮🇳 <b>New India Lead</b>';
      else if (clean(lead.country)) heading = '🌍 <b>New Abroad Lead</b>';
      else heading = '🔔 <b>New Lead</b>';
      const formName = clean(lead.form) || clean(lead.source);
      if (formName) heading += ` · ${escapeHtml(formName)}`;

      const timestamp = new Date().toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short'
      });

      const saved = env.DB
        ? await safeDb(env,
          `INSERT INTO leads (name,phone,neet,path,state,india_path,neet_score,country,budget,note,
             utm_source,utm_medium,utm_campaign,landing,referrer,gclid,ip_country,ua,score)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) RETURNING id`,
          name, phone, clean(lead.neet, 40), path, clean(lead.state, 60), clean(lead.indiaPath || lead.indiapath, 40),
          clean(lead.neetScore || lead.neetscore, 30), clean(lead.country, 40), clean(lead.budget, 30),
          clean(lead.note || lead.message, 500), clean(lead.utm_source, 120), clean(lead.utm_medium, 120),
          clean(lead.utm_campaign, 160), clean(lead.landing || lead.page, 300), clean(lead.referrer, 300),
          clean(lead.gclid, 200), request.cf?.country || '', clean(request.headers.get('User-Agent'), 300), score)
        : null;

      const idTag = saved?.id ? ` #${saved.id}` : '';
      const waText = encodeURIComponent('Hi ' + name.split(' ')[0] + ', doctor here from MBBS Admission Guide. You asked for free counseling — what is your NEET score and state?');
      const waLink = `https://wa.me/91${phone}?text=${waText}`;

      const message = [
        `${badge} <b>NEW LEAD${idTag}</b> · score ${score}${isDup ? ' · ⚠️ REPEAT' : ''}`,
        '━━━━━━━━━━━━━━━━━━',
        ...lines,
        '━━━━━━━━━━━━━━━━━━',
        `🌐 ${escapeHtml(source)}`,
        clean(lead.page) ? `🔗 ${escapeHtml(clean(lead.page, 300))}` : '',
        `🕒 ${timestamp} IST`,
        '',
        `<a href="tel:+91${phone}">📞 Call Now</a> · <a href="${waLink}">💬 WhatsApp</a>`
      ].filter(Boolean).join('\n');

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
            disable_web_page_preview: true,
            reply_markup: {
              inline_keyboard: [[{ text: '💬 WhatsApp', url: waLink }]]
            }
          })
        });
        const telegramData = await telegramResponse.json().catch(() => ({}));

        if (!telegramResponse.ok || !telegramData.ok) {
          console.error('Telegram API error:', telegramData?.description || telegramResponse.status);
          // retry plain: markup or parse_mode problems must never lose a lead
          const plain = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: chatId, text: message.replace(/<a href="([^"]+)">([^<]*)<\/a>/g, '$2 $1').replace(/<[^>]+>/g, ''), disable_web_page_preview: true })
          }).catch(() => null);
          if (!plain || !plain.ok) {
            return json({ ok: false, error: 'Unable to send your request right now.' }, 502);
          }
        }
        return json({ ok: true, score, dup: isDup, id: saved?.id || null });
      } catch (error) {
        console.error('Telegram request failed:', error);
        return json({ ok: false, error: 'Unable to send your request right now.' }, 502);
      }
    }

    // first-party pageview beacon: POST /api/hit {p:"/path",r:"ref"}
    if (url.pathname === '/api/hit') {
      if (request.method === 'POST' && env.RL) {
        ctx.waitUntil((async () => {
          try {
            const body = await request.clone().json().catch(() => ({}));
            const p = clean(body.p, 200) || '/';
            const day = new Date().toISOString().slice(0, 10);
            const key = `v:${day}:${p}`;
            const n = parseInt((await env.RL.get(key)) || '0', 10);
            await env.RL.put(key, String(n + 1), { expirationTtl: 2592000 });
            const tot = `v:${day}:__total`;
            const t = parseInt((await env.RL.get(tot)) || '0', 10);
            await env.RL.put(tot, String(t + 1), { expirationTtl: 2592000 });
          } catch (error) { /* beacon must never fail loudly */ }
        })());
      }
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    // admin: GET /api/leads?key=... (&format=csv)
    if (url.pathname === '/api/leads') {
      if (url.searchParams.get('key') !== env.ADMIN_KEY) return json({ ok: false, error: 'auth' }, 401);
      if (!env.DB) return json({ ok: false, error: 'DB not bound' }, 503);
      const rows = (await env.DB.prepare('SELECT * FROM leads ORDER BY created_at DESC LIMIT 300').all()).results || [];
      if (url.searchParams.get('format') === 'csv') {
        if (!rows.length) return new Response('', { headers: { 'Content-Type': 'text/csv' } });
        const cols = Object.keys(rows[0]);
        const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
        const csv = [cols.join(','), ...rows.map((o) => cols.map((c) => esc(o[c])).join(','))].join('\n');
        return new Response(csv, { headers: { 'Content-Type': 'text/csv', 'Content-Disposition': 'attachment; filename=leads.csv' } });
      }
      return json({ ok: true, count: rows.length, leads: rows });
    }

    // admin: GET /api/stats?key=...
    if (url.pathname === '/api/stats') {
      if (url.searchParams.get('key') !== env.ADMIN_KEY) return json({ ok: false, error: 'auth' }, 401);
      if (!env.RL) return json({ ok: false, error: 'KV not bound' }, 503);
      const day = new Date().toISOString().slice(0, 10);
      const list = await env.RL.list({ prefix: `v:${day}:`, limit: 200 });
      const pages = list.keys.filter((k) => !k.name.endsWith('__total')).map((k) => ({ p: k.name.replace(`v:${day}:`, ''), n: 0 }));
      for (const page of pages) page.n = parseInt((await env.RL.get(`v:${day}:${page.p}`)) || '0', 10);
      const total = parseInt((await env.RL.get(`v:${day}:__total`)) || '0', 10);
      pages.sort((a, b) => b.n - a.n);
      const leads = env.DB ? await safeDb(env, 'SELECT count(*) n FROM leads WHERE created_at > datetime(\'now\',\'-1 day\')') : null;
      return json({ ok: true, day, views: total, pages: pages.slice(0, 40), leads24h: leads?.n ?? null });
    }

    // admin: POST /api/status?key= {"id":1,"status":"called"}
    if (url.pathname === '/api/status') {
      if (request.method !== 'POST') return json({ ok: false, error: 'Method not allowed' }, 405);
      if (url.searchParams.get('key') !== env.ADMIN_KEY) return json({ ok: false, error: 'auth' }, 401);
      if (!env.DB) return json({ ok: false, error: 'DB not bound' }, 503);
      const body = await request.json().catch(() => ({}));
      const allowed = ['new', 'called', 'quoted', 'won', 'lost', 'fake'];
      if (!allowed.includes(body.status)) return json({ ok: false, error: 'bad status' }, 400);
      await env.DB.prepare(
        `UPDATE leads SET status=?,
           called_at=CASE WHEN ?='called' THEN datetime('now') ELSE called_at END,
           closed_won=CASE WHEN ?='won' THEN 1 ELSE closed_won END,
           closed_at=CASE WHEN ? IN ('won','lost','fake') THEN datetime('now') ELSE closed_at END
         WHERE id=?`
      ).bind(body.status, body.status, body.status, body.status, body.id).run();
      return json({ ok: true });
    }

    if (url.pathname.startsWith('/api/')) return json({ ok: false, error: 'Not found' }, 404);

    return json({ ok: false, error: 'Not found' }, 404);
  },

  // 09:00 IST digest
  async scheduled(_event, env, ctx) {
    ctx.waitUntil((async () => {
      if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) return;
      const row = env.DB
        ? await safeDb(env, "SELECT count(*) n, sum(closed_won) won, sum(CASE WHEN status='new' THEN 1 ELSE 0 END) pending FROM leads WHERE created_at > datetime('now','-1 day')")
        : null;
      const text = row
        ? `📊 24h: ${row.n || 0} leads · ${row.won || 0} won · ${row.pending || 0} untouched`
        : '📊 Digest: DB not bound';
      await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: env.TELEGRAM_CHAT_ID, text })
      }).catch(() => {});
    })());
  }
};
