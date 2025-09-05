// --- 编辑器核心逻辑与渲染 ---
// 本文件是编辑器功能的核心, 包含了数据管理、渲染、事件处理、模态框逻辑以及导入/导出功能.
//
// 功能函数:
// - 数据管理: populateWorldBookWithDefaults, loadEditorData, resetEditorToDefaults
// - 渲染: renderTalentEditor, renderBackgroundEditor, renderPresetEditor, renderWorldBookEditor, renderPresetDetails, 等
// - 模态框: showModal, hideModal, saveModalData, showWorldBookModal, hideWorldBookModal, saveWorldBookData, 等
// - 事件监听: setupEditorEventListeners
// - 导入/导出: handleBatchImport, importCustomTextData, exportSeriesPackage, importSeriesPackage
//
// 数据对象:
// - editorData: 统一存放从世界书加载的天赋、背景、预设等数据.
// - currentEditingPreset: 当前正在编辑的预设对象.
//
// 加载顺序:
// - 本文件应在gameState.js, ui.js, worldbookManager.js, seriesManager.js 和 utils.js 之后加载.

// --- 编辑器数据（统一管理） ---
const editorData = {
  talents: [],
  backgrounds: [],
  presets: [],
  worldbookEntries: [],
  isLoading: false,
  lastLoadTime: null,
};

async function populateWorldBookWithDefaults() {
  console.log('正在使用默认数据填充世界书...');
  const { talents, backgrounds, presets } = DEFAULT_EDITOR_DATA;
  let successCount = 0;
  let failCount = 0;

  const processItems = async (items, type, saveFunction) => {
    for (const item of items) {
      try {
        if (await saveFunction(item, type)) {
          successCount++;
        } else {
          failCount++;
        }
      } catch (e) {
        failCount++;
        console.error(`保存默认${type}失败: ${item.name}`, e);
      }
    }
  };

  await processItems(talents, 'talent', WorldBookManager.saveTalentOrBackground.bind(WorldBookManager));
  await processItems(backgrounds, 'background', WorldBookManager.saveTalentOrBackground.bind(WorldBookManager));
  await processItems(presets, 'preset', WorldBookManager.savePreset.bind(WorldBookManager));

  if (failCount > 0) {
    await guiXuAlert(`世界书初始化部分完成。成功: ${successCount}, 失败: ${failCount}。详情请查看控制台。`, '警告');
  } else {
    await guiXuAlert(`世界书初始化成功，共写入 ${successCount} 条默认数据。`);
  }
}

async function promptForDefaultImport() {
  return new Promise(resolve => {
    const modal = document.getElementById('default-import-modal');
    const confirmBtn = document.getElementById('import-defaults-confirm-btn');
    const laterBtn = document.getElementById('import-defaults-later-btn');
    modal.style.display = 'flex';
    const onConfirm = async () => {
      modal.style.display = 'none';
      document.getElementById('loading-overlay').style.display = 'flex';
      await populateWorldBookWithDefaults();
      document.getElementById('loading-overlay').style.display = 'none';
      cleanup();
      resolve(true);
    };
    const onLater = () => {
      modal.style.display = 'none';
      cleanup();
      resolve(false);
    };
    const cleanup = () => {
      confirmBtn.removeEventListener('click', onConfirm);
      laterBtn.removeEventListener('click', onLater);
    };
    confirmBtn.addEventListener('click', onConfirm);
    laterBtn.addEventListener('click', onLater);
  });
}

async function loadEditorData() {
  if (editorData.isLoading) return true;
  editorData.isLoading = true;
  document.getElementById('loading-overlay').style.display = 'flex';

  try {
    const loadingPlaceholder = `<div class="loading-placeholder">正在从世界书加载数据...</div>`;
    [
      'talent-list-container',
      'background-list-container',
      'preset-list-container',
      'worldbook-list-container',
    ].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.innerHTML = loadingPlaceholder;
    });

    console.log('开始从世界书加载编辑器数据...');
    const worldBookData = await WorldBookManager.loadAllData();

    // **逻辑优化**: 只有在天赋和背景都为空时才提示导入
    const needsDefaultImport = worldBookData.talents.length === 0 && worldBookData.backgrounds.length === 0;

    if (needsDefaultImport) {
      // 隐藏加载动画，防止遮挡弹窗
      document.getElementById('loading-overlay').style.display = 'none';
      const imported = await promptForDefaultImport();
      if (imported) {
        // 重新显示加载动画并加载新数据
        document.getElementById('loading-overlay').style.display = 'flex';
        const reloadedData = await WorldBookManager.loadAllData();
        Object.assign(editorData, {
          talents: reloadedData.talents || [],
          backgrounds: reloadedData.backgrounds || [],
          presets: reloadedData.presets || [],
          worldbookEntries: reloadedData.worldbookEntries || [],
        });
      } else {
        Object.assign(editorData, { talents: [], backgrounds: [], presets: [], worldbookEntries: [] });
      }
    } else {
      Object.assign(editorData, {
        talents: worldBookData.talents || [],
        backgrounds: worldBookData.backgrounds || [],
        presets: worldBookData.presets || [],
        worldbookEntries: worldBookData.worldbookEntries || [],
      });
    }

    editorData.lastLoadTime = Date.now();
    console.log(
      `编辑器数据加载完成: ${editorData.talents.length}个天赋, ${editorData.backgrounds.length}个背景, ${editorData.presets.length}个预设, ${editorData.worldbookEntries.length}个世界书条目`,
    );
    renderAllEditors();
    return true;
  } catch (error) {
    console.error('加载编辑器数据时发生严重错误:', error);
    await guiXuAlert('加载编辑器数据失败，请检查控制台。
错误: ' + error.message, '错误');
    return false;
  } finally {
    editorData.isLoading = false;
    document.getElementById('loading-overlay').style.display = 'none';
  }
}

async function resetEditorToDefaults() {
  const confirmed = await guiXuConfirm(
    '确定要重置编辑器吗？这将删除世界书中所有【天赋】和【背景】条目，并重新写入默认数据。此操作不可撤销！',
    '重置确认',
  );
  if (!confirmed) return;

  document.getElementById('loading-overlay').style.display = 'flex';
  try {
    await TavernHelper.updateWorldbookWith(WorldBookManager.LOREBOOK_NAME, worldbook => {
      return worldbook.filter(entry => {
        return !entry.name.startsWith('【天赋】') && !entry.name.startsWith('【背景】');
      });
    });
    await populateWorldBookWithDefaults();
    await loadEditorData();
  } catch (error) {
    console.error('重置编辑器失败:', error);
    await guiXuAlert('重置失败，详情请查看控制台。', '错误');
  } finally {
    document.getElementById('loading-overlay').style.display = 'none';
  }
}

