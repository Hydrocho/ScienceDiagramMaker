import { buildSvgTextSpans } from './MathRenderer.js';
import { anchors, snapTranslation } from './Snapping.js';

export class SvgEngine {
  constructor(svgElement, wrapperElement) {
    this.svg = svgElement;
    this.wrapper = wrapperElement;
    this.elements = [];
    this.selectedIds = new Set();
    this.clipboard = null;
    this.history = [];
    this.historyIndex = -1;
    
    // Settings & Options
    this.showGrid = true;
    this.snapToGrid = true;
    this.gridSize = 15; // 15px grid step

    // Zoom & Pan state
    this.zoom = 1;
    this.minZoom = 0.4;
    this.maxZoom = 4.0;
    this.pan = { x: 0, y: 0 };
    this.isSpacePressed = false;
    this.isPanning = false;
    this.panStart = { x: 0, y: 0 };
    this.panStartOffset = { x: 0, y: 0 };

    this.mode = 'select';
    this.isDragging = false;
    this.dragTarget = null;
    this.dragStart = { x: 0, y: 0 };
    this.elementsStartPos = null;
    this.isSelectingBox = false;
    this.selectionBoxStart = null;

    this.initSvgDefs();
    this.bindEvents();
    this.updateTransform();
    this.saveState();
  }

  get selectedId() {
    return this.selectedIds.size > 0 ? Array.from(this.selectedIds)[this.selectedIds.size - 1] : null;
  }

  set selectedId(id) {
    this.selectedIds = id ? new Set([id]) : new Set();
  }

  initSvgDefs() {
    this.svg.innerHTML = `
      <defs>
        <style>
          @import url('https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.css');
          @import url('https://fonts.googleapis.com/css2?family=STIX+Two+Text:ital,wght@0,400..700;1,400..700&amp;display=swap');
        </style>
        <!-- Grid Background Pattern -->
        <pattern id="grid-pattern" width="${this.gridSize}" height="${this.gridSize}" patternUnits="userSpaceOnUse">
          <path d="M ${this.gridSize} 0 L 0 0 0 ${this.gridSize}" fill="none" stroke="#e2e8f0" stroke-width="0.8" />
        </pattern>

        <!-- Standard Exam Hatch Pattern (Diagonal 45 deg lines for Ground/Wall) -->
        <pattern id="hatch-pattern" width="10" height="10" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">
          <line x1="0" y1="0" x2="0" y2="10" stroke="#000000" stroke-width="1.5" />
        </pattern>
        
        <!-- Arrowhead Marker (Single) -->
        <marker id="arrowhead" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M 0 1 L 10 5 L 0 9 z" fill="#000000" />
        </marker>
        
        <!-- Open Arrowhead (For dimension lines) -->
        <marker id="dimension-arrow" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 1 L 10 5 L 0 9 Z" fill="#000000" />
        </marker>
      </defs>
      <rect id="bgGrid" width="100%" height="100%" fill="${this.showGrid ? 'url(#grid-pattern)' : 'transparent'}" pointer-events="all" />
      <g id="contentLayer"></g>
      <g id="interactionLayer"></g>
    `;
    
    this.bgGrid = this.svg.querySelector('#bgGrid');
    this.contentGroup = this.svg.querySelector('#contentLayer');
    this.interactionGroup = this.svg.querySelector('#interactionLayer');
  }

  // --- Zoom & Pan Management ---
  updateTransform() {
    // SVG transform syntax requires numbers without 'px' units
    const transformStr = `translate(${this.pan.x}, ${this.pan.y}) scale(${this.zoom})`;

    if (this.contentGroup) {
      this.contentGroup.setAttribute('transform', transformStr);
    }
    if (this.interactionGroup) {
      this.interactionGroup.setAttribute('transform', transformStr);
    }

    const gridPattern = this.svg ? this.svg.querySelector('#grid-pattern') : null;
    if (gridPattern) {
      gridPattern.setAttribute('patternTransform', transformStr);
    }

    if (this.onZoomChange) {
      this.onZoomChange(this.zoom);
    }
  }

  setZoom(newZoom, mousePos = null) {
    const oldZoom = this.zoom;
    const clampedZoom = Math.min(Math.max(this.minZoom, parseFloat(newZoom.toFixed(2))), this.maxZoom);

    if (clampedZoom === oldZoom) return;

    if (this.svg) {
      const rect = this.svg.getBoundingClientRect();
      const pos = mousePos || {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2
      };

      const mouseX = pos.x - rect.left;
      const mouseY = pos.y - rect.top;

      const ratio = clampedZoom / oldZoom;
      this.pan.x = mouseX - (mouseX - this.pan.x) * ratio;
      this.pan.y = mouseY - (mouseY - this.pan.y) * ratio;
    }

    this.zoom = clampedZoom;
    this.updateTransform();
  }

  resetZoom() {
    this.zoom = 1.0;
    this.pan = { x: 0, y: 0 };
    this.updateTransform();
  }

  setShowGrid(visible) {
    this.showGrid = visible;
    if (this.bgGrid) {
      this.bgGrid.setAttribute('fill', this.showGrid ? 'url(#grid-pattern)' : 'transparent');
    }
  }

  setSnapToGrid(snap) {
    this.snapToGrid = snap;
  }

  setGridSize(size) {
    this.gridSize = size;
    const gridPattern = this.svg.querySelector('#grid-pattern');
    if (gridPattern) {
      gridPattern.setAttribute('width', size);
      gridPattern.setAttribute('height', size);
      gridPattern.querySelector('path').setAttribute('d', `M ${size} 0 L 0 0 0 ${size}`);
    }
  }

  // Grid Snap Calculation
  snap(value) {
    if (!this.snapToGrid) return value;
    return Math.round(value / this.gridSize) * this.gridSize;
  }

