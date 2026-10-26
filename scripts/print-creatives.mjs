// Patient-facing creatives in Malayalam, written for older readers: large type, strong contrast, few colours,
// warm food illustrations, no fear. Writes PNG (WhatsApp / social) and PDF (clinic print) files.
// Usage: ANNAM_TOUR_FONTS_CSS=fonts-inline.css node scripts/print-creatives.mjs [out-dir]
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from '@playwright/test';

const OUT = process.argv[2] ?? '.data/creatives';
const FONTS = process.env.ANNAM_TOUR_FONTS_CSS ? readFileSync(process.env.ANNAM_TOUR_FONTS_CSS, 'utf8') : '';
const BRAND = 'Annam by Medinn · RM Clinic · Good Food Guru';
const C = { ink: '#1B2B22', green: '#2E6B47', deep: '#1F4D36', cream: '#FFF8EA', sand: '#F6E7C8', saffron: '#E3A03A', leaf: '#7DB06B', chilli: '#D8553F' };

const BASE = `${FONTS}
* { box-sizing: border-box; margin: 0; }
body { font-family: 'Noto Sans Malayalam', 'Hanken Grotesk', sans-serif; color: ${C.ink}; background: ${C.cream}; line-height: 1.45; -webkit-font-smoothing: antialiased; }
.serif { font-family: 'Noto Serif Malayalam', serif; }
.en { font-family: 'Hanken Grotesk', sans-serif; }
.brand { font-family: 'Hanken Grotesk', sans-serif; font-weight: 600; color: ${C.deep}; opacity: .85; }
`;

// ---- illustrations -------------------------------------------------------------------------------------------
const leaf = (x, y, r, c = C.leaf) => `<ellipse cx="${x}" cy="${y}" rx="${r}" ry="${r * 0.45}" transform="rotate(${(x * 7 + y * 3) % 180} ${x} ${y})" fill="${c}"/>`;
const dots = (cx, cy, n, spread, r, fill) => Array.from({ length: n }, (_, i) => { const a = i * 2.4, d = spread * Math.sqrt((i + 1) / n); return `<circle cx="${(cx + Math.cos(a) * d).toFixed(1)}" cy="${(cy + Math.sin(a) * d).toFixed(1)}" r="${r}" fill="${fill}"/>`; }).join('');

/** A Kerala meal seen from above: rice, thoran, fish curry, sambar, pappadam. */
const mealSvg = (size = 520) => `<svg width="${size}" height="${size}" viewBox="0 0 400 400" role="img" aria-label="ഒരു കേരളീയ ഭക്ഷണത്തിന്റെ ചിത്രം">
<ellipse cx="200" cy="372" rx="150" ry="14" fill="#000" opacity=".08"/>
<circle cx="200" cy="196" r="184" fill="#F1F1EE"/><circle cx="200" cy="196" r="184" fill="none" stroke="#CFCFC8" stroke-width="3"/>
<circle cx="200" cy="196" r="160" fill="#FFFFFF" stroke="#E2E2DC" stroke-width="2"/>
<g><circle cx="150" cy="170" r="66" fill="#FBFAF4"/>${dots(150, 170, 46, 56, 3.2, '#EDE7D4')}<ellipse cx="132" cy="148" rx="22" ry="12" fill="#fff" opacity=".7"/></g>
<g><circle cx="262" cy="128" r="48" fill="#5E9A55"/>${dots(262, 128, 26, 40, 5, '#7DB06B')}${dots(262, 128, 12, 38, 3, '#F7F3E4')}${dots(262, 128, 5, 30, 3.2, '#D8553F')}</g>
<g><circle cx="280" cy="236" r="40" fill="#fff" stroke="#E2D4B8" stroke-width="3"/><circle cx="280" cy="236" r="32" fill="#D8742F"/><circle cx="280" cy="236" r="32" fill="url(#cur)"/>
<ellipse cx="278" cy="238" rx="18" ry="8" transform="rotate(-20 278 238)" fill="#F2B48A"/><circle cx="289" cy="233" r="2.2" fill="#6B2A12"/>${dots(280, 236, 6, 26, 2.4, '#B5381F')}</g>
<g><circle cx="168" cy="282" r="40" fill="#fff" stroke="#E2D4B8" stroke-width="3"/><circle cx="168" cy="282" r="32" fill="#E3A03A"/>${dots(168, 282, 10, 24, 4, '#C9822A')}${dots(168, 282, 6, 22, 3, '#7DB06B')}</g>
<g><circle cx="236" cy="306" r="30" fill="#E4C48A"/><circle cx="236" cy="306" r="30" fill="none" stroke="#CFA864" stroke-width="2"/>${dots(236, 306, 14, 22, 2.2, '#C79B55')}</g>
<g>${leaf(104, 262, 16)}${leaf(92, 238, 12, '#5E9A55')}</g>
<defs><radialGradient id="cur"><stop offset="0" stop-color="#E88A3C" stop-opacity="0"/><stop offset="1" stop-color="#B5381F" stop-opacity=".35"/></radialGradient></defs></svg>`;

