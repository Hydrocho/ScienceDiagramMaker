import { SvgEngine } from './engine/SvgEngine.js';
import { Inspector } from './ui/Inspector.js';
import { PRESETS } from './presets/templates.js';

document.addEventListener('DOMContentLoaded', () => {
  const svgCanvas = document.getElementById('physicsCanvas');
  const canvasWrapper = document.querySelector('.canvas-wrapper');
  
  // Initialize Core SVG Engine
  const engine = new SvgEngine(svgCanvas, canvasWrapper);

  // Zoom UI Bindings
  const zoomBadge = document.getElementById('zoomBadge');
  const zoomInBtn = document.getElementById('zoomInBtn');
  const zoomOutBtn = document.getElementById('zoomOutBtn');
  const zoomResetBtn = document.getElementById('zoomResetBtn');

  engine.onZoomChange = (zoom) => {
    zoomBadge.textContent = `${Math.round(zoom * 100)}%`;
  };

  zoomInBtn.addEventListener('click', () => engine.setZoom(engine.zoom + 0.15));
  zoomOutBtn.addEventListener('click', () => engine.setZoom(engine.zoom - 0.15));
  zoomResetBtn.addEventListener('click', () => engine.resetZoom());
  zoomBadge.addEventListener('click', () => engine.resetZoom());
  
  // Initialize Inspector Panel
  const inspectorContainer = document.getElementById('inspectorContainer');
  const inspector = new Inspector(inspectorContainer, engine);

  // Render Preset List in Left Sidebar
  const presetContainer = document.getElementById('presetListContainer');
  renderPresetList();

  // Load Initial Default Preset (Preset 1: 연직 운동 / 자유 낙하 matching user's image)
  if (PRESETS.length > 0) {
    engine.loadElements(PRESETS[0].elements);
  }

  // --- Settings Checkboxes Listener ---
  const chkShowGrid = document.getElementById('chkShowGrid');
  const canvasChkShowGrid = document.getElementById('canvasChkShowGrid');
  const chkSnapGrid = document.getElementById('chkSnapGrid');
  const canvasChkSnapGrid = document.getElementById('canvasChkSnapGrid');
  const chkDarkTheme = document.getElementById('chkDarkTheme');

  function updateGridVisibility(visible) {
    if (chkShowGrid) chkShowGrid.checked = visible;
    if (canvasChkShowGrid) canvasChkShowGrid.checked = visible;
    engine.setShowGrid(visible);
    showToast(visible ? '그리드 격자 표시 ON' : '그리드 격자 감추기 OFF');
  }

  function updateGridSnap(snap) {
    if (chkSnapGrid) chkSnapGrid.checked = snap;
    if (canvasChkSnapGrid) canvasChkSnapGrid.checked = snap;
    engine.setSnapToGrid(snap);
    showToast(snap ? '그리드 스냅 ON (자석 맞춤)' : '그리드 스냅 OFF');
  }

  if (chkShowGrid) chkShowGrid.addEventListener('change', (e) => updateGridVisibility(e.target.checked));
  if (canvasChkShowGrid) canvasChkShowGrid.addEventListener('change', (e) => updateGridVisibility(e.target.checked));

  if (chkSnapGrid) chkSnapGrid.addEventListener('change', (e) => updateGridSnap(e.target.checked));
  if (canvasChkSnapGrid) canvasChkSnapGrid.addEventListener('change', (e) => updateGridSnap(e.target.checked));

  if (chkDarkTheme) {
    chkDarkTheme.addEventListener('change', (e) => {
      document.body.classList.toggle('dark-theme', e.target.checked);
      showToast(e.target.checked ? '다크 테마 적용' : '화이트 테마 적용');
    });
  }

  // --- Toolbox Buttons Listener ---
  const toolCards = document.querySelectorAll('.tool-card');
  toolCards.forEach(card => {
    card.addEventListener('click', () => {
      const toolType = card.getAttribute('data-tool');
      addNewElement(toolType);
    });
  });

  function addNewElement(type, customPos = null) {
    const center = customPos || { x: 300, y: 225 };
    let newEl = null;

    switch (type) {
      case 'ground':
        newEl = {
          type: 'ground',
          x1: center.x - 150, y1: center.y,
          x2: center.x + 150, y2: center.y,
          hatchSide: 'bottom',
          hatchSize: 12
        };
        break;
      case 'ball':
        newEl = {
          type: 'ball',
          cx: center.x, cy: center.y,
          r: 30,
          label: '질량 m',
          showCenterDot: false,
          fill: '#ffffff'
        };
        break;
      case 'block':
        newEl = {
          type: 'block',
          x: center.x - 30, y: center.y - 30,
          width: 60, height: 60,
          label: 'm',
          fill: '#ffffff'
        };
        break;
      case 'vector':
        newEl = {
          type: 'vector',
          x1: center.x, y1: center.y,
          x2: center.x, y2: center.y + 60,
          label: '속력 v',
          labelPos: 'right',
          dashed: false,
          strokeWidth: 2
        };
        break;
      case 'dimension':
        newEl = {
          type: 'dimension',
          x1: center.x - 105, y1: center.y - 60,
          x2: center.x - 105, y2: center.y + 60,
          label: '높이 h',
          labelPos: 'left',
          showGuides: true
        };
        break;
      case 'guideLine':
        newEl = {
          type: 'guideLine',
          x1: center.x - 105, y1: center.y,
          x2: center.x, y2: center.y,
          style: 'dashed'
        };
        break;
      case 'spring':
        newEl = {
          type: 'spring',
          x1: center.x - 105, y1: center.y,
          x2: center.x + 60, y2: center.y,
          coils: 8,
          radius: 10,
          label: 'k'
        };
        break;
      case 'pulley':
        newEl = {
          type: 'pulley',
          cx: center.x, cy: center.y - 45,
          r: 30,
          label: ''
        };
        break;
      case 'angleArc':
        newEl = {
          type: 'angleArc',
          cx: center.x - 75, cy: center.y + 45,
          r: 30,
          startAngle: 0, endAngle: 35,
          label: '\\theta'
        };
        break;
      case 'text':
        newEl = {
          type: 'text',
          x: center.x, y: center.y,
          text: '새 수식 라벨 T',
          fontSize: 18
        };
        break;
    }

    if (newEl) {
      engine.addElement(newEl);
      showToast('새 요소가 추가되었습니다.');
      if (type === 'text') {
        setTimeout(() => {
          const input = document.getElementById('prop_label');
          if (input) {
            input.focus();
            input.select();
          }
        }, 50);
      }
    }
  }

  // Double-click canvas to quickly add text object at clicked location
  svgCanvas.addEventListener('dblclick', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
    const elemGroup = e.target.closest('[data-id]');
    if (!elemGroup) {
      const coords = engine.getCanvasCoords(e);
      addNewElement('text', coords);
    }
  });

  // --- Render Presets Sidebar ---
  function renderPresetList() {
    presetContainer.innerHTML = PRESETS.map(p => `
      <div class="preset-card" data-id="${p.id}">
        <div class="preset-badge">${p.badge}</div>
        <div class="preset-info">
          <h4>${p.title}</h4>
          <p>${p.desc}</p>
        </div>
      </div>
    `).join('');

    presetContainer.querySelectorAll('.preset-card').forEach(card => {
      card.addEventListener('click', () => {
        const pid = card.getAttribute('data-id');
        const found = PRESETS.find(p => p.id === pid);
        if (found) {
          engine.loadElements(found.elements);
          showToast(`'${found.title}' 프리셋을 불러왔습니다.`);
        }
      });
    });
  }

  // --- Header Action Listeners ---
  const groupBtn = document.getElementById('groupBtn');
  if (groupBtn) {
    groupBtn.addEventListener('click', () => {
      const g = engine.groupSelected();
      if (g) showToast('📦 선택한 요소가 그룹으로 지정되었습니다.');
      else showToast('그룹으로 지정할 요소를 2개 이상 선택하세요.', '⚠️');
    });
  }

  const ungroupBtn = document.getElementById('ungroupBtn');
  if (ungroupBtn) {
    ungroupBtn.addEventListener('click', () => {
      if (engine.ungroupSelected()) showToast('🔓 그룹이 해제되었습니다.');
      else showToast('해제할 그룹 요소를 선택하세요.', '⚠️');
    });
  }

  const copyBtn = document.getElementById('copyBtn');
  if (copyBtn) {
    copyBtn.addEventListener('click', () => {
      if (engine.copy()) showToast('📋 클립보드에 요소가 복사되었습니다 (Ctrl+C).');
      else showToast('복사할 요소를 선택하세요.', '⚠️');
    });
  }

  const pasteBtn = document.getElementById('pasteBtn');
  if (pasteBtn) {
    pasteBtn.addEventListener('click', () => {
      if (engine.paste()) showToast('📌 복사한 요소가 붙여넣기 되었습니다 (Ctrl+V).');
      else showToast('클립보드에 복사된 요소가 없습니다.', '⚠️');
    });
  }

  document.getElementById('undoBtn').addEventListener('click', () => {
    if (engine.undo()) showToast('실행 취소되었습니다.');
  });

  document.getElementById('redoBtn').addEventListener('click', () => {
    if (engine.redo()) showToast('다시 실행되었습니다.');
  });

  document.getElementById('clearBtn').addEventListener('click', () => {
    if (confirm('캔버스의 모든 요소를 지우시겠습니까?')) {
      engine.clear();
      showToast('캔버스가 비워졌습니다.');
    }
  });

  document.getElementById('copyClipboardFastBtn').addEventListener('click', async () => {
    await copyPngToClipboard(2);
  });

  // --- Save & Load Persistence Engine ---
  const STORAGE_KEY = 'physics_diagram_studio_saves_v1';

  function getSavedDiagrams() {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.error('Failed to load diagrams from localStorage:', e);
      return [];
    }
  }

  function saveDiagramToStorage(item) {
    const list = getSavedDiagrams();
    list.unshift(item); // Add to beginning of array
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  }

  function deleteDiagramFromStorage(id) {
    let list = getSavedDiagrams();
    list = list.filter(item => item.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  }

  // --- Save Modal Logic ---
  const saveModal = document.getElementById('saveModal');
  const openSaveModalBtn = document.getElementById('openSaveModalBtn');
  const closeSaveModalBtn = document.getElementById('closeSaveModalBtn');
  const cancelSaveModalBtn = document.getElementById('cancelSaveModalBtn');
  const confirmSaveBtn = document.getElementById('confirmSaveBtn');
  const savePreviewImg = document.getElementById('savePreviewImg');
  const saveDiagramName = document.getElementById('saveDiagramName');

  openSaveModalBtn.addEventListener('click', async () => {
    if (engine.elements.length === 0) {
      showToast('저장할 그림 요소가 캔버스에 없습니다.', '⚠️');
      return;
    }

    const thumbnailDataUrl = await engine.exportPng(1);
    savePreviewImg.src = thumbnailDataUrl;

    const defaultTitle = `물리 도식_${new Date().toLocaleDateString('ko-KR').replace(/\. /g, '-').replace('.', '')}_${new Date().toLocaleTimeString('ko-KR', { hour12: false, hour: '2-digit', minute: '2-digit' })}`;
    saveDiagramName.value = defaultTitle;

    saveModal.classList.add('active');
    setTimeout(() => saveDiagramName.select(), 100);
  });

  function closeSaveModal() {
    saveModal.classList.remove('active');
  }

  closeSaveModalBtn.addEventListener('click', closeSaveModal);
  cancelSaveModalBtn.addEventListener('click', closeSaveModal);
  saveModal.addEventListener('click', (e) => {
    if (e.target === saveModal) closeSaveModal();
  });

  confirmSaveBtn.addEventListener('click', () => {
    const title = saveDiagramName.value.trim() || '무제 물리 도식';
    const diagramItem = {
      id: 'save_' + Date.now(),
      name: title,
      elements: JSON.parse(JSON.stringify(engine.elements)),
      thumbnail: savePreviewImg.src,
      createdAt: new Date().toLocaleString('ko-KR')
    };

    saveDiagramToStorage(diagramItem);
    closeSaveModal();
    showToast(`💾 '${title}' 그림이 저장되었습니다!`, '✅');
  });

  // --- Load Modal Logic ---
  const loadModal = document.getElementById('loadModal');
  const openLoadModalBtn = document.getElementById('openLoadModalBtn');
  const closeLoadModalBtn = document.getElementById('closeLoadModalBtn');
  const closeLoadModalFooterBtn = document.getElementById('closeLoadModalFooterBtn');
  const savedListContainer = document.getElementById('savedListContainer');

  openLoadModalBtn.addEventListener('click', () => {
    renderSavedDiagramsList();
    loadModal.classList.add('active');
  });

  function closeLoadModal() {
    loadModal.classList.remove('active');
  }

  closeLoadModalBtn.addEventListener('click', closeLoadModal);
  closeLoadModalFooterBtn.addEventListener('click', closeLoadModal);
  loadModal.addEventListener('click', (e) => {
    if (e.target === loadModal) closeLoadModal();
  });

  function renderSavedDiagramsList() {
    const diagrams = getSavedDiagrams();
    if (diagrams.length === 0) {
      savedListContainer.innerHTML = `
        <div class="empty-saved-state">
          <span style="font-size: 2.5rem;">📭</span>
          <p>내부 저장소에 저장된 물리 그림이 없습니다.</p>
          <span style="font-size: 0.75rem; color: var(--text-muted);">캔버스에서 그림을 작성한 후 '💾 저장' 버튼을 누르면 이 곳에 저장됩니다.</span>
        </div>
      `;
      return;
    }

    savedListContainer.innerHTML = diagrams.map(item => `
      <div class="saved-diagram-card" data-id="${item.id}">
        <div class="saved-diagram-thumb">
          <img src="${item.thumbnail}" alt="${item.name}" />
        </div>
        <div class="saved-diagram-body">
          <div class="saved-diagram-title" title="${item.name}">${item.name}</div>
          <div class="saved-diagram-date">🕒 ${item.createdAt}</div>
          <div class="saved-diagram-actions">
            <button class="btn btn-primary load-item-btn" data-id="${item.id}">
              <span>📂 불러오기</span>
            </button>
            <button class="btn btn-secondary delete-item-btn" data-id="${item.id}" title="삭제">
              <span>🗑️</span>
            </button>
          </div>
        </div>
      </div>
    `).join('');

    // Bind Load Action
    savedListContainer.querySelectorAll('.load-item-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const item = getSavedDiagrams().find(d => d.id === id);
        if (item) {
          engine.loadElements(item.elements);
          closeLoadModal();
          showToast(`📂 '${item.name}' 그림을 불러왔습니다!`, '✅');
        }
      });
    });

    // Bind Delete Action
    savedListContainer.querySelectorAll('.delete-item-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-id');
        const item = getSavedDiagrams().find(d => d.id === id);
        if (item && confirm(`'${item.name}' 그림을 삭제하시겠습니까?`)) {
          deleteDiagramFromStorage(id);
          renderSavedDiagramsList();
          showToast(`🗑️ '${item.name}' 그림이 삭제되었습니다.`, '💡');
        }
      });
    });
  }

  // --- Export Modal Management ---
  const exportModal = document.getElementById('exportModal');
  const openModalBtn = document.getElementById('openExportModalBtn');
  const closeModalBtn = document.getElementById('closeExportModalBtn');
  const previewImg = document.getElementById('exportPreviewImg');
  let currentExportScale = 2;

  openModalBtn.addEventListener('click', async () => {
    await updateExportPreview();
    exportModal.classList.add('active');
  });

  closeModalBtn.addEventListener('click', () => {
    exportModal.classList.remove('active');
  });

  exportModal.addEventListener('click', (e) => {
    if (e.target === exportModal) exportModal.classList.remove('active');
  });

  // Resolution Scale Selector
  document.querySelectorAll('.segmented-control .seg-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      document.querySelectorAll('.segmented-control .seg-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentExportScale = parseInt(btn.getAttribute('data-scale')) || 2;
      await updateExportPreview();
    });
  });

  async function updateExportPreview() {
    const dataUrl = await engine.exportPng(currentExportScale);
    previewImg.src = dataUrl;
  }

  // Modal Action Buttons
  document.getElementById('modalCopyClipboardBtn').addEventListener('click', async () => {
    await copyPngToClipboard(currentExportScale);
    exportModal.classList.remove('active');
  });

  document.getElementById('modalDownloadPngBtn').addEventListener('click', async () => {
    const dataUrl = await engine.exportPng(currentExportScale);
    const link = document.createElement('a');
    link.download = `physics_diagram_${Date.now()}.png`;
    link.href = dataUrl;
    link.click();
    showToast('PNG 파일이 다운로드 되었습니다.');
    exportModal.classList.remove('active');
  });

  document.getElementById('modalDownloadSvgBtn').addEventListener('click', () => {
    const svgStr = engine.getSvgString();
    const blob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = `physics_diagram_${Date.now()}.svg`;
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
    showToast('Vector SVG 파일이 다운로드 되었습니다.');
    exportModal.classList.remove('active');
  });

  // --- Copy PNG to Clipboard Helper ---
  async function copyPngToClipboard(scale = 2) {
    try {
      const svgStr = engine.getSvgString();
      const blob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);

      const canvas = document.createElement('canvas');
      canvas.width = 600 * scale;
      canvas.height = 450 * scale;
      const ctx = canvas.getContext('2d');

      const img = new Image();
      img.onload = async () => {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(url);

        canvas.toBlob(async (pngBlob) => {
          if (!pngBlob) {
            showToast('이미지 변환에 실패했습니다.', '⚠️');
            return;
          }
          try {
            await navigator.clipboard.write([
              new ClipboardItem({ 'image/png': pngBlob })
            ]);
            showToast('📋 클립보드 복사 완료! 한글 HWP나 Word에 Ctrl+V로 붙여넣으세요.', '✅');
          } catch (err) {
            console.error('Clipboard write failed:', err);
            const link = document.createElement('a');
            link.download = `physics_diagram_${Date.now()}.png`;
            link.href = URL.createObjectURL(pngBlob);
            link.click();
            showToast('클립보드 접근 제한으로 파일 다운로드 처리되었습니다.', '💡');
          }
        }, 'image/png');
      };
      img.src = url;
    } catch (err) {
      console.error(err);
      showToast('이미지 복사 중 오류가 발생했습니다.', '❌');
    }
  }

  // --- Toast Notification System ---
  function showToast(message, icon = '✅') {
    const toast = document.getElementById('toastMsg');
    const toastIcon = document.getElementById('toastIcon');
    const toastText = document.getElementById('toastText');

    toastIcon.textContent = icon;
    toastText.textContent = message;

    toast.classList.add('show');
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => {
      toast.classList.remove('show');
    }, 3200);
  }

  // Keyboard Shortcuts
  window.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.isContentEditable) return;

    const isCtrlOrCmd = e.ctrlKey || e.metaKey;

    if (e.key === 'Delete' || e.key === 'Backspace') {
      engine.deleteSelectedElements();
    } else if (isCtrlOrCmd && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      engine.undo();
    } else if (isCtrlOrCmd && e.key.toLowerCase() === 'y') {
      e.preventDefault();
      engine.redo();
    } else if (isCtrlOrCmd && e.key.toLowerCase() === 'c') {
      e.preventDefault();
      if (engine.copy()) showToast('📋 요소 복사 완료 (Ctrl+C)');
    } else if (isCtrlOrCmd && e.key.toLowerCase() === 'v') {
      e.preventDefault();
      if (engine.paste()) showToast('📌 요소 붙여넣기 완료 (Ctrl+V)');
    } else if (isCtrlOrCmd && e.key.toLowerCase() === 'd') {
      e.preventDefault();
      if (engine.duplicate()) showToast('✨ 요소 복제 완료 (Ctrl+D)');
    } else if (isCtrlOrCmd && e.key.toLowerCase() === 'g') {
      e.preventDefault();
      if (e.shiftKey) {
        if (engine.ungroupSelected()) showToast('🔓 그룹 해제 완료 (Ctrl+Shift+G)');
        else showToast('해제할 그룹 요소를 선택하세요.', '⚠️');
      } else {
        if (engine.groupSelected()) showToast('📦 그룹 지정 완료 (Ctrl+G)');
        else showToast('그룹으로 지정할 요소를 2개 이상 선택하세요.', '⚠️');
      }
    } else if (isCtrlOrCmd && e.key.toLowerCase() === 'a') {
      e.preventDefault();
      engine.selectAll();
      showToast('전체 요소가 선택되었습니다.');
    }
  });
});