// --- 编辑器渲染函数 ---
function renderTalentEditor() {
  const container = document.getElementById('talent-list-container');
  if (!container) return;
  container.innerHTML = '';

  if (editorData.talents.length === 0 && !editorData.isLoading) {
    container.innerHTML = '<div class="loading-placeholder">暂无天赋数据</div>';
    return;
  }

  editorData.talents.forEach(talent => {
    const seriesString = String(talent.series || '').trim();
    const seriesInfo = seriesString ? `[${seriesString}] ` : '';
    const item = document.createElement('div');
    item.classList.add('editor-item');
    item.innerHTML = `
    <div class="item-header">
      <strong>${seriesInfo}${talent.name}</strong>
      <span>(品阶: ${talent.quality || '无'} | 作者: ${talent.author || '未知'} | 消耗: ${talent.cost || 0}点)</span>
    </div>
    <p class="item-description">${talent.description || '暂无描述'}</p>
    <div class="item-actions">
      <button class="editor-btn edit-talent-btn" data-uid="${talent.uid}" data-name="${talent.name}">编辑</button>
      <button class="editor-btn btn-danger delete-talent-btn" data-uid="${talent.uid}" data-name="${talent.name}">删除</button>
    </div>
  `;
    container.appendChild(item);
  });
}

function renderBackgroundEditor() {
  const container = document.getElementById('background-list-container');
  if (!container) return;
  container.innerHTML = '';

  if (editorData.backgrounds.length === 0 && !editorData.isLoading) {
    container.innerHTML = '<div class="loading-placeholder">暂无背景数据</div>';
    return;
  }

  editorData.backgrounds.forEach(bg => {
    const seriesString = String(bg.series || '').trim();
    const seriesInfo = seriesString ? `[${seriesString}] ` : '';
    const item = document.createElement('div');
    item.classList.add('editor-item');
    item.innerHTML = `
    <div class="item-header">
      <strong>${seriesInfo}${bg.name}</strong>
      <span>(品阶: ${bg.quality || '无'} | 作者: ${bg.author || '未知'})</span>
    </div>
    <p class="item-description">${bg.description || '暂无描述'}</p>
    <div class="item-actions">
      <button class="editor-btn edit-background-btn" data-uid="${bg.uid}" data-name="${bg.name}">编辑</button>
      <button class="editor-btn btn-danger delete-background-btn" data-uid="${bg.uid}" data-name="${bg.name}">删除</button>
    </div>
  `;
    container.appendChild(item);
  });
}

function renderPresetEditor() {
  const container = document.getElementById('preset-list-container');
  if (!container) return;
  container.innerHTML = '';
  if (editorData.presets.length === 0 && !editorData.isLoading) {
    container.innerHTML = '<div class="loading-placeholder">暂无预设数据</div>';
    return;
  }
  editorData.presets.forEach(preset => {
    const item = document.createElement('div');
    item.classList.add('preset-list-item');
    if (currentEditingPreset && currentEditingPreset.name === preset.name) {
      item.classList.add('selected');
    }
    item.dataset.presetName = preset.name;
    const seriesString = String(preset.series || '').trim();
    const seriesInfo = seriesString ? `[${seriesString}] ` : '';
    item.innerHTML = `<strong>${seriesInfo}${preset.name}</strong><br><small>作者: ${preset.author || '未知'}</small>`;
    container.appendChild(item);
  });
}

let currentWbFilter = 'all';
function renderWorldBookEditor() {
  const container = document.getElementById('worldbook-list-container');
  if (!container) return;
  container.innerHTML = '';

  const searchInput = document.getElementById('wb-search-input');
  const searchTerm = searchInput ? searchInput.value.toLowerCase().trim() : '';

  const filterPrefixMap = {
    general: '【世界书】',
    preset: '【预设】',
    talent: '【天赋】',
    background: '【背景】',
  };

  let filteredEntries = editorData.worldbookEntries;

  // Step 1: Filter by category
  if (currentWbFilter !== 'all') {
    const prefix = filterPrefixMap[currentWbFilter];
    if (prefix) {
      filteredEntries = filteredEntries.filter(entry => entry.name.startsWith(prefix));
    }
  }

  // Step 2: Filter by search term
  if (searchTerm) {
    filteredEntries = filteredEntries.filter(entry => {
      const nameMatch = entry.name.toLowerCase().includes(searchTerm);
      const contentMatch = entry.content.toLowerCase().includes(searchTerm);
      return nameMatch || contentMatch;
    });
  }

  if (filteredEntries.length === 0 && !editorData.isLoading) {
    let placeholderText = '暂无世界书数据';
    if (searchTerm) {
      placeholderText = `未找到匹配 "${searchTerm}" 的条目`;
    } else if (currentWbFilter !== 'all') {
      placeholderText = `无匹配 "${filterPrefixMap[currentWbFilter] || ''}" 前缀的条目`;
    }
    container.innerHTML = `<div class="loading-placeholder">${placeholderText}</div>`;
    return;
  }

  const positionMap = {
    before_character_definition: '角色前',
    after_character_definition: '角色后',
    before_example_messages: '示例前',
    after_example_messages: '示例后',
    before_author_note: '作者注前',
    after_author_note: '作者注后',
    at_depth: '指定深度',
  };

  filteredEntries.forEach(entry => {
    const item = document.createElement('div');
    item.classList.add('editor-item');
    item.dataset.uid = entry.uid;
    const statusClass = entry.enabled ? 'enabled' : 'disabled';
    const strategyClass = entry.strategy?.type || 'constant';
    const positionText = positionMap[entry.position?.type] || '未知位置';

    item.innerHTML = `
          <div class="wb-item-header">
              <div class="wb-item-title">
                  <span class="status-indicator ${statusClass}" title="${entry.enabled ? '已启用' : '已禁用'}"></span>
                  <span>${entry.name}</span>
              </div>
              <div class="wb-item-indicators">
                  <span class="strategy-indicator ${strategyClass}" title="策略: ${strategyClass}"></span>
                  <span>${positionText} (顺序: ${entry.position?.order ?? 'N/A'})</span>
              </div>
          </div>
          <p class="item-description">${entry.content || '无内容'}</p>
           <div class="item-actions">
              <button class="editor-btn toggle-wb-btn">
                  ${entry.enabled ? '禁用' : '启用'}
              </button>
              <button class="editor-btn edit-wb-btn">编辑</button>
              <button class="editor-btn btn-danger delete-wb-btn">删除</button>
          </div>
      `;
    container.appendChild(item);
  });
}

let currentEditingPreset = null;

// --- 编辑器模态框逻辑 ---
const modal = document.getElementById('editor-modal');
const modalForm = document.getElementById('modal-form');
const modalTitle = document.getElementById('modal-title');
const modalItemType = document.getElementById('modal-item-type');
const modalEditIdentifier = document.getElementById('modal-edit-identifier');
const modalEditUid = document.getElementById('modal-edit-uid');
const modalNameInput = document.getElementById('modal-name');
const modalAuthorInput = document.getElementById('modal-author');
const modalSeriesInput = document.getElementById('modal-series');
const modalCostGroup = document.getElementById('modal-cost-group');
const modalCostInput = document.getElementById('modal-cost');
const modalDescriptionInput = document.getElementById('modal-description');
const modalInitialResourcesGroup = document.getElementById('modal-initial-resources-group');
const modalInitialResourcesInput = document.getElementById('modal-initial-resources');