/** A balanced plate: half vegetables, quarter protein, quarter grains. */
const balancedSvg = (size = 520) => `<svg width="${size}" height="${size}" viewBox="0 0 400 400" role="img" aria-label="സമീകൃത പ്ലേറ്റ്">
<ellipse cx="200" cy="378" rx="150" ry="12" fill="#000" opacity=".08"/>
<circle cx="200" cy="196" r="188" fill="#F1F1EE" stroke="#CFCFC8" stroke-width="3"/>
<path d="M200 196 L200 22 A174 174 0 0 0 200 370 Z" fill="#CFE5C4"/>
<path d="M200 196 L200 22 A174 174 0 0 1 374 196 Z" fill="#FBE0A6"/>
<path d="M200 196 L374 196 A174 174 0 0 1 200 370 Z" fill="#F2E9D2"/>
<g stroke="#fff" stroke-width="6"><line x1="200" y1="22" x2="200" y2="370"/><line x1="200" y1="196" x2="374" y2="196"/></g>
<g>${leaf(110, 110, 30, '#5E9A55')}${leaf(80, 190, 26)}${leaf(130, 270, 30, '#5E9A55')}${leaf(90, 300, 22)}${leaf(150, 170, 24)}<circle cx="70" cy="120" r="12" fill="${C.chilli}"/><circle cx="160" cy="320" r="11" fill="${C.chilli}"/><circle cx="60" cy="250" r="9" fill="#F2A33A"/></g>
<g><ellipse cx="270" cy="96" rx="34" ry="42" fill="#fff"/><circle cx="270" cy="102" r="17" fill="#E9A92E"/><path d="M296 150 q30 -10 56 8 q-26 30 -56 -8z" fill="#F2A98A"/><circle cx="340" cy="152" r="3" fill="#6B2A12"/>${dots(310, 70, 7, 20, 7, '#B5683A')}</g>
<g><circle cx="272" cy="284" r="48" fill="#FBFAF4"/>${dots(272, 284, 32, 40, 3.2, '#E5DCC2')}</g></svg>`;

const phoneSvg = (size = 380) => `<svg width="${size}" height="${size * 1.5}" viewBox="0 0 240 360" role="img" aria-label="ഫോണിൽ ഭക്ഷണത്തിന്റെ ഫോട്ടോ">
<rect x="14" y="8" width="212" height="344" rx="34" fill="${C.deep}"/><rect x="26" y="30" width="188" height="290" rx="18" fill="#FFF8EA"/>
<g transform="translate(40 80) scale(.36)">${mealSvg(400).replace(/<svg[^>]*>|<\/svg>/g, '')}</g>
<path d="M44 58 h28 M44 58 v22 M196 58 h-28 M196 58 v22 M44 300 h28 M44 300 v-22 M196 300 h-28 M196 300 v-22" stroke="${C.saffron}" stroke-width="5" fill="none" stroke-linecap="round"/>
<circle cx="120" cy="338" r="9" fill="#FFF8EA"/></svg>`;

const sun = (r = 60) => `<svg width="${r * 2}" height="${r * 2}" viewBox="-60 -60 120 120" aria-hidden="true"><g stroke="${C.saffron}" stroke-width="6" stroke-linecap="round">${Array.from({ length: 12 }, (_, i) => `<line x1="0" y1="-40" x2="0" y2="-54" transform="rotate(${i * 30})"/>`).join('')}</g><circle r="30" fill="${C.saffron}"/></svg>`;