  // Smart Anchor & Object Edge Snapping
  getSnapCoords(x, y, excludeId = null) {
    if (!this.snapToGrid) return { x, y };

    const snapRadius = 14; // Snapping distance threshold
    let bestDist = snapRadius;
    let snapX = this.snap(x);
    let snapY = this.snap(y);

    // Collect object anchor points (Center, Top, Bottom, Left, Right edges)
    const anchors = [];

    this.elements.forEach(el => {
      if (el.id === excludeId) return;

      if (el.type === 'ball') {
        const { cx, cy, r } = el;
        anchors.push({ x: cx, y: cy }); // Center
        anchors.push({ x: cx - r, y: cy }); // Left edge
        anchors.push({ x: cx + r, y: cy }); // Right edge
        anchors.push({ x: cx, y: cy - r }); // Top edge
        anchors.push({ x: cx, y: cy + r }); // Bottom edge
      } else if (el.type === 'block') {
        const { x: bx, y: by, width: w, height: h } = el;
        anchors.push({ x: bx, y: by }); // Top-Left
        anchors.push({ x: bx + w, y: by }); // Top-Right
        anchors.push({ x: bx, y: by + h }); // Bottom-Left
        anchors.push({ x: bx + w, y: by + h }); // Bottom-Right
        anchors.push({ x: bx + w / 2, y: by }); // Top-Center
        anchors.push({ x: bx + w / 2, y: by + h }); // Bottom-Center
        anchors.push({ x: bx, y: by + h / 2 }); // Left-Center
        anchors.push({ x: bx + w, y: by + h / 2 }); // Right-Center
      } else if (el.x1 !== undefined && el.y1 !== undefined) {
        anchors.push({ x: el.x1, y: el.y1 });
        anchors.push({ x: el.x2, y: el.y2 });
      }
    });

    // Check if near any anchor point
    for (const a of anchors) {
      const dist = Math.hypot(x - a.x, y - a.y);
      if (dist < bestDist) {
        bestDist = dist;
        snapX = a.x;
        snapY = a.y;
      }
    }

    return { x: snapX, y: snapY };
  }

  saveState() {
    if (this.historyIndex < this.history.length - 1) {
      this.history = this.history.slice(0, this.historyIndex + 1);
    }
    const stateStr = JSON.stringify(this.elements);
    this.history.push(stateStr);
    this.historyIndex = this.history.length - 1;
  }

  undo() {
    if (this.historyIndex > 0) {
      this.historyIndex--;
      this.elements = JSON.parse(this.history[this.historyIndex]);
      this.selectedIds.clear();
      this.render();
      return true;
    }
    return false;
  }

  redo() {
    if (this.historyIndex < this.history.length - 1) {
      this.historyIndex++;
      this.elements = JSON.parse(this.history[this.historyIndex]);
      this.selectedIds.clear();
      this.render();
      return true;
    }
    return false;
  }

  clear() {
    this.elements = [];
    this.selectedIds.clear();
    this.saveState();
    this.render();
  }

  loadElements(newElements) {
    this.elements = JSON.parse(JSON.stringify(newElements));
    this.selectedIds.clear();
    this.saveState();
    this.render();
  }

  addElement(element) {
    element.id = 'elem_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
    this.elements.push(element);
    this.selectedIds = new Set([element.id]);
    this.saveState();
    this.render();
    return element;
  }

  updateSelectedElement(props, skipSelectionChange = false) {
    const el = this.getSelectedElement();
    if (!el) return;

    // Enforce ball radius alignment to grid step (multiples of 15px)
    if (el.type === 'ball' && props.r !== undefined) {
      props.r = this.snap(props.r);
      if (props.r < 15) props.r = 15;
    }

    Object.assign(el, props);
    this.saveState();
    this.render(skipSelectionChange);
  }

  deleteSelectedElement() {
    this.deleteSelectedElements();
  }

  deleteSelectedElements() {
    if (this.selectedIds.size === 0) return;
    this.elements = this.elements.filter(e => !this.selectedIds.has(e.id));
    this.selectedIds.clear();
    this.saveState();
    this.render();
  }

  getSelectedElement() {
    if (this.selectedIds.size === 0) return null;
    return this.elements.find(e => this.selectedIds.has(e.id)) || null;
  }

  getSelectedElements() {
    return this.elements.filter(e => this.selectedIds.has(e.id));
  }

  selectElement(id, multi = false) {
    if (multi) {
      if (this.selectedIds.has(id)) {
        this.selectedIds.delete(id);
      } else {
        this.selectedIds.add(id);
      }
    } else {
      this.selectedIds = id ? new Set([id]) : new Set();
    }
    this.render();
  }

  selectAll() {
    this.selectedIds = new Set(this.elements.map(e => e.id));
    this.render();
  }

  clearSelection() {
    this.selectedIds.clear();
    this.render();
  }

  // --- Grouping & Ungrouping Engine ---
  groupSelected() {
    const selectedElements = this.getSelectedElements();
    if (selectedElements.length < 2) return null;

    this.elements = this.elements.filter(e => !this.selectedIds.has(e.id));
    const groupEl = {
      id: 'elem_group_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
      type: 'group',
      children: JSON.parse(JSON.stringify(selectedElements))
    };

    this.elements.push(groupEl);
    this.selectedIds = new Set([groupEl.id]);
    this.saveState();
    this.render();
    return groupEl;
  }

  ungroupSelected() {
    const selectedElements = this.getSelectedElements();
    const groups = selectedElements.filter(e => e.type === 'group');
    if (groups.length === 0) return false;

    const newSelectedIds = new Set();
    groups.forEach(groupEl => {
      const idx = this.elements.findIndex(e => e.id === groupEl.id);
      if (idx !== -1) {
        const children = groupEl.children || [];
        children.forEach(c => newSelectedIds.add(c.id));
        this.elements.splice(idx, 1, ...children);
      }
    });

    this.selectedIds = newSelectedIds;
    this.saveState();
    this.render();
    return true;
  }

  // --- Copy, Paste & Duplicate ---
  copy() {
    const selectedElements = this.getSelectedElements();
    if (selectedElements.length === 0) return false;
    this.clipboard = JSON.stringify(selectedElements);
    return true;
  }