function showModal(type, uid = null) {
  modalForm.reset();
  modalItemType.value = type;
  modalEditUid.value = uid;

  let item = {};
  const isEditMode = uid !== null;
  const modeText = isEditMode ? '编辑' : '添加';

  if (isEditMode) {
    const globalData = type === 'talent' ? editorData.talents : editorData.backgrounds;
    item = globalData.find(d => String(d.uid) === String(uid)) || {};
  }
  modalEditIdentifier.value = item.name || ''; // Store original name for comparison

  modalTitle.textContent = `${modeText}${type === 'talent' ? '天赋' : '背景'}`;
  modalNameInput.value = item.name || '';
  modalAuthorInput.value = item.author || '';
  modalSeriesInput.value = item.series || '';
  document.getElementById('modal-quality').value = item.quality || '';
  modalDescriptionInput.value = item.description || '';
  if (type === 'talent') {
    modalCostGroup.style.display = 'block';
    modalInitialResourcesGroup.style.display = 'none';
    modalCostInput.value = item.cost || 0;
  } else {
    modalCostGroup.style.display = 'none';
    modalInitialResourcesGroup.style.display = 'block';
    modalInitialResourcesInput.value = (item.initialResources || []).join('\n');
  }
  modal.style.display = 'flex';
}

function hideModal() {
  modal.style.display = 'none';
}

async function saveModalData() {
  const type = modalItemType.value;
  const uid = modalEditUid.value || undefined;

  const name = modalNameInput.value.trim();
  const author = modalAuthorInput.value.trim();
  const series = modalSeriesInput.value.trim();
  const quality = document.getElementById('modal-quality').value.trim();
  const description = modalDescriptionInput.value.trim();

  if (!name || !author || !description) {
    await guiXuAlert('名称、作者和描述均为必填项。', '输入错误');
    return;
  }

  const newItemData = { uid, name, author, series, quality, description };
  if (type === 'talent') {
    const cost = parseInt(modalCostInput.value, 10);
    if (isNaN(cost)) {
      await guiXuAlert('消耗点数必须是数字。', '输入错误');
      return;
    }
    newItemData.cost = cost;
  } else {
    newItemData.initialResources = modalInitialResourcesInput.value
      .split('\n')
      .map(line => line.trim())
      .filter(line => line);
  }

  const targetArray = type === 'talent' ? editorData.talents : editorData.backgrounds;
  const existingItem = targetArray.find(item => item.name === name && String(item.uid) !== String(uid));
  if (existingItem) {
    await guiXuAlert(`名称 "${name}" 已被另一个条目占用，请使用其他名称。`, '输入错误');
    return;
  }

  document.getElementById('loading-overlay').style.display = 'flex';
  try {
    const success = await WorldBookManager.saveTalentOrBackground(newItemData, type);
    if (success) {
      await loadEditorData();
      hideModal();
    } else {
      await guiXuAlert('保存失败，请检查控制台错误信息。', '错误');
    }
  } catch (error) {
    console.error('保存时发生错误:', error);
    await guiXuAlert('保存失败：' + error.message, '错误');
  } finally {
    document.getElementById('loading-overlay').style.display = 'none';
  }
}

const wbModal = document.getElementById('worldbook-editor-modal');

function setStrategyButtonState(strategy) {
  const btn = document.getElementById('wb-strategy-toggle-btn');
  if (strategy === 'constant') {
    btn.textContent = '策略: 常量 (蓝灯)';
    btn.className = 'editor-btn strategy-constant';
    btn.dataset.strategy = 'constant';
  } else {
    btn.textContent = '策略: 选择性 (绿灯)';
    btn.className = 'editor-btn strategy-selective';
    btn.dataset.strategy = 'selective';
  }
}

function showWorldBookModal(entry = null, presetContext = null) {
  const form = document.getElementById('wb-modal-form');
  form.reset();

  // Store preset context in hidden fields
  document.getElementById('wb-modal-preset-series').value = presetContext?.series || '';
  document.getElementById('wb-modal-preset-author').value = presetContext?.author || '';

  if (entry) {
    document.getElementById('wb-modal-title').textContent = '编辑世界书条目';
    document.getElementById('wb-modal-edit-uid').value = entry.uid;
    document.getElementById('wb-modal-comment').value = entry.name;
    document.getElementById('wb-modal-content').value = entry.content;
    document.getElementById('wb-modal-enabled').checked = entry.enabled;
    setStrategyButtonState(entry.strategy?.type || 'constant');
    document.getElementById('wb-modal-keys').value = (entry.strategy?.keys || []).join(', ');
    document.getElementById('wb-position-type').value = entry.position?.type || 'before_character_definition';
    document.getElementById('wb-position-order').value = entry.position?.order ?? 100;
    document.getElementById('wb-position-depth').value = entry.position?.depth ?? 0;
    document.getElementById('wb-position-role').value = entry.position?.role || 'system';
    document.getElementById('wb-recursion-incoming').checked = entry.recursion?.prevent_incoming || false;
    document.getElementById('wb-recursion-outgoing').checked = entry.recursion?.prevent_outgoing || false;
  } else {
    const title = presetContext ? `为【${presetContext.series}】系列创建新条目` : '添加新世界书条目';
    document.getElementById('wb-modal-title').textContent = title;
    document.getElementById('wb-modal-edit-uid').value = '';
    setStrategyButtonState('constant'); // Default for new entries
  }

  const positionTypeSelect = document.getElementById('wb-position-type');
  const depthSettings = document.getElementById('wb-depth-settings');
  depthSettings.style.display = positionTypeSelect.value === 'at_depth' ? 'grid' : 'none';

  wbModal.style.display = 'flex';
}

function hideWorldBookModal() {
  wbModal.style.display = 'none';
}

async function saveWorldBookData() {
  const uid = document.getElementById('wb-modal-edit-uid').value || null;
  let name = document.getElementById('wb-modal-comment').value.trim();
  const content = document.getElementById('wb-modal-content').value.trim();

  const presetSeries = document.getElementById('wb-modal-preset-series').value;
  const presetAuthor = document.getElementById('wb-modal-preset-author').value;

  if (!name) {
    await guiXuAlert('标题不能为空。', '输入错误');
    return;
  }

  // If creating a preset-specific entry, construct the full name
  if (presetSeries && presetAuthor && !uid) {
    // Only format new entries
    name = `【世界书】【${presetSeries}】【${presetAuthor}】${name}`;
  } else if (!name.startsWith('【')) {
    // For regular entries, enforce the prefix if not present
    name = `【世界书】${name}`;
  }

  const isReserved = [...editorData.talents, ...editorData.backgrounds, ...editorData.presets].some(
    item => item.originalComment === name && String(item.uid) !== String(uid),
  );
  if (isReserved && !name.startsWith('【世界书】')) {
    await guiXuAlert('该标题已被天赋/背景/预设编辑器占用，请使用其他标题，或使用【世界书】前缀。', '标题冲突');
    return;
  }

  document.getElementById('loading-overlay').style.display = 'flex';
  try {
    const entryData = {
      uid,
      name,
      content,
      enabled: document.getElementById('wb-modal-enabled').checked,
      strategy: {
        type: document.getElementById('wb-strategy-toggle-btn').dataset.strategy,
        keys: document
          .getElementById('wb-modal-keys')
          .value.split(',')
          .map(k => k.trim())
          .filter(Boolean),
      },
      position: {
        type: document.getElementById('wb-position-type').value,
        order: parseInt(document.getElementById('wb-position-order').value, 10) || 100,
        depth: parseInt(document.getElementById('wb-position-depth').value, 10) || 0,
        role: document.getElementById('wb-position-role').value,
      },
      probability: 100, // Default to 100% as per request
      recursion: {
        prevent_incoming: document.getElementById('wb-recursion-incoming').checked,
        prevent_outgoing: document.getElementById('wb-recursion-outgoing').checked,
        delay_until: null,
      },
      effect: { sticky: null, cooldown: null, delay: null },
    };

    const success = await WorldBookManager.saveWorldBookEntry(entryData);
    if (success) {
      await loadEditorData();
      hideWorldBookModal();
    } else {
      await guiXuAlert('保存世界书条目失败。', '错误');
    }
  } catch (error) {
    console.error('保存世界书条目时出错:', error);
    await guiXuAlert('保存失败: ' + error.message, '错误');
  } finally {
    document.getElementById('loading-overlay').style.display = 'none';
  }
}

