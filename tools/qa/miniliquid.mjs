// Just enough Liquid to try out the files in shopify/ without a Shopify. It knows what those files use and nothing else, and says so when it is
// asked for more, so the files stay within what is tried here:
//   tags      {% comment %}  {% assign x = … %}  {% capture x %}  {% if %} {% elsif %} {% else %}  {% unless %}  {% for x in y %} (with forloop)
//   output    {{ x.y | filter: argument, argument | filter }}, and "-" next to a brace trims the spaces around the tag ({%- -%}, {{- -}})
//   tests     == != < > <= >= contains, and / or (from the right, without precedence, as Liquid does), nil true false blank empty
//   filters   escape default downcase upcase slice round append remove replace size strip, and any that the caller gives (Shopify's own: money, format_address …)
// Like Liquid, only nil and false are false: an empty text is true, and so is 0. Unlike Liquid, a name that is not set is an error when it is
// written out (in a test it is simply false), which is what catches a misspelt name: the filter `default` is what makes a missing value fine.
// (Shopify's own Liquid is the real thing: this only catches a tag that is not closed, a name that is not set, and text that would come out wrong.)

const TOKENS = /({%[\s\S]*?%}|{{[\s\S]*?}})/;
const NAME = /^[a-z_][a-z0-9_]*(\.[a-z_][a-z0-9_]*)*$/i;
const BLANK = Symbol('blank'); // the words blank and empty
const MAX_LOOPS = 10_000;

const fail = (message) => {
  throw new Error(`miniliquid: ${message}`);
};
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const isNil = (value) => value === undefined || value === null;
/** In Liquid only nil and false are false: an empty text is true. */
const truthy = (value) => !isNil(value) && value !== false;
const isBlank = (value) => isNil(value) || value === false || (typeof value === 'string' && value.trim() === '') || (Array.isArray(value) && value.length === 0);
const text = (value) => (isNil(value) ? '' : String(value));

/** Splits at the spaces that are not inside a quoted text. */
function words(source) {
  const out = [];
  let current = '';
  let quote = null;
  for (const ch of source) {
    if (quote) {
      current += ch;
      if (ch === quote) quote = null;
    } else if (ch === '"' || ch === "'") {
      quote = ch;
      current += ch;
    } else if (/\s/.test(ch)) {
      if (current) out.push(current);
      current = '';
    } else current += ch;
  }
  if (quote) fail(`a quote that is never closed in "${source}"`);
  if (current) out.push(current);
  return out;
}

/** Splits at a character that is not inside a quoted text. */
function splitOutside(source, separator, limit = Infinity) {
  const out = [];
  let current = '';
  let quote = null;
  for (const ch of source) {
    if (quote) {
      current += ch;
      if (ch === quote) quote = null;
    } else if (ch === '"' || ch === "'") {
      quote = ch;
      current += ch;
    } else if (ch === separator && out.length < limit - 1) {
      out.push(current);
      current = '';
    } else current += ch;
  }
  out.push(current);
  return out;
}

function parseValue(source) {
  const s = source.trim();
  if (/^'[^']*'$|^"[^"]*"$/.test(s)) return { literal: s.slice(1, -1) };
  if (/^-?\d+(\.\d+)?$/.test(s)) return { literal: Number(s) };
  if (s === 'true') return { literal: true };
  if (s === 'false') return { literal: false };
  if (s === 'nil' || s === 'null') return { literal: null };
  if (s === 'blank' || s === 'empty') return { literal: BLANK };
  if (!NAME.test(s)) fail(`"${s}" is not a name`);
  return { path: s.split('.'), source: s };
}

/** `a | f: x, y | g` → the value a and the list of filters. */
function parseExpression(source) {
  const [head, ...rest] = splitOutside(source, '|');
  const filters = rest.map((part) => {
    const [name, args] = splitOutside(part, ':', 2);
    if (!/^\s*[a-z_]+\s*$/i.test(name)) fail(`"${part.trim()}" is not a filter`);
    return { name: name.trim(), args: args === undefined ? [] : splitOutside(args, ',').map(parseValue) };
  });
  return { value: parseValue(head), filters, source: source.trim() };
}

/** `a and b or c` is a and (b or c), because Liquid reads from the right. */
function parseCondition(source) {
  const list = words(source);
  const at = list.findIndex((w) => w === 'and' || w === 'or');
  if (at !== -1) {
    if (at === 0 || at === list.length - 1) fail(`"${source}" has an and/or with nothing on one side`);
    return { logic: list[at], left: parseCondition(list.slice(0, at).join(' ')), right: parseCondition(list.slice(at + 1).join(' ')) };
  }
  if (list.length === 1) return { test: parseValue(list[0]) };
  if (list.length === 3 && ['==', '!=', '<>', '<', '>', '<=', '>=', 'contains'].includes(list[1])) {
    return { left: parseValue(list[0]), op: list[1], right: parseValue(list[2]) };
  }
  return fail(`"${source}" is more than a comparison of two values`);
}

