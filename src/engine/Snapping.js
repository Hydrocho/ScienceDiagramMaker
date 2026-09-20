// Geometry anchors match the SVG shapes, excluding labels and hit buffers.
export function anchors(el) {
  if (el.type === 'block') {
    const { x, y, width = 60, height = 40 } = el;
    const points = [
      { x, y }, { x: x + width, y }, { x, y: y + height },
      { x: x + width, y: y + height },
      { x: x + width / 2, y }, { x: x + width / 2, y: y + height },
      { x, y: y + height / 2 }, { x: x + width, y: y + height / 2 },
      { x: x + width / 2, y: y + height / 2 },
    ];
    const angle = (el.rotation ?? 0) * Math.PI / 180;
    return points.map(p => ({
      x: x + (p.x - x) * Math.cos(angle) - (p.y - y) * Math.sin(angle),
      y: y + (p.x - x) * Math.sin(angle) + (p.y - y) * Math.cos(angle),
    }));
  }
  if (el.cx !== undefined) {
    const points = [{ x: el.cx, y: el.cy }];
    if (el.type === 'ball' || el.type === 'pulley') {
      const r = el.r ?? (el.type === 'ball' ? 20 : 24);
      points.push({ x: el.cx - r, y: el.cy }, { x: el.cx + r, y: el.cy },
        { x: el.cx, y: el.cy - r }, { x: el.cx, y: el.cy + r });
      if (el.type === 'pulley') points.push({ x: el.cx, y: el.cy - r - (el.supportLength ?? 24) });
    }
    return points;
  }
  if (el.x1 !== undefined) return [
    { x: el.x1, y: el.y1 }, { x: el.x2, y: el.y2 },
    { x: (el.x1 + el.x2) / 2, y: (el.y1 + el.y2) / 2 },
  ];
  return [{ x: el.x, y: el.y }];
}

function surfaces(el) {
  if (el.type === 'ground' || el.type === 'guideLine') {
    return [[{ x: el.x1, y: el.y1 }, { x: el.x2, y: el.y2 }]];
  }
  if (el.type === 'block') {
    const [a, b, c, d] = anchors(el);
    return [[a, b], [b, d], [d, c], [c, a]];
  }
  return [];
}

function project(point, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const lengthSquared = dx * dx + dy * dy;
  if (!lengthSquared) return a;
  const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSquared));
  return { x: a.x + t * dx, y: a.y + t * dy };
}

// Return one coherent translation: never snap a line's two ends separately.
export function snapTranslation(points, reference, targets, gridSize, tolerance) {
  const grid = {
    x: Math.round(reference.x / gridSize) * gridSize - reference.x,
    y: Math.round(reference.y / gridSize) * gridSize - reference.y,
  };
  let best = null;
  let distance = tolerance;
  const consider = (source, target) => {
    const d = Math.hypot(target.x - source.x, target.y - source.y);
    if (d <= tolerance && (!best || d < distance)) {
      distance = d;
      best = { x: target.x - source.x, y: target.y - source.y };
    }
  };
  // Named connection points take precedence over an arbitrary point on an edge.
  for (const target of targets) {
    for (const source of points) {
      for (const point of anchors(target)) consider(source, point);
    }
  }
  if (best) return best;
  for (const target of targets) {
    for (const [a, b] of surfaces(target)) {
      for (const source of points) {
        // Along horizontal/vertical surfaces the unconstrained axis may still
        // use the grid; project afterwards so grid rounding cannot break contact.
        const candidate = {
          x: source.x + (a.y === b.y ? grid.x : 0),
          y: source.y + (a.x === b.x ? grid.y : 0),
        };
        const point = project(candidate, a, b);
        const d = Math.hypot(point.x - candidate.x, point.y - candidate.y);
        if (d <= tolerance && (!best || d < distance)) {
          distance = d;
          best = { x: point.x - source.x, y: point.y - source.y };
        }
      }
    }
  }
  return best ?? grid;
}
