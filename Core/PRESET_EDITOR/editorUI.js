//渲染所有编辑器

function renderAllEditors() {
  renderTalentEditor();
  renderBackgroundEditor();
  renderWorldBookEditor();
  renderPresetEditor();
  renderPresetDetails(currentEditingPreset);
  document.querySelector('.preset-editor-layout').classList.remove('mobile-details-view');
}

//renderXXXXXXEditor function Start Here -----------------------------------------------------------------------------------------------------------

//根据当前的内存数据（editorData.backgrounds），动态生成HTML内容，并在页面上绘制出整个背景列表的UI界面。

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


//根据当前的内存数据（editorData.presets），动态生成HTML内容，并在页面上绘制出整个预设列表的UI界面。

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

//根据当前的内存数据（editorData.talents），动态生成HTML内容，并在页面上绘制出整个天赋列表的UI界面。

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


//根据当前的内存数据（editorData.worldbookEntries），动态生成HTML内容，并在页面上绘制出整个世界书列表的UI界面。 


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

//--------------------------------------------------- END ---------------------------------------------------------------------------------------------


//setupGlobalControls function Start Here -----------------------------------------------------------------------------------------------------------

//为编辑器页面上那些不隶属于任何特定标签页的、全局性的功能按钮绑定点击事件处理函数。这些功能通常包括数据的导入、导出和重置。

function setupGlobalControls() {
  const importFileInput = document.getElementById('import-file-input');
  document.getElementById('import-all-btn').addEventListener('click', () => importFileInput.click());
  document.getElementById('import-preset-btn').addEventListener('click', () => importFileInput.click());
  importFileInput.addEventListener('change', event => {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => handleImportFile(e.target.result);
    reader.readAsText(file);
    importFileInput.value = '';
  });
  document.getElementById('export-all-btn').addEventListener('click', async () => {
    const dataToExport = {
      talents: editorData.talents,
      backgrounds: editorData.backgrounds,
      presets: editorData.presets,
    };
    exportData(JSON.stringify(dataToExport, null, 2), 'guixu_full_config_backup.json');
    await guiXuAlert('所有配置导出成功！这是一个简单的本地备份，分享请使用系列包。');
  });
  document.getElementById('reset-editor-btn').addEventListener('click', resetEditorToDefaults);
}