  paste() {
    if (!this.clipboard) return false;
    try {
      const items = JSON.parse(this.clipboard);
      if (!Array.isArray(items) || items.length === 0) return false;

      const newSelectedIds = new Set();
      const processPastedItem = (el) => {
        const copy = JSON.parse(JSON.stringify(el));
        copy.id = 'elem_' + Date.now() + '_' + Math.floor(Math.random() * 10000);
        this.offsetElementPosition(copy, 15, 15);

        if (copy.type === 'group' && Array.isArray(copy.children)) {
          copy.children.forEach(child => {
            child.id = 'elem_' + Date.now() + '_' + Math.floor(Math.random() * 10000);
          });
        }
        return copy;
      };

      const pastedItems = items.map(processPastedItem);
      pastedItems.forEach(item => {
        this.elements.push(item);
        newSelectedIds.add(item.id);
      });

      this.selectedIds = newSelectedIds;
      this.saveState();
      this.render();
      return true;
    } catch (e) {
      console.error('Paste error:', e);
      return false;
    }
  }

  duplicate() {
    if (this.copy()) {
      return this.paste();
    }
    return false;
  }

  offsetElementPosition(el, dx, dy) {
    if (el.type === 'group' && Array.isArray(el.children)) {
      el.children.forEach(child => this.offsetElementPosition(child, dx, dy));
      return;
    }
    if (el.cx !== undefined) {
      el.cx += dx;
      el.cy += dy;
    }
    if (el.x1 !== undefined && el.y1 !== undefined) {
      el.x1 += dx;
      el.y1 += dy;
      el.x2 += dx;
      el.y2 += dy;
    }
    if (el.x !== undefined && el.y !== undefined && el.cx === undefined) {
      el.x += dx;
      el.y += dy;
    }
  }

  // --- SVG Rendering Core ---
  render(skipSelectionChange = false) {
    this.contentGroup.innerHTML = '';
    this.interactionGroup.innerHTML = '';

    this.elements.forEach(el => {
      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.setAttribute('data-id', el.id);
      g.style.cursor = 'pointer';
      g.innerHTML = this.renderElementSvg(el);
      
      if (this.selectedIds.has(el.id)) {
        g.classList.add('selected-element');
      }

      this.contentGroup.appendChild(g);
    });

    if (this.selectedIds.size === 1) {
      const selectedEl = this.getSelectedElement();
      if (selectedEl) {
        this.renderHandles(selectedEl);
      }
    } else if (this.selectedIds.size > 1) {
      this.renderMultiSelectionHandles();
    }

    if (!skipSelectionChange && this.onSelectionChange) {
      this.onSelectionChange(this.getSelectedElements());
    }
  }

  renderElementSvg(el) {
    switch (el.type) {
      case 'group':
        return this.drawGroup(el);
      case 'ground':
        return this.drawGround(el);
      case 'ball':
        return this.drawBall(el);
      case 'block':
        return this.drawBlock(el);
      case 'vector':
        return this.drawVector(el);
      case 'dimension':
        return this.drawDimension(el);
      case 'guideLine':
        return this.drawGuideLine(el);
      case 'spring':
        return this.drawSpring(el);
      case 'pulley':
        return this.drawPulley(el);
      case 'angleArc':
        return this.drawAngleArc(el);
      case 'text':
        return this.drawText(el);
      default:
        return '';
    }
  }

  drawGroup(el) {
    return (el.children || []).map(child => this.renderElementSvg(child)).join('');
  }

  drawGround(el) {
    const { x1, y1, x2, y2, hatchSide = 'bottom', hatchSize = 12 } = el;
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.hypot(dx, dy);
    const angle = Math.atan2(dy, dx);

    let polyPoints = '';
    const h = hatchSize;
    if (hatchSide === 'bottom' || hatchSide === 'left') {
      polyPoints = `0,0 ${len},0 ${len},${h} 0,${h}`;
    } else {
      polyPoints = `0,0 ${len},0 ${len},-${h} 0,-${h}`;
    }

    return `
      <g transform="translate(${x1}, ${y1}) rotate(${angle * 180 / Math.PI})">
        <!-- Transparent Click Buffer -->
        <line x1="0" y1="0" x2="${len}" y2="0" stroke="transparent" stroke-width="18" pointer-events="stroke" />
        <polygon points="${polyPoints}" fill="url(#hatch-pattern)" stroke="none" />
        <line x1="0" y1="0" x2="${len}" y2="0" stroke="#000000" stroke-width="2.5" stroke-linecap="square" />
      </g>
    `;
  }

  drawBall(el) {
    const { cx, cy, r = 25, label = '', showCenterDot = false, fill = '#ffffff', fontSize = 18 } = el;
    const labelSpans = buildSvgTextSpans(label, fontSize);

    return `
      <g transform="translate(${cx}, ${cy})">
        <circle cx="0" cy="0" r="${r}" fill="${fill}" stroke="#000000" stroke-width="2.5" />
        ${showCenterDot ? '<circle cx="0" cy="0" r="2.5" fill="#000000" />' : ''}
        ${label ? `
          <text x="0" y="-${r + 10}" text-anchor="middle" font-size="${fontSize}px" fill="#000000">
            ${labelSpans}
          </text>
        ` : ''}
      </g>
    `;
  }

  drawBlock(el) {
    const { x, y, width = 60, height = 40, label = '', fill = '#ffffff', fontSize = 18, rotation = 0 } = el;
    const labelSpans = buildSvgTextSpans(label, fontSize);
    const rotAttr = rotation ? ` rotate(${rotation})` : '';

    return `
      <g transform="translate(${x}, ${y})${rotAttr}">
        <rect x="0" y="0" width="${width}" height="${height}" fill="${fill}" stroke="#000000" stroke-width="2.5" rx="1" />
        ${label ? `
          <text x="${width / 2}" y="${height / 2 + 6}" text-anchor="middle" font-size="${fontSize}px" fill="#000000">
            ${labelSpans}
          </text>
        ` : ''}
      </g>
    `;
  }