// ---- creatives -----------------------------------------------------------------------------------------------
const poster = {
  name: 'poster-30-day-clinic-A4', w: 794, h: 1123, pdf: true,
  html: `<style>.wrap{width:794px;height:1123px;padding:44px 52px;position:relative;overflow:hidden;background:linear-gradient(180deg,${C.cream},${C.sand})}
.tag{display:inline-block;background:${C.deep};color:#fff;font-weight:700;font-size:26px;border-radius:40px;padding:6px 26px}
h1{font-size:74px;line-height:1.2;color:${C.deep};margin:22px 0 14px}
.lead{font-size:30px;font-weight:600;color:${C.ink};max-width:690px}
.meal{position:absolute;right:-34px;top:560px}
.pts{position:absolute;left:52px;top:600px;width:350px}
.pts div{font-size:30px;font-weight:700;margin-bottom:18px;display:flex;gap:14px;align-items:center}
.pts i{flex:none;width:44px;height:44px;border-radius:50%;background:${C.green};color:#fff;font-style:normal;display:grid;place-items:center;font-size:26px}
.foot{position:absolute;left:0;right:0;bottom:0;background:${C.deep};color:#fff;padding:22px 52px;display:flex;justify-content:space-between;align-items:center}
.foot b{font-size:34px}.foot span{font-size:19px;opacity:.9}.sun{position:absolute;right:30px;top:30px;opacity:.9}</style>
<div class="wrap"><div class="sun">${sun(52)}</div><span class="tag">പുതുവർഷ തീരുമാനം</span>
<h1 class="serif">30 ദിവസം,<br>നിങ്ങൾക്ക് വേണ്ടി</h1>
<p class="lead">എങ്ങനെ കഴിക്കാം, എത്ര കഴിക്കാം എന്ന് ന്യൂട്രീഷനിസ്റ്റ് നിങ്ങളുടെ ഓരോ പ്ലേറ്റും നോക്കി പറഞ്ഞുതരും.</p>
<div class="meal">${mealSvg(430)}</div>
<div class="pts"><div><i>1</i>ഭക്ഷണത്തിന്റെ ഫോട്ടോ അയയ്ക്കുക</div><div><i>2</i>ന്യൂട്രീഷനിസ്റ്റ് മറുപടി തരും</div><div><i>3</i>30 ദിവസം, ഒരു നല്ല ശീലം</div></div>
<div class="foot"><div><b>RM ക്ലിനിക്കിൽ ചോദിക്കൂ</b><br><span class="brand" style="color:#fff">${BRAND}</span></div><div style="font-size:24px">📞 ____________</div></div></div>`
};

const plate = {
  name: 'poster-balanced-plate-A4', w: 794, h: 1123, pdf: true,
  html: `<style>.wrap{width:794px;height:1123px;padding:46px 52px;background:${C.cream};position:relative}
h1{font-size:64px;line-height:1.2;color:${C.deep}}.sub{font-size:28px;font-weight:600;margin-top:6px}
.plate{margin:6px auto 0;width:400px}
.row{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-top:20px}
.card{border-radius:22px;padding:18px 16px;font-size:24px;font-weight:600;line-height:1.35}
.card b{display:block;font-size:30px;margin-bottom:6px}
.foot{position:absolute;left:0;right:0;bottom:0;background:${C.deep};color:#fff;padding:20px 52px;font-size:30px;font-weight:700}
.foot span{display:block;font-size:19px;font-weight:600;opacity:.9}</style>
<div class="wrap"><h1 class="serif">ഒരു നല്ല പ്ലേറ്റ് ഇങ്ങനെ</h1><p class="sub">നമ്മുടെ ഇഷ്ടഭക്ഷണങ്ങൾ തന്നെ, അളവ് ഒന്ന് ശ്രദ്ധിച്ചാൽ മതി.</p>
<div class="plate">${balancedSvg(400)}</div>
<div class="row"><div class="card" style="background:#CFE5C4"><b>പകുതി</b>പച്ചക്കറികൾ<br>തോരൻ, അവിയൽ, സാലഡ്</div><div class="card" style="background:#FBE0A6"><b>കാൽ ഭാഗം</b>പയർ, പരിപ്പ്, മീൻ, മുട്ട, ചിക്കൻ</div><div class="card" style="background:#F2E9D2"><b>കാൽ ഭാഗം</b>ചോറ്, ചപ്പാത്തി, ചെറുധാന്യങ്ങൾ</div></div>
<div class="foot">RM ക്ലിനിക്കിൽ ചോദിക്കൂ<span class="brand" style="color:#fff">${BRAND}</span></div></div>`
};

