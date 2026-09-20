export const number = (value, fallback, min = -10000, max = 10000) =>
  value !== undefined && value !== null && value !== '' && Number.isFinite(Number(value))
    ? Math.max(min, Math.min(max, Number(value))) : fallback;
export const color = (value, fallback = '#000000') => /^#[0-9a-f]{6}$/i.test(value ?? '') ? value : fallback;
export function strokeAttrs(el, width = 2, defaultStyle = 'solid', cap = 'butt') {
  const dash = { solid: '', dashed: '6,4', dotted: '2,3', dashdot: '8,3,2,3' }[el.lineStyle ?? defaultStyle] ?? '';
  return `stroke="${color(el.stroke)}" stroke-width="${number(el.strokeWidth, width, 0, 20)}" stroke-dasharray="${dash}" stroke-linecap="${['butt', 'round', 'square'].includes(el.lineCap) ? el.lineCap : cap}"`;
}
export function fillAttrs(el) {
  return `fill="${el.fill === 'none' ? 'none' : color(el.fill, '#ffffff')}" fill-opacity="${number(el.fillOpacity, 1, 0, 1)}"`;
}
export function textAttrs(el, defaultSize = 16) {
  return `font-size="${number(el.fontSize, defaultSize, 8, 96)}px" fill="${color(el.textColor)}" transform="translate(${number(el.labelOffsetX, 0)}, ${number(el.labelOffsetY, 0)})"`;
}
export function resourceId(el, suffix) {
  return `style-${Array.from(String(el.id ?? `${el.type}-${el.x1}-${el.y1}`), ch => ch.codePointAt(0).toString(16)).join('-')}-${suffix}`;
}
export function arrowMarkup(el, dimension = false) {
  const start = el.arrowStart ?? (dimension ? 'triangle' : 'none');
  const end = el.arrowEnd ?? 'triangle';
  const size = number(el.arrowSize, dimension ? 6 : 7, 3, 20);
  let defs = '', attrs = '';
  for (const [side, kind] of [['start', start], ['end', end]]) {
    if (kind === 'none') continue;
    const id = resourceId(el, side);
    defs += `<marker id="${id}" viewBox="-1 -1 12 12" refX="10" refY="5" markerWidth="${size}" markerHeight="${size}" orient="auto-start-reverse" overflow="visible">`
      + (kind === 'open'
        ? `<path d="M 0 1 L 10 5 L 0 9" fill="none" stroke="${color(el.stroke)}" stroke-width="1.2" stroke-linejoin="round" />`
        : `<path d="M 0 1 L 10 5 L 0 9 Z" fill="${color(el.stroke)}" />`) + '</marker>';
    attrs += ` marker-${side}="url(#${id})"`;
  }
  return { defs: `<defs>${defs}</defs>`, attrs };
}
