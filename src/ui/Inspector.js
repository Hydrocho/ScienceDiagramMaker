/**
 * Property Inspector Component
 * Renders contextual controls for the currently selected diagram element.
 */

export class Inspector {
  constructor(containerElement, svgEngine) {
    this.container = containerElement;
    this.engine = svgEngine;
    this.engine.onSelectionChange = this.render.bind(this);
  }

  render(selectedInput) {
    let selectedElements = [];
    if (Array.isArray(selectedInput)) {
      selectedElements = selectedInput;
    } else if (selectedInput) {
      selectedElements = [selectedInput];
    }

    const currentKey = selectedElements.map(e => e.id).join(',');

    if (currentKey === this.renderedKey && this.container.contains(document.activeElement)) {
      return;
    }

    if (document.activeElement && this.container.contains(document.activeElement)) {
      document.activeElement.blur();
    }

    this.renderedKey = currentKey;

    if (selectedElements.length === 0) {
      this.container.innerHTML = `
        <div class="empty-inspector">
          <p style="margin-bottom: 0.5rem; opacity: 0.6;">🎯 선택된 요소가 없습니다</p>
          <p style="font-size: 0.75rem; color: var(--text-muted);">
            Shift/Ctrl 키 또는 마우스 드래그로 요소를 다중 선택해보세요.
          </p>
        </div>
      `;
      return;
    }

    if (selectedElements.length > 1) {
      this.renderMultiSelectInspector(selectedElements);
      return;
    }

    const el = selectedElements[0];
    if (el.type === 'group') {
      this.renderGroupInspector(el);
      return;
    }

    let html = `
      <div class="inspector-header">
        <h3>${this.getElementTypeName(el.type)} 속성</h3>
        <button class="btn btn-secondary" id="deleteElemBtn" style="padding: 0.3rem 0.6rem; color: var(--accent-red); border-color: rgba(239,68,68,0.3);">
          🗑️ 삭제
        </button>
      </div>
      <div class="inspector-body">
    `;

    // Common Text/Label Property
    if (el.label !== undefined || el.text !== undefined) {
      const val = el.label !== undefined ? el.label : el.text;
      html += `
        <div class="prop-group">
          <div class="prop-label">텍스트 / 수식 라벨</div>
          <input type="text" class="prop-input" id="prop_label" value="${this.escapeHtml(val)}" 
                 placeholder="예: 질량 m, 속력 v, 높이 h, \\theta" />
          <span style="font-size: 0.68rem; color: var(--text-muted); margin-top: 0.2rem;">
            💡 영문자(m, v, g, h, F)는 자동 이탤릭 수식 처리됩니다. (예: v_0, \\theta)
          </span>
        </div>
      `;
    }

    // Specific Element Controls
    switch (el.type) {
      case 'ground':
        html += `
          <div class="prop-group">
            <div class="prop-label">빗금 방향 (Hatch Side)</div>
            <select class="prop-input" id="prop_hatchSide">
              <option value="bottom" ${el.hatchSide === 'bottom' ? 'selected' : ''}>아래쪽 (바닥)</option>
              <option value="top" ${el.hatchSide === 'top' ? 'selected' : ''}>위쪽 (천장)</option>
              <option value="left" ${el.hatchSide === 'left' ? 'selected' : ''}>왼쪽 (벽)</option>
              <option value="right" ${el.hatchSide === 'right' ? 'selected' : ''}>오른쪽 (벽)</option>
            </select>
          </div>
          <div class="prop-group">
            <div class="prop-label">빗금 깊이 (px)</div>
            <input type="number" class="prop-input" id="prop_hatchSize" value="${el.hatchSize || 12}" min="5" max="30" />
          </div>
        `;
        break;

      case 'ball':
        html += `
          <div class="prop-group">
            <div class="prop-label">반지름 (Radius)</div>
            <input type="number" class="prop-input" id="prop_r" value="${el.r || 20}" min="5" max="100" />
          </div>
          <div class="prop-group" style="margin-top: 0.4rem;">
            <label class="checkbox-label" style="font-size: 0.85rem; font-weight: 600;">
              <input type="checkbox" class="prop-input" id="prop_showCenterDot" ${el.showCenterDot ? 'checked' : ''} />
              <span>원 중심 점(•) 표시</span>
            </label>
          </div>
          ${this.renderGrayPaletteControl(el)}
        `;
        break;

      case 'block':
        html += `
          <div class="prop-row">
            <div class="prop-group">
              <div class="prop-label">가로 너비</div>
              <input type="number" class="prop-input" id="prop_width" value="${el.width || 60}" min="10" />
            </div>
            <div class="prop-group">
              <div class="prop-label">세로 높이</div>
              <input type="number" class="prop-input" id="prop_height" value="${el.height || 40}" min="10" />
            </div>
          </div>
          ${this.renderGrayPaletteControl(el)}
        `;
        break;

      case 'vector':
        html += `
          <div class="prop-group">
            <div class="prop-label">라벨 위치</div>
            <select class="prop-input" id="prop_labelPos">
              <option value="right" ${el.labelPos === 'right' ? 'selected' : ''}>오른쪽</option>
              <option value="left" ${el.labelPos === 'left' ? 'selected' : ''}>왼쪽</option>
              <option value="top" ${el.labelPos === 'top' ? 'selected' : ''}>위쪽</option>
              <option value="bottom" ${el.labelPos === 'bottom' ? 'selected' : ''}>아래쪽</option>
            </select>
          </div>
          <div class="prop-group">
            <div class="prop-label">선 스타일</div>
            <select class="prop-input" id="prop_dashed">
              <option value="false" ${!el.dashed ? 'selected' : ''}>실선 (Solid)</option>
              <option value="true" ${el.dashed ? 'selected' : ''}>점선 (Dashed)</option>
            </select>
          </div>
        `;
        break;

      case 'dimension':
        html += `
          <div class="prop-group">
            <div class="prop-label">텍스트 위치 (Left / Center / Right)</div>
            <select class="prop-input" id="prop_labelPos">
              <option value="left" ${el.labelPos === 'left' || !el.labelPos ? 'selected' : ''}>⬅️ 왼쪽 (Left)</option>
              <option value="center" ${el.labelPos === 'center' ? 'selected' : ''}>⏺️ 중앙 (Center)</option>
              <option value="right" ${el.labelPos === 'right' ? 'selected' : ''}>➡️ 오른쪽 (Right)</option>
            </select>
          </div>
          <div class="prop-group">
            <div class="prop-label">보조 연장선</div>
            <select class="prop-input" id="prop_showGuides">
              <option value="true" ${el.showGuides ? 'selected' : ''}>표시함</option>
              <option value="false" ${!el.showGuides ? 'selected' : ''}>표시 안함</option>
            </select>
          </div>
        `;
        break;

      case 'guideLine':
        html += `
          <div class="prop-group">
            <div class="prop-label">점선 형태</div>
            <select class="prop-input" id="prop_style">
              <option value="dashed" ${el.style === 'dashed' ? 'selected' : ''}>점선 (Dashed)</option>
              <option value="dotted" ${el.style === 'dotted' ? 'selected' : ''}>촘촘한 점선 (Dotted)</option>
              <option value="solid" ${el.style === 'solid' ? 'selected' : ''}>실선 (Solid)</option>
            </select>
          </div>
        `;
        break;

      case 'spring':
        html += `
          <div class="prop-row">
            <div class="prop-group">
              <div class="prop-label">코일 횟수</div>
              <input type="number" class="prop-input" id="prop_coils" value="${el.coils || 8}" min="3" max="30" />
            </div>
            <div class="prop-group">
              <div class="prop-label">반지름</div>
              <input type="number" class="prop-input" id="prop_radius" value="${el.radius || 10}" min="4" max="30" />
            </div>
          </div>
        `;
        break;

      case 'pulley':
        html += `
          <div class="prop-group">
            <div class="prop-label">도르래 반지름</div>
            <input type="number" class="prop-input" id="prop_r" value="${el.r || 24}" min="10" max="60" />
          </div>
          ${this.renderGrayPaletteControl(el)}
        `;
        break;

      case 'text':
        html += `
          <div class="prop-group">
            <div class="prop-label">글자 크기 (px)</div>
            <input type="number" class="prop-input" id="prop_fontSize" value="${el.fontSize || 18}" min="10" max="60" />
          </div>
        `;
        break;
    }

    html += `</div>`;
    this.container.innerHTML = html;

    this.bindEvents(el);
  }

