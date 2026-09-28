export const PHYSICS_FONTS = {
  katex: "'KaTeX_Math', 'STIX Two Text', 'Cambria Math', 'Times New Roman', serif",
  stix: "'STIX Two Text', 'KaTeX_Math', 'Cambria Math', serif",
  cambria: "Cambria, 'Cambria Math', 'Times New Roman', serif",
  times: "'Times New Roman', Cambria, serif",
  georgia: "Georgia, Cambria, serif",
};
const GREEK = {
  alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', epsilon: 'ε', zeta: 'ζ', eta: 'η', theta: 'θ',
  iota: 'ι', kappa: 'κ', lambda: 'λ', mu: 'μ', nu: 'ν', xi: 'ξ', pi: 'π', rho: 'ρ', sigma: 'σ',
  tau: 'τ', upsilon: 'υ', phi: 'φ', chi: 'χ', psi: 'ψ', omega: 'ω',
  Gamma: 'Γ', Delta: 'Δ', Theta: 'Θ', Lambda: 'Λ', Xi: 'Ξ', Pi: 'Π', Sigma: 'Σ', Phi: 'Φ', Psi: 'Ψ', Omega: 'Ω',
};
export function escapeHtml(value) {
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
const greek = text => text.replace(/\\([a-zA-Z]+)/g, (raw, name) => GREEK[name] ?? raw);
const SI_UNITS = new Set([
  'm', 'cm', 'mm', 'km', 'nm',
  'g', 'kg', 'mg',
  's', 'ms', 'us', 'ns',
  'N', 'J', 'W', 'Hz', 'Pa', 'V', 'A', 'K', 'mol', 'cd', 'rad', 'deg', 'dB', 'T', 'C', 'F', 'H', 'Ω', 'ohm'
]);

export function parsePhysicsText(rawText) {
  if (!rawText) return [];
  let raw = String(rawText);

  // Convert \text{...}, \mathrm{...}, \rm{...} to internal placeholder
  raw = raw.replace(/\\(?:text|mathrm|rm)\{([^{}]+)\}/g, '§T{$1}§');

  const tokens = [];
  const regex = /§T\{([^{}]+)\}§|(\d+(?:\.\d+)?)\s*([a-zA-ZΩμ°]+(?:\/[a-zA-Z0-9^]+)?)?|\\([a-zA-Z]+)|([a-zA-Zα-ωΑ-Ωϑϕϖ])|(\d+)/g;

  let last = 0, match;
  while ((match = regex.exec(raw))) {
    if (match.index > last) {
      tokens.push({ type: 'text', val: raw.slice(last, match.index) });
    }

    if (match[1] !== undefined) {
      // Explicit \text{...} or \mathrm{...}
      tokens.push({ type: 'text', val: match[1] });
    } else if (match[2] !== undefined) {
      // Number (match[2]) and optional unit (match[3])
      const numStr = match[2];
      const unitCandidate = match[3];

      tokens.push({ type: 'math', var: numStr, isNumber: true });

      if (unitCandidate) {
        const baseUnit = unitCandidate.split('/')[0].replace(/\^\d+/, '');
        if (SI_UNITS.has(baseUnit) || unitCandidate.includes('/')) {
          tokens.push({ type: 'unit', val: ' ' + unitCandidate });
        } else {
          // If not an SI unit, roll back regex index so trailing letters can be parsed as math vars
          regex.lastIndex -= unitCandidate.length;
        }
      }
    } else if (match[4] !== undefined) {
      // Macro like \theta
      const symbol = GREEK[match[4]];
      if (symbol) {
        tokens.push({ type: 'math', var: symbol, sub: null, sup: null });
      } else {
        tokens.push({ type: 'text', val: '\\' + match[4] });
      }
    } else if (match[5] !== undefined) {
      // Single letter variable (m, v, h, F)
      const token = { type: 'math', var: match[5], sub: null, sup: null };
      for (let i = 0; i < 2; i++) {
        const script = raw.slice(regex.lastIndex).match(/^([_^])(?:\{([^{}]+)\}|(\\[a-zA-Z]+|[a-zA-Z0-9α-ωΑ-Ω]+))/);
        if (!script) break;
        const key = script[1] === '_' ? 'sub' : 'sup';
        if (token[key] !== null) break;
        token[key] = greek(script[2] ?? script[3]);
        regex.lastIndex += script[0].length;
      }
      tokens.push(token);
    } else if (match[6] !== undefined) {
      tokens.push({ type: 'math', var: match[6], isNumber: true });
    }

    last = regex.lastIndex;
  }

  if (last < raw.length) {
    tokens.push({ type: 'text', val: raw.slice(last) });
  }

  return tokens;
}

export function buildSvgTextSpans(rawText, fontSize = 16, fill = '#000000', options = {}) {
  const family = PHYSICS_FONTS[options.fontFamily] ?? PHYSICS_FONTS.katex;
  const weight = String(options.fontWeight) === '700' ? '700' : '400';
  const mathStyle = options.mathStyle === 'normal' ? 'normal' : 'italic';

  const span = (value, extra = '', italic = true) => `<tspan font-family="${italic ? family : "'Noto Serif KR', 'Malgun Gothic', 'Times New Roman', serif"}" fill="${escapeHtml(fill)}" font-weight="${weight}" font-style="${italic ? mathStyle : 'normal'}" ${extra}>${escapeHtml(value)}</tspan>`;

  return parsePhysicsText(rawText).map(token => {
    if (token.type === 'text' || token.type === 'unit') {
      return span(token.val, '', false);
    }
    const isMathItalic = token.type === 'math' && !token.isNumber && options.mathStyle !== 'normal';
    let svg = span(token.var, '', isMathItalic);
    for (const [key, dy] of [['sub', fontSize * 0.25], ['sup', -fontSize * 0.45]]) {
      if (token[key]) {
        const scriptIsNumber = /^\d+$/.test(token[key]);
        const scriptItalic = isMathItalic && !scriptIsNumber;
        svg += span(token[key], `font-size="${fontSize * 0.7}px" dy="${dy}px"`, scriptItalic)
          + `<tspan dy="${-dy}px">&#8203;</tspan>`;
      }
    }
    return svg;
  }).join('');
}
