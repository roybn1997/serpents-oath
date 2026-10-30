const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1100, height: 700 } });
  const errs = []; p.on('pageerror', (e) => errs.push(String(e))); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto('http://localhost:8799/trtest.html'); await p.waitForFunction(() => window.T?.chat);
  const ok = (c, m) => console.log(c ? 'ok' : 'FAIL', m);
  // setting off by default: button says Off, list hidden
  ok(await p.textContent('[data-a=translate]') === 'Spontaneous translation: Off', 'off by default');
  ok(await p.isHidden('.trpick'), 'list hidden when off');
  await p.click('[data-a=translate]'); await p.selectOption('select[name=trlang]', 'he');
  ok(await p.isVisible('.trpick'), 'list shows when on');
  await p.screenshot({ path: process.argv[2] + '/settings.png', clip: { x: 640, y: 0, width: 460, height: 260 } });
  const rpcs = await p.evaluate(() => T.rpcs.filter((r) => r[0] === 'set_translate_lang').map((r) => r[1].p_lang));
  ok(rpcs.join() === ',en,he', 'server told: initial null, on(en), he -> ' + rpcs.join());
  // someone writes in Spanish, then the translation comes
  await p.evaluate(() => T.emit('chat:global', { id: 'm1', c: 'p2', n: 'Juan', text: 'hola a todos', at: 5 }, 'msg'));
  await p.evaluate(() => T.emit('chat:global', { id: 'm1', src: 'es', tr: { he: 'שלום לכולם', fr: 'salut' } }, 'tr'));
  const x = await p.evaluate(() => [...document.querySelectorAll('.rt-x')].map((e) => e.textContent));
  ok(x.includes('שלום לכולם'), 'line swapped to Hebrew: ' + x.join(' | '));
  ok(await p.evaluate(() => T.said.some((s) => s[0] === 'p2' && s[1] === 'שלום לכולם')), 'bubble updated');
  // translation arriving before the line
  await p.evaluate(() => T.emit('chat:global', { id: 'm2', src: 'en', tr: { he: 'מה שלומך' } }, 'tr'));
  await p.evaluate(() => T.emit('chat:global', { id: 'm2', c: 'p3', n: 'Ann', text: 'how are you', at: 6 }, 'msg'));
  ok(await p.evaluate(() => [...document.querySelectorAll('.rt-x')].some((e) => e.textContent === 'מה שלומך')), 'early translation applied');
  // a whisper
  await p.evaluate(() => T.emit('player:me', { id: 'w1', c: 'p2', n: 'Juan', text: 'gracias', at: 7 }, 'whisper'));
  await p.evaluate(() => T.emit('player:me', { id: 'w1', src: 'es', tr: { he: 'תודה' } }, 'tr'));
  ok(await p.evaluate(() => [...document.querySelectorAll('.wh .rt-x')].some((e) => e.textContent === 'תודה')), 'whisper translated');
  // signed (player-made) tr is ignored
  await p.evaluate(() => T.emit('chat:global', { id: 'm3', c: 'p2', n: 'Juan', text: 'real', at: 8 }, 'msg'));
  await p.evaluate(() => { for (const fn of T.subs.get('chat:global')) fn({ id: 'm3', src: 'en', tr: { he: 'FAKE' } }, { event: 'tr', signed: true }); });
  ok(!(await p.evaluate(() => document.body.textContent.includes('FAKE'))), 'signed tr ignored');
  // I send: chat_send then the edge function with the id only
  await p.evaluate(() => document.activeElement.blur());
  await p.keyboard.press('Enter'); await p.keyboard.type('שלום לכולם'); await p.keyboard.press('Enter');
  await p.waitForTimeout(300);
  const f = await p.evaluate(() => T.fetches);
  ok(f.length === 1 && f[0][0].endsWith('/functions/v1/chat-translate') && f[0][1] === '{"id":"mine-1"}', 'edge called with id only ' + JSON.stringify(f));
  await p.evaluate(() => T.emit('chat:global', { id: 'mine-1', c: 'me', n: 'Roy', text: 'שלום לכולם', at: 9 }, 'msg'));
  // open the chat and click the translated line: original
  await p.keyboard.press('Enter');
  await p.click('.rt-x.tr >> nth=0');
  ok(await p.evaluate(() => [...document.querySelectorAll('.rt-x')].some((e) => e.textContent === 'hola a todos')), 'click shows original');
  await p.screenshot({ path: process.argv[2] + '/chat.png', clip: { x: 0, y: 300, width: 520, height: 400 } });
  await p.click('.rt-x.tr >> nth=0');
  ok(await p.evaluate(() => [...document.querySelectorAll('.rt-x')].some((e) => e.textContent === 'שלום לכולם' && e.dataset.tr === '1')), 'click again: translation');
  // turned off: a new tr does nothing
  await p.evaluate(() => T.setTranslatePref({ on: false, lang: 'he' }));
  await p.evaluate(() => { T.emit('chat:global', { id: 'm4', c: 'p2', n: 'Juan', text: 'adios', at: 10 }, 'msg'); T.emit('chat:global', { id: 'm4', src: 'es', tr: { he: 'להתראות' } }, 'tr'); });
  ok(!(await p.evaluate(() => document.body.textContent.includes('להתראות'))), 'off: no swap');
  ok(errs.length === 0, 'no page errors ' + errs.join(';'));
  await b.close();
})();