  renderGrayPaletteControl(el) {
    const currentFill = (el.fill || '#ffffff').toLowerCase();
    const grays = [
      { name: '흰색 (0%)', hex: '#ffffff' },
      { name: '아주 밝은 회색 (5%)', hex: '#f3f4f6' },
      { name: '밝은 회색 (10%)', hex: '#e5e7eb' },
      { name: '연한 회색 (20%)', hex: '#d1d5db' },
      { name: '중간 회색 (40%)', hex: '#9ca3af' },
      { name: '진한 회색 (60%)', hex: '#6b7280' },
      { name: '어두운 회색 (80%)', hex: '#374151' },
      { name: '검은색 (100%)', hex: '#000000' }
    ];

    return `
      <div class="prop-group" style="margin-top: 0.6rem;">
        <div class="prop-label">면 채우기 색상 (그레이 팔레트)</div>
        <div class="color-palette-grid">
          ${grays.map(g => {
            const isActive = currentFill === g.hex;
            const borderStyle = g.hex === '#ffffff' ? 'border: 1px solid #cbd5e1;' : '';
            return `
              <button type="button" class="color-swatch-btn ${isActive ? 'active' : ''}" 
                      data-color="${g.hex}" 
                      style="background-color: ${g.hex}; ${borderStyle}" 
                      title="${g.name}">
              </button>
            `;
          }).join('')}
        </div>
        <div style="display: flex; align-items: center; gap: 0.5rem; margin-top: 0.5rem;">
          <input type="color" class="prop-input" id="prop_fill" value="${currentFill}" 
                 style="width: 32px; height: 32px; padding: 0; cursor: pointer; border: 1px solid var(--border-color); border-radius: 6px;" />
          <span style="font-size: 0.75rem; color: var(--text-muted); font-family: monospace;">${currentFill.toUpperCase()}</span>
        </div>
      </div>
    `;
  }

