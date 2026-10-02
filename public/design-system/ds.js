// Style guide behaviour. Colours are read from the live CSS tokens, so this page cannot drift from tokens.css.
import { AVATARS } from '../shared/avatars.mjs';

const GROUPS = {
  'sw-burgundy': [
    ['--burgundy-950', 'Dypeste skygge, sheets bak innhold'],
    ['--burgundy-900', 'Sticky topplinje, kort på kort'],
    ['--burgundy-800', 'Sheets og dype kort'],
    ['--burgundy-700', 'Standard sidebakgrunn'],
    ['--burgundy-600', 'Kort (surface)'],
    ['--burgundy-500', 'Blir sjelden brukt alene; kritt-karmosin'],
  ],
  'sw-crayon': [
    ['--yellow', 'Primærknapp, logo-klistremerke, avatar-flis'],
    ['--lime', 'Start/lås-knapper, riktig svar A, «+1»'],
    ['--orange', 'Svaralternativ B, advarende handlinger'],
    ['--coral', 'Svak aksent, kirsebær'],
    ['--pink', 'Svaralternativ C, «feil»-skjerm'],
    ['--violet', 'Dekor, leppene'],
    ['--blue-light', 'Svaralternativ D, sekundærknapp'],
    ['--teal', 'Briller-avataren'],
  ],
  'sw-role': [
    ['--red', 'Ordet IMPOSTER på rollekortet'],
    ['--blue', 'Ordet LOJAL på rollekortet'],
    ['--lime', 'Riktig-skjermen (kun den som svarer)'],
    ['--pink', 'Feil-skjermen (kun den som svarer)'],
  ],
  'sw-paper': [
    ['--cream', 'Tekst på burgunder, papirkort, input'],
    ['--ink', 'Tekst på lys flate, logo, kantlinjer'],
    ['--yellow-pale', 'Kodeeksempler'],
    ['--cream-dim', 'Kritt-kant på krem'],
  ],
};

