
//presetEditor function Start Here -----------------------------------------------------------------------------------------------------------

// ------------------------------------Talent PART---------------------------------------
//将一个天赋添加到当前编辑的预设中

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

//设置一个天赋在当前编辑的预设中的状态

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

//从当前编辑的预设中移除一个天赋

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


//------------------------------------------ 切换预设编辑器中的标签页   ------------------------------------------

function switchPresetTab(tabName) {
  document.querySelectorAll('.preset-tab-btn').forEach(btn => btn.classList.remove('active'));
  document.querySelectorAll('.preset-tab-content').forEach(content => content.classList.remove('active'));
  const clickedBtn = document.querySelector(`.preset-tab-btn[data-tab="${tabName}"]`);
  if (clickedBtn) clickedBtn.classList.add('active');
  const targetContentId = tabName === 'talents' ? 'talents-tab-content' : tabName + '-tab';
  const targetContent = document.getElementById(targetContentId);
  if (targetContent) targetContent.classList.add('active');
}



//------------------------------------------ 保存当前预设   ------------------------------------------

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

//------------------------------------------ 复制当前预设   ------------------------------------------

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

//------------------------------------------ 删除当前预设   ------------------------------------------

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


//------------------------------------------ 编辑当前预设   ------------------------------------------

function editPreset(name) {
  const preset = editorData.presets.find(p => p.name === name);
  if (preset) {
    currentEditingPreset = JSON.parse(JSON.stringify(preset));
    renderPresetEditor();
    renderPresetDetails(currentEditingPreset);
    switchPresetTab('attributes');
  }
}


//-------------------------------------- UI PART ---------------------------------------------------



//根据游戏数据（GAME_DATA.attributes）和预设中已分配的属性点（presetAttributes），-------------------------------
// 动态生成一个属性点数分配面板。这个面板允许用户查看和调整每个属性上分配的技能点。

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




// 当用户在列表中选择一个预设后，此函数负责在右侧或下方的详情面板中显示该预设的完整信息，并提供一个可交互的操作界面。-----------
// 这个函数包含了预设的详细信息、属性分配、天赋选择、系列内容等各个方面的渲染逻辑。

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


//当一个预设被选中时，此函数会检查该预设所属的系列，然后自动搜集、-------------------------------------------------------------
//筛选并渲染出该系列下的所有相关资源，包括天赋、背景和世界书扩展。它提供了一个关于某个系列的全景视图。

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
        .map(wb => {
          const titleInfo = WorldBookManager.parseCommentTitle(wb.name);
          return `<div class="series-item"><span class="item-name">${titleInfo.name}</span><span class="item-author">${titleInfo.author}</span><div class="item-description-details">${wb.content || '暂无描述'}</div></div>`;
        })
        .join('')}</div></div>`;
    }

    content += `</div>`;
  }

  if (!content) {
    content = `<p style="color: #888; text-align: center;">未找到与【${seriesName}】系列关联的天赋、背景或扩展。</p>`;
  }
  seriesContainer.innerHTML = content;
}



//根据预设中的天赋数据，动态生成两个列表：一个是可选择的天赋列表，另一个是已选择的天赋列表。--------------------------
// 这个函数允许用户查看和调整预设中包含的天赋，包括设置天赋的必选/可选状态以及从预设中移除天赋。

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
    let actionsHtml = isRequired
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



