// --- 主程序入口与游戏流程控制 --- 
// 本文件是整个前端的总入口和流程控制器. 它负责初始化、视图切换、UI渲染以及将所有模块的事件监听器绑定到DOM上.
//
// 功能函数:
// - showView(viewId): 控制显示哪个主视图 (如主页、编辑器、开局设置等).
// - renderUI(): 根据当前游戏状态(gameState)渲染对应的UI界面.
// - bindGameFlowEvents(): 为游戏设置流程中的各种按钮(如"下一步"、"上一步")绑定事件.
// - generateStartup(): 最终生成开局设定的函数.
//
// 加载顺序:
// - 本文件应在所有其他JS文件加载完毕后最后加载,因为它依赖于之前定义的所有函数和对象.

const mainViews = [
  'main-page-content',
  'editor-container',
  'setup-form',
  'startup-choice-container',
  'quick-start-container',
];
async function showView(viewId) {
  mainViews.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
  const targetView = document.getElementById(viewId);
  if (targetView) {
    targetView.style.display = viewId === 'setup-form' || viewId === 'editor-modal' ? 'flex' : 'block';
    if (viewId === 'quick-start-container') {
      targetView.style.width = '100%';
      targetView.style.maxWidth = '800px';
    }
  }
  if (viewId === 'editor-container') await loadEditorData();
  if (window.ensureBackgroundImage) window.ensureBackgroundImage();
}

