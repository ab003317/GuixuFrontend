//检查酒馆助手有没有连接

(function () {
  if (
    typeof TavernHelper === 'undefined' ||
    typeof TavernHelper.getWorldbook === 'undefined' || // 检查新API是否存在
    typeof eventEmit === 'undefined' ||
    typeof getChatMessages === 'undefined' ||
    typeof getCurrentMessageId === 'undefined'
  ) {
    console.error('TavernHelper API 或事件系统未找到，或者版本过旧。');
    document.addEventListener('DOMContentLoaded', () => {
      document.body.innerHTML =
        '<h1 style="color: red; text-align: center;">错误：SillyTavern 环境 API 未找到或不兼容。请确保TavernHelper插件已更新。</h1>';
    });
    return;
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
      }

      if (Math.random() < 0.5) {
        return getRandomTalent(talentGachaConfig.qualities.shen.pool); // 神品
      } else {
        gameState.is5StarGuaranteed = true;
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

    function renderSelectedTalents() {
      const container = document.getElementById('selected-talents-list-container');
      if (!container) return;

      container.innerHTML = gameState.selectedTalents
        .map(talentInstance => {
          return `
               <div class="selected-talent-item">
                   <span class="selected-talent-name">${talentInstance.name}</span>
                   <div class="talent-preset-actions">
                       <span class="points-value">${talentInstance.cost}点</span>
                       <button type="button" class="talent-detail-btn" data-talent-id="${talentInstance.id}">详情</button>
                       <button type="button" class="delete-talent-btn" data-talent-id="${talentInstance.id}" style="border-color: #ff6347; color: #ff6347;">删除</button>
                   </div>
               </div>
           `;
        })
        .join('');
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
      });
      setupForm.addEventListener(
        'blur',
        e => {
          if (e.target.classList.contains('value-input')) {
            const attrId = e.target.dataset.attributeId;
            const baseValue = baseAttributes[attrId];
            const newValue = parseInt(e.target.value, 10);
            if (isNaN(newValue) || newValue < baseValue) {
              renderUI();
              return;
            }
            const oldSpent = { ...gameState.spentAttributePoints };
            gameState.spentAttributePoints[attrId] = newValue - baseValue;
            if (gameState.spentPoints > gameState.totalPoints) {
              gameState.spentAttributePoints = oldSpent;
            }
            renderUI();
          }
        },
        true,
      );
      setupForm.addEventListener('keypress', e => {
        if (e.target.classList.contains('value-input') && e.key === 'Enter') e.target.blur();
      });
    }

    async function applyGameDifficultySettings(difficultyId) {
      const difficulty = GAME_DIFFICULTY_DEFINITIONS[difficultyId];
      if (!difficulty) {
        console.error(`未找到难度定义: ${difficultyId}`);
        return;
      }

      const entriesToEnable = new Set(difficulty.entriesToEnable);

      try {
        await WorldBookManager._saveOrUpdateWith(worldbook => {
          let changesMade = false;
          worldbook.forEach(entry => {
            if (DIFFICULTY_LORE_ENTRIES.includes(entry.name)) {
              const shouldBeEnabled = entriesToEnable.has(entry.name);
              if (entry.enabled !== shouldBeEnabled) {
                entry.enabled = shouldBeEnabled;
                changesMade = true;
              }
            }
          });
          if (changesMade) {
            console.log(`[归墟] 游戏难度已设置为 "${difficulty.name}"。`);
          }
          return worldbook;
        });
      } catch (error) {
        console.error(`应用游戏难度 "${difficulty.name}" 时失败:`, error);
        await guiXuAlert(`应用游戏难度设置失败: ${error.message}`, '错误');
      }
    }

    async function generateStartup() {
      if (!gameState.selectedGender) return await guiXuAlert('请选择性别');
      if (!gameState.selectedRuleDifficulty) return await guiXuAlert('请选择游戏模式');

      document.getElementById('loading-overlay').style.display = 'flex';

      try {
        await applyGameDifficultySettings(gameState.selectedRuleDifficulty);
        sessionStorage.removeItem(GAME_STATE_KEY);

        const talentsText = gameState.selectedTalents
          .map(talentInstance => {
            const talent = editorData.talents.find(t => t.id === talentInstance.id);
            return talent ? `              - ${talent.name}: ${talent.description}` : '';
          })
          .filter(Boolean)
          .join('\n');
        const customTalentText = gameState.customTalent ? `              - 自定义: ${gameState.customTalent}` : '';
        const backgroundText = (() => {
          if (gameState.customBackground) return `              - 自定义: ${gameState.customBackground}`;
          const bgInfo = editorData.backgrounds.find(bg => bg.id === gameState.selectedBackground);
          return bgInfo ? `              - ${bgInfo.name}: ${bgInfo.description}` : '';
        })();
        const initialResourcesText = (() => {
          const bgInfo = editorData.backgrounds.find(bg => bg.id === gameState.selectedBackground);
          return bgInfo && bgInfo.initialResources && bgInfo.initialResources.length > 0
            ? bgInfo.initialResources.map(r => `              - ${r}`).join('\n')
            : '              - 无';
        })();
        const genderText = `              - ${GAME_DATA.genders[gameState.selectedGender].name}`;

        let bondCharacterText = '';
        if (Object.values(gameState.bondCharacter).some(field => field.trim() !== '')) {
          bondCharacterText = `
<user>的羁绊人物:
${gameState.bondCharacter.name ? `              - 人物姓名: ${gameState.bondCharacter.name}\n` : ''}
${gameState.bondCharacter.identity ? `              - 身份: ${gameState.bondCharacter.identity}\n` : ''}
${gameState.bondCharacter.setting ? `              - 设定: ${gameState.bondCharacter.setting}\n` : ''}
${gameState.bondCharacter.appearance ? `              - 外貌: ${gameState.bondCharacter.appearance}\n` : ''}
${gameState.bondCharacter.other ? `              - 其他信息: ${gameState.bondCharacter.other}\n` : ''}
`.trim();
        }

        const playerInput = `

以下是<user>的初始属性:
${Object.entries(gameState.finalAttributes)
  .map(([id, value]) => `              - ${GAME_DATA.attributes[id].name}: ${value}`)
  .join('\n')}
<user>的初始天赋/灵根:
${talentsText}
${customTalentText}
<user>的初始出生背景:
${backgroundText}
<user>的初始资源:
${initialResourcesText}
${bondCharacterText}
<user>的性别:
${genderText}`.trim();
        const prompt = `<开局设定>
# 这是角色<user>的开局设定
1.请根据以下设定，进行开局的生成以及变量的初始化设置（注意不需要清空和删掉任何变量，直接设定即可）
2.请忽略所有<status_current_variables>中关于<user>的变量内容，而是根据以下“开局设定”进行全部初始化设定
3.对于开局的故事描写，应该使用沉浸感式进行描述，避免出现天赋名称、点数、背景等字样，这样会大幅度破坏开局的代入感
4.对于所有需要数值的变量，比如功法、武器、灵根、天赋等，必须按照<数值参考>中的数值体系，设定合理的数值，但避免留空，都需要填写数值
5.对于开局点数，这只是<user>开局设定的基础值，你必须要参考<境界数值参考>然后根据<user>的对应开局背景境界来计算符合要求的基础数值，而不是单纯只看开局给的基础值
6.对于天赋，需要根据天赋的描述，参考<品阶参考>、<数值参考>，设定合理的数值和品阶。但注意避免全神品、全仙品，高等级天赋极其稀有，请根据天赋的描述酌情设定品阶
7.对于灵根，应该依据背景，参考<品阶参考>、<数值参考>，设置一个灵根，同时也需要酌情处理品阶问题
8.对于背景，需要合理的引入剧情，如果是穿越者，需要描述清楚详情，如果是原主，则不应该突兀引入天赋等介绍，这应该是与之俱来的，而非突然觉醒
## 开局设定
${playerInput}

</开局设定>`;

        const result = await guiXuPromptEditable('【提示词预览】', prompt, '确认并编辑提示词');

        if (!result || result.button === 'cancel' || !result.value) {
          document.getElementById('loading-overlay').style.display = 'none';
          return;
        }

        if (result.button === 'save') {
          const templateName = await guiXuPrompt('请输入模板名称：');
          if (templateName) {
            saveQuickStartTemplate(templateName, result.value);
          }
          document.getElementById('loading-overlay').style.display = 'none';
          return;
        }

        if (result.button !== 'confirm') {
          document.getElementById('loading-overlay').style.display = 'none';
          return;
        }

        const finalPrompt = result.value;

        const generateConfig = {
          injects: [
            {
              role: 'user',
              content: finalPrompt,
              position: 'before_prompt',
              depth: 0,
              should_scan: true,
            },
          ],
          should_stream: false,
        };
        const aiResponse = await TavernHelper.generate(generateConfig);
        if (!aiResponse) {
          throw new Error('AI未能生成开局脚本。');
        }

        const messages = await getChatMessages(0);
        if (!messages || messages.length === 0) {
          throw new Error('无法获取到第0层消息，无法写入开局设定。');
        }
        const messageZero = messages[0];

        // 提取UpdateVariable脚本
        const updateScriptMatch = aiResponse.match(/<UpdateVariable>([\s\S]+?)<\/UpdateVariable>/i);
        const updateScript = updateScriptMatch ? updateScriptMatch[1].trim() : null;

        let updatedData = {};

        if (updateScript) {
          // 准备调用事件所需的数据
          const eventPayload = { old_variables: messageZero.data || {} };

          // 触发事件，让SillyTavern的MVU引擎处理脚本
          await eventEmit('mag_invoke_mvu', updateScript, eventPayload);

          // 从事件返回的数据中获取新变量
          if (eventPayload.new_variables) {
            updatedData = eventPayload.new_variables;
          }
        }

        messageZero.message = aiResponse; // 存储完整的AI回复
        messageZero.data = updatedData; // 将脚本生成的新变量保存回消息数据

        await TavernHelper.setChatMessages([messageZero], { refresh: 'all' });
      } catch (error) {
        await guiXuAlert(`生成开局失败: ${error.message}\n详情请查看控制台。`, '错误');
      } finally {
        document.getElementById('loading-overlay').style.display = 'none';
      }
    }

    function renderStartupChoice() {
      const container = document.getElementById('startup-choice-container');
      if (!container) return;
      const presetsHtml =
        editorData.presets.length > 0
          ? editorData.presets
              .map(
                p =>
                  `<div class="choice-item" data-preset-name="${p.name}"><div class="choice-item-title">${p.name}</div><div class="choice-item-desc">作者: ${p.author || '未知'} | 点数: ${p.points || 40}</div></div>`,
              )
              .join('')
          : '<p style="color: #ccc; text-align: center;">没有可用的预设。</p>';
      const difficultiesHtml = Object.entries(GAME_DATA.difficulties)
        .map(
          ([id, diff]) =>
            `<div class="choice-item" data-difficulty-id="${id}"><div class="choice-item-title">${diff.name}</div><div class="choice-item-desc">初始点数: ${diff.points}</div></div>`,
        )
        .join('');
      container.innerHTML = `<h1 class="title" style="margin-bottom: 30px;">选择你的开局方式</h1><div class="startup-choice-layout"><div class="choice-column"><h2>选择预设</h2><div class="choice-list">${presetsHtml}</div></div><div class="choice-column"><h2>标准开局</h2><div class="choice-list">${difficultiesHtml}</div></div></div><button type="button" id="back-to-main-from-choice-btn" class="generate-btn" style="margin-top: 30px;">返回主页</button>`;
    }

    document.getElementById('startup-choice-container').addEventListener('click', e => {
      const choiceItem = e.target.closest('.choice-item');
      if (choiceItem) {
        if (choiceItem.dataset.presetName) startWithPreset(choiceItem.dataset.presetName);
        else if (choiceItem.dataset.difficultyId) startWithDifficulty(choiceItem.dataset.difficultyId);
      } else if (e.target.id === 'back-to-main-from-choice-btn') {
        showView('main-page-content');
      }
    });

    async function togglePresetWorldbooks(preset) {
      const series = (preset.series || '').trim();
      const author = (preset.author || '').trim();
      if (!series || !author) {
        console.log(`预设 "${preset.name}" 未设置系列或作者，跳过世界书自动切换。`);
        return;
      }

      const targetPrefix = `【世界书】【${series}】【${author}】`;
      console.log(`正在为预设 "${preset.name}" 切换世界书，目标前缀: ${targetPrefix}`);

      try {
        let changed = false;
        await WorldBookManager._saveOrUpdateWith(worldbook => {
          worldbook.forEach(entry => {
            if (entry.name.startsWith('【世界书】【') && entry.name.includes('】【')) {
              if (entry.name.startsWith(targetPrefix)) {
                if (!entry.enabled) {
                  entry.enabled = true;
                  changed = true;
                }
              } else if (entry.enabled) {
                entry.enabled = false;
                changed = true;
              }
            }
          });
          return worldbook;
        });
        if (changed) {
          console.log('世界书状态已根据预设自动更新。');
          await loadEditorData(); // Refresh data silently
        }
      } catch (error) {
        console.error('自动切换世界书状态时出错:', error);
        await guiXuAlert('自动切换世界书状态失败，详情请查看控制台。', '错误');
      }
    }

    function startWithDifficulty(difficultyId) {
      const difficulty = GAME_DATA.difficulties[difficultyId];
      if (!difficulty) return;
      gameState = getNewGameState();
      gameState.selectedDifficulty = difficultyId;
      gameState.totalPoints = difficulty.points;
      gameState.currentStep = 'attributes';
      showView('setup-form');
      renderUI();
    }

    async function startWithPreset(presetName) {
      const preset = editorData.presets.find(p => p.name === presetName);
      if (!preset) return;
      if (!(await guiXuConfirm(`确定要加载预设 "${presetName}" 吗？\n这将自动启用其关联的系列世界书。`))) return;

      await togglePresetWorldbooks(preset);

      gameState = getNewGameState();
      gameState.totalPoints = preset.points || 40;

      if (preset.attributes) {
        gameState.spentAttributePoints = { ...gameState.spentAttributePoints, ...preset.attributes };
      }

      // --- 核心修复逻辑开始 ---
      // 1. 合并并去重所有预设天赋的名称
      const allPresetTalentNames = [...(preset.requiredTalents || []), ...(preset.optionalTalents || [])];
      const uniqueTalentNames = [...new Set(allPresetTalentNames)];

      // 2. 将天赋名称转换为完整的、包含所有信息的天赋对象
      gameState.selectedTalents = uniqueTalentNames
        .map(talentName => {
          const talentData = editorData.talents.find(t => t.name === talentName);
          if (talentData) {
            // 返回一个符合渲染函数期望的、包含所有信息的对象
            return {
              id: talentData.id,
              instanceId: `preset-${talentData.id}`, // 为预设天赋创建唯一实例ID
              name: talentData.name,
              cost: talentData.cost || 0,
            };
          }
          console.warn(`预设 "${presetName}" 中的天赋 "${talentName}" 未在编辑器数据中找到，已跳过。`);
          return null; // 如果找不到天赋，返回null
        })
        .filter(Boolean); // 过滤掉所有未找到的天赋

      // 3. 存储必选天赋的ID，用于UI显示
      gameState.requiredTalents = [...(preset.requiredTalents || [])];
      // --- 核心修复逻辑结束 ---

      gameState.startingPresetName = preset.name;
      gameState.currentStep = 'attributes';
      showView('setup-form');
      renderUI();
    }
  });
})();