const square = {
  name: 'whatsapp-daily-photo-1080x1080', w: 1080, h: 1080,
  html: `<style>.wrap{width:1080px;height:1080px;padding:64px 70px;background:linear-gradient(160deg,${C.cream},${C.sand});position:relative;overflow:hidden}
h1{font-size:88px;line-height:1.2;color:${C.deep};max-width:640px}
p{font-size:42px;font-weight:600;margin-top:24px;max-width:560px}
.phone{position:absolute;right:40px;top:400px;transform:rotate(6deg)}
.pill{position:absolute;left:70px;bottom:120px;background:${C.deep};color:#fff;font-size:44px;font-weight:700;padding:20px 44px;border-radius:70px}
.brand{position:absolute;left:70px;bottom:50px;font-size:26px}.sun{position:absolute;right:50px;top:40px}</style>
<div class="wrap"><div class="sun">${sun(40)}</div><h1 class="serif">ഇന്നത്തെ ഭക്ഷണത്തിന്റെ ഫോട്ടോ അയച്ചോ?</h1><p>ഒരു ഫോട്ടോ മതി. ബാക്കി ന്യൂട്രീഷനിസ്റ്റ് നോക്കും.</p>
<div class="phone">${phoneSvg(290)}</div><div class="pill">അയയ്ക്കൂ 🙂</div><div class="brand">${BRAND}</div></div>`
};

const tips = {
  name: 'whatsapp-photo-tips-1080x1350', w: 1080, h: 1350,
  html: `<style>.wrap{width:1080px;height:1350px;padding:60px 64px;background:${C.cream}}
h1{font-size:92px;line-height:1.2;color:${C.deep}}
.s{display:grid;grid-template-columns:150px 1fr;gap:28px;align-items:center;background:#fff;border:4px solid #E6DAB8;border-radius:34px;padding:34px 30px;margin-top:30px}
.n{width:130px;height:130px;border-radius:50%;background:${C.green};color:#fff;font-size:80px;font-weight:800;display:grid;place-items:center}
.s b{font-size:54px;display:block;line-height:1.25}.s span{font-size:38px;font-weight:600;color:#3B4D43}
.meal{position:absolute;right:30px;bottom:30px}.note{margin-top:34px;width:640px;background:${C.deep};color:#fff;border-radius:30px;padding:26px 34px;font-size:40px;font-weight:700}
.brand{margin-top:26px;font-size:26px}</style>
<div class="wrap" style="position:relative"><h1 class="serif">ഫോട്ടോ എടുക്കാൻ<br>3 എളുപ്പ വഴികൾ</h1>
<div class="s"><div class="n">1</div><div><b>കഴിക്കുന്നതിന് മുമ്പ്</b><span>പ്ലേറ്റിൽ വിളമ്പിയ ഉടനെ</span></div></div>
<div class="s"><div class="n">2</div><div><b>മുകളിൽ നിന്ന്</b><span>പ്ലേറ്റ് മുഴുവൻ കാണണം</span></div></div>
<div class="s"><div class="n">3</div><div><b>നല്ല വെളിച്ചത്തിൽ</b><span>ചായയും മധുരവും മറക്കരുത്</span></div></div>
<div class="meal">${mealSvg(330)}</div><div class="note">ഫോട്ടോയിൽ മുഖങ്ങൾ വേണ്ട.</div><div class="brand brand">${BRAND}</div></div>`
};

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
for (const c of [poster, plate, square, tips]) {
  const html = `<!doctype html><html lang="ml"><head><meta charset="utf-8"><title>${c.name}</title><style>${BASE}</style></head><body>${c.html}</body></html>`;
  writeFileSync(join(OUT, c.name + '.html'), html);
  const page = await browser.newPage({ viewport: { width: c.w, height: c.h }, deviceScaleFactor: c.pdf ? 2 : 1 });
  await page.setContent(html, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: join(OUT, c.name + '.png') });
  if (c.pdf) await page.pdf({ path: join(OUT, c.name + '.pdf'), width: c.w + 'px', height: c.h + 'px', printBackground: true });
  await page.close();
  console.log('Wrote', c.name);
}
await browser.close();