// --- 预设编辑器逻辑 ---
function renderPresetDetails(preset) {
  const detailsPanel = document.getElementById('preset-details-panel');
  const controlsContainer = document.getElementById('preset-controls-container');
  const collapsibleArea = document.getElementById('preset-details-collapsible-area');

  if (!detailsPanel || !controlsContainer || !collapsibleArea) return;

  if (!preset) {
    if (window.innerWidth > 768) {
      detailsPanel.style.display = 'none';
    }
    return;
  }
  if (window.innerWidth > 768) {
    detailsPanel.style.display = 'block';
  }

  document.getElementById('preset-name').value = preset.name || '';
  document.getElementById('preset-author').value = preset.author || '';
  document.getElementById('preset-series').value = preset.series || '';
  document.getElementById('preset-points').value = preset.points || 0;

  controlsContainer.innerHTML = `
          <div class="preset-controls">
            <button type="button" id="toggle-preset-details-btn" class="preset-toggle-icon-btn" title="收拢/展开配置">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
            </button>
            <div style="display: flex; align-items: center; gap: 8px;">
              <input type="checkbox" id="preset-worldbook-enabled-switch" data-uid="${preset.uid}" ${preset.enabled ? 'checked' : ''} style="width: 18px; height: 18px; cursor: pointer;">
              <label for="preset-worldbook-enabled-switch" style="color: #c9aa71; cursor: pointer;">启用世界书</label>
            </div>
          </div>`;
  collapsibleArea.style.display = 'block';
  document.getElementById('toggle-preset-details-btn').classList.remove('collapsed');

  renderPresetAttributes(preset.attributes || {});
  renderPresetTalentSelectors(preset);
  renderPresetSeriesContent(preset);
}

function renderPresetAttributes(presetAttributes) {
  const attributesGrid = document.getElementById('preset-attributes-grid');
  if (!attributesGrid) return;
  attributesGrid.innerHTML = '';
  Object.entries(GAME_DATA.attributes).forEach(([id, attr]) => {
    const spentValue = presetAttributes[id] || 0;
    const finalValue = spentValue + (baseAttributes[id] || 0);
    const card = document.createElement('div');
    card.className = 'attribute-card';
    card.innerHTML = `
            <div class="attribute-header">
              <span class="attribute-name">${attr.name}</span>
              <div class="attribute-value">
                <button type="button" class="value-btn decrease-btn" data-attribute="${id}" ${spentValue <= 0 ? 'disabled' : ''}>-</button>
                <span class="value">${finalValue}</span>
                <button type="button" class="value-btn increase-btn" data-attribute="${id}">+</button>
              </div>
            </div>
          `;
    attributesGrid.appendChild(card);
  });
}

function addTalentToPreset(talentName) {
  if (!currentEditingPreset) return;
  if (!currentEditingPreset.optionalTalents) currentEditingPreset.optionalTalents = [];
  const allSelected = new Set([
    ...(currentEditingPreset.requiredTalents || []),
    ...(currentEditingPreset.optionalTalents || []),
  ]);
  if (allSelected.has(talentName)) return;
  currentEditingPreset.optionalTalents.push(talentName);
  renderPresetTalentSelectors(currentEditingPreset);
}

function setTalentStateInPreset(talentName, state) {
  if (!currentEditingPreset) return;
  const required = new Set(currentEditingPreset.requiredTalents || []);
  const optional = new Set(currentEditingPreset.optionalTalents || []);
  if (state === 'required') {
    optional.delete(talentName);
    required.add(talentName);
  } else {
    required.delete(talentName);
    optional.add(talentName);
  }
  currentEditingPreset.requiredTalents = Array.from(required);
  currentEditingPreset.optionalTalents = Array.from(optional);
  renderPresetTalentSelectors(currentEditingPreset);
}

function removeTalentFromPreset(talentName) {
  if (!currentEditingPreset) return;
  const required = new Set(currentEditingPreset.requiredTalents || []);
  const optional = new Set(currentEditingPreset.optionalTalents || []);
  required.delete(talentName);
  optional.delete(talentName);
  currentEditingPreset.requiredTalents = Array.from(required);
  currentEditingPreset.optionalTalents = Array.from(optional);
  renderPresetTalentSelectors(currentEditingPreset);
}

function renderPresetTalentSelectors(preset) {
  const availableList = document.getElementById('available-talents-list');
  const selectedList = document.getElementById('selected-talents-list');
  if (!availableList || !selectedList) return;
  availableList.innerHTML = '';
  selectedList.innerHTML = '';
  if (!preset) return;

  const requiredIds = new Set(preset.requiredTalents || []);
  const optionalIds = new Set(preset.optionalTalents || []);
  const allSelectedIds = new Set([...requiredIds, ...optionalIds]);
  const presetSeries = (preset.series || '').trim();

  editorData.talents.forEach(talent => {
    if (!allSelectedIds.has(talent.name)) {
      const talentEl = document.createElement('div');
      const seriesString = String(talent.series || '').trim();
      const seriesInfo = seriesString ? `[${seriesString}] ` : '';
      talentEl.textContent = `${seriesInfo}${talent.name} (${talent.cost || 0}点)`;
      talentEl.classList.add('editor-item');
      talentEl.style.cursor = 'pointer';
      talentEl.style.padding = '8px';
      talentEl.dataset.talentName = talent.name;
      const talentSeries = (talent.series || '').trim();
      if (talentSeries && talentSeries !== presetSeries) {
        talentEl.classList.add('disabled');
        talentEl.title = `这是【${talentSeries}】系列的专属天赋，无法选择。`;
      }
      availableList.appendChild(talentEl);
    }
  });

  const renderSelected = talentName => {
    const talent = editorData.talents.find(t => t.name === talentName);
    if (!talent) return;
    const isRequired = requiredIds.has(talent.name);
    const talentEl = document.createElement('div');
    talentEl.classList.add('selected-talent-item');
    talentEl.dataset.talentName = talent.name;
    const seriesString = String(talent.series || '').trim();
    const seriesInfo = seriesString ? `[${seriesString}] ` : '';
    const actionsHtml = isRequired
      ? `
              <span class="tag required-tag">必选</span>
              <button class="preset-talent-action-btn" data-action="setOptional">设为可选</button>
              <button class="preset-talent-action-btn" data-action="remove">移除</button>
            `
      : `
              <span class="tag optional-tag">可选</span>
              <button class="preset-talent-action-btn" data-action="setRequired">设为必选</button>
              <button class="preset-talent-action-btn" data-action="remove">移除</button>
            `;
    talentEl.innerHTML = `
            <span class="selected-talent-name">${seriesInfo}${talent.name} (${talent.cost || 0}点)</span>
            <div class="talent-preset-actions">${actionsHtml}</div>`;
    selectedList.appendChild(talentEl);
  };
  (preset.requiredTalents || []).sort().forEach(renderSelected);
  (preset.optionalTalents || []).sort().forEach(renderSelected);
}

