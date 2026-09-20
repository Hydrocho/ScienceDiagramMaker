import test from 'node:test';
import assert from 'node:assert/strict';
import { PRESETS } from '../src/presets/templates.js';
import { anchors } from '../src/engine/Snapping.js';
import { SvgEngine } from '../src/engine/SvgEngine.js';
const preset = id => Object.fromEntries(PRESETS.find(p => p.id === id).elements.map(e => [e.id, e]));
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-8, `${a} != ${b}`);

test('all preset placement coordinates lie on the default grid', () => {
  for (const p of PRESETS) for (const e of p.elements) {
    for (const key of ['x', 'y', 'x1', 'y1', 'x2', 'y2', 'cx', 'cy']) {
      if (e[key] !== undefined) near(e[key] / 15, Math.round(e[key] / 15));
    }
  }
});
test('incline block bottom and force follow the actual ramp angle', () => {
  const p = preset('inclined_plane'), ramp = p.ramp_line;
  const [a, b, c, d] = anchors(p.block_ramp);
  const dx = ramp.x2 - ramp.x1, dy = ramp.y2 - ramp.y1;
  for (const point of [c, d]) near((point.x - ramp.x1) * dy, (point.y - ramp.y1) * dx);
  const f = p.vec_force;
  near((f.x2 - f.x1) * dy, (f.y2 - f.y1) * dx);
  assert.ok([a, b, c, d].some(pt => Math.hypot(pt.x - f.x1, pt.y - f.y1) < 1e-8));
  near(p.angle_theta.endAngle, -Math.atan2(dy, dx) * 180 / Math.PI);
});
test('pulley support, tangent ropes and block centers meet exactly', () => {
  const p = preset('pulley_atwood'), wheel = p.pulley_wheel;
  near(wheel.cy - wheel.r - (wheel.supportLength ?? 24), p.ceiling.y1);
  assert.ok(p.block_m1.x + p.block_m1.width < p.block_m2.x, 'hanging masses need a visible gap');
  for (const [rope, block, sign] of [[p.rope_left, p.block_m1, -1], [p.rope_right, p.block_m2, 1]]) {
    near(rope.x1, wheel.cx + sign * wheel.r);
    near(rope.y1, wheel.cy);
    near(rope.x2, block.x + block.width / 2);
    near(rope.y2, block.y);
  }
});
test('spring and collision objects rest on their floors', () => {
  const s = preset('spring_mass');
  near(s.block_m.y + s.block_m.height, s.ground_bottom.y1);
  near(s.spring_k.x1, s.wall_left.x1);
  near(s.spring_k.x2, s.block_m.x);
  near(s.spring_k.y2, s.block_m.y + s.block_m.height / 2);
  const c = preset('collision');
  for (const ball of [c.ball_A, c.ball_B]) near(ball.cy + ball.r, c.ground_coll.y1);
});
test('rotated block render and resize handle share transformed geometry', () => {
  const engine = Object.create(SvgEngine.prototype);
  const block = { type: 'block', x: 100, y: 100, width: 60, height: 30, rotation: -90 };
  assert.match(engine.drawBlock(block), /rotate\(-90\)/);
  const points = anchors(block);
  near(points[3].x, 130); near(points[3].y, 40);
  engine.interactionGroup = { innerHTML: '' };
  engine.renderHandles(block);
  assert.match(engine.interactionGroup.innerHTML, /x="124" y="34"/);
});
test('vertical wall hatch occupies the strip along the wall, on its left', () => {
  const engine = Object.create(SvgEngine.prototype);
  const svg = engine.drawGround({ x1: 120, y1: 150, x2: 120, y2: 345, hatchSide: 'left', hatchSize: 12 });
  assert.match(svg, /points="0,0 195,0 195,12 0,12"/);
});