const css = getComputedStyle(document.documentElement);
const toRgb = (value) => {
  const probe = document.createElement('span');
  probe.style.color = value;
  document.body.append(probe);
  const [r, g, b] = getComputedStyle(probe).color.match(/\d+(\.\d+)?/g).map(Number);
  probe.remove();
  return [r, g, b];
};
const hex = ([r, g, b]) => `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;
const lum = ([r, g, b]) => {
  const f = (v) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
const ratio = (a, b) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
const CREAM = toRgb(css.getPropertyValue('--cream').trim());
const INK = toRgb(css.getPropertyValue('--ink').trim());

for (const [id, tokens] of Object.entries(GROUPS)) {
  const host = document.getElementById(id);
  if (!host) continue;
  host.innerHTML = tokens
    .map(([token, usage]) => {
      const value = css.getPropertyValue(token).trim();
      const rgb = toRgb(value);
      const onCream = ratio(rgb, CREAM);
      const onInk = ratio(rgb, INK);
      const badge = (n) => `${n.toFixed(1)}${n >= 4.5 ? ' AA' : n >= 3 ? ' stor' : ''}`;
      return `<div class="ds-swatch">
        <div class="ds-swatch__chip" style="--c:var(${token})"></div>
        <div class="ds-swatch__meta">
          <strong>${token.replace('--', '')}</strong>
          <span><code>${token}</code> ${hex(rgb)}</span>
          <span>${usage}</span>
          <div class="ds-contrast"><i class="on-cream">krem ${badge(onCream)}</i><i class="on-ink">blekk ${badge(onInk)}</i></div>
        </div>
      </div>`;
    })
    .join('');
}

// ---- avatars
const avatarHost = document.getElementById('avatar-grid');
if (avatarHost) {
  avatarHost.innerHTML = AVATARS.map(
    (a) => `<div class="ds-motion"><span class="avatar avatar--lg avatar--alive"><img src="../assets/avatars/${a.id}.svg" alt="" width="400" height="400"></span><strong>${a.name}</strong><span class="ds-note"><code>${a.id}</code> <span style="color:${a.accent}">●</span> ${a.accent}</span></div>`,
  ).join('');
}
const sizes = document.getElementById('avatar-sizes');
if (sizes) {
  sizes.innerHTML = ['xs', 'sm', 'md', 'lg'].map((s) => `<div class="ds-motion"><span class="avatar avatar--${s}"><img src="../assets/avatars/mandarin.svg" alt=""></span><code>avatar--${s}</code></div>`).join('');
}

// ---- screen gallery (images come from `npm run shots -- --docs`; missing ones are dropped silently)
const SCREENS = [
  ['home', 'Hjem', 'Opprett spill, eller bli med i et spill med koden.'],
  ['profile-new', 'Profil', 'Navn og avatar. Tatte avatarer er utilgjengelige.'],
  ['lobby-host-3', 'Lobby – vert', 'QR-kode, spillere, poengmål og Start Disputt.'],
  ['lobby-guest-3', 'Lobby – spiller', 'Venter på verten. Kan se hvem som er med.'],
  ['role-impostor', 'Rolle: skjult', 'Lik på alles telefon til en finger holder knappen. Lojal og imposter ser det samme. 8 sekunder.'],
  ['role-impostor-held', 'Rolle: mens du holder', 'Kortet vises bare mens knappen holdes. Imposteren ser også riktig svar; lojale ser «?».'],
  ['question-asker-selected', 'Spørsmål', 'Den som svarer: klokke, 2/6/10 min, spørsmål, alternativer og lås.'],
  ['discussion-impostor', 'Diskusjon', 'Alle andre: hvem som har spørsmålet, klokka og en rollestripe som er lik for alle til den holdes.'],
  ['countdown-asker', 'Nedtelling', '5 – 4 – 3 – 2 – 1 etter at svaret er låst.'],
  ['reveal-right', 'Avsløring: riktig', 'Kun på telefonen til den som svarte.'],
  ['reveal-wrong', 'Avsløring: feil', 'Med riktig svar.'],
  ['summary-wrong-host', 'Oppsummering', 'Imposteren avsløres, poeng deles ut, verten går videre.'],
  ['finished-host', 'Vinner', 'Konfetti og krone. Spill igjen?'],
  ['sheet-scores', 'Poengtavle', 'Åpnes fra alle skjermer. Verten har vertsvalg bak tannhjulet ved siden av «Poeng».'],
];
const gallery = document.getElementById('screen-gallery');
if (gallery) {
  gallery.innerHTML = SCREENS.map(
    ([key, title, text]) => `<figure><img loading="lazy" src="screens/${key}.webp" alt="${title}" width="390" height="844"><figcaption><strong>${title}</strong>${text}</figcaption></figure>`,
  ).join('');
  gallery.querySelectorAll('img').forEach((img) => img.addEventListener('error', () => img.closest('figure')?.remove()));
}

// ---- interactive demos
document.querySelectorAll('[data-options]').forEach((group) => {
  group.addEventListener('click', (e) => {
    const opt = e.target.closest('.option');
    if (!opt || opt.classList.contains('option--locked')) return;
    group.querySelectorAll('.option').forEach((o) => {
      o.classList.toggle('is-selected', o === opt);
      o.querySelector('input').checked = o === opt;
    });
  });
});
document.querySelectorAll('[data-segmented]').forEach((group) => {
  group.addEventListener('click', (e) => {
    const btn = e.target.closest('.segmented__item');
    if (!btn) return;
    group.querySelectorAll('.segmented__item').forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
  });
});
document.querySelectorAll('[data-role-strip]').forEach((strip) => {
  // "ORD|klasse|tekst på knappen mens den holdes": stripen er lik for alle til en finger holder knappen
  const [word, cls, openText] = strip.dataset.roleStrip.split('|');
  const btn = strip.querySelector('.secret');
  const label = strip.querySelector('[data-label]');
  const set = (open) => {
    strip.classList.toggle('role-strip--open', open);
    strip.classList.toggle('role-strip--hidden', !open);
    label.innerHTML = open ? `Du er <strong class="${cls}">${word}</strong>` : 'Din rolle';
    btn.textContent = open ? openText : 'Hold for å se';
  };
  btn.addEventListener('pointerdown', (e) => { e.preventDefault(); set(true); });
  ['pointerup', 'pointerleave', 'pointercancel', 'blur'].forEach((ev) => btn.addEventListener(ev, () => set(false)));
  btn.addEventListener('contextmenu', (e) => e.preventDefault());
});
document.querySelectorAll('[data-toggle-sheet]').forEach((btn) => {
  btn.addEventListener('click', () => document.getElementById(btn.dataset.toggleSheet)?.toggleAttribute('hidden'));
});
document.querySelectorAll('[data-replay]').forEach((el) => {
  el.addEventListener('click', () => {
    const cls = el.dataset.replay;
    el.classList.remove(cls);
    void el.offsetWidth;
    el.classList.add(cls);
  });
});

// ---- a running timer, so the digit cells can be seen not jittering
const live = document.getElementById('timer-live');
if (live) {
  let left = 6 * 60;
  const draw = () => {
    const m = String(Math.floor(left / 60)).padStart(2, '0');
    const s = String(left % 60).padStart(2, '0');
    live.innerHTML = [...`${m}:${s}`].map((ch) => (ch === ':' ? '<span class="timer__c">:</span>' : `<span class="timer__d">${ch}</span>`)).join('');
    live.classList.toggle('timer--low', left <= 30 && left > 0);
    live.classList.toggle('timer--out', left === 0);
    left = left === 0 ? 6 * 60 : left - 7; // 7x speed so the demo moves
  };
  draw();
  setInterval(draw, 1000);
}