function switchPresetTab(tabName) {
  document.querySelectorAll('.preset-tab-btn').forEach(btn => btn.classList.remove('active'));
  document.querySelectorAll('.preset-tab-content').forEach(content => content.classList.remove('active'));
  const clickedBtn = document.querySelector(`.preset-tab-btn[data-tab="${tabName}"]`);
  if (clickedBtn) clickedBtn.classList.add('active');
  const targetContentId = tabName === 'talents' ? 'talents-tab-content' : tabName + '-tab';
  const targetContent = document.getElementById(targetContentId);
  if (targetContent) targetContent.classList.add('active');
}

function renderPresetSeriesContent(preset) {
  const seriesContainer = document.getElementById('preset-series-content');
  if (!seriesContainer) return;
  const seriesName = (preset.series || '').trim();
  const presetAuthor = (preset.author || '').trim();

  if (!seriesName) {
    seriesContainer.innerHTML =
      '<p style="color: #888; text-align: center;">此预设未指定系列。请在基本信息中设置系列以查看关联内容。</p>';
    return;
  }

  const seriesData = SeriesManager.getSeriesData(seriesName);
  const seriesWorldbooks = editorData.worldbookEntries.filter(entry => {
    const titleInfo = WorldBookManager.parseCommentTitle(entry.name);
    return titleInfo.type === '世界书' && titleInfo.series === seriesName && titleInfo.author === presetAuthor;
  });

  let content = '';
  if (seriesData.talents.length > 0 || seriesData.backgrounds.length > 0 || seriesWorldbooks.length > 0) {
    content += `<div class="series-section"><h4>【${seriesName}】系列内容</h4>`;

    if (seriesData.talents.length > 0) {
      content += `<div class="series-talents"><h5>系列天赋 (${seriesData.talents.length}个)</h5><div class="series-items">${seriesData.talents.map(talent => `<div class="series-item ${preset.requiredTalents?.includes(talent.name) ? 'required' : preset.optionalTalents?.includes(talent.name) ? 'optional' : ''}"><span class="item-name">${talent.name}</span><span class="item-cost">${talent.cost}点</span><span class="item-author">${talent.author}</span>${preset.requiredTalents?.includes(talent.name) ? '<span class="tag required-tag">必选</span>' : ''}${preset.optionalTalents?.includes(talent.name) ? '<span class="tag optional-tag">可选</span>' : ''}<div class="item-description-details">${talent.description || '暂无描述'}</div></div>`).join('')}</div></div>`;
    }

    if (seriesData.backgrounds.length > 0) {
      content += `<div class="series-backgrounds"><h5>系列背景 (${seriesData.backgrounds.length}个)</h5><div class="series-items">${seriesData.backgrounds.map(bg => `<div class="series-item"><span class="item-name">${bg.name}</span><span class="item-author">${bg.author}</span><div class="item-description-details">${bg.description || '暂无描述'}</div></div>`).join('')}</div></div>`;
    }

    if (seriesWorldbooks.length > 0) {
      content += `<div class="series-extensions"><h5>系列扩展 (${seriesWorldbooks.length}个)</h5><div class="series-items">${seriesWorldbooks
        .map(
          (wb) => {
            const titleInfo = WorldBookManager.parseCommentTitle(wb.name);
            return `<div class="series-item"><span class="item-name">${titleInfo.name}</span><span class="item-author">${titleInfo.author}</span><div class="item-description-details">${wb.content || '暂无描述'}</div></div>`;
          },
        )
        .join('')}</div></div>`;
    }

    content += `</div>`;
  }

  if (!content) {
    content = `<p style="color: #888; text-align: center;">未找到与【${seriesName}】系列关联的天赋、背景或扩展。</p>`;
  }
  seriesContainer.innerHTML = content;
}

async function saveCurrentPreset() {
  if (!currentEditingPreset) return Promise.reject(new Error('No preset selected'));
  const oldName = currentEditingPreset.name;
  const newName = document.getElementById('preset-name').value.trim();
  if (!newName) return Promise.reject(new Error('预设名称不能为空。'));
  if (oldName !== newName && editorData.presets.some(p => p.name === newName)) {
    return Promise.reject(new Error(`名称为 "${newName}" 的预设已存在。`));
  }
  currentEditingPreset.name = newName;
  currentEditingPreset.author = document.getElementById('preset-author').value.trim();
  currentEditingPreset.series = document.getElementById('preset-series').value.trim();
  currentEditingPreset.points = parseInt(document.getElementById('preset-points').value) || 40;
  currentEditingPreset.enabled = document.getElementById('preset-worldbook-enabled-switch').checked;
  await WorldBookManager.savePreset(currentEditingPreset);
  const worldBookData = await WorldBookManager.loadAllData();
  Object.assign(editorData, {
    talents: worldBookData.talents || [],
    backgrounds: worldBookData.backgrounds || [],
    presets: worldBookData.presets || [],
    worldbookEntries: worldBookData.worldbookEntries || [],
  });
  const newlySavedPreset = editorData.presets.find(p => p.name === currentEditingPreset.name);
  if (newlySavedPreset) {
    currentEditingPreset.uid = newlySavedPreset.uid;
    currentEditingPreset.originalComment = newlySavedPreset.originalComment;
  }
  renderPresetEditor();
}

async function duplicateCurrentPreset() {
  if (!currentEditingPreset) return;
  const newName = await guiXuPrompt('输入新预设的名称:', currentEditingPreset.name + '_副本', '复制预设');
  if (!newName || editorData.presets.some(p => p.name === newName)) {
    if (newName !== null) await guiXuAlert('名称无效或已存在。', '错误');
    return;
  }
  const newPreset = {
    ...JSON.parse(JSON.stringify(currentEditingPreset)),
    name: newName,
    id: newName,
    uid: undefined,
  };
  document.getElementById('loading-overlay').style.display = 'flex';
  try {
    await WorldBookManager.savePreset(newPreset);
    await loadEditorData();
    editPreset(newPreset.name);
    await guiXuAlert('预设复制成功！');
  } catch (error) {
    console.error('复制预设失败:', error);
    await guiXuAlert('复制失败：' + error.message, '错误');
  } finally {
    document.getElementById('loading-overlay').style.display = 'none';
  }
}

