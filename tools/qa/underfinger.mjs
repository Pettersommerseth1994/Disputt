// What a hold-to-see button reveals must not sit where the finger that holds it covers it. The finger is on the button, and
// the hand comes from below, so everything on or straight below the button is hidden from the person holding it. This runs
// inside the page (hand it to page.evaluate) and lists every line of revealed text on or below a hold button: the role card on
// the role screen, and what the role strip says beside its button.
export function underTheFinger() {
  const found = [];
  for (const button of document.querySelectorAll('.hold-btn, .role-strip .secret')) {
    const b = button.getBoundingClientRect();
    if (!b.width || !b.height) continue;
    for (const holder of document.querySelectorAll('.rolecard, .role-strip__info')) {
      const walker = document.createTreeWalker(holder, NodeFilter.SHOW_TEXT);
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        if (!n.textContent.trim()) continue;
        const range = document.createRange();
        range.selectNodeContents(n);
        for (const line of range.getClientRects()) {
          if (line.width < 3 || line.height < 3) continue;
          const sideways = Math.min(line.right, b.right) - Math.max(line.left, b.left); // how far it lies over the button's width
          if (sideways > 2 && line.bottom > b.top + 2) found.push(`"${n.textContent.trim().slice(0, 28)}"`);
        }
      }
    }
  }
  return [...new Set(found)];
}