  drawVector(el) {
    const { x1, y1, x2, y2, label = '', dashed = false, labelPos = 'right', strokeWidth = 2.2, fontSize = 18 } = el;
    const midX = (x1 + x2) / 2;
    const midY = (y1 + y2) / 2;
    const dashAttr = dashed ? 'stroke-dasharray="5,4"' : '';
    
    let offsetX = 12;
    let offsetY = 6;
    let textAnchor = 'start';

    if (labelPos === 'left') { textAnchor = 'end'; offsetX = -12; }
    else if (labelPos === 'top') { textAnchor = 'middle'; offsetY = -14; offsetX = 0; }
    else if (labelPos === 'bottom') { textAnchor = 'middle'; offsetY = 22; offsetX = 0; }

    const labelSpans = buildSvgTextSpans(label, fontSize);

    return `
      <g>
        <!-- Wide Transparent Hit Target Buffer Line (18px Wide) -->
        <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="transparent" stroke-width="18" pointer-events="stroke" />
        <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" 
              stroke="#000000" stroke-width="${strokeWidth}" ${dashAttr} 
              marker-end="url(#arrowhead)" />
        ${label ? `
          <text x="${midX + offsetX}" y="${midY + offsetY}" text-anchor="${textAnchor}" font-size="${fontSize}px" fill="#000000">
            ${labelSpans}
          </text>
        ` : ''}
      </g>
    `;
  }

  drawDimension(el) {
    const { x1, y1, x2, y2, label = '', showGuides = true, fontSize = 18, labelPos = 'left' } = el;
    const dx = x2 - x1;
    const dy = y2 - y1;
    const midX = (x1 + x2) / 2;
    const midY = (y1 + y2) / 2;
    const labelSpans = buildSvgTextSpans(label, fontSize);

    let guidesSvg = '';
    if (showGuides) {
      const isVertical = Math.abs(dy) > Math.abs(dx);
      if (isVertical) {
        guidesSvg = `
          <line x1="${x1 - 25}" y1="${y1}" x2="${x1}" y2="${y1}" stroke="#000000" stroke-width="1.5" stroke-dasharray="4,3" />
          <line x1="${x2 - 25}" y1="${y2}" x2="${x2}" y2="${y2}" stroke="#000000" stroke-width="1.5" stroke-dasharray="4,3" />
        `;
      } else {
        guidesSvg = `
          <line x1="${x1}" y1="${y1 - 25}" x2="${x1}" y2="${y1}" stroke="#000000" stroke-width="1.5" stroke-dasharray="4,3" />
          <line x1="${x2}" y1="${y2 - 25}" x2="${x2}" y2="${y2}" stroke="#000000" stroke-width="1.5" stroke-dasharray="4,3" />
        `;
      }
    }

    let textX = midX - 14;
    let textY = midY + 6;
    let textAnchor = 'end';
    let bgRectSvg = '';

    if (labelPos === 'right') {
      textX = midX + 14;
      textY = midY + 6;
      textAnchor = 'start';
    } else if (labelPos === 'center') {
      textX = midX;
      textY = midY + 6;
      textAnchor = 'middle';
      const approxWidth = Math.max(20, (label || '').length * 10 + 12);
      const bgX = midX - approxWidth / 2;
      const bgY = midY - fontSize * 0.65;
      bgRectSvg = `<rect x="${bgX}" y="${bgY}" width="${approxWidth}" height="${fontSize * 1.2}" fill="#ffffff" rx="3" />`;
    }

    return `
      <g>
        ${guidesSvg}
        <!-- Wide Transparent Hit Target Buffer Line (18px Wide) -->
        <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="transparent" stroke-width="18" pointer-events="stroke" />
        <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#000000" stroke-width="2" 
              marker-start="url(#dimension-arrow)" marker-end="url(#dimension-arrow)" />
        ${label ? `
          ${bgRectSvg}
          <text x="${textX}" y="${textY}" text-anchor="${textAnchor}" font-size="${fontSize}px" fill="#000000">
            ${labelSpans}
          </text>
        ` : ''}
      </g>
    `;
  }

  drawGuideLine(el) {
    const { x1, y1, x2, y2, style = 'dashed' } = el;
    const dashArray = style === 'dotted' ? '3,3' : style === 'dashed' ? '5,4' : '';
    return `
      <g>
        <!-- Wide Transparent Hit Target Buffer Line (18px Wide) -->
        <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="transparent" stroke-width="18" pointer-events="stroke" />
        <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" 
              stroke="#000000" stroke-width="1.8" stroke-dasharray="${dashArray}" />
      </g>
    `;
  }

  drawSpring(el) {
    const { x1, y1, x2, y2, coils = 8, radius = 10, label = '' } = el;
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.hypot(dx, dy);
    const angle = Math.atan2(dy, dx);
    const labelSpans = buildSvgTextSpans(label, 16);

    let pathData = `M 0,0 L 10,0 `;
    const springLen = len - 20;
    const step = springLen / coils;

    for (let i = 0; i < coils; i++) {
      const curX = 10 + i * step;
      pathData += `L ${curX + step * 0.25},${radius} L ${curX + step * 0.75},-${radius} `;
    }
    pathData += `L ${len - 10},0 L ${len},0`;

    return `
      <g transform="translate(${x1}, ${y1}) rotate(${angle * 180 / Math.PI})">
        <!-- Wide Transparent Hit Target Buffer Line (24px Wide) -->
        <line x1="0" y1="0" x2="${len}" y2="0" stroke="transparent" stroke-width="24" pointer-events="stroke" />
        <path d="${pathData}" fill="none" stroke="#000000" stroke-width="2" stroke-linejoin="round" />
        ${label ? `
          <text x="${len / 2}" y="-${radius + 6}" text-anchor="middle" font-size="16px" fill="#000000">
            ${labelSpans}
          </text>
        ` : ''}
      </g>
    `;
  }