async function deleteCurrentPreset() {
  if (!currentEditingPreset) return;
  if (!(await guiXuConfirm(`确定要删除预设 "${currentEditingPreset.name}" 吗？此操作不可撤销。`, '删除确认'))) return;
  document.getElementById('loading-overlay').style.display = 'flex';
  try {
    await WorldBookManager.deleteEntryByUid(currentEditingPreset.uid);
    await loadEditorData();
    currentEditingPreset = null;
    renderPresetDetails(null);
    await guiXuAlert('预设删除成功！');
  } catch (error) {
    console.error('删除预设失败:', error);
    await guiXuAlert('删除失败：' + error.message, '错误');
  } finally {
    document.getElementById('loading-overlay').style.display = 'none';
  }
}

function editPreset(name) {
  const preset = editorData.presets.find(p => p.name === name);
  if (preset) {
    currentEditingPreset = JSON.parse(JSON.stringify(preset));
    renderPresetEditor();
    renderPresetDetails(currentEditingPreset);
    switchPresetTab('attributes');
  }
}

async function promptPresetSelectionForWB() {
  const presetsWithSeries = editorData.presets.filter(p => (p.series || '').trim() && (p.author || '').trim());
  if (presetsWithSeries.length === 0) {
    await guiXuAlert('没有找到任何已设置“系列”和“作者”的预设。请先在预设编辑器中完善预设信息。', '无法创建');
    return;
  }

  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.style.cssText = 'display: flex; z-index: 2001;';
  const presetsHtml = presetsWithSeries
    .map(
      p =>
        `<div class="choice-item" data-preset-name="${p.name}">
                  <div class="choice-item-title">${p.name}</div>
                  <div class="choice-item-desc">系列: ${p.series} | 作者: ${p.author}</div>
               </div>`,
    )
    .join('');

  modal.innerHTML = `
            <div class="modal-content" style="width: 90%; max-width: 500px; height: auto;">
              <h2 class="modal-title">选择一个预设</h2>
              <div class="modal-body" style="padding: 20px; max-height: 60vh; overflow-y: auto;">
                <p>请选择一个预设，新创建的世界书条目将自动关联其“系列”和“作者”。</p>
                <div style="margin-top:20px;">${presetsHtml}</div>
              </div>
              <div class="modal-footer"><button class="editor-btn btn-danger" id="preset-select-cancel-btn">取消</button></div>
            </div>`;
  document.body.appendChild(modal);

  modal.addEventListener('click', e => {
    const choice = e.target.closest('.choice-item');
    if (choice) {
      const presetName = choice.dataset.presetName;
      const selectedPreset = presetsWithSeries.find(p => p.name === presetName);
      if (selectedPreset) {
        showWorldBookModal(null, { series: selectedPreset.series, author: selectedPreset.author });
      }
      modal.remove();
    } else if (e.target.id === 'preset-select-cancel-btn' || e.target === modal) {
      modal.remove();
    }
  });
}

