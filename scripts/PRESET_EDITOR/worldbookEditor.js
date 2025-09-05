

//WorldbookEditor function Start Here -----------------------------------------------------------------------------------------------------------


//显示世界书编辑器模态框
//这两个函数负责控制一个高级编辑模态框的显示和隐藏。
// 这个模态框用于创建新的世界书条目或编辑现有的世界书条目，它包含了大量复杂的配置选项。

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


//设置世界书编辑器中的策略按钮(蓝灯/绿灯)状态------------------------------------------------------------

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



//保存由世界书编辑器中保存的世界书数据-----------------------------------------------------------------------------
//这是一个复杂的函数，它负责收集世界书编辑器中的数据、进行验证、检查重名，并最终通过 WorldBookManager 将数据保存到世界书。

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


//当用户想要创建一个新的世界书条目时，如果系统发现没有明确的上下文（比如不是在编辑某个预设时创建的），-----------------------------------
// 这个函数会弹出一个模态框，让用户从一个预设列表中选择一个。
// 选择的目的是为了自动获取该预设的“系列”和“作者”信息，并用这些信息作为新世界书条目的默认值。

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








