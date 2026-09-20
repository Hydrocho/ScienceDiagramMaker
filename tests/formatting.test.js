import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSvgTextSpans, parsePhysicsText } from '../src/engine/MathRenderer.js';
import { SvgEngine } from '../src/engine/SvgEngine.js';
import { Inspector } from '../src/ui/Inspector.js';

const engine = Object.create(SvgEngine.prototype);
test('physics labels support Greek commands, grouped subscripts and superscripts', () => {
  const tokens = parsePhysicsText('v_{0}^2 + \\alpha + \\Delta + θ');
  assert.ok(tokens.some(t => t.var === 'v' && t.sub === '0' && t.sup === '2'));
  for (const symbol of ['α', 'Δ', 'θ']) assert.ok(tokens.some(t => t.var === symbol));
});
test('variables use Cambria italic while numeric subscripts stay upright', () => {
  const svg = buildSvgTextSpans('v_0');
  assert.match(svg, /Cambria/);
  assert.match(svg, /font-style="italic"[^>]*>v</);
  assert.match(svg, /font-style="normal"[^>]*>0</);
});
test('font, weight and upright choice apply to the full expression', () => {
  const svg = buildSvgTextSpans('m_A', 24, '#123456', { fontFamily: 'times', fontWeight: '700', mathStyle: 'normal' });
  assert.match(svg, /Times New Roman/);
  assert.match(svg, /font-weight="700"/);
  assert.doesNotMatch(svg, /font-style="italic"/);
  assert.match(svg, /fill="#123456"/);
});
test('stroke settings apply to every geometry without coloring hit buffers', () => {
  for (const type of ['ground', 'ball', 'block', 'vector', 'dimension', 'guideLine', 'spring', 'pulley', 'angleArc']) {
    const svg = engine.renderElementSvg({ id: type, type, x: 60, y: 60, cx: 90, cy: 90,
      x1: 60, y1: 60, x2: 180, y2: 120, stroke: '#2563eb', strokeWidth: 4, lineStyle: 'dotted', lineCap: 'round' });
    assert.match(svg, /stroke="#2563eb"/, type);
    assert.match(svg, /stroke-width="4"/, type);
    assert.match(svg, /stroke-dasharray="2,3"/, type);
  }
});
test('fill color and opacity work for blocks, balls and pulleys', () => {
  for (const type of ['block', 'ball', 'pulley']) {
    const svg = engine.renderElementSvg({ type, x: 0, y: 0, cx: 30, cy: 30, fill: '#fde68a', fillOpacity: 0.4 });
    assert.match(svg, /fill="#fde68a" fill-opacity="0.4"/);
  }
});
test('custom arrowheads use the line color and can be disabled independently', () => {
  const svg = engine.drawVector({ id: 'force', x1: 0, y1: 0, x2: 60, y2: 0,
    stroke: '#dc2626', arrowStart: 'open', arrowEnd: 'none', arrowSize: 10 });
  assert.match(svg, /marker-start="url\(#/);
  assert.doesNotMatch(svg, /marker-end=/);
  assert.match(svg, /markerWidth="10"/);
  assert.match(svg, /stroke="#dc2626"/);
});
test('label formatting uses the selected size and offset in rendered SVG', () => {
  const svg = engine.drawBlock({ x: 0, y: 0, width: 60, height: 60, label: 'F',
    fontSize: 24, textColor: '#123456', labelOffsetX: 10, labelOffsetY: -5 });
  assert.match(svg, /font-size="24px"/);
  assert.match(svg, /fill="#123456"/);
  assert.match(svg, /transform="translate\(10, -5\)"/);
});
test('preview edits preserve inspector focus and commit one undo step', () => {
  const e = Object.create(SvgEngine.prototype);
  Object.assign(e, { elements: [{ id: 'a', type: 'block', strokeWidth: 2 }], selectedId: 'a', history: [], historyIndex: -1,
    render(notify) { this.notified = notify; } });
  e.saveState();
  e.updateSelectedElement({ strokeWidth: 3 }, { save: false, notify: false });
  e.updateSelectedElement({ strokeWidth: 4 }, { save: false, notify: false });
  assert.equal(e.history.length, 1);
  assert.equal(e.notified, false);
  e.saveState();
  assert.equal(e.history.length, 2);
  e.undo();
  assert.equal(e.elements[0].strokeWidth, 2);
});

test('no-fill toggle restores the chosen color after both input and change events', () => {
  const element = { id: 'a', fill: '#fde68a' };
  const inspector = Object.create(Inspector.prototype);
  inspector.lastFill = new Map();
  inspector.engine = { getSelectedElement: () => element, updateSelectedElement: props => Object.assign(element, props) };
  const input = { matches: () => true, dataset: { prop: 'noFill' }, type: 'checkbox', checked: true };
  inspector.container = { querySelectorAll: () => [], querySelector: () => input };
  inspector.edit({ type: 'input', target: input });
  inspector.edit({ type: 'change', target: input });
  assert.equal(element.fill, 'none');
  input.checked = false;
  inspector.edit({ type: 'input', target: input });
  assert.equal(element.fill, '#fde68a');
});

test('arranging and duplicating preserve geometry and formatting with undo', () => {
  const e = Object.create(SvgEngine.prototype);
  Object.assign(e, { elements: [{ id: 'a', type: 'block', x: 15, y: 30, fill: '#fde68a', rotation: 30 }, { id: 'b', type: 'ball' }],
    selectedId: 'a', gridSize: 15, history: [], historyIndex: -1, render() {} });
  e.saveState();
  e.arrangeSelected('front');
  assert.deepEqual(e.elements.map(el => el.id), ['b', 'a']);
  e.duplicateSelected();
  const copy = e.getSelectedElement();
  assert.notEqual(copy.id, 'a');
  assert.equal(copy.x, 30); assert.equal(copy.y, 45);
  assert.equal(copy.fill, '#fde68a'); assert.equal(copy.rotation, 30);
  e.undo();
  assert.deepEqual(e.elements.map(el => el.id), ['b', 'a']);
  e.undo();
  assert.deepEqual(e.elements.map(el => el.id), ['a', 'b']);
});