function setupEditorEventListeners() {
  const editorContainer = document.getElementById('editor-container');
  if (!editorContainer) return;

  wbModal.addEventListener('click', e => {
    if (e.target.id === 'wb-modal-save-btn') saveWorldBookData();
    if (e.target.id === 'wb-modal-cancel-btn') hideWorldBookModal();
    if (e.target.id === 'wb-strategy-toggle-btn') {
      const current = e.target.dataset.strategy;
      setStrategyButtonState(current === 'constant' ? 'selective' : 'constant');
    }
  });
  document.getElementById('wb-position-type').addEventListener('change', e => {
    document.getElementById('wb-depth-settings').style.display = e.target.value === 'at_depth' ? 'grid' : 'none';
  });

  // New listeners for search and refresh
  const searchInput = document.getElementById('wb-search-input');
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      renderWorldBookEditor();
    });
  }

  const refreshBtn = document.getElementById('wb-refresh-btn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', async () => {
      await loadEditorData();
      showSaveStatus('数据已刷新', true);
    });
  }

  editorContainer.addEventListener('click', async e => {
    const target = e.target;
    const tabButton = target.closest('.tab-button');
    if (tabButton) {
      document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
      tabButton.classList.add('active');
      document.querySelectorAll('.tab-pane').forEach(pane => (pane.style.display = 'none'));
      document.getElementById(tabButton.dataset.tab + '-tab').style.display = 'block';
      return;
    }

    if (target.id === 'add-new-talent-btn') return showModal('talent');
    if (target.id === 'add-new-background-btn') return showModal('background');
    const editTalentBtn = target.closest('.edit-talent-btn');
    if (editTalentBtn) return showModal('talent', editTalentBtn.dataset.uid);

    const deleteTalentBtn = target.closest('.delete-talent-btn');
    if (deleteTalentBtn) {
      const uid = deleteTalentBtn.dataset.uid;
      const name = deleteTalentBtn.dataset.name;
      if (uid && (await guiXuConfirm(`你确定要删除天赋 "${name}" 吗?`, '删除确认'))) {
        if (await WorldBookManager.deleteEntryByUid(uid)) {
          await guiXuAlert(`天赋 "${name}" 已删除。`);
          await loadEditorData();
        } else {
          await guiXuAlert('删除失败', '错误');
        }
      }
      return;
    }

    const editBgBtn = target.closest('.edit-background-btn');
    if (editBgBtn) return showModal('background', editBgBtn.dataset.uid);

    const deleteBgBtn = target.closest('.delete-background-btn');
    if (deleteBgBtn) {
      const uid = deleteBgBtn.dataset.uid;
      const name = deleteBgBtn.dataset.name;
      if (uid && (await guiXuConfirm(`你确定要删除背景 "${name}" 吗?`, '删除确认'))) {
        if (await WorldBookManager.deleteEntryByUid(uid)) {
          await guiXuAlert(`背景 "${name}" 已删除。`);
          await loadEditorData();
        } else {
          await guiXuAlert('删除失败', '错误');
        }
      }
      return;
    }

    const wbFilterBtn = target.closest('.wb-filter-btn');
    if (wbFilterBtn) {
      document.querySelectorAll('.wb-filter-btn').forEach(btn => btn.classList.remove('active'));
      wbFilterBtn.classList.add('active');
      currentWbFilter = wbFilterBtn.dataset.filter;
      renderWorldBookEditor();
      return;
    }

    if (target.id === 'add-new-worldbook-btn') return showWorldBookModal();
    if (target.id === 'add-preset-worldbook-btn') return promptPresetSelectionForWB();

    const wbItem = target.closest('.editor-item[data-uid]');
    if (wbItem) {
      const uid = wbItem.dataset.uid;
      const entry = editorData.worldbookEntries.find(e => String(e.uid) === String(uid));

      if (!entry) {
        console.error(`[归墟编辑器] 错误：在数据中未找到 UID 为 ${uid} 的世界书条目。可能是数据不同步导致的。`);
        await guiXuAlert('操作失败：找不到对应的世界书条目，数据可能已过期，请尝试点击“刷新数据”按钮。', '错误');
        return;
      }

      if (target.closest('.edit-wb-btn')) return showWorldBookModal(entry);

      if (target.closest('.delete-wb-btn')) {
        if (await guiXuConfirm(`确定要删除世界书条目 "${entry.name}" 吗？`)) {
          await WorldBookManager.deleteEntryByUid(entry.uid);
          await loadEditorData();
        }
        return;
      }

      if (target.closest('.toggle-wb-btn')) {
        await TavernHelper.updateWorldbookWith(WorldBookManager.LOREBOOK_NAME, worldbook => {
          const entryToUpdate = worldbook.find(e => String(e.uid) === String(uid));
          if (entryToUpdate) entryToUpdate.enabled = !entryToUpdate.enabled;
          return worldbook;
        });
        await loadEditorData();
        return;
      }
    }

    const presetItem = target.closest('.preset-list-item');
    if (presetItem) {
      editPreset(presetItem.dataset.presetName);
      if (window.innerWidth <= 768) {
        document.querySelector('.preset-editor-layout').classList.add('mobile-details-view');
      }
      return;
    }

    if (target.id === 'add-new-preset-btn') {
      const newName = await guiXuPrompt('输入新预设的名称:', '', '新预设');
      if (newName && newName.trim() !== '') {
        if (editorData.presets.some(p => p.name === newName.trim())) {
          await guiXuAlert('该名称的预设已存在。', '错误');
          return;
        }
        const newSeries = await guiXuPrompt('输入系列名称 (可留空):', '', '系列');
        const newPreset = {
          id: newName.trim(),
          name: newName.trim(),
          author: '玩家',
          points: 40,
          attributes: {},
          requiredTalents: [],
          optionalTalents: [],
          series: (newSeries || '').trim(),
          description: '',
          enabled: false,
        };
        await WorldBookManager.savePreset(newPreset);
        await loadEditorData();
        editPreset(newPreset.name);
      }
      return;
    }

    if (target.id === 'export-preset-btn') {
      if (!currentEditingPreset) return await guiXuAlert('请先从列表中选择一个预设。');
      exportSeriesPackage(currentEditingPreset);
      return;
    }

    const presetDetailsPanel = target.closest('#preset-details-panel');
    if (presetDetailsPanel) {
      if (target.id === 'preset-back-to-list-btn') {
        document.querySelector('.preset-editor-layout').classList.remove('mobile-details-view');
        currentEditingPreset = null;
        renderPresetEditor();
        return;
      }
      const toggleBtn = target.closest('#toggle-preset-details-btn');
      if (toggleBtn) {
        const collapsibleArea = document.getElementById('preset-details-collapsible-area');
        const isCollapsed = collapsibleArea.style.display === 'none';
        collapsibleArea.style.display = isCollapsed ? 'block' : 'none';
        toggleBtn.classList.toggle('collapsed', !isCollapsed);
        return;
      }
      const presetTabBtn = target.closest('.preset-tab-btn');
      if (presetTabBtn) return switchPresetTab(presetTabBtn.dataset.tab);
      const attrBtn = target.closest('.attribute-card .value-btn');
      if (attrBtn && !attrBtn.disabled) {
        const attrId = attrBtn.dataset.attribute;
        if (!currentEditingPreset) return;
        if (!currentEditingPreset.attributes) currentEditingPreset.attributes = {};
        let currentValue = currentEditingPreset.attributes[attrId] || 0;
        if (attrBtn.classList.contains('increase-btn')) currentValue++;
        else if (attrBtn.classList.contains('decrease-btn') && currentValue > 0) currentValue--;
        currentEditingPreset.attributes[attrId] = currentValue;
        renderPresetAttributes(currentEditingPreset.attributes);
        debouncedSave();
        return;
      }
      const availableTalentItem = target.closest('#available-talents-list .editor-item');
      if (availableTalentItem) {
        if (availableTalentItem.classList.contains('disabled')) return await guiXuAlert(availableTalentItem.title);
        addTalentToPreset(availableTalentItem.dataset.talentName);
        debouncedSave();
        return;
      }
      const talentActionBtn = target.closest('.preset-talent-action-btn');
      if (talentActionBtn) {
        const talentName = talentActionBtn.closest('.selected-talent-item').dataset.talentName;
        const action = talentActionBtn.dataset.action;
        if (action === 'setRequired') setTalentStateInPreset(talentName, 'required');
        else if (action === 'setOptional') setTalentStateInPreset(talentName, 'optional');
        else if (action === 'remove') removeTalentFromPreset(talentName);
        debouncedSave();
        return;
      }
      const seriesItem = target.closest('.series-item');
      if (seriesItem) {
        const details = seriesItem.querySelector('.item-description-details');
        if (details) details.style.display = details.style.display === 'block' ? 'none' : 'block';
        return;
      }
      if (target.id === 'export-current-preset-btn') return exportSeriesPackage(currentEditingPreset);
      if (target.id === 'duplicate-current-preset-btn') return duplicateCurrentPreset();
      if (target.id === 'delete-current-preset-btn') return deleteCurrentPreset();
    }

    if (target.id === 'batch-import-talents-btn' || target.id === 'batch-import-backgrounds-btn') {
      const type = target.id === 'batch-import-talents-btn' ? 'talent' : 'background';
      showBatchImportModal(type);
    }
  });

  editorContainer.addEventListener('change', e => {
    if (e.target.id === 'preset-worldbook-enabled-switch' && currentEditingPreset) {
      currentEditingPreset.enabled = e.target.checked;
      debouncedSave();
    }
  });
  editorContainer.addEventListener('input', e => {
    if (e.target.closest('#preset-name, #preset-author, #preset-series, #preset-points')) {
      debouncedSave();
    }
  });
}
function showBatchImportModal(type) {
  const modal = document.getElementById('batch-import-modal');
  document.getElementById('batch-import-type').value = type;
  document.getElementById('batch-import-title').textContent = `批量导入${type === 'talent' ? '天赋' : '背景'}`;
  document.getElementById('batch-import-content').value = '';
  modal.style.display = 'flex';
}

document.getElementById('batch-import-cancel-btn').addEventListener('click', () => {
  document.getElementById('batch-import-modal').style.display = 'none';
});

document.getElementById('batch-import-save-btn').addEventListener('click', handleBatchImport);

async function handleBatchImport() {
  const type = document.getElementById('batch-import-type').value;
  const content = document.getElementById('batch-import-content').value.trim();
  if (!content) {
    await guiXuAlert('导入内容不能为空。', '警告');
    return;
  }

  let items;
  try {
    // 尝试将整个内容解析为JSON数组
    items = JSON.parse(content);
  } catch (e) {
    // 如果失败，尝试处理多行JSON对象
    const lines = content.split('\n').filter(line => line.trim() !== '');
    const jsonString = `[${lines.join(',')}]`;
    try {
      items = JSON.parse(jsonString);
    } catch (jsonError) {
      await guiXuAlert('解析JSON失败，请检查格式。确保是有效的JSON数组或每行一个JSON对象。', '错误');
      console.error('JSON Parsing Error:', jsonError);
      return;
    }
  }

  if (!Array.isArray(items)) {
    await guiXuAlert('导入数据必须是一个JSON数组。', '错误');
    return;
  }

  let successCount = 0;
  let failCount = 0;
  document.getElementById('loading-overlay').style.display = 'flex';

  for (const item of items) {
    try {
      if (await WorldBookManager.saveTalentOrBackground(item, type)) {
        successCount++;
      } else {
        failCount++;
      }
    } catch (error) {
      failCount++;
      console.error(`导入失败: ${item.name}`, error);
    }
  }

  document.getElementById('loading-overlay').style.display = 'none';
  document.getElementById('batch-import-modal').style.display = 'none';

  await guiXuAlert(`批量导入完成。成功: ${successCount}, 失败: ${failCount}。`);
  await loadEditorData();
}