/** The tokens, with the "-" of {%- and -%} already used up: the text next to such a tag has lost its spaces. */
function tokenize(source) {
  const parts = source.split(TOKENS);
  const tokens = parts.map((part, k) => {
    if (k % 2 === 0) return { text: part };
    const inner = part.slice(2, -2);
    return { tag: part.startsWith('{%'), body: inner.replace(/^-/, '').replace(/-$/, '').trim(), trimBefore: inner.startsWith('-'), trimAfter: inner.endsWith('-') && inner.length > 1 };
  });
  tokens.forEach((token, k) => {
    if (token.text !== undefined) return;
    if (token.trimBefore && tokens[k - 1]) tokens[k - 1].text = tokens[k - 1].text.replace(/\s+$/, '');
    if (token.trimAfter && tokens[k + 1]) tokens[k + 1].text = tokens[k + 1].text.replace(/^\s+/, '');
  });
  return tokens;
}

function parse(tokens) {
  let at = 0;
  /** The nodes up to the tag that one of `stops` names; says which one stopped it (none = the end of the file). */
  function block(stops) {
    const nodes = [];
    while (at < tokens.length) {
      const token = tokens[at++];
      if (token.text !== undefined) {
        if (token.text) nodes.push({ type: 'text', text: token.text });
        continue;
      }
      if (!token.tag) {
        nodes.push({ type: 'output', expression: parseExpression(token.body) });
        continue;
      }
      const word = token.body.split(/\s+/)[0];
      const rest = token.body.slice(word.length).trim();
      if (stops.includes(word)) return { nodes, stop: word, rest };
      if (word === 'comment') {
        while (at < tokens.length && !(tokens[at].tag && tokens[at].body === 'endcomment')) at++;
        if (at >= tokens.length) fail('a {% comment %} that is never closed');
        at++;
      } else if (word === 'assign') {
        const m = rest.match(/^([a-z_][a-z0-9_]*)\s*=\s*([\s\S]+)$/i);
        if (!m) fail(`"{% ${token.body} %}" is not an assign`);
        nodes.push({ type: 'assign', name: m[1], expression: parseExpression(m[2]) });
      } else if (word === 'capture') {
        if (!/^[a-z_][a-z0-9_]*$/i.test(rest)) fail(`"{% ${token.body} %}" is not a capture`);
        const body = block(['endcapture']);
        if (!body.stop) fail('a {% capture %} that is never closed');
        nodes.push({ type: 'capture', name: rest, body: body.nodes });
      } else if (word === 'if' || word === 'unless') {
        const branches = [];
        let condition = rest;
        let negate = word === 'unless';
        let otherwise = null;
        for (;;) {
          const body = block(['elsif', 'else', 'endif', 'endunless']);
          if (!body.stop) fail(`an {% ${word} %} that is never closed`);
          if (body.stop === `end${word === 'if' ? 'unless' : 'if'}`) fail(`an {% ${word} %} that is closed with {% ${body.stop} %}`);
          branches.push({ condition: parseCondition(condition), negate, body: body.nodes });
          negate = false;
          if (body.stop === 'elsif') {
            condition = body.rest;
            continue;
          }
          if (body.stop === 'else') {
            const last = block([`end${word}`]);
            if (!last.stop) fail(`an {% ${word} %} that is never closed`);
            otherwise = last.nodes;
          }
          break;
        }
        nodes.push({ type: 'if', branches, otherwise });
      } else if (word === 'for') {
        const m = rest.match(/^([a-z_][a-z0-9_]*)\s+in\s+([a-z_][a-z0-9_.]*)$/i);
        if (!m) fail(`"{% ${token.body} %}" is more than a plain for-loop over a name`);
        const body = block(['else', 'endfor']);
        if (!body.stop) fail('a {% for %} that is never closed');
        let otherwise = null;
        if (body.stop === 'else') {
          const last = block(['endfor']);
          if (!last.stop) fail('a {% for %} that is never closed');
          otherwise = last.nodes;
        }
        nodes.push({ type: 'for', variable: m[1], collection: parseValue(m[2]), body: body.nodes, otherwise });
      } else fail(`the tag "${word}" is not tried here`);
    }
    return { nodes, stop: null };
  }
  const top = block([]);
  return top.nodes;
}

