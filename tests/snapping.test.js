import test from 'node:test';
import assert from 'node:assert/strict';
import { SvgEngine } from '../src/engine/SvgEngine.js';
import { snapTranslation } from '../src/engine/Snapping.js';

// Exercise the real drag handler without requiring a browser to render SVG.
function drag(element, handle, dx, dy, targets = [], snap = true) {
  const engine = Object.create(SvgEngine.prototype);
  Object.assign(engine, {
    elements: [structuredClone(element), ...targets], selectedId: element.id,
    isDragging: true, activeHandle: handle, dragStart: { x: 0, y: 0 },
    elementStartPos: structuredClone(element), snapToGrid: snap, gridSize: 15, zoom: 1,
    getCanvasCoords: e => ({ x: e.clientX, y: e.clientY }), render() {},
  });
  engine.onMouseMove({ clientX: dx, clientY: dy });
  return engine.getSelectedElement();
}

test('moving an off-grid sloped line preserves its exact direction and length', () => {
  const line = { id: 'a', type: 'vector', x1: 290, y1: 240, x2: 360, y2: 202 };
  const moved = drag(line, 'move', 17, 13);
  assert.equal(moved.x2 - moved.x1, 70);
  assert.equal(moved.y2 - moved.y1, -38);
});

test('a vector endpoint connects to the ball surface outside the grid', () => {
  const moved = drag({ id: 'a', type: 'vector', x1: 300, y1: 200, x2: 300, y2: 260 }, 'p1', 2, -26,
    [{ id: 'b', type: 'ball', cx: 300, cy: 150, r: 22 }]);
  assert.equal(moved.x1, 300);
  assert.equal(moved.y1, 172);
  assert.equal(moved.y2, 260);
});

test('block bottom contacts an off-grid floor while preserving its size', () => {
  const moved = drag({ id: 'a', type: 'block', x: 280, y: 250, width: 60, height: 80 }, 'move', 31, 18,
    [{ id: 'b', type: 'ground', x1: 100, y1: 350, x2: 500, y2: 350 }]);
  assert.equal(moved.y + moved.height, 350);
  assert.equal(moved.width, 60);
  assert.equal(moved.height, 80);
});

test('ball bottom contacts the floor instead of snapping its center through it', () => {
  const moved = drag({ id: 'a', type: 'ball', cx: 200, cy: 290, r: 25 }, 'center', 18, 3,
    [{ id: 'b', type: 'ground', x1: 80, y1: 320, x2: 520, y2: 320 }]);
  assert.equal(moved.cy + moved.r, 320);
});

test('spring endpoint connects to a block side midpoint', () => {
  const moved = drag({ id: 'a', type: 'spring', x1: 100, y1: 310, x2: 260, y2: 310 }, 'p2', 18, 1,
    [{ id: 'b', type: 'block', x: 280, y: 270, width: 60, height: 80 }]);
  assert.equal(moved.x2, 280);
  assert.equal(moved.y2, 310);
});

test('pulley support connects to the ceiling', () => {
  const moved = drag({ id: 'a', type: 'pulley', cx: 300, cy: 140, r: 28 }, 'move', 0, -6,
    [{ id: 'b', type: 'ground', x1: 150, y1: 80, x2: 450, y2: 80 }]);
  assert.equal(moved.cy - moved.r - 24, 80);
});

test('resizing snaps the absolute corner, not the width and height', () => {
  const moved = drag({ id: 'a', type: 'block', x: 280, y: 270, width: 60, height: 80 }, 'p2', 2, 2);
  assert.equal(moved.x + moved.width, 345);
  assert.equal(moved.y + moved.height, 345);
});

test('resizing a rotated block follows its local axes', () => {
  const moved = drag({ id: 'a', type: 'block', x: 150, y: 150, width: 60, height: 30, rotation: -90 }, 'p2', 15, -30, [], false);
  assert.ok(Math.abs(moved.width - 90) < 1e-8);
  assert.ok(Math.abs(moved.height - 45) < 1e-8);
  assert.equal(moved.rotation, -90);
});

test('disabling the magnet preserves free movement even near a connection', () => {
  const moved = drag({ id: 'a', type: 'vector', x1: 300, y1: 200, x2: 300, y2: 260 }, 'p1', 2.3, -26.2,
    [{ id: 'b', type: 'ball', cx: 300, cy: 150, r: 22 }], false);
  assert.equal(moved.x1, 302.3);
  assert.equal(moved.y1, 173.8);
});

test('surface contact at high zoom is independent of tangential grid rounding', () => {
  const offset = snapTranslation([{ x: 217, y: 319 }], { x: 217, y: 294 },
    [{ type: 'ground', x1: 80, y1: 320, x2: 520, y2: 320 }], 15, 8 / 3);
  assert.equal(319 + offset.y, 320);
  assert.equal(217 + offset.x, 210);
});

test('arrow tips render at the connection coordinate without overshooting', () => {
  const engine = Object.create(SvgEngine.prototype);
  engine.gridSize = 15;
  engine.svg = { innerHTML: '', querySelector() { return null; } };
  engine.initSvgDefs();
  const markers = [...engine.svg.innerHTML.matchAll(/<marker\b([^>]+)>([\s\S]*?)<\/marker>/g)];
  assert.equal(markers.length, 2);
  for (const [, attributes, body] of markers) {
    const refX = Number(attributes.match(/refX="([^"]+)"/)[1]);
    const tipX = Number(body.match(/L\s+(\d+)\s+5/)[1]);
    assert.equal(refX, tipX);
  }
});