async function importCustomTextData(text) {
  console.log('JSON parsing failed, attempting custom text import.');
  document.getElementById('loading-overlay').style.display = 'flex';
  const successCount = { talent: 0, background: 0, preset: 0 };
  let errorCount = 0;
  const entries = text.split(/^\s*#\s*comment:/gm).filter(s => s.trim() !== '');
  if (entries.length === 0) {
    document.getElementById('loading-overlay').style.display = 'none';
    throw new Error('未找到 "# comment:" 分隔的有效条目。');
  }
  for (const entryText of entries) {
    try {
      const lines = entryText.trim().split('\n');
      const commentLine = lines.shift().trim();
      const content = lines.join('\n');
      const comment = commentLine.replace(/"/g, '');
      const titleInfo = WorldBookManager.parseCommentTitle(comment);
      const yamlData = YAMLParser.parse(content);
      if (!titleInfo.type || !titleInfo.name) {
        console.warn('Skipping entry with invalid comment:', comment);
        errorCount++;
        continue;
      }
      let dataToSave = {}, saveFunction, typeKey;
      switch (titleInfo.type) {
        case '天赋':
          dataToSave = {
            name: titleInfo.name,
            author: titleInfo.author,
            series: titleInfo.series || yamlData.系列 || '',
            quality: yamlData.品阶 || '',
            cost: parseInt(yamlData['消耗点数']) || 0,
            description: yamlData['描述'] || '',
          };
          saveFunction = data => WorldBookManager.saveTalentOrBackground(data, 'talent');
          typeKey = 'talent';
          break;
        case '背景':
          dataToSave = {
            name: titleInfo.name,
            author: titleInfo.author,
            series: titleInfo.series || yamlData.系列 || '',
            quality: yamlData.品阶 || '',
            description: yamlData['描述'] || '',
            initialResources: yamlData['初始资源'] || [],
          };
          saveFunction = data => WorldBookManager.saveTalentOrBackground(data, 'background');
          typeKey = 'background';
          break;
        case '预设':
          dataToSave = {
            name: titleInfo.name,
            author: titleInfo.author,
            series: titleInfo.series || yamlData.系列 || '',
            points: parseInt(yamlData['点数']) || 40,
            description: yamlData['描述'] || '',
            attributes: yamlData['属性分配'] || {},
            requiredTalents: yamlData['必选天赋'] || [],
            optionalTalents: yamlData['可选天赋'] || [],
          };
          saveFunction = WorldBookManager.savePreset;
          typeKey = 'preset';
          break;
        default:
          console.warn('Unknown entry type:', titleInfo.type);
          errorCount++;
          continue;
      }
      if (await saveFunction(dataToSave, dataToSave.name)) successCount[typeKey]++;
      else errorCount++;
    } catch (e) {
      console.error('Error parsing custom text entry:', e, entryText);
      errorCount++;
    }
  }
  await loadEditorData();
  document.getElementById('loading-overlay').style.display = 'none';
  await guiXuAlert(
    `自定义文本导入完成。

成功导入:
- 天赋: ${successCount.talent}个
- 背景: ${successCount.background}个
- 预设: ${successCount.preset}个

失败: ${errorCount}个
(详情请查看控制台)`,
  );
}

async function exportSeriesPackage(preset) {
  if (!preset) return await guiXuAlert('没有选择任何预设。');
  const author = (preset.author || '').trim();
  const series = (preset.series || '').trim();
  if (!author || !series) return await guiXuAlert('无法导出系列包：预设的“作者”和“系列”字段必须都填写完整。');

  document.getElementById('loading-overlay').style.display = 'flex';
  try {
    const allEntries = await TavernHelper.getWorldbook(WorldBookManager.LOREBOOK_NAME);
    const authorTag = `【${author}】`;
    const seriesTag = `【${series}】`;
    const seriesEntries = allEntries.filter(
      entry => entry.name.includes(authorTag) && entry.name.includes(seriesTag),
    );

    if (seriesEntries.length === 0) {
      await guiXuAlert(`未找到任何同时包含“${authorTag}”和“${seriesTag}”的世界书条目，无法导出系列包。`);
      return;
    }
    const seriesPackage = {
      type: 'GuixuSeriesPackage',
      version: '2.5',
      author,
      series,
      exportTime: new Date().toISOString(),
      entries: seriesEntries,
    };
    exportData(JSON.stringify(seriesPackage, null, 2), `归墟系列包_${author}_${series}.json`);
    await guiXuAlert(`系列包 “${series}” (作者: ${author}) 导出成功，共包含 ${seriesEntries.length} 个条目！`);
  } catch (error) {
    console.error('导出系列包失败:', error);
    await guiXuAlert('导出系列包失败：' + error.message, '错误');
  } finally {
    document.getElementById('loading-overlay').style.display = 'none';
  }
}

async function importSeriesPackage(packageData) {
  if (!packageData || packageData.type !== 'GuixuSeriesPackage') throw new Error('文件不是有效的归墟系列包格式。');
  const entryCount = packageData.entries?.length || 0;
  if (entryCount === 0) return await guiXuAlert('此系列包不包含任何条目，无需导入。');
  if (
    !(await guiXuConfirm(
      `即将导入系列包 “${packageData.series}” (作者: ${packageData.author})，共 ${entryCount} 个条目。这将覆盖世界书中同名的条目。是否继续？`,
    ))
  )
    return;

  document.getElementById('loading-overlay').style.display = 'flex';
  try {
    const bookName = WorldBookManager.LOREBOOK_NAME;
    let createdCount = 0;
    let updatedCount = 0;

    await TavernHelper.updateWorldbookWith(bookName, worldbook => {
      const existingComments = new Map(worldbook.map(e => [e.name, e]));
      for (const entry of packageData.entries) {
        const { uid, ...newEntryData } = entry;
        if (existingComments.has(entry.name)) {
          const existing = existingComments.get(entry.name);
          Object.assign(existing, newEntryData);
          updatedCount++;
        } else {
          worldbook.push(newEntryData);
          createdCount++;
        }
      }
      return worldbook;
    });

    await loadEditorData();
    await guiXuAlert(
      `系列包 “${packageData.series}” 导入成功！
创建了 ${createdCount} 个新条目，更新了 ${updatedCount} 个现有条目。`,
    );
  } catch (error) {
    console.error('导入系列包时出错:', error);
    await guiXuAlert('导入系列包失败：' + error.message, '错误');
  } finally {
    document.getElementById('loading-overlay').style.display = 'none';
  }
}