document.addEventListener('DOMContentLoaded', () => {
  // Main UI Listeners
  document.getElementById('show-editor-btn').addEventListener('click', async () => {
    currentEditingPreset = null;
    await showView('editor-container');
  });
  document.getElementById('quick-start-btn').addEventListener('click', () => {
    renderQuickStartList();
    showView('quick-start-container');
  });

  // --- Quick Start Event Handlers ---
  async function createNewQuickStartTemplateInScope() {
    const name = await guiXuPrompt('请输入新模板的名称：');
    if (!name) return;
    const templates = getQuickStartTemplates();
    if (templates[name]) {
      return guiXuAlert(`模板 "${name}" 已存在。`);
    }
    const result = await guiXuPromptEditable('请输入模板内容：', '', '创建新模板', 'template');
    if (result && result.button === 'save' && result.value) {
      saveQuickStartTemplate(name, result.value);
      renderQuickStartList();
    }
  }

  async function editQuickStartTemplateInScope(oldName) {
    const templates = getQuickStartTemplates();
    const oldPrompt = templates[oldName];
    if (!oldPrompt) return guiXuAlert('找不到要编辑的模板。');

    const newName = await guiXuPrompt('请输入模板的新名称：', oldName);
    if (!newName) return;

    if (newName !== oldName && templates[newName]) {
      return guiXuAlert(`模板 "${newName}" 已存在。`);
    }

    const result = await guiXuPromptEditable('请编辑模板内容：', oldPrompt, '编辑模板', 'template');
    if (result && result.button === 'save' && result.value) {
      delete templates[oldName];
      templates[newName] = result.value;
      localStorage.setItem(QUICK_START_KEY, JSON.stringify(templates));
      guiXuAlert(`模板 "${newName}" 已更新！`);
      renderQuickStartList();
    }
  }

  document.getElementById('quick-start-container').addEventListener('click', async e => {
    const target = e.target;
    if (target.id === 'back-to-main-from-quick-start-btn') {
      return showView('main-page-content');
    }
    if (target.id === 'create-new-template-btn') {
      return createNewQuickStartTemplateInScope();
    }

    const templateItem = target.closest('.choice-item');
    if (!templateItem) return;

    const templateName = templateItem.dataset.templateName;
    const actionBtn = target.closest('[data-action]');

    if (actionBtn) {
      const action = actionBtn.dataset.action;
      if (action === 'delete') {
        if (await guiXuConfirm(`确定要删除模板 "${templateName}" 吗？`)) {
          deleteQuickStartTemplate(templateName);
        }
      } else if (action === 'edit') {
        await editQuickStartTemplateInScope(templateName);
      }
    } else {
      // If the item itself is clicked (but not a button), start the game
      await startWithQuickStart(templateName);
    }
  });
  document.getElementById('back-to-main-btn').addEventListener('click', () => showView('main-page-content'));
  document.getElementById('modal-save-btn').addEventListener('click', saveModalData);
  document.getElementById('modal-cancel-btn').addEventListener('click', hideModal);

  // Setup modules
  setupEditorEventListeners();
  setupGlobalControls();
  bindGameFlowEvents();
  setupSaveManagerEventListeners();
  setupSnapshotManagerEventListeners();
  setupUnifiedIndexControls();

  // === Settings Modal Listeners ===
  const settingsModal = document.getElementById('settings-modal');
  const floatingSettingsBtn = document.getElementById('floating-settings-btn');
  const closeModalSettingsBtn = document.getElementById('modal-close-settings-btn');
  if (floatingSettingsBtn)
    floatingSettingsBtn.addEventListener('click', () => {
      updateSettingsUI();
      settingsModal.style.display = 'flex';
    });
  if (closeModalSettingsBtn)
    closeModalSettingsBtn.addEventListener('click', () => (settingsModal.style.display = 'none'));
  if (settingsModal)
    settingsModal.addEventListener('click', e => {
      if (e.target === settingsModal) settingsModal.style.display = 'none';
    });

  // Initialize Background
  loadBackgroundSettings();
  applyBackgroundSettings();
  renderSettingsModal();
  window.ensureBackgroundImage = applyBackgroundSettings;
  window.addEventListener('focus', applyBackgroundSettings);

  document.getElementById('start-game-btn').addEventListener('click', async () => {
    await refreshLocalStorage();
    await loadEditorData();
    renderStartupChoice();
    await showView('startup-choice-container');
  });

  function renderUI() {
    const setupForm = document.getElementById('setup-form');
    if (!setupForm) return;
    let html = '';
    switch (gameState.currentStep) {
      case 'difficulty':
        html = renderDifficultySelection();
        break;
      case 'attributes':
        html = renderAttributeAllocation();
        break;
      case 'talents':
        html = renderTalentSelection();
        break;
      case 'background':
        html = renderBackgroundSelection();
        break;
      case 'bondCharacter':
        html = renderBondCharacterSelection();
        break;
      case 'gender':
        html = renderGenderSelection();
        break;
      case 'ruleDifficulty':
        html = renderRuleDifficultySelection();
        break; // 新增
    }
    setupForm.innerHTML = html;

    if (gameState.currentStep === 'talents') {
      // Re-render gacha results if they exist
      if (gameState.gachaTalentPool.length > 0) {
        renderGachaResults();
      }

      const showPoolBtn = document.getElementById('show-talent-pool-btn');
      if (showPoolBtn) {
        showPoolBtn.addEventListener('click', showTalentPoolPreview);
      }
      updateGachaStatusUI(); // Initial UI update
      renderSelectedTalents();
    }
    saveGameState();
  }

  function handleTalentPull(count) {
    const cost = count === 1 ? talentGachaConfig.pullOneCost : talentGachaConfig.pullTenCost;
    if (gameState.remainingPoints < cost) {
      guiXuAlert('剩余点数不足！');
      return;
    }
    gameState.spentGachaPoints += cost;

    const results = [];
    let has4StarOrAboveInBatch = false;
    for (let i = 0; i < count; i++) {
      const result = performTalentPull();
      results.push(result);
      const qualityKeyMap = {
        神品: 'shen',
        仙品: 'xian',
        天品: 'tian',
        极品: 'ji',
        上品: 'shang',
        中品: 'zhong',
        下品: 'xia',
        凡品: 'fan',
      };
      const qualityKey = qualityKeyMap[result.quality];
      if (talentGachaConfig.qualities[qualityKey].star >= 4) {
        has4StarOrAboveInBatch = true;
      }
    }

    if (count === 10 && !has4StarOrAboveInBatch) {
      const randomIndex = Math.floor(Math.random() * 10);
      results[randomIndex] = get4StarTalent();
    }

    displayTalentGachaResults(results);
    renderGachaResults();
    updatePointsTracker();
    updateGachaStatusUI();
  }

  function updatePointsTracker() {
    const tracker = document.getElementById('points-tracker');
    if (tracker) {
      tracker.textContent = `剩余点数: ${gameState.remainingPoints}`;
    }
  }

  function showTalentPoolPreview() {
    const modal = document.getElementById('talent-pool-modal');
    const body = document.getElementById('talent-pool-modal-body');
    const closeBtn = document.getElementById('close-talent-pool-modal-btn');
    if (!modal || !body || !closeBtn) return;

    const qualityOrder = ['神品', '仙品', '天品', '极品', '上品', '中品', '下品', '凡品'];
    const talentsByQuality = qualityOrder.reduce((acc, q) => ({ ...acc, [q]: [] }), {});

    editorData.talents.forEach(talent => {
      if (talentsByQuality[talent.quality]) {
        talentsByQuality[talent.quality].push(talent);
      }
    });

    body.innerHTML = qualityOrder
      .map(quality => {
        const talents = talentsByQuality[quality];
        if (talents.length === 0) return '';

        const qualityKeyMap = {
          神品: 'shen',
          仙品: 'xian',
          天品: 'tian',
          极品: 'ji',
          上品: 'shang',
          中品: 'zhong',
          下品: 'xia',
          凡品: 'fan',
        };
        const qualityClass = qualityKeyMap[quality] || 'fan';

        return `
                <div class="visual-pool-category">
                    <h3 class="quality-${qualityClass}" style="color: inherit; border-bottom: 1px solid var(--color-border); padding-bottom: 10px;">${quality}</h3>
                    ${talents.map(t => `<div class="visual-pool-item"><strong>${t.name}</strong><p>${t.description}</p></div>`).join('')}
                </div>
            `;
      })
      .join('');

    modal.style.display = 'flex';
    closeBtn.onclick = () => (modal.style.display = 'none');
    modal.onclick = e => {
      if (e.target === modal) modal.style.display = 'none';
    };
  }

  function updateGachaStatusUI() {
    const pity5Counter = document.getElementById('pity-5-counter');
    const pity4Counter = document.getElementById('pity-4-counter');
    const guaranteeStatus = document.getElementById('guarantee-status');

    if (pity5Counter) pity5Counter.textContent = gameState.pity5;
    if (pity4Counter) pity4Counter.textContent = gameState.pity4;
    if (guaranteeStatus) {
      guaranteeStatus.textContent = gameState.is5StarGuaranteed ? '开启' : '关闭';
      guaranteeStatus.style.color = gameState.is5StarGuaranteed ? '#ff6b6b' : 'inherit';
      guaranteeStatus.style.textShadow = gameState.is5StarGuaranteed ? '0 0 5px #ff6b6b' : 'none';
    }
  }

  function renderDifficultySelection() {
    return `<div class="form-section"><label>第一步：选择难度</label><div class="difficulty-selection">${Object.entries(
      GAME_DATA.difficulties,
    )
      .map(
        ([id, diff]) =>
          `<div class="difficulty-card ${gameState.selectedDifficulty === id ? 'selected' : ''}" data-difficulty-id="${id}"><div class="difficulty-header"><span class="difficulty-name">${diff.name}</span><span class="points-value">${diff.points}点</span></div></div>`,
      )
      .join('')}</div></div>`;
  }

  function renderAttributeAllocation() {
    return `<div id="points-tracker">剩余点数: ${gameState.remainingPoints}</div><div class="form-section"><label>第二步：分配属性</label><div class="attributes-grid">${Object.entries(
      GAME_DATA.attributes,
    )
      .map(([id, attr]) => {
        const finalValue = gameState.finalAttributes[id];
        const spentValue = gameState.spentAttributePoints[id];
        return `<div class="attribute-card"><div class="attribute-tooltip">${attr.description}</div><div class="attribute-header"><span class="attribute-name">${attr.name}</span><div class="attribute-value"><button type="button" class="value-btn decrease-btn" data-attribute="${id}" ${spentValue <= 0 ? 'disabled' : ''}>-</button><input type="number" class="value-input" value="${finalValue}" data-attribute-id="${id}"><button type="button" class="value-btn increase-btn" data-attribute="${id}" ${(id === 'qi_yun' ? gameState.remainingPoints < 10 : gameState.remainingPoints <= 0) ? 'disabled' : ''}>+</button></div></div></div>`;
      })
      .join(
        '',
      )}</div></div><button type="button" id="prev-step-btn" class="generate-btn">返回</button><button type="button" id="next-step-btn" class="generate-btn">下一步：选择天赋</button>`;
  }

  function renderTalentSelection() {
    const isGachaMode = gameState.talentSelectionMode === 'gacha';

    const gachaUI = `
          <div class="gacha-controls">
              <button type="button" id="pull-one-talent-btn" class="interaction-btn">寻访一次 (消耗10点)</button>
              <button type="button" id="pull-ten-talents-btn" class="interaction-btn">寻访十次 (消耗100点)</button>
              <button type="button" id="show-talent-pool-btn" class="interaction-btn">卡池预览</button>
          </div>
          <div class="gacha-results" id="talent-gacha-results"></div>
          <div class="gacha-status" style="background: rgba(0,0,0,0.3); padding: 15px; border-radius: 6px; color: var(--color-text-light); display: flex; justify-content: center; gap: 20px; flex-wrap: wrap; margin-top: 15px;">
              <p>距离5星保底: <span id="pity-5-counter">0</span> / 90</p>
              <p>距离4星保底: <span id="pity-4-counter">0</span> / 10</p>
              <p>大保底状态: <span id="guarantee-status">关闭</span></p>
          </div>
      `;

    const storeUI = `
          <div id="talent-store-container" class="talent-selection-grid">
              ${renderTalentStore()}
          </div>
      `;

    return `
          <div id="points-tracker">剩余点数: ${gameState.remainingPoints}</div>
          <div class="form-section">
              <label>第三步：选择天赋</label>
              <div class="tab-controls">
                  <button type="button" id="talent-mode-gacha" class="tab-btn ${isGachaMode ? 'active' : ''}">天赋寻访</button>
                  <button type="button" id="talent-mode-store" class="tab-btn ${!isGachaMode ? 'active' : ''}">天赋商店</button>
              </div>

              <div id="talent-selection-content">
                  ${isGachaMode ? gachaUI : storeUI}
              </div>
              
              <div id="selected-talents-display" class="talent-selection-box" style="margin-top: 20px;">
                  <h4>已选天赋</h4>
                  <div id="selected-talents-list-container"></div>
              </div>
          </div>
          <div class="form-section">
              <label for="custom-talent">自定义天赋 (不消耗点数)</label>
              <textarea id="custom-talent" class="custom-talent-input" rows="2" placeholder="输入你的自定义天赋...">${gameState.customTalent}</textarea>
          </div>
          <button type="button" id="prev-step-btn" class="generate-btn">返回</button>
          <button type="button" id="next-step-btn" class="generate-btn">下一步：选择出身</button>
      `;
  }

  function renderTalentStore() {
    const qualityOrder = ['神品', '仙品', '天品', '极品', '上品', '中品', '下品', '凡品'];
    const talentsByQuality = qualityOrder.reduce((acc, q) => ({ ...acc, [q]: [] }), {});

    editorData.talents.forEach(talent => {
      if (talentsByQuality[talent.quality]) {
        talentsByQuality[talent.quality].push(talent);
      }
    });

    return qualityOrder
      .map(quality => {
        const talents = talentsByQuality[quality];
        if (talents.length === 0) return '';

        const qualityKeyMap = {
          神品: 'shen',
          仙品: 'xian',
          天品: 'tian',
          极品: 'ji',
          上品: 'shang',
          中品: 'zhong',
          下品: 'xia',
          凡品: 'fan',
        };
        const qualityClass = qualityKeyMap[quality] || 'fan';

        return `
              <div class="talent-store-category">
                  <h4 class="quality-${qualityClass}" style="color: inherit; border-bottom: 1px solid var(--color-border); padding-bottom: 5px; margin-top: 15px;">${quality}</h4>
                  <div class="talent-selection-grid">
                      ${talents
                        .map(talent => {
                          const isSelected = gameState.selectedTalents.some(t => t.id === talent.id);
                          const canAfford = gameState.remainingPoints >= (talent.cost || 0);
                          let cardClass = `talent-card quality-${qualityClass}`;
                          if (isSelected) cardClass += ' selected';
                          if (!isSelected && !canAfford) cardClass += ' disabled';

                          return `
                              <div class="${cardClass}" data-talent-id="${talent.id}">
                                  <div class="talent-header">
                                      <span class="talent-name">${talent.name}</span>
                                      <span class="points-value">${talent.cost || 0}点</span>
                                  </div>
                                  <div class="talent-description">${talent.description}</div>
                              </div>
                          `;
                        })
                        .join('')}
                  </div>
              </div>
          `;
      })
      .join('');
  }
  function renderBackgroundSelection() {
    let availableBackgrounds;
    if (gameState.startingPresetName) {
      const preset = editorData.presets.find(p => p.name === gameState.startingPresetName);
      const presetSeries = preset ? (preset.series || '').trim() : '';
      availableBackgrounds = editorData.backgrounds.filter(bg => {
        const bgSeries = (bg.series || '').trim();
        return bgSeries === '' || bgSeries === presetSeries;
      });
    } else {
      availableBackgrounds = editorData.backgrounds.filter(bg => (bg.series || '').trim() === '');
    }
    return `<div id="points-tracker">剩余点数: ${gameState.remainingPoints}</div><div class="form-section"><label>第四步：选择出生背景</label><div class="background-selection">${availableBackgrounds
      .map(bg => {
        const isSelected = gameState.selectedBackground === bg.id;
        const seriesString = String(bg.series || '').trim();
        const seriesInfo = seriesString ? `[${seriesString}] ` : '';
        const qualityStyle = getTierColorStyle(bg.quality);
        const resourcesHtml =
          bg.initialResources && bg.initialResources.length > 0
            ? `<div class="initial-resources"><strong>初始资源:</strong> ${bg.initialResources.join(', ')}</div>`
            : '';
        return `<div class="background-card ${isSelected ? 'selected' : ''}" data-background-id="${bg.id}"><div class="talent-header"><span class="talent-name">${seriesInfo}${bg.name} (${bg.author})</span><span class="talent-quality" style="${qualityStyle}">${bg.quality || ''}</span></div><p class="talent-description" style="white-space: pre-wrap;">${bg.description}</p>${resourcesHtml}</div>`;
      })
      .join(
        '',
      )}</div></div><div class="form-section"><label for="custom-background">自定义背景 (不消耗点数)</label><textarea id="custom-background" class="custom-talent-input" rows="2" placeholder="输入你的自定义背景...">${gameState.customBackground}</textarea></div><button type="button" id="prev-step-btn" class="generate-btn">返回</button><button type="button" id="next-step-btn" class="generate-btn">下一步：选择性别</button>`;
  }

  function getTierColorStyle(tier) {
    const tierColors = {
      凡品: 'color: #FFFFFF;',
      下品: 'color: #66CDAA;',
      中品: 'color: #FFD700;',
      上品: 'background: linear-gradient(90deg, #DA70D6, #BA55D3, #9932CC, #BA55D3, #DA70D6); -webkit-background-clip: text; color: transparent;',
      极品: 'background: linear-gradient(90deg, #DC143C, #FF4500, #B22222, #FF4500, #DC143C); -webkit-background-clip: text; color: transparent;',
      天品: 'background: linear-gradient(90deg, #C71585, #FF1493, #DB7093, #FF1493, #C71585); -webkit-background-clip: text; color: transparent;',
      仙品: 'background: linear-gradient(90deg, #FF416C, #FF4B2B, #FF6B6B, #FF4B2B, #FF416C); -webkit-background-clip: text; color: transparent;',
      神品: 'background: linear-gradient(90deg, #cccccc, #ffffff, #bbbbbb, #ffffff, #cccccc); -webkit-background-clip: text; color: transparent;',
    };
    return tierColors[tier] || '';
  }

  // --- Talent Gacha Logic ---
  const talentGachaConfig = {
    pullOneCost: 10,
    pullTenCost: 100,
    baseRate5Star: 0.006,
    baseRate4Star: 0.051,
    softPityStart: 74,
    hardPity5Star: 90,
    hardPity4Star: 10,
    softPityIncreaseRate: 0.06,
    qualities: {
      shen: { star: 5, pool: [] },
      xian: { star: 5, pool: [] },
      tian: { star: 4, pool: [] },
      ji: { star: 4, pool: [] },
      shang: { star: 3, pool: [] },
      zhong: { star: 3, pool: [] },
      xia: { star: 3, pool: [] },
      fan: { star: 3, pool: [] },
    },
  };

  function performTalentPull() {
    gameState.pity5++;
    gameState.pity4++;

    // Initialize pools if they are empty
    // --- NEW: Smart Sync Logic ---
    // 计算当前卡池中的天赋总数
    const currentPoolSize = Object.values(talentGachaConfig.qualities).reduce((sum, q) => sum + q.pool.length, 0);

    // 如果卡池为空，或数量与主数据源不匹配，则强制重建
    if (currentPoolSize === 0 || currentPoolSize !== editorData.talents.length) {
      console.log('天赋抽卡池数据过时或为空，正在重建...');
      const qualityKeyMap = {
        神品: 'shen',
        仙品: 'xian',
        天品: 'tian',
        极品: 'ji',
        上品: 'shang',
        中品: 'zhong',
        下品: 'xia',
        凡品: 'fan',
      };

      // 从最新的 editorData.talents 重新填充所有品阶的卡池
      for (const quality in qualityKeyMap) {
        const key = qualityKeyMap[quality];
        talentGachaConfig.qualities[key].pool = editorData.talents.filter(t => t.quality === quality);
      }
    }
    // --- END: Smart Sync Logic ---

    if (gameState.pity5 >= talentGachaConfig.hardPity5Star) return get5StarTalent();
    if (gameState.pity4 >= talentGachaConfig.hardPity4Star) return get4StarTalent();

    const random = Math.random();
    let current5StarRate = talentGachaConfig.baseRate5Star;
    if (gameState.pity5 >= talentGachaConfig.softPityStart) {
      current5StarRate +=
        (gameState.pity5 - talentGachaConfig.softPityStart + 1) * talentGachaConfig.softPityIncreaseRate;
    }
    current5StarRate = Math.min(1, current5StarRate);

    if (random < current5StarRate) return get5StarTalent();
    if (random < current5StarRate + talentGachaConfig.baseRate4Star) return get4StarTalent();

    return get3StarTalent();
  }

  function getRandomTalent(pool) {
    if (!pool || pool.length === 0) {
      return { name: '空空如也', quality: '凡品', description: '无', id: 'empty' };
    }
    return pool[Math.floor(Math.random() * pool.length)];
  }

  function get5StarTalent() {
    gameState.pity5 = 0;
    // 抽中5星不再重置4星保底
    // gameState.pity4 = 0;

    if (gameState.is5StarGuaranteed) {
      gameState.is5StarGuaranteed = false;
      return getRandomTalent(talentGachaConfig.qualities.shen.pool); // 神品
    } else {
      // Intentionally fall through to get a 4-star or 3-star talent, since the 5-star was "off-banner"
    }
  }

  function get4StarTalent() {
    gameState.pity4 = 0;
    // 4-star pity doesn't have a guarantee in this implementation, but can be added if needed.
    if (Math.random() < 0.5) {
      return getRandomTalent(talentGachaConfig.qualities.tian.pool); // 天品
    } else {
      return getRandomTalent(talentGachaConfig.qualities.ji.pool); // 极品
    }
  }

  function get3StarTalent() {
    const rand = Math.random();
    if (rand < 0.2) return getRandomTalent(talentGachaConfig.qualities.shang.pool); // 上品 20%
    if (rand < 0.4) return getRandomTalent(talentGachaConfig.qualities.zhong.pool); // 中品 20%
    if (rand < 0.7) return getRandomTalent(talentGachaConfig.qualities.xia.pool); // 下品 30%
    return getRandomTalent(talentGachaConfig.qualities.fan.pool); // 凡品 30%
  }

  function displayTalentGachaResults(results) {
    const newTalents = results.map((talent, index) => ({
      ...talent,
      instanceId: `${talent.id}-${gameState.gachaTalentPool.length + index}-${Date.now()}`, // Create a unique ID for each instance
    }));
    gameState.gachaTalentPool.push(...newTalents);
    if (gameState.gachaTalentPool.length > 10) {
      gameState.gachaTalentPool = gameState.gachaTalentPool.slice(-10);
    }
  }

  function renderGachaResults() {
    const container = document.getElementById('talent-gacha-results');
    if (!container) return;

    container.innerHTML = gameState.gachaTalentPool
      .map((talentInstance, index) => {
        const qualityKeyMap = {
          神品: 'shen',
          仙品: 'xian',
          天品: 'tian',
          极品: 'ji',
          上品: 'shang',
          中品: 'zhong',
          下品: 'xia',
          凡品: 'fan',
        };
        const qualityClass = qualityKeyMap[talentInstance.quality] || 'fan';
        const isSelected = gameState.selectedTalents.some(t => t.instanceId === talentInstance.instanceId);

        let cardClass = `gacha-item quality-${qualityClass}`;
        if (isSelected) cardClass += ' selected';

        return `
            <div class="${cardClass}" data-talent-id="${talentInstance.id}" data-instance-id="${talentInstance.instanceId}" style="animation-delay: ${index * 0.05}s;">
                <div class="item-name">${talentInstance.name}</div>
                <div class="item-quality">【${talentInstance.quality}】</div>
                <div class="item-description">${talentInstance.description}</div>
            </div>
        `;
      })
      .join('');
  }

  function handleTalentCardClick(event) {
    const card = event.currentTarget;
    const talentId = card.dataset.talentId;
    const instanceId = card.dataset.instanceId;
    const selectedIndex = gameState.selectedTalents.findIndex(t => t.instanceId === instanceId);

    if (selectedIndex > -1) {
      // Deselect talent
      gameState.selectedTalents.splice(selectedIndex, 1);
      card.classList.remove('selected');
    } else {
      // Select talent
      const talentInfo = gameState.gachaTalentPool.find(t => t.instanceId === instanceId);
      if (talentInfo) {
        gameState.selectedTalents.push({
          id: talentId,
          instanceId: instanceId,
          name: talentInfo.name,
          cost: talentInfo.cost || 0,
        });
        card.classList.add('selected');
      }
    }

    // We don't update points tracker here as points are only spent on pulling
    renderSelectedTalents();
    updatePointsTracker();
  }

  function showTalentPoolPreview() {
    const modal = document.getElementById('talent-pool-modal');
    const body = document.getElementById('talent-pool-modal-body');
    const closeBtn = document.getElementById('close-talent-pool-modal-btn');
    if (!modal || !body || !closeBtn) return;

    const qualityOrder = ['神品', '仙品', '天品', '极品', '上品', '中品', '下品', '凡品'];
    const talentsByQuality = qualityOrder.reduce((acc, q) => ({ ...acc, [q]: [] }), {});

    const rates = getCurrentGachaRates();

    editorData.talents.forEach(talent => {
      if (talentsByQuality[talent.quality]) {
        talentsByQuality[talent.quality].push(talent);
      }
    });

    body.innerHTML = qualityOrder
      .map(quality => {
        const talents = talentsByQuality[quality];
        if (talents.length === 0) return '';

        const qualityKeyMap = {
          神品: 'shen',
          仙品: 'xian',
          天品: 'tian',
          极品: 'ji',
          上品: 'shang',
          中品: 'zhong',
          下品: 'xia',
          凡品: 'fan',
        };
        const qualityClass = qualityKeyMap[quality] || 'fan';
        const rate = rates[quality] ? (rates[quality] * 100).toFixed(2) + '%' : 'N/A';

        return `
              <div class="visual-pool-category">
                  <h3 class="quality-${qualityClass}" style="color: inherit;">
                      ${quality}
                      <span class="pool-rarity-rate">${rate}</span>
                  </h3>
                  ${talents.map(t => `<div class="visual-pool-item"><strong>${t.name}</strong><p>${t.description}</p></div>`).join('')}
              </div>
          `;
      })
      .join('');

    modal.style.display = 'flex';
    closeBtn.onclick = () => (modal.style.display = 'none');
    modal.onclick = e => {
      if (e.target === modal) modal.style.display = 'none';
    };
  }
  function getCurrentGachaRates() {
    let current5StarRate = talentGachaConfig.baseRate5Star;
    if (gameState.pity5 >= talentGachaConfig.softPityStart) {
      current5StarRate +=
        (gameState.pity5 - talentGachaConfig.softPityStart + 1) * talentGachaConfig.softPityIncreaseRate;
    }
    current5StarRate = Math.min(1, current5StarRate);

    const base4StarRate = talentGachaConfig.baseRate4Star;
    const remainingRate = 1 - current5StarRate - base4StarRate;

    return {
      神品: current5StarRate * 0.5,
      仙品: current5StarRate * 0.5,
      天品: base4StarRate * 0.5,
      极品: base4StarRate * 0.5,
      上品: remainingRate * 0.2,
      中品: remainingRate * 0.2,
      下品: remainingRate * 0.3,
      凡品: remainingRate * 0.3,
    };
  }
  function showTalentDetailModal(talent) {
    if (!talent) return;

    const modal = document.getElementById('talent-detail-modal');
    const title = document.getElementById('talent-detail-title');
    const body = document.getElementById('talent-detail-body');
    const closeBtn = document.getElementById('close-talent-detail-modal-btn');

    if (!modal || !title || !body || !closeBtn) return;

    title.textContent = talent.name;
    body.innerHTML = `
          <p><strong>品阶:</strong> ${talent.quality || '凡品'}</p>
          <p><strong>消耗点数:</strong> ${talent.cost || 0}</p>
          <p><strong>描述:</strong></p>
          <p style="white-space: pre-wrap;">${talent.description}</p>
      `;

    modal.style.display = 'flex';
    const closeModal = () => (modal.style.display = 'none');
    closeBtn.onclick = closeModal;
    modal.onclick = e => {
      if (e.target === modal) closeModal();
    };
  }
  function renderBondCharacterSelection() {
    return `
        <div class="form-section">
          <label>第五步：设定羁绊人物 (可选)</label>
          <div class="modal-form-grid">
            <div class="modal-form-group">
              <label for="bond-name">人物姓名</label>
              <input type="text" id="bond-name" class="modal-input" value="${gameState.bondCharacter.name}">
            </div>
            <div class="modal-form-group">
              <label for="bond-identity">身份</label>
              <input type="text" id="bond-identity" class="modal-input" value="${gameState.bondCharacter.identity}">
            </div>
          </div>
          <div class="modal-form-group">
            <label for="bond-setting">设定</label>
            <textarea id="bond-setting" class="modal-textarea" rows="3">${gameState.bondCharacter.setting}</textarea>
          </div>
          <div class="modal-form-group">
            <label for="bond-appearance">外貌</label>
            <textarea id="bond-appearance" class="modal-textarea" rows="3">${gameState.bondCharacter.appearance}</textarea>
          </div>
          <div class="modal-form-group">
            <label for="bond-other">其他信息</label>
            <textarea id="bond-other" class="modal-textarea" rows="3">${gameState.bondCharacter.other}</textarea>
          </div>
        </div>
        <button type="button" id="prev-step-btn" class="generate-btn">返回</button>
        <button type="button" id="next-step-btn" class="generate-btn">下一步：选择性别</button>
      `;
  }

  function renderGenderSelection() {
    return `<div class="form-section"><label>第六步：选择性别</label><div class="difficulty-selection">${Object.entries(
      GAME_DATA.genders,
    )
      .map(
        ([id, gender]) =>
          `<div class="gender-card ${gameState.selectedGender === id ? 'selected' : ''}" data-gender-id="${id}"><div class="talent-header"><span class="talent-name">${gender.name}</span></div></div>`,
      )
      .join(
        '',
      )}</div></div><button type="button" id="prev-step-btn" class="generate-btn">返回</button><button type="button" id="next-step-btn" class="generate-btn">下一步：选择游戏难度</button>`;
  }

  function renderRuleDifficultySelection() {
    return `<div class="form-section"><label>最后一步：选择游戏模式</label><div class="difficulty-selection">${Object.values(
      GAME_DIFFICULTY_DEFINITIONS,
    )
      .map(
        diff =>
          `<div class="difficulty-card ${gameState.selectedRuleDifficulty === diff.id ? 'selected' : ''}" data-rule-difficulty-id="${diff.id}"><div class="difficulty-header"><span class="difficulty-name">${diff.name}</span></div><p class="talent-description">${diff.description}</p></div>`,
      )
      .join(
        '',
      )}</div></div><button type="button" id="prev-step-btn" class="generate-btn">返回</button><button type="button" id="generate-startup-btn" class="generate-btn">生成开局</button>`;
  }

  function bindGameFlowEvents() {
    const setupForm = document.getElementById('setup-form');
    if (!setupForm) return;
    setupForm.addEventListener('click', async e => {
      const target = e.target;
      const diffCard = target.closest('.difficulty-card');
      if (diffCard && diffCard.dataset.difficultyId) {
        const id = diffCard.dataset.difficultyId;
        gameState.selectedDifficulty = id;
        gameState.totalPoints = GAME_DATA.difficulties[id].points;
        gameState.currentStep = 'attributes';
        renderUI();
        return;
      }
      const ruleDiffCard = target.closest('.difficulty-card[data-rule-difficulty-id]');
      if (ruleDiffCard) {
        const id = ruleDiffCard.dataset.ruleDifficultyId;
        gameState.selectedRuleDifficulty = gameState.selectedRuleDifficulty === id ? null : id;
        renderUI();
        return;
      }
      const valueBtn = target.closest('.value-btn');
      if (valueBtn && !valueBtn.disabled) {
        const attrId = valueBtn.dataset.attribute;
        const cost = attrId === 'qi_yun' ? 10 : 1;
        if (valueBtn.classList.contains('increase-btn') && gameState.remainingPoints >= cost) {
          gameState.spentAttributePoints[attrId]++;
        } else if (valueBtn.classList.contains('decrease-btn') && gameState.spentAttributePoints[attrId] > 0) {
          gameState.spentAttributePoints[attrId]--;
        }
        renderUI();
        return;
      }
      const bgCard = target.closest('.background-card');
      if (bgCard) {
        const id = bgCard.dataset.backgroundId;
        gameState.selectedBackground = gameState.selectedBackground === id ? null : id;
        renderUI();
        return;
      }
      const genderCard = target.closest('.gender-card[data-gender-id]');
      if (genderCard) {
        const id = genderCard.dataset.genderId;
        gameState.selectedGender = gameState.selectedGender === id ? null : id;
        renderUI();
        return;
      }

      const detailBtn = target.closest('.talent-detail-btn');
      if (detailBtn) {
        const talentId = detailBtn.dataset.talentId;
        const talent = editorData.talents.find(t => t.id === talentId);
        if (talent) {
          showTalentDetailModal(talent);
        }
        return;
      }

      if (target.id === 'talent-mode-gacha') {
        gameState.talentSelectionMode = 'gacha';
        renderUI();
        return;
      }
      if (target.id === 'talent-mode-store') {
        gameState.talentSelectionMode = 'store';
        renderUI();
        return;
      }

      if (target.id === 'pull-one-talent-btn') {
        handleTalentPull(1);
        return;
      }
      if (target.id === 'pull-ten-talents-btn') {
        handleTalentPull(10);
        return;
      }

      const deleteBtn = target.closest('.delete-talent-btn');
      if (deleteBtn) {
        const talentId = deleteBtn.dataset.talentId;
        const talent = gameState.selectedTalents.find(t => t.id === talentId);
        if (talent && (await guiXuConfirm(`确定要删除天赋 "${talent.name}" 吗？此操作无法撤销。`, '删除确认'))) {
          const originalTalent = editorData.talents.find(t => t.id === talentId);
          const cost = originalTalent ? originalTalent.cost || 0 : 0;

          gameState.selectedTalents = gameState.selectedTalents.filter(t => t.id !== talentId);
          gameState.spentTalentPoints -= cost;
          renderUI();
        }
        return;
      }

      const storeCard = target.closest('.talent-card');
      if (storeCard && !storeCard.classList.contains('disabled')) {
        const talentId = storeCard.dataset.talentId;
        const talentInfo = editorData.talents.find(t => t.id === talentId);
        if (!talentInfo) return;

        const selectedIndex = gameState.selectedTalents.findIndex(t => t.id === talentId);

        if (selectedIndex > -1) {
          // Deselect
          gameState.selectedTalents.splice(selectedIndex, 1);
        } else if (gameState.remainingPoints >= (talentInfo.cost || 0)) {
          // Select
          gameState.selectedTalents.push({
            id: talentInfo.id,
            instanceId: `store-${talentInfo.id}`, // Unique ID for store items
            name: talentInfo.name,
            cost: talentInfo.cost || 0,
          });
        }
        // Re-render the talent selection part, which is inside the main UI
        renderUI();
        // Also need to explicitly re-render selected talents as renderUI doesn't always do that
        renderSelectedTalents();
        updatePointsTracker();
        return;
      }

      const gachaCard = target.closest('.gacha-item');
      if (gachaCard) {
        handleTalentCardClick({ currentTarget: gachaCard });
        return;
      }
      if (target.id === 'next-step-btn') {
        if (gameState.currentStep === 'attributes') gameState.currentStep = 'talents';
        else if (gameState.currentStep === 'talents') gameState.currentStep = 'background';
        else if (gameState.currentStep === 'background') gameState.currentStep = 'bondCharacter';
        else if (gameState.currentStep === 'bondCharacter') gameState.currentStep = 'gender';
        else if (gameState.currentStep === 'gender') gameState.currentStep = 'ruleDifficulty'; // 新增
        renderUI();
        return;
      }
      if (target.id === 'prev-step-btn') {
        if (gameState.currentStep === 'attributes') {
          sessionStorage.removeItem(GAME_STATE_KEY);
          gameState = getNewGameState();
          showView('startup-choice-container');
          renderStartupChoice();
        } else if (gameState.currentStep === 'talents') gameState.currentStep = 'attributes';
        else if (gameState.currentStep === 'background') gameState.currentStep = 'talents';
        else if (gameState.currentStep === 'gender') gameState.currentStep = 'bondCharacter';
        else if (gameState.currentStep === 'bondCharacter') gameState.currentStep = 'background';
        else if (gameState.currentStep === 'ruleDifficulty') gameState.currentStep = 'gender'; // 新增
        renderUI();
        return;
      }
      if (target.id === 'generate-startup-btn') {
        generateStartup();
        return;
      }
    });
    setupForm.addEventListener('input', e => {
      if (e.target.id === 'custom-talent') gameState.customTalent = e.target.value;
      else if (e.target.id === 'custom-background') gameState.customBackground = e.target.value;
      else if (e.target.id === 'bond-name') gameState.bondCharacter.name = e.target.value;
      else if (e.target.id === 'bond-setting') gameState.bondCharacter.setting = e.target.value;
      else if (e.target.id === 'bond-appearance') gameState.bondCharacter.appearance = e.target.value;
      else if (e.target.id === 'bond-identity') gameState.bondCharacter.identity = e.target.value;
      else if (e.target.id === 'bond-other') gameState.bondCharacter.other = e.target.value;
      saveGameState();
    });
    setupForm.addEventListener('change', e => {
      const valueInput = e.target.closest('.value-input');
      if (valueInput) {
        const attrId = valueInput.dataset.attributeId;
        const baseValue = baseAttributes[attrId] || 0;
        const newValue = parseInt(valueInput.value, 10);
        if (!isNaN(newValue) && newValue >= baseValue) {
          const spent = newValue - baseValue;
          const costDifference = (spent - (gameState.spentAttributePoints[attrId] || 0)) * (attrId === 'qi_yun' ? 10 : 1);
          if (gameState.remainingPoints >= costDifference) {
            gameState.spentAttributePoints[attrId] = spent;
          } else {
            valueInput.value = gameState.finalAttributes[attrId]; // Revert
          }
        } else {
          valueInput.value = gameState.finalAttributes[attrId]; // Revert
        }
        renderUI();
      }
    });
  }

  function renderStartupChoice() {
    const container = document.getElementById('startup-choice-container');
    const presets = editorData.presets;
    let presetsHtml = '<p style="text-align: center; color: #ccc;">没有可用的开局预设。</p>';
    if (presets && presets.length > 0) {
      presetsHtml = presets
        .map(
          p => `
        <div class="choice-item" data-preset-name="${p.name}">
          <div class="choice-item-title">${p.name}</div>
          <div class="choice-item-desc">作者: ${p.author || '未知'} | 系列: ${p.series || '无'}</div>
        </div>
      `,
        )
        .join('');
    }

    container.innerHTML = `
        <h2 class="title">选择开局方式</h2>
        <div class="panel-section">
            <button type="button" id="start-from-scratch-btn" class="action-btn">从零开始</button>
        </div>
        <div class="panel-section">
            <h3 class="section-title">或从预设开始</h3>
            <div class="choice-list">${presetsHtml}</div>
        </div>
      `;

    document.getElementById('start-from-scratch-btn').addEventListener('click', () => {
      sessionStorage.removeItem(GAME_STATE_KEY);
      gameState = getNewGameState();
      renderUI();
      showView('setup-form');
    });

    container.querySelectorAll('.choice-item[data-preset-name]').forEach(item => {
      item.addEventListener('click', () => {
        const presetName = item.dataset.presetName;
        const preset = editorData.presets.find(p => p.name === presetName);
        if (preset) {
          sessionStorage.removeItem(GAME_STATE_KEY);
          gameState = getNewGameState();
          gameState.startingPresetName = preset.name;
          gameState.totalPoints = preset.points || 40;
          gameState.spentAttributePoints = preset.attributes || { fa_li: 0, shen_hai: 0, dao_xin: 0, kong_su: 0, qi_yun: 0 };
          gameState.selectedTalents = (preset.requiredTalents || []).map(tName => {
            const t = editorData.talents.find(tData => tData.name === tName);
            return { id: t.id, instanceId: `preset-${t.id}`, name: t.name, cost: t.cost || 0 };
          });
          gameState.currentStep = 'background';
          renderUI();
          showView('setup-form');
        }
      });
    });
  }

  async function generateStartup() {
    const loadingOverlay = document.getElementById('loading-overlay');
    loadingOverlay.style.display = 'flex';
    try {
      const { finalAttributes, selectedTalents, customTalent, selectedBackground, customBackground, bondCharacter, selectedGender, selectedRuleDifficulty } = gameState;
      let prompt = '<开局设定>\n';
      prompt += `性别: ${GAME_DATA.genders[selectedGender]?.name || '未选择'}\n`;
      prompt += '属性分配:\n';
      for (const [id, value] of Object.entries(finalAttributes)) {
        prompt += `  - ${GAME_DATA.attributes[id].name}: ${value}\n`;
      }
      prompt += '已选天赋:\n';
      if (selectedTalents.length > 0) {
        selectedTalents.forEach(t => {
          const talentData = editorData.talents.find(td => td.id === t.id);
          if (talentData) {
            prompt += `  - 【${talentData.quality}】${t.name}: ${talentData.description}\n`;
          }
        });
      }
      if (customTalent) {
        prompt += `  - 【自定义】${customTalent}\n`;
      }
      prompt += '出身背景:\n';
      if (selectedBackground) {
        const bgData = editorData.backgrounds.find(bg => bg.id === selectedBackground);
        if (bgData) {
          prompt += `  - 【${bgData.quality}】${bgData.name}: ${bgData.description}`;
          if (bgData.initialResources && bgData.initialResources.length > 0) {
            prompt += ` (初始资源: ${bgData.initialResources.join(', ')})`;
          }
          prompt += '\n';
        }
      }
      if (customBackground) {
        prompt += `  - 【自定义】${customBackground}\n`;
      }
      if (bondCharacter && bondCharacter.name) {
        prompt += '羁绊人物:\n';
        prompt += `  - 姓名: ${bondCharacter.name}\n`;
        prompt += `  - 身份: ${bondCharacter.identity}\n`;
        prompt += `  - 设定: ${bondCharacter.setting}\n`;
        prompt += `  - 外貌: ${bondCharacter.appearance}\n`;
        prompt += `  - 其他: ${bondCharacter.other}\n`;
      }
      prompt += '</开局设定>\n';

      let injects = [];
      if (selectedRuleDifficulty) {
        const ruleDef = GAME_DIFFICULTY_DEFINITIONS[selectedRuleDifficulty];
        if (ruleDef && ruleDef.entriesToEnable.length > 0) {
          const allEntries = await TavernHelper.getWorldbook(LOREBOOK_NAME);
          ruleDef.entriesToEnable.forEach(entryName => {
            const entry = allEntries.find(e => e.name === entryName);
            if (entry) {
              injects.push({
                role: 'system',
                content: entry.content,
                position: 'before_prompt',
                depth: 0,
                should_scan: false,
              });
            }
          });
        }
      }

      injects.push({
        role: 'user',
        content: prompt,
        position: 'before_prompt',
        depth: 0,
        should_scan: true,
      });

      const generateConfig = { injects, should_stream: false };
      const aiResponse = await TavernHelper.generate(generateConfig);
      if (!aiResponse) {
        throw new Error('AI未能生成开局脚本。');
      }

      const messages = await getChatMessages(0);
      if (!messages || messages.length === 0) {
        throw new Error('无法获取到第0层消息，无法写入开局设定。');
      }
      const messageZero = messages[0];
      const updateScriptMatch = aiResponse.match(/<UpdateVariable>([\s\S]+?)<\/UpdateVariable>/i);
      const updateScript = updateScriptMatch ? updateScriptMatch[1].trim() : null;
      let updatedData = {};
      if (updateScript) {
        const eventPayload = { old_variables: messageZero.data || {} };
        await eventEmit('mag_invoke_mvu', updateScript, eventPayload);
        if (eventPayload.new_variables) {
          updatedData = eventPayload.new_variables;
        }
      }
      messageZero.message = aiResponse;
      messageZero.data = updatedData;
      await TavernHelper.setChatMessages([messageZero], { refresh: 'all' });
    } catch (error) {
      await guiXuAlert(`生成开局失败: ${error.message}\n详情请查看控制台。`, '错误');
    } finally {
      loadingOverlay.style.display = 'none';
    }
  }
});