  renderMultiSelectInspector(elements) {
    this.container.innerHTML = `
      <div class="inspector-header">
        <h3>📦 다중 선택 (${elements.length}개)</h3>
        <button class="btn btn-secondary" id="deleteElemBtn" style="padding: 0.3rem 0.6rem; color: var(--accent-red); border-color: rgba(239,68,68,0.3);">
          🗑️ 삭제
        </button>
      </div>
      <div class="inspector-body">
        <div style="display: flex; flex-direction: column; gap: 0.5rem; margin-bottom: 1rem;">
          <button class="btn btn-primary" id="groupActionBtn">
            <span>📦 그룹 지정 (Ctrl+G)</span>
          </button>
          <button class="btn btn-secondary" id="copyActionBtn">
            <span>📋 복사하기 (Ctrl+C)</span>
          </button>
        </div>
        <div class="prop-group">
          <div class="prop-label">선택된 요소 목록</div>
          <div style="max-height: 180px; overflow-y: auto; display: flex; flex-direction: column; gap: 0.3rem; padding: 0.4rem; background: var(--bg-canvas); border-radius: 6px; border: 1px solid var(--border-color);">
            ${elements.map(e => `
              <div style="font-size: 0.78rem; display: flex; align-items: center; justify-content: space-between; padding: 0.2rem 0.4rem; background: var(--bg-card); border-radius: 4px;">
                <span>• ${this.getElementTypeName(e.type)}</span>
                <span style="font-size: 0.7rem; color: var(--text-muted);">${e.label || e.text || ''}</span>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;

    const groupBtn = this.container.querySelector('#groupActionBtn');
    if (groupBtn) groupBtn.addEventListener('click', () => this.engine.groupSelected());

    const copyBtn = this.container.querySelector('#copyActionBtn');
    if (copyBtn) copyBtn.addEventListener('click', () => this.engine.copy());

    const deleteBtn = this.container.querySelector('#deleteElemBtn');
    if (deleteBtn) deleteBtn.addEventListener('click', () => this.engine.deleteSelectedElements());
  }