const FILTERS = {
  escape: (v) => esc(text(v)),
  /** nil, false and the empty text (and the empty list) take the default. */
  default: (v, fallback) => (isNil(v) || v === false || v === '' || (Array.isArray(v) && v.length === 0) ? fallback : v),
  downcase: (v) => text(v).toLowerCase(),
  upcase: (v) => text(v).toUpperCase(),
  slice: (v, from, length = 1) => text(v).slice(from < 0 ? text(v).length + from : from).slice(0, length),
  round: (v, digits = 0) => {
    const n = Number(v);
    const factor = 10 ** digits;
    const rounded = Math.round(n * factor) / factor;
    return digits === 0 ? Math.trunc(rounded) : rounded;
  },
  append: (v, s) => text(v) + text(s),
  remove: (v, s) => text(v).split(text(s)).join(''),
  replace: (v, a, b) => text(v).split(text(a)).join(text(b)),
  size: (v) => (isNil(v) ? 0 : typeof v === 'string' || Array.isArray(v) ? v.length : Object.keys(v).length),
  strip: (v) => text(v).trim(),
};

/**
 * Renders a Liquid file with the values in `vars`.
 * `options.filters` adds filters that only Shopify has: an object of { name: (value, ...arguments) => text }.
 */
export function renderLiquid(source, vars = {}, options = {}) {
  const ast = parse(tokenize(source));
  const filters = { ...FILTERS, ...(options.filters ?? {}) };
  const frames = [{ ...vars }]; // [0] is where {% assign %} writes; a for-loop adds a frame for its variable
  let loops = 0;

  const lookup = (value) => {
    if (value.literal !== undefined) return value.literal === BLANK ? BLANK : value.literal;
    const [first, ...path] = value.path;
    let current;
    for (let k = frames.length - 1; k >= 0; k--) {
      if (first in frames[k]) {
        current = frames[k][first];
        break;
      }
    }
    for (const key of path) {
      if (isNil(current)) return undefined;
      if (key === 'size' && (typeof current === 'string' || Array.isArray(current))) current = current.length;
      else if (key === 'first' && Array.isArray(current)) current = current[0];
      else if (key === 'last' && Array.isArray(current)) current = current[current.length - 1];
      else current = current[key];
    }
    return current;
  };
  const evaluate = (expression) => {
    let value = lookup(expression.value);
    for (const filter of expression.filters) {
      const apply = filters[filter.name];
      if (!apply) fail(`the filter "${filter.name}" is not tried here`);
      value = apply(value, ...filter.args.map(lookup));
    }
    return value;
  };
  const equal = (a, b) => {
    if (a === BLANK) return isBlank(b);
    if (b === BLANK) return isBlank(a);
    return (isNil(a) && isNil(b)) || a === b;
  };
  const test = (condition) => {
    if (condition.logic) return condition.logic === 'and' ? test(condition.left) && test(condition.right) : test(condition.left) || test(condition.right);
    if (condition.test) {
      const value = lookup(condition.test);
      return value === BLANK ? false : truthy(value);
    }
    const left = lookup(condition.left);
    const right = lookup(condition.right);
    switch (condition.op) {
      case '==': return equal(left, right);
      case '!=': case '<>': return !equal(left, right);
      case 'contains': return (typeof left === 'string' && typeof right === 'string' && left.includes(right)) || (Array.isArray(left) && left.includes(right));
      default: {
        // Liquid only compares numbers with numbers (anything else is false)
        if (typeof left !== 'number' || typeof right !== 'number') return false;
        return { '<': left < right, '>': left > right, '<=': left <= right, '>=': left >= right }[condition.op];
      }
    }
  };
  const run = (nodes) => {
    let out = '';
    for (const node of nodes) {
      if (node.type === 'text') out += node.text;
      else if (node.type === 'output') {
        const value = evaluate(node.expression);
        if (isNil(value)) fail(`"${node.expression.source}" is not set`);
        if (typeof value === 'object' && !Array.isArray(value)) fail(`"${node.expression.source}" is not a text or a number`);
        out += Array.isArray(value) ? value.join('') : String(value);
      } else if (node.type === 'assign') frames[0][node.name] = evaluate(node.expression);
      else if (node.type === 'capture') frames[0][node.name] = run(node.body);
      else if (node.type === 'if') {
        const branch = node.branches.find((b) => test(b.condition) !== b.negate);
        if (branch) out += run(branch.body);
        else if (node.otherwise) out += run(node.otherwise);
      } else if (node.type === 'for') {
        const list = lookup(node.collection);
        if (!isNil(list) && !Array.isArray(list)) fail(`"${node.collection.source}" is not a list`);
        if (!list || list.length === 0) {
          if (node.otherwise) out += run(node.otherwise);
          continue;
        }
        list.forEach((item, index) => {
          if (++loops > MAX_LOOPS) fail('a for-loop that never ends');
          frames.push({ [node.variable]: item, forloop: { index: index + 1, index0: index, first: index === 0, last: index === list.length - 1, length: list.length } });
          try {
            out += run(node.body);
          } finally {
            frames.pop();
          }
        });
      }
    }
    return out;
  };
  return run(ast);
}