  drawPulley(el) {
    const { cx, cy, r = 24, label = '', fill = '#ffffff' } = el;
    const labelSpans = buildSvgTextSpans(label, 16);

    return `
      <g transform="translate(${cx}, ${cy})">
        <circle cx="0" cy="0" r="${r}" fill="${fill}" stroke="#000000" stroke-width="2.5" />
        <circle cx="0" cy="0" r="4" fill="#000000" />
        <path d="M -8,0 L 0,-${r + 12} L 8,0" fill="none" stroke="#000000" stroke-width="2" />
        <line x1="0" y1="-${r + 12}" x2="0" y2="-${r + 24}" stroke="#000000" stroke-width="2.5" />
        ${label ? `
          <text x="${r + 10}" y="5" text-anchor="start" font-size="16px" fill="#000000">
            ${labelSpans}
          </text>
        ` : ''}
      </g>
    `;
  }

  drawAngleArc(el) {
    const { cx, cy, r = 30, startAngle = 0, endAngle = 35, label = '\\theta' } = el;
    const radStart = (startAngle * Math.PI) / 180;
    const radEnd = (endAngle * Math.PI) / 180;

    const x1 = cx + r * Math.cos(radStart);
    const y1 = cy - r * Math.sin(radStart);
    const x2 = cx + r * Math.cos(radEnd);
    const y2 = cy - r * Math.sin(radEnd);

    const midAngle = ((startAngle + endAngle) / 2 * Math.PI) / 180;
    const labelX = cx + (r + 16) * Math.cos(midAngle);
    const labelY = cy - (r + 16) * Math.sin(midAngle);

    const largeArc = (endAngle - startAngle) > 180 ? 1 : 0;
    const labelSpans = buildSvgTextSpans(label, 16);

    return `
      <g>
        <!-- Wide Transparent Hit Target Arc (18px Wide) -->
        <path d="M ${x1},${y1} A ${r} ${r} 0 ${largeArc} 0 ${x2},${y2}" fill="none" stroke="transparent" stroke-width="18" pointer-events="stroke" />
        <path d="M ${x1},${y1} A ${r} ${r} 0 ${largeArc} 0 ${x2},${y2}" 
              fill="none" stroke="#000000" stroke-width="1.8" />
        ${label ? `
          <text x="${labelX}" y="${labelY}" text-anchor="middle" font-size="16px" fill="#000000">
            ${labelSpans}
          </text>
        ` : ''}
      </g>
    `;
  }

  drawText(el) {
    const { x, y, text = 'Text', fontSize = 18 } = el;
    const labelSpans = buildSvgTextSpans(text, fontSize);

    return `
      <g>
        <rect x="${x - 4}" y="${y - fontSize}" width="${text.length * 10 + 10}" height="${fontSize + 6}" fill="transparent" pointer-events="all" />
        <text x="${x}" y="${y}" font-size="${fontSize}px" fill="#000000">
          ${labelSpans}
        </text>
      </g>
    `;
  }

  // --- Bounding Box Calculation ---
  getElementBoundingBox(el) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    const processItem = (item) => {
      if (!item) return;
      if (item.type === 'group' && Array.isArray(item.children)) {
        item.children.forEach(processItem);
        return;
      }

      switch (item.type) {
        case 'ground':
          minX = Math.min(minX, item.x1, item.x2);
          maxX = Math.max(maxX, item.x1, item.x2);
          const hs = item.hatchSize || 12;
          minY = Math.min(minY, item.y1 - hs, item.y2 - hs);
          maxY = Math.max(maxY, item.y1 + hs, item.y2 + hs);
          break;
        case 'ball':
        case 'pulley':
          const r = item.r !== undefined ? item.r : (item.radius !== undefined ? item.radius : 25);
          minX = Math.min(minX, item.cx - r);
          maxX = Math.max(maxX, item.cx + r);
          minY = Math.min(minY, item.cy - r - (item.label ? 25 : 0));
          maxY = Math.max(maxY, item.cy + r + (item.label ? 15 : 0));
          break;
        case 'block':
          minX = Math.min(minX, item.x);
          maxX = Math.max(maxX, item.x + (item.width || 60));
          minY = Math.min(minY, item.y - (item.label ? 15 : 0));
          maxY = Math.max(maxY, item.y + (item.height || 40) + (item.label ? 15 : 0));
          break;
        case 'vector':
        case 'dimension':
        case 'guideLine':
        case 'spring':
          minX = Math.min(minX, item.x1, item.x2);
          maxX = Math.max(maxX, item.x1, item.x2);
          minY = Math.min(minY, item.y1, item.y2);
          maxY = Math.max(maxY, item.y1, item.y2);
          break;
        case 'text':
          minX = Math.min(minX, item.x);
          maxX = Math.max(maxX, item.x + (item.text || '').length * 11);
          minY = Math.min(minY, item.y - (item.fontSize || 18));
          maxY = Math.max(maxY, item.y + 5);
          break;
        case 'angleArc':
          const ar = item.r || 30;
          minX = Math.min(minX, item.cx - ar);
          maxX = Math.max(maxX, item.cx + ar);
          minY = Math.min(minY, item.cy - ar);
          maxY = Math.max(maxY, item.cy + ar);
          break;
        default:
          if (item.x !== undefined) { minX = Math.min(minX, item.x); maxX = Math.max(maxX, item.x + 30); }
          if (item.y !== undefined) { minY = Math.min(minY, item.y); maxY = Math.max(maxY, item.y + 30); }
          break;
      }
    };

    processItem(el);

    if (!isFinite(minX)) {
      return { x: 0, y: 0, width: 60, height: 60, maxX: 60, maxY: 60 };
    }