  renderGroupInspector(groupEl) {
    const childrenCount = groupEl.children ? groupEl.children.length : 0;
    this.container.innerHTML = `
      <div class="inspector-header">
        <h3>📦 그룹 객체 (${childrenCount}개 요소)</h3>
        <button class="btn btn-secondary" id="deleteElemBtn" style="padding: 0.3rem 0.6rem; color: var(--accent-red); border-color: rgba(239,68,68,0.3);">
          🗑️ 삭제
        </button>
      </div>
      <div class="inspector-body">
        <div style="display: flex; flex-direction: column; gap: 0.5rem; margin-bottom: 1rem;">
          <button class="btn btn-primary" id="ungroupActionBtn">
            <span>🔓 그룹 해제 (Ctrl+Shift+G)</span>
          </button>
          <button class="btn btn-secondary" id="copyActionBtn">
            <span>📋 복사하기 (Ctrl+C)</span>
          </button>
        </div>
        <div class="prop-group">
          <div class="prop-label">그룹 구성 요약</div>
          <div style="max-height: 180px; overflow-y: auto; display: flex; flex-direction: column; gap: 0.3rem; padding: 0.4rem; background: var(--bg-canvas); border-radius: 6px; border: 1px solid var(--border-color);">
            ${(groupEl.children || []).map(e => `
              <div style="font-size: 0.78rem; display: flex; align-items: center; justify-content: space-between; padding: 0.2rem 0.4rem; background: var(--bg-card); border-radius: 4px;">
                <span>• ${this.getElementTypeName(e.type)}</span>
                <span style="font-size: 0.7rem; color: var(--text-muted);">${e.label || e.text || ''}</span>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;

    const ungroupBtn = this.container.querySelector('#ungroupActionBtn');
    if (ungroupBtn) ungroupBtn.addEventListener('click', () => this.engine.ungroupSelected());

    const copyBtn = this.container.querySelector('#copyActionBtn');
    if (copyBtn) copyBtn.addEventListener('click', () => this.engine.copy());

    const deleteBtn = this.container.querySelector('#deleteElemBtn');
    if (deleteBtn) deleteBtn.addEventListener('click', () => this.engine.deleteSelectedElements());
  }

  getElementTypeName(type) {
    const names = {
      group: '그룹 객체',
      ground: '빗금 바닥/벽',
      ball: '구형 물체(원)',
      block: '사각형 물체',
      vector: '벡터 화살표',
      dimension: '치수선(높이/거리)',
      guideLine: '보조 점선',
      spring: '용수철',
      pulley: '도르래',
      angleArc: '각도 표시',
      text: '수식/텍스트 라벨'
    };
    return names[type] || '요소';
  }

  bindEvents(el) {
    const boundElementId = el.id;
    const deleteBtn = this.container.querySelector('#deleteElemBtn');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', () => {
        this.engine.deleteSelectedElement();
      });
    }

    // Bind color swatch clicks
    const swatchBtns = this.container.querySelectorAll('.color-swatch-btn');
    swatchBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const color = btn.getAttribute('data-color');
        if (color) {
          this.engine.updateSelectedElement({ fill: color });
        }
      });
    });

    // Bind input listeners
    const inputs = this.container.querySelectorAll('.prop-input');
    inputs.forEach(input => {
      const handler = () => {
        if (!this.engine.selectedIds.has(boundElementId)) return;

        const id = input.id.replace('prop_', '');
        let val;

        if (input.type === 'checkbox') {
          val = input.checked;
        } else if (input.type === 'number') {
          val = parseFloat(input.value) || 0;
        } else {
          val = input.value;
          if (val === 'true') val = true;
          else if (val === 'false') val = false;
        }

        const updateObj = {};
        if (id === 'label' && el.text !== undefined) {
          updateObj.text = val;
        } else {
          updateObj[id] = val;
        }

        this.engine.updateSelectedElement(updateObj, true);
      };

      input.addEventListener('input', handler);
      input.addEventListener('change', handler);
    });
  }

  escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/"/g, '&quot;');
  }
}
