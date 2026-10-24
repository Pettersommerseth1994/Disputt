// The terms and the privacy statement (vilkar.html, personvern.html) have one block per language: <div lang data-lang="no|da|sv">. This shows the
// one that fits the language kept on the phone (localStorage 'disputt:sprak', set by the language card in the game) and hides the others. It also
// sets <html lang>, <title> and the description from the data-title / data-description of that block. Without this script, or without a stored
// choice, the Norwegian block is the one that shows (the others carry `hidden` in the HTML). A classic script at the end of <body>: no dependencies.
(function () {
  var KEY = 'disputt:sprak';
  var lang = 'no';
  try {
    var stored = localStorage.getItem(KEY);
    if (stored === 'da' || stored === 'sv' || stored === 'no') lang = stored;
  } catch (e) {
    /* storage blocked: Norwegian */
  }
  var blocks = document.querySelectorAll('[data-lang]');
  var found = null;
  for (var i = 0; i < blocks.length; i++) if (blocks[i].getAttribute('data-lang') === lang) found = blocks[i];
  if (!found) return; // (nothing to change: what is in the HTML stays)
  for (var j = 0; j < blocks.length; j++) blocks[j].hidden = blocks[j] !== found;
  var code = found.getAttribute('lang');
  if (code) document.documentElement.lang = code;
  var title = found.getAttribute('data-title');
  if (title) document.title = title;
  var description = found.getAttribute('data-description');
  var meta = document.querySelector('meta[name="description"]');
  if (description && meta) meta.setAttribute('content', description);
})();
