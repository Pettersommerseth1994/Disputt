// The paid part of a game when the host pays with «Betal med Vipps» (the button above «Betal med kort»), played through the real interface
// against the whole pretend chain (tools/qa/shop-stack.mjs with `vipps: true`: the real payment server, a pretend Vipps with a page where
// the customer approves or turns the payment down, and a pretend Shopify that receives the paid order). The host ticks the box and taps the
// button, is sent to Vipps in a NEW tab, gives up once, has a payment turned down once, and pays the third time, while the guests wait,
// connected, the whole time. Vipps tells the payment server late (its webhook is held), so the page that the host comes back to and the game
// have to find the payment themselves. Later somebody buys from the start screen in a browser that refuses new tabs. Used by `play.mjs --pay-vipps`.
//
// `t` is play.mjs's own toolbox: { clickButton, waitText, bodyText, newPhone, shot, sleep, log }.
import assert from 'node:assert/strict';
import { checkHome } from './payflow.mjs';

const CODE = /^[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/;
const REFERENCE = /^disputt-[0-9a-hjkmnp-tv-z]{24}$/;

/** The pass this phone keeps (it sits under a key that names the payment server it came from), or null. */
const storedPass = (p) =>
  p.page.evaluate(() => {
    const key = Object.keys(localStorage).find((k) => k.startsWith('disputt:pass'));
    return key ? JSON.parse(localStorage.getItem(key)) : null;
  });
const choosePlan = (p, id) => p.page.evaluate((plan) => document.querySelector(`input[name=plan][value=${plan}]`).click(), id);
const buttons = (p) => p.page.$$eval('button', (els) => els.map((b) => ({ text: b.innerText.trim(), disabled: b.disabled })));
const button = async (p, label) => (await buttons(p)).find((b) => b.text.includes(label));
const tick = (p) => p.page.click('.consent__box'); // (the box itself: the middle of the whole line can be on the link to the terms)
const rect = (p, selector) =>
  p.page.$eval(selector, (el) => {
    const r = el.getBoundingClientRect();
    return { top: r.top, bottom: r.bottom, height: r.height };
  });
const attribute = (order, key) => order.input.customAttributes.find((a) => a.key === key)?.value;
const waitsForBox = (p) => p.page.$eval('.btn--vipps', (b) => b.disabled);

/** For the web flow the pretend phone is a computer to the page (no touch): the game then opens a tab of its own for Vipps, instead of opening the Vipps app. */
const asComputer = async (page) => {
  const patch = () => {
    const real = window.matchMedia.bind(window);
    window.matchMedia = (q) => (/pointer|hover/.test(q) ? { matches: false, media: q, addEventListener() {}, removeEventListener() {} } : real(q)); // (no touch, a mouse that hovers)
  };
  await page.evaluate(patch);
  await page.evaluateOnNewDocument(patch);
};

/** The tab that the host's tap opened: the pretend Vipps, where the customer decides. */
async function vippsTab(host) {
  const target = await host.ctx.waitForTarget((x) => x.type() === 'page' && new URL(x.url(), 'http://x').pathname.startsWith('/landing/'), { timeout: 20000 });
  const page = await target.page();
  await page.waitForSelector('#amount');
  return page;
}
/** The tab that «Betal med kort» opened: the pretend shop's checkout. */
async function checkoutTab(host) {
  const target = await host.ctx.waitForTarget((x) => x.type() === 'page' && new URL(x.url(), 'http://x').pathname.startsWith('/checkouts/'), { timeout: 20000 });
  const page = await target.page();
  await page.waitForSelector('#attributes');
  return page;
}
const referenceOf = (tab) => new URL(tab.url()).pathname.split('/').pop();
const onTakk = (tab, title) => tab.waitForFunction((text) => document.getElementById('takk-title')?.textContent === text, { timeout: 20000 }, title);

/**
 * The host is at the points of the last free round. Returns the code of the access that was bought.
 */
export async function payAfterFreeRoundsVipps(t, { host, others, stack, holdMs = 0 }) {
  const { clickButton, waitText, bodyText, shot, sleep, log } = t;
  const { vipps, admin } = stack;
  const guest = others[0];
  await asComputer(host.page);

  // "Neste runde" shows the packages to the host. The others just wait, like between any two rounds.
  await clickButton(host, 'Neste runde');
  await waitText(host, /Fortsett quizen/);
  await host.page.waitForSelector('.btn--vipps', { timeout: 10000 }); // (the packages ask the payment server whether Vipps is set up, and the button comes with the answer)
  const paywall = await bodyText(host);
  assert.match(paywall, /Dere har spilt to runder gratis/);
  assert.match(paywall, /Betal med Vipps/);
  assert.match(paywall, /Betal med kort/, 'the shop is still there for those who want a card or Apple Pay');
  assert.match(paywall, /Jeg godtar vilkårene og at tilgangen leveres med en gang\./);
  assert.doesNotMatch(paywall, /Stripe|Shopify/, 'the page does not name the shop');
  const above = await rect(host, '.btn--vipps');
  const below = await rect(host, '.dock .btn:not(.btn--vipps)');
  assert.ok(above.bottom <= below.top, 'the Vipps button sits above «Betal med kort»');
  assert.ok(Math.abs(above.height - below.height) <= 4, `and is as tall as it (${above.height} and ${below.height} px): a button like the other, in the orange of Vipps`);
  assert.equal(await host.page.$eval('.btn--vipps', (b) => getComputedStyle(b).backgroundColor === 'rgb(255, 91, 36)' || getComputedStyle(b).backgroundImage.includes('rgb(255, 91, 36)')), true, 'in the orange of Vipps (#ff5b24)');
  assert.equal(await waitsForBox(host), true, 'the Vipps button waits for the box, like the other one');
  assert.equal((await button(host, 'Betal med kort')).disabled, true);
  await shot(host, '30-paywall-vipps');
  for (const p of others) {
    const text = await bodyText(p);
    assert.match(text, /Venter på at verten starter neste runde/, `${p.name} just waits`);
    assert.doesNotMatch(text, /Fortsett quizen|Betal med kort|Betal med Vipps/, `${p.name} is not asked to pay`);
    assert.equal(await p.page.$('.btn--vipps'), null, `${p.name} has no Vipps button`);
  }
  // a tap on a button that waits for the box does nothing, whether it comes from a finger or from a script
  const pagesBefore = (await host.ctx.pages()).length;
  const center = await host.page.$eval('.btn--vipps', (el) => {
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  });
  await host.page.mouse.click(center.x, center.y);
  await host.page.$eval('.btn--vipps', (el) => el.click());
  await sleep(600);
  assert.equal((await host.ctx.pages()).length, pagesBefore, 'no tab was opened');
  assert.equal(vipps.payments.size, 0, 'and nothing was started at Vipps');
  assert.equal(admin.orders.length, 0);
  log('after the free rounds the host gets the Vipps button above «Betal med kort», both wait for the box, and the others only wait');

  // 1) "En kveld": the box, the button, a new tab at Vipps; the host gives up in the game, which closes the tab
  await choosePlan(host, 'evening');
  await waitText(host, /Gjelder i 12 timer fra du betaler/);
  await tick(host);
  assert.equal(await waitsForBox(host), false, 'ticked: the button is on');
  await clickButton(host, 'Betal med Vipps');
  const first = await vippsTab(host);
  assert.equal((await host.ctx.pages()).length, pagesBefore + 1, 'Vipps opened in a new tab, and the game is still where it was');
  assert.equal(await first.$eval('#amount', (el) => el.textContent), '149,00 kr');
  assert.match(await first.$eval('#what', (el) => el.textContent), /Disputt: En kveld/);
  const ref1 = referenceOf(first);
  assert.match(ref1, REFERENCE);
  const started = vipps.payments.get(ref1);
  assert.equal(started.amount, 14900, 'the price is in øre, and it is the shop\'s price');
  assert.equal(started.scope, 'email', 'the e-mail address is asked for, so that the receipt has somewhere to go, and nothing else');
  assert.equal(started.returnUrl, new URL(`takk.html?ref=${ref1}`, stack.env.SITE_URL).href, 'Vipps sends the host back to the page that says whether it went through');
  await waitText(host, /Venter på betalingen/);
  assert.equal(await host.page.$$eval('input[name=plan]', (els) => els.every((i) => i.disabled)), true, 'the host cannot change package while waiting');
  const waiting = JSON.parse(await host.page.evaluate(() => sessionStorage.getItem('disputt:shop')));
  assert.match(waiting.code, CODE, 'the game tab remembers the code it is waiting for');
  assert.ok(waiting.url.includes(`/landing/${ref1}`), 'and where Vipps is');
  await shot(host, '31-host-waiting-vipps');
  for (const p of others) {
    const text = await bodyText(p);
    assert.match(text, /Venter på at verten starter neste runde/, `${p.name} still just waits`);
    assert.equal(await p.page.$('.banner'), null, `${p.name} has not lost the host`);
  }
  await clickButton(host, 'Avbryt');
  await waitText(host, /Betal med kort/);
  for (let i = 0; i < 20 && !first.isClosed(); i++) await sleep(250);
  assert.equal(first.isClosed(), true, 'the game closes the tab for Vipps when the host gives up');
  assert.equal(await waitsForBox(host), true, 'after giving up the box has to be ticked again');
  assert.equal(await host.page.evaluate(() => sessionStorage.getItem('disputt:shop')), null);
  assert.equal(vipps.payments.get(ref1).captured, 0, 'nothing was taken');
  assert.equal(admin.orders.length, 0, 'and no order was made');
  log('a host who gives up is not charged: the tab for Vipps is closed and the box has to be ticked again');

  // 2) "For ett år": the customer turns it down in Vipps. The page that the host comes back to says so, and nothing is bought.
  await choosePlan(host, 'year');
  await tick(host);
  await clickButton(host, 'Betal med Vipps');
  const second = await vippsTab(host);
  assert.equal(await second.$eval('#amount', (el) => el.textContent), '299,00 kr');
  const ref2 = referenceOf(second);
  assert.notEqual(ref2, ref1, 'a new try is a new payment');
  await second.click('#reject');
  await second.waitForFunction(() => location.pathname.endsWith('/takk.html'));
  await onTakk(second, 'Betalingen ble ikke gjennomført');
  assert.match(await second.$eval('#takk-text', (el) => el.textContent), /Ingen penger er trukket/);
  assert.equal(await second.$eval('#takk-close', (el) => el.hidden), false, 'a tab that the game opened can be closed from here');
  assert.equal(await second.$eval('#takk-open', (el) => el.hidden), true);
  assert.equal(await second.$eval('#takk-switch', (el) => el.hidden), true, 'it was opened by the game, so it needs no telling to go back to it');
  await shot({ page: second }, '32-takk-failed');
  await second.click('#takk-close');
  for (let i = 0; i < 20 && !second.isClosed(); i++) await sleep(250);
  assert.equal(second.isClosed(), true, 'the button closes the tab, and the host is where the game is');
  await host.page.bringToFront();
  assert.match(await bodyText(host), /Venter på betalingen/, 'the game says nothing about a payment that was turned down: the host decides when to stop');
  assert.equal(admin.orders.length, 0, 'a payment that was turned down is no order');
  assert.equal(vipps.payments.get(ref2).state, 'ABORTED');
  await clickButton(host, 'Avbryt');
  await waitText(host, /Betal med kort/);
  log('a payment that is turned down in Vipps ends on a page that says so, and nothing is bought');

  // The discount code: a field under the packages. A code that is no good is told so; a code that takes everything off is for the shop's checkout
  // (Vipps takes no price of nothing), which gets the code in the cart link; a good code changes the prices, and Vipps is paid the price with it.
  admin.addDiscount('VENN20', { customerGets: { value: { __typename: 'DiscountPercentage', percentage: 0.2 }, items: { __typename: 'AllDiscountItems' } } });
  admin.addDiscount('GRATIS', { customerGets: { value: { __typename: 'DiscountPercentage', percentage: 1 }, items: { __typename: 'AllDiscountItems' } } });
  assert.equal(await host.page.$$eval('.plan__was', (els) => els.length), 0, 'no code, no struck-out prices');
  await clickButton(host, 'Har du rabattkode?');
  await host.page.type('#discount-code', 'finnesikke');
  await clickButton(host, 'Bruk');
  await waitText(host, /Fant ikke den rabattkoden/);
  assert.equal(await host.page.$$eval('.plan__was', (els) => els.length), 0, 'a code that is no good changes no price');
  await host.page.$eval('#discount-code', (el) => {
    el.focus();
    el.select(); // (what stands there is replaced by what is typed)
  });
  await host.page.keyboard.type('gratis');
  await clickButton(host, 'Bruk');
  await waitText(host, /GRATIS/);
  await waitText(host, /Denne koden gjelder i butikkens kasse/);
  await tick(host);
  assert.equal((await button(host, 'Betal med Vipps')).disabled, true, 'Vipps takes no price of nothing');
  await shot(host, '37-discount-free');
  await clickButton(host, 'Betal med kort');
  const checkout = await checkoutTab(host);
  assert.equal(await checkout.$eval('#discount', (el) => el.textContent), 'GRATIS', 'the shop\'s checkout gets the code in the cart link, and counts it itself');
  await checkout.close();
  await clickButton(host, 'Avbryt');
  await waitText(host, /Betal med kort/);
  await clickButton(host, 'Fjern');
  await waitText(host, /Har du rabattkode\?/);
  assert.equal(await host.page.$$eval('.plan__was', (els) => els.length), 0, 'taken away: the ordinary prices');
  await clickButton(host, 'Har du rabattkode?');
  await host.page.type('#discount-code', 'venn20');
  await host.page.keyboard.press('Enter');
  await waitText(host, /20 % rabatt/);
  const deals = await host.page.$$eval('.plan', (els) => els.map((el) => el.querySelector('.plan__price').innerText.replace(/\s+/g, ' ').trim()));
  assert.deepEqual(deals, ['149 kr 119,20 kr', '199 kr 159,20 kr', '299 kr 239,20 kr'], 'every package shows the old price struck out and the new one');
  await shot(host, '38-discount-20');
  log('a discount code: a bad one is told so, one for nothing is kept to the shop\'s checkout (which gets the code), and a good one changes the prices');

  // 3) "En helg" with the code, paid in the new tab: Vipps keeps quiet about it, and the page and the game find the payment themselves
  await choosePlan(host, 'weekend');
  await tick(host);
  await clickButton(host, 'Betal med Vipps');
  const third = await vippsTab(host);
  assert.equal(await third.$eval('#amount', (el) => el.textContent), '159,20 kr', 'the price at Vipps is the price with the code');
  const ref3 = referenceOf(third);
  const code = JSON.parse(await host.page.evaluate(() => sessionStorage.getItem('disputt:shop'))).code;
  assert.match(code, CODE);
  if (holdMs) {
    log(`the host stays at Vipps for ${Math.round(holdMs / 1000)} s`);
    await sleep(holdMs);
    for (const p of others) {
      const text = await bodyText(p).catch((err) => `[the page is gone: ${err.message}]`);
      assert.match(text, /Venter på at verten starter neste runde/, `${p.name} is still waiting for the host after ${Math.round(holdMs / 1000)} s, but the screen says: ${text.slice(0, 200)}`);
    }
  }
  vipps.hold(); // (Vipps has the payment and has not told the payment server yet)
  await third.click('#approve');
  await third.waitForFunction(() => location.pathname.endsWith('/takk.html'));
  // (the page asks the payment server, which asks Vipps itself: no webhook is needed for the answer. The tab may close while this is being read.)
  const sawThanks = await onTakk(third, 'Velkommen!').then(
    () => true,
    () => false,
  );
  await host.page.bringToFront();
  await waitText(host, /Velkommen!/, 30000);
  const thanks = await host.page.$eval('.sheet', (el) => el.innerText.replace(/\s+/g, ' '));
  assert.match(thanks, /En helg/);
  assert.match(thanks, /Gjelder til/);
  assert.match(thanks, /Den står også i bestillingsbekreftelsen på e-post/);
  const shown = (await host.page.$eval('.passcode', (el) => el.textContent)).trim();
  assert.equal(shown, code, 'the code on the thank-you sheet is the one the game made up before it left');
  const stored = await storedPass(host);
  assert.equal(stored.code, code);
  assert.equal(stored.token.split('.').length, 3, 'a signed pass is kept on the phone');
  assert.equal(await host.page.evaluate(() => sessionStorage.getItem('disputt:shop')), null, 'and the game tab has forgotten that it waited');
  assert.equal(new URL(host.page.url()).search, '');
  const sheetButtons = await host.page.$$eval('.sheet button', (els) => els.map((b) => b.innerText.trim()));
  assert.ok(sheetButtons.includes('Start runde 3'), `the thank-you sheet offers the round the host asked for (${sheetButtons.join(' | ')})`);
  await shot(host, '33-thanks-vipps');
  log(`paid in the tab for Vipps with the webhook held back: "Velkommen!" with the code ${shown}${sawThanks ? ', and the page in the tab said «Velkommen!»' : ''}`);

  // what Vipps and the shop were told: one payment taken, one paid order that carries the code, and the receipt goes to the address from Vipps
  assert.equal(vipps.payments.get(ref3).captured, 15920, 'the money was taken once, for the price with the code');
  assert.equal(vipps.calls.filter((c) => c.method === 'POST' && c.path.endsWith('/capture')).length, 1, 'with one capture');
  assert.equal(admin.orders.length, 1, 'one paid order for one payment');
  const order = admin.orders[0];
  assert.equal(order.input.financialStatus, 'PAID');
  assert.ok(order.tags.includes(ref3), 'the order is tagged with the reference at Vipps');
  assert.equal(order.input.lineItems[0].priceSet.shopMoney.amount, '159.20');
  assert.equal(attribute(order, 'rabattkode'), 'VENN20', 'the order says which code it was');
  assert.equal(attribute(order, 'ordinaer_pris'), '199.00', 'and what the package costs without it');
  assert.ok(order.tags.includes('rabatt'));
  assert.equal(attribute(order, 'kode'), code, 'the order carries the code, which is what the e-mail and the pass read');
  assert.match(attribute(order, 'samtykke'), /^\d{4}-\d{2}-\d{2}T[\d:]+\.\d{3}Z$/, 'and the time of the consent');
  assert.equal(order.email, 'kari@example.com');
  assert.deepEqual(
    admin.receipts.map((r) => r.to),
    ['kari@example.com'],
    'the receipt is asked for, to the address that the customer shared in Vipps',
  );
  assert.equal(stack.orders.length, 0, 'nothing went through the shop\'s own checkout');

  // the game closes the tab for Vipps, now that the payment is in (the page in it closes itself, too: whichever comes first)
  for (let i = 0; i < 20 && !third.isClosed(); i++) await sleep(250);
  assert.equal(third.isClosed(), true, 'the tab for Vipps is closed once the payment is in, and the host is where the game is');

  // Vipps keeps its word and calls the webhook in the end: the payment is already done, and nothing is done twice
  await vipps.release();
  await sleep(500);
  assert.equal(
    vipps.sent.every((s) => s.status === 200),
    true,
    `every webhook was answered with a yes (${JSON.stringify(vipps.sent)})`,
  );
  assert.equal(admin.orders.length, 1, 'the late webhook made no second order');
  assert.equal(vipps.calls.filter((c) => c.method === 'POST' && c.path.endsWith('/capture')).length, 1, 'and no second capture');
  log('Vipps\' own webhook came in the end, after everything: no second order and no second capture');

  // somebody who opens the page without being sent from the game (a link in an e-mail, a bookmark) is told, and gets a link instead of a button
  const visitor = await host.ctx.newPage();
  await visitor.goto(`${stack.env.SITE_URL}takk.html?ref=${ref3}`);
  await onTakk(visitor, 'Velkommen!');
  assert.equal(await visitor.$eval('#takk-close', (el) => el.hidden), true, 'no button that closes a tab that nobody opened');
  assert.equal(await visitor.$eval('#takk-switch', (el) => el.hidden), false, 'the Vipps app opens this tab on a phone: the game is in another one, and it is told so');
  assert.equal(await visitor.$eval('#takk-open', (el) => el.textContent), 'Åpne spillet her i stedet', 'and a link to the game is only the last way (it would open the game a second time)');
  await shot({ page: visitor }, '34-takk-other-tab');
  await visitor.goto(`${stack.env.SITE_URL}takk.html?ref=disputt-nonsense`);
  await onTakk(visitor, 'Vi fikk ikke svar');
  await visitor.goto(`${stack.env.SITE_URL}takk.html`);
  await onTakk(visitor, 'Vi fikk ikke svar');
  await visitor.close();
  log('the page the host comes back to says «Velkommen!» for a payment that is in, and asks for nothing when it is opened with nothing');

  await host.page.bringToFront();
  await clickButton(host, 'Start runde 3');
  return { code };
}

/**
 * Buying from the start screen, with no game, in a browser that does not open new tabs: the page sends this very tab to Vipps, the customer
 * pays there and comes back to the page that says so, and the link on it leads to the game, which finds the payment itself from what it
 * remembered about leaving.
 */
export async function buyAndComeBackVipps(t, { base, stack }) {
  const { clickButton, waitText, bodyText, newPhone, shot, log } = t;
  const { vipps, admin } = stack;
  const phone = await newPhone('Kjøper');
  await asComputer(phone.page);
  await phone.page.evaluateOnNewDocument(() => {
    window.open = () => null; // (a pop-up blocker)
  });
  await phone.page.goto(`${base}/`);
  await checkHome(t, phone);
  await clickButton(phone, 'Logg inn');
  await waitText(phone, /Skriv inn koden/);
  await clickButton(phone, 'Har du ikke kjøpt ennå? Se pakkene');
  await waitText(phone, /Pakker/);
  await phone.page.waitForSelector('.btn--vipps', { timeout: 10000 });
  const browse = await bodyText(phone);
  assert.match(browse, /Betal med Vipps/);
  assert.doesNotMatch(browse, /Fortsett quizen/, 'opened from the start screen it is a list of packages, not a gate');
  assert.equal((await button(phone, 'Betal med Vipps')).disabled, true, 'and waits for the box, too');
  await shot(phone, '35-paywall-browse-vipps');
  await choosePlan(phone, 'year');
  await tick(phone);
  assert.equal((await button(phone, 'Betal med Vipps')).disabled, false);
  const paid = vipps.payments.size;
  await clickButton(phone, 'Betal med Vipps');
  await phone.page.waitForFunction(() => location.pathname.startsWith('/landing/'), { timeout: 20000 });
  assert.equal(vipps.payments.size, paid + 1);
  assert.equal(await phone.page.$eval('#amount', (el) => el.textContent), '299,00 kr');
  const reference = referenceOf(phone.page);
  await phone.page.click('#approve');
  await phone.page.waitForFunction(() => location.pathname.endsWith('/takk.html'), { timeout: 20000 });
  await onTakk(phone.page, 'Velkommen!');
  assert.equal(await phone.page.$eval('#takk-close', (el) => el.hidden), true, 'this is the game\'s own tab: there is no tab to close');
  assert.equal(await phone.page.$eval('#takk-open', (el) => el.hidden), false);
  assert.equal(await phone.page.$eval('#takk-open', (el) => el.textContent), 'Tilbake til spillet', 'the game\'s own tab: the link back is the way on');
  assert.equal(await phone.page.$eval('#takk-switch', (el) => el.hidden), true, 'and there is no other tab to go back to');
  await shot(phone, '36-takk-vipps');
  await phone.page.click('#takk-open');
  await waitText(phone, /Velkommen!/, 30000);
  const sheet = await phone.page.$eval('.sheet', (el) => el.innerText.replace(/\s+/g, ' '));
  assert.match(sheet, /For ett år/);
  const code = (await phone.page.$eval('.passcode', (el) => el.textContent)).trim();
  assert.match(code, CODE);
  const order = admin.orders.at(-1);
  assert.equal(attribute(order, 'kode'), code, 'the order carries the code that is on the sheet');
  assert.ok(order.tags.includes(reference));
  assert.equal(vipps.payments.get(reference).captured, 29900);
  assert.equal((await storedPass(phone))?.code, code);
  assert.equal(await phone.page.evaluate(() => sessionStorage.getItem('disputt:shop')), null, 'and has forgotten it now');
  await clickButton(phone, 'Fortsett spillet');
  await waitText(phone, /Du har tilgang/);
  log('bought from the start screen with no new tab: the page was sent to Vipps and came back by the link on the «Velkommen!» page, and found the payment itself');
}

/**
 * The same, on a phone: «Betal med Vipps» opens the Vipps app from the game tab, so the game opens no tab at all,
 * and the only new tab is the one the phone opens when Vipps sends the host back (here: the same page, opened by hand in a new tab, with no opener).
 * (A browser on a computer cannot open the app, and ignores the deep link; what the host sees is the game still waiting, as on a phone that is in the app.)
 */
export async function payAfterFreeRoundsVippsApp(t, { host, others, stack }) {
  const { clickButton, waitText, bodyText, shot, log } = t;
  const { vipps, admin } = stack;
  await clickButton(host, 'Neste runde');
  await waitText(host, /Fortsett quizen/);
  await host.page.waitForSelector('.btn--vipps', { timeout: 10000 });
  await choosePlan(host, 'weekend');
  await tick(host);
  const gameAt = host.page.url();
  const pagesBefore = (await host.ctx.pages()).length;
  await clickButton(host, 'Betal med Vipps');
  await waitText(host, /Fullfør betalingen i Vipps-appen/);
  assert.equal((await host.ctx.pages()).length, pagesBefore, 'no tab was opened for Vipps');
  assert.equal(host.page.url(), gameAt, 'and the game tab is still the game');
  assert.equal(await button(host, 'Åpne Vipps igjen').then((b) => Boolean(b)), true, 'the bar offers to open the app again');
  const reference = [...vipps.payments.keys()].at(-1);
  const payment = vipps.payments.get(reference);
  assert.equal(payment.flow, 'NATIVE_REDIRECT', 'Vipps was asked for the flow of the app');
  assert.equal(payment.amount, 19900);
  for (const p of others) assert.match(await bodyText(p), /Venter på at verten starter neste runde/, `${p.name} just waits`);
  await shot(host, '39-waiting-app');
  log('on a phone: no tab for Vipps, the game tab stays where it is, and the bar says that it is the app that is waited for');

  // the host approves in the app, and the phone opens the page Vipps was given as the return address: a new tab, with no opener
  await vipps.approve(reference);
  const back = await host.ctx.newPage();
  await back.goto(payment.returnUrl);
  await onTakk(back, 'Velkommen!');
  assert.equal(await back.$eval('#takk-switch', (el) => el.hidden), false, 'the page tells the host to go back to the game, which is in another tab');
  assert.equal((await host.ctx.pages()).length, pagesBefore + 1, 'one new tab in all: the one the phone opened on the way back');
  await host.page.bringToFront();
  await waitText(host, /Velkommen!/, 30000);
  const thanks = await host.page.$eval('.sheet', (el) => el.innerText.replace(/\s+/g, ' '));
  assert.match(thanks, /En helg/);
  const code = (await host.page.$eval('.passcode', (el) => el.textContent)).trim();
  assert.match(code, CODE);
  assert.equal(admin.orders.length, 1);
  assert.equal(attribute(admin.orders[0], 'kode'), code);
  assert.equal(payment.captured, 19900);
  await back.close();
  await host.page.bringToFront();
  log(`paid in the app: the pass came to the game tab by itself ("Velkommen!", the code ${code}), with one extra tab in all`);
  await clickButton(host, 'Start runde 3');
  return { code };
}