    return {
      x: minX,
      y: minY,
      width: Math.max(10, maxX - minX),
      height: Math.max(10, maxY - minY),
      maxX,
      maxY
    };
  }

  getCombinedBoundingBox(elements) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    elements.forEach(el => {
      const box = this.getElementBoundingBox(el);
      minX = Math.min(minX, box.x);
      minY = Math.min(minY, box.y);
      maxX = Math.max(maxX, box.x + box.width);
      maxY = Math.max(maxY, box.y + box.height);
    });
    if (!isFinite(minX)) return { x: 0, y: 0, width: 0, height: 0, maxX: 0, maxY: 0 };
    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
      maxX,
      maxY
    };
  }

  // --- Handles for Selected Elements ---
  renderHandles(el) {
    let handlesHtml = '';
    const createHandle = (hx, hy, handleKey, extraClass = '', cursorStyle = '') => `
      <g class="handle-group" style="${cursorStyle ? `cursor: ${cursorStyle};` : ''}">
        <!-- Invisible 18x18 hit buffer target for stable clicking & dragging -->
        <rect data-handle="${handleKey}" x="${hx - 9}" y="${hy - 9}" width="18" height="18" fill="transparent" />
        <!-- Visible 12x12 handle box -->
        <rect class="handle-box ${extraClass}" data-handle="${handleKey}" 
              x="${hx - 6}" y="${hy - 6}" width="12" height="12" rx="3" pointer-events="none" />
      </g>
    `;

    if (el.type === 'group') {
      const bbox = this.getElementBoundingBox(el);
      const pad = 6;
      const x = bbox.x - pad;
      const y = bbox.y - pad;
      const w = bbox.width + pad * 2;
      const h = bbox.height + pad * 2;

      handlesHtml += `
        <rect class="group-select-box" data-handle="move" 
              x="${x}" y="${y}" width="${w}" height="${h}" 
              fill="rgba(99, 102, 241, 0.06)" 
              stroke="#6366f1" stroke-width="1.8" stroke-dasharray="5,3" 
              style="cursor: move;" />
      `;

      const createCornerHandle = (hx, hy, handleKey) => `
        <g class="handle-group" style="cursor: move;">
          <rect data-handle="${handleKey}" x="${hx - 9}" y="${hy - 9}" width="18" height="18" fill="transparent" />
          <rect class="handle-box" data-handle="${handleKey}" x="${hx - 5}" y="${hy - 5}" width="10" height="10" rx="2" style="fill: #6366f1;" pointer-events="none" />
        </g>
      `;

      handlesHtml += createCornerHandle(x, y, 'move');
      handlesHtml += createCornerHandle(x + w, y, 'move');
      handlesHtml += createCornerHandle(x, y + h, 'move');
      handlesHtml += createCornerHandle(x + w, y + h, 'move');

      this.interactionGroup.innerHTML = handlesHtml;
      return;
    }

    if (el.cx !== undefined && el.cy !== undefined) {
      handlesHtml += createHandle(el.cx, el.cy, 'center', '', 'move');
      const r = el.r !== undefined ? el.r : (el.radius !== undefined ? el.radius : 0);
      if (r > 0) {
        handlesHtml += `<circle cx="${el.cx}" cy="${el.cy}" r="${r}" fill="none" stroke="#3b82f6" stroke-width="1.2" stroke-dasharray="3,3" pointer-events="none" />`;
        handlesHtml += createHandle(el.cx + r, el.cy, 'radius', 'handle-radius', 'ew-resize');
        handlesHtml += createHandle(el.cx - r, el.cy, 'radius', 'handle-radius', 'ew-resize');
        handlesHtml += createHandle(el.cx, el.cy - r, 'radius', 'handle-radius', 'ns-resize');
        handlesHtml += createHandle(el.cx, el.cy + r, 'radius', 'handle-radius', 'ns-resize');
      }
    } else if (el.x1 !== undefined && el.y1 !== undefined) {
      handlesHtml += createHandle(el.x1, el.y1, 'p1', '', 'crosshair');
      handlesHtml += createHandle(el.x2, el.y2, 'p2', '', 'crosshair');
    } else if (el.x !== undefined && el.y !== undefined) {
      if (el.rotation) {
        const pts = anchors(el);
        handlesHtml += createHandle(pts[0].x, pts[0].y, 'p1', '', 'move');
        handlesHtml += createHandle(pts[3].x, pts[3].y, 'p2', '', 'nwse-resize');
      } else {
        handlesHtml += createHandle(el.x, el.y, 'p1', '', 'move');
        if (el.width && el.height) {
          handlesHtml += createHandle(el.x + el.width, el.y + el.height, 'p2', '', 'nwse-resize');
        }
      }
    }

    this.interactionGroup.innerHTML = handlesHtml;
  }

  renderMultiSelectionHandles() {
    const selElements = this.getSelectedElements();
    const bbox = this.getCombinedBoundingBox(selElements);
    const pad = 6;
    const x = bbox.x - pad;
    const y = bbox.y - pad;
    const w = bbox.width + pad * 2;
    const h = bbox.height + pad * 2;

    let html = `
      <rect class="multi-select-box" data-handle="move" 
            x="${x}" y="${y}" width="${w}" height="${h}" 
            fill="rgba(59, 130, 246, 0.05)" 
            stroke="#3b82f6" stroke-width="1.5" stroke-dasharray="4,4" 
            style="cursor: move;" />
    `;

    const createCornerHandle = (hx, hy, handleKey) => `
      <g class="handle-group" style="cursor: move;">
        <rect data-handle="${handleKey}" x="${hx - 9}" y="${hy - 9}" width="18" height="18" fill="transparent" />
        <rect class="handle-box" data-handle="${handleKey}" x="${hx - 5}" y="${hy - 5}" width="10" height="10" rx="2" pointer-events="none" />
      </g>
    `;

    html += createCornerHandle(x, y, 'move');
    html += createCornerHandle(x + w, y, 'move');
    html += createCornerHandle(x, y + h, 'move');
    html += createCornerHandle(x + w, y + h, 'move');

    this.interactionGroup.innerHTML = html;
  }

  // --- Interaction & Event Handling ---
  bindEvents() {
    this.svg.addEventListener('mousedown', this.onMouseDown.bind(this));
    window.addEventListener('mousemove', this.onMouseMove.bind(this));
    window.addEventListener('mouseup', this.onMouseUp.bind(this));

    const canvasArea = this.svg.closest('.canvas-area') || this.svg;
    canvasArea.addEventListener('wheel', this.onWheel.bind(this), { passive: false });
    this.svg.addEventListener('wheel', this.onWheel.bind(this), { passive: false });

    const isSpaceKey = (e) => e.code === 'Space' || e.key === ' ' || e.key === 'Spacebar' || e.keyCode === 32;

    window.addEventListener('keydown', (e) => {
      if (isSpaceKey(e) && !e.repeat) {
        if (this.isEditingText()) return;
        this.isSpacePressed = true;
        if (!this.isPanning) {
          canvasArea.style.cursor = 'grab';
          document.body.style.cursor = 'grab';
        }
        e.preventDefault();
      }
    });

    window.addEventListener('keyup', (e) => {
      if (isSpaceKey(e)) {
        this.isSpacePressed = false;
        if (!this.isPanning) {
          canvasArea.style.cursor = '';
          document.body.style.cursor = '';
        }
      }
    });
  }

  isEditingText() {
    const active = document.activeElement;
    if (!active) return false;
    const tag = active.tagName.toLowerCase();
    return tag === 'input' || tag === 'textarea' || active.isContentEditable;
  }

  onWheel(e) {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.08 : 0.92;
    this.setZoom(this.zoom * zoomFactor, { x: e.clientX, y: e.clientY });
  }

  getCanvasCoords(e) {
    const rect = this.svg.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    return {
      x: Math.round((mouseX - this.pan.x) / this.zoom),
      y: Math.round((mouseY - this.pan.y) / this.zoom)
    };
  }

  onMouseDown(e) {
    if (this.isEditingText()) {
      document.activeElement.blur();
    }

    if (this.isSpacePressed || e.button === 1) {
      this.isPanning = true;
      this.panStart = { x: e.clientX, y: e.clientY };
      this.panStartOffset = { x: this.pan.x, y: this.pan.y };
      const canvasArea = this.svg.closest('.canvas-area') || this.svg;
      canvasArea.style.cursor = 'grabbing';
      document.body.style.cursor = 'grabbing';
      e.preventDefault();
      return;
    }

    const handle = e.target.getAttribute('data-handle');
    const coords = this.getCanvasCoords(e);
    const isMultiKey = e.shiftKey || e.ctrlKey || e.metaKey;

    if (handle && this.selectedIds.size > 0) {
      this.isDragging = true;
      this.activeHandle = handle;
      this.dragStart = coords;
      this.elementsStartPos = JSON.parse(JSON.stringify(this.getSelectedElements()));
      this.elementStartPos = this.elementsStartPos[0] || null;

      if (handle === 'radius') document.body.style.cursor = 'ew-resize';
      else if (handle === 'p2') document.body.style.cursor = 'nwse-resize';
      else if (handle === 'move' || handle === 'center') document.body.style.cursor = 'move';
      return;
    }

    const elemGroup = e.target.closest('[data-id]');
    if (elemGroup) {
      const id = elemGroup.getAttribute('data-id');
      if (isMultiKey) {
        this.selectElement(id, true);
      } else {
        if (!this.selectedIds.has(id)) {
          this.selectElement(id, false);
        }
      }
      this.isDragging = true;
      this.activeHandle = 'move';
      this.dragStart = coords;
      this.elementsStartPos = JSON.parse(JSON.stringify(this.getSelectedElements()));
      this.elementStartPos = this.elementsStartPos[0] || null;
      document.body.style.cursor = 'move';
    } else {
      if (!isMultiKey) {
        this.selectedIds.clear();
        this.render();
      }
      this.isSelectingBox = true;
      this.selectionBoxStart = coords;
    }
  }

  onMouseMove(e) {
    if (this.isPanning) {
      const dx = e.clientX - this.panStart.x;
      const dy = e.clientY - this.panStart.y;
      this.pan.x = this.panStartOffset.x + dx;
      this.pan.y = this.panStartOffset.y + dy;
      this.updateTransform();
      return;
    }

    const coords = this.getCanvasCoords(e);

    if (this.isSelectingBox && this.selectionBoxStart) {
      const startX = Math.min(this.selectionBoxStart.x, coords.x);
      const startY = Math.min(this.selectionBoxStart.y, coords.y);
      const width = Math.abs(coords.x - this.selectionBoxStart.x);
      const height = Math.abs(coords.y - this.selectionBoxStart.y);

      this.interactionGroup.innerHTML = `
        <rect x="${startX}" y="${startY}" width="${width}" height="${height}" 
              fill="rgba(59, 130, 246, 0.12)" stroke="#3b82f6" stroke-width="1.5" stroke-dasharray="4,4" />
      `;
      return;
    }

    if (!this.isDragging || this.selectedIds.size === 0) return;
    if (!this.elementsStartPos && this.elementStartPos) {
      this.elementsStartPos = [this.elementStartPos];
    }
    if (!this.elementsStartPos) return;

    let dx = coords.x - this.dragStart.x;
    let dy = coords.y - this.dragStart.y;

    // Shift key constraint: Lock movement strictly to horizontal (X) or vertical (Y) axis
    if (e.shiftKey) {
      if (Math.abs(dx) >= Math.abs(dy)) {
        dy = 0;
      } else {
        dx = 0;
      }
    }

    if (this.selectedIds.size > 1 || this.activeHandle === 'move' || this.activeHandle === 'center') {
      this.elementsStartPos.forEach(orig => {
        const el = this.elements.find(e => e.id === orig.id);
        if (!el) return;

        const otherTargets = this.elements.filter(e => e.id !== el.id && !this.selectedIds.has(e.id));
        const tempMoved = JSON.parse(JSON.stringify(orig));
        this.offsetElementPosition(tempMoved, dx, dy);

        let finalDx = dx;
        let finalDy = dy;

        if (this.snapToGrid) {
          const pts = anchors(tempMoved);
          const ref = pts[0] || { x: 0, y: 0 };
          const offset = snapTranslation(pts, ref, otherTargets, this.gridSize, 14);
          finalDx = dx + offset.x;
          finalDy = dy + offset.y;
        }

        const resetCopy = JSON.parse(JSON.stringify(orig));
        this.offsetElementPosition(resetCopy, finalDx, finalDy);
        Object.assign(el, resetCopy);
      });
    } else if (this.selectedIds.size === 1) {
      const el = this.getSelectedElement();
      const orig = this.elementsStartPos[0];
      if (el && orig) {
        if (this.activeHandle === 'p1') {
          if (orig.x1 !== undefined) {
            const snapPt = this.getSnapCoords(orig.x1 + dx, orig.y1 + dy, el.id);
            el.x1 = snapPt.x;
            el.y1 = snapPt.y;
          } else if (orig.x !== undefined) {
            const snapPt = this.getSnapCoords(orig.x + dx, orig.y + dy, el.id);
            el.x = snapPt.x;
            el.y = snapPt.y;
          }
        } else if (this.activeHandle === 'p2') {
          if (orig.x2 !== undefined) {
            const snapPt = this.getSnapCoords(orig.x2 + dx, orig.y2 + dy, el.id);
            el.x2 = snapPt.x;
            el.y2 = snapPt.y;
          } else if (orig.width !== undefined) {
            if (orig.rotation) {
              const rad = (orig.rotation || 0) * Math.PI / 180;
              const localDx = dx * Math.cos(rad) + dy * Math.sin(rad);
              const localDy = -dx * Math.sin(rad) + dy * Math.cos(rad);
              el.width = Math.max(15, orig.width + localDx);
              el.height = Math.max(15, orig.height + localDy);
            } else {
              const cornerSnap = this.getSnapCoords(orig.x + orig.width + dx, orig.y + orig.height + dy, el.id);
              el.width = Math.max(15, cornerSnap.x - orig.x);
              el.height = Math.max(15, cornerSnap.y - orig.y);
            }
          }
        } else if (this.activeHandle === 'radius') {
          if (orig.cx !== undefined) {
            const rawDist = Math.hypot(coords.x - orig.cx, coords.y - orig.cy);
            let newR = rawDist;
            if (this.snapToGrid) {
              newR = this.snap(rawDist);
              if (newR < this.gridSize) newR = this.gridSize;
            } else {
              newR = Math.max(5, Math.round(rawDist));
            }
            if (el.r !== undefined) el.r = newR;
            if (el.radius !== undefined) el.radius = newR;
          }
        }
      }
    }

    this.render();
  }

  onMouseUp(e) {
    if (this.isPanning) {
      this.isPanning = false;
      document.body.style.cursor = '';
      const canvasArea = this.svg.closest('.canvas-area') || this.svg;
      canvasArea.style.cursor = this.isSpacePressed ? 'grab' : '';
      return;
    }

    if (this.isSelectingBox && this.selectionBoxStart) {
      const coords = this.getCanvasCoords(e);
      const minX = Math.min(this.selectionBoxStart.x, coords.x);
      const minY = Math.min(this.selectionBoxStart.y, coords.y);
      const maxX = Math.max(this.selectionBoxStart.x, coords.x);
      const maxY = Math.max(this.selectionBoxStart.y, coords.y);
      const width = maxX - minX;
      const height = maxY - minY;

      this.isSelectingBox = false;
      this.selectionBoxStart = null;

      if (width > 5 || height > 5) {
        const isMultiKey = e.shiftKey || e.ctrlKey || e.metaKey;
        if (!isMultiKey) {
          this.selectedIds.clear();
        }
        this.elements.forEach(el => {
          const bbox = this.getElementBoundingBox(el);
          if (bbox.x < maxX && bbox.x + bbox.width > minX &&
              bbox.y < maxY && bbox.y + bbox.height > minY) {
            this.selectedIds.add(el.id);
          }
        });
      }
      this.render();
      return;
    }

    if (this.isDragging) {
      this.isDragging = false;
      document.body.style.cursor = '';
      this.saveState();
    }
  }

  // --- Exporting Engine ---
  getElementsBoundingBox(padding = 25) {
    if (this.elements.length === 0) {
      return { x: 0, y: 0, width: 600, height: 450 };
    }
    const bbox = this.getCombinedBoundingBox(this.elements);
    const x = Math.max(0, Math.floor(bbox.x - padding));
    const y = Math.max(0, Math.floor(bbox.y - padding));
    const w = Math.max(120, Math.ceil(bbox.width + padding * 2));
    const h = Math.max(120, Math.ceil(bbox.height + padding * 2));
    return { x, y, width: w, height: h };
  }

  getSvgString(cropToBoundingBox = true) {
    const clone = this.svg.cloneNode(true);
    const bgGridRect = clone.querySelector('#bgGrid');
    if (bgGridRect) bgGridRect.remove();
    const interactiveG = clone.querySelector('#interactionLayer');
    if (interactiveG) interactiveG.remove();
    
    clone.querySelectorAll('[stroke="transparent"]').forEach(node => node.remove());
    clone.querySelectorAll('[fill="transparent"]').forEach(node => node.remove());

    if (cropToBoundingBox && this.elements.length > 0) {
      const bbox = this.getElementsBoundingBox(25);
      clone.setAttribute('viewBox', `${bbox.x} ${bbox.y} ${bbox.width} ${bbox.height}`);
      clone.setAttribute('width', `${bbox.width}`);
      clone.setAttribute('height', `${bbox.height}`);
    }

    return new XMLSerializer().serializeToString(clone);
  }

  async exportPng(scale = 2, cropToBoundingBox = true) {
    const bbox = (cropToBoundingBox && this.elements.length > 0) ? this.getElementsBoundingBox(25) : { width: 600, height: 450 };
    const svgStr = this.getSvgString(cropToBoundingBox);
    const blob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = bbox.width * scale;
        canvas.height = bbox.height * scale;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(url);
        resolve(canvas.toDataURL('image/png'));
      };
      img.src = url;
    });
  }
}
