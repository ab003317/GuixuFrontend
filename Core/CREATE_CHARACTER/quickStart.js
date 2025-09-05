function getQuickStartTemplates() {
  try {
    const templates = localStorage.getItem(QUICK_START_KEY);
    return templates ? JSON.parse(templates) : {};
  } catch (e) {
    console.error('获取快速开始模板失败:', e);
    return {};
  }
}

function saveQuickStartTemplate(name, prompt) {
  const templates = getQuickStartTemplates();
  templates[name] = prompt;
  localStorage.setItem(QUICK_START_KEY, JSON.stringify(templates));
  guiXuAlert(`模板 "${name}" 已保存！`);
}

function renderQuickStartList() {
  const container = document.getElementById('quick-start-container');
  const templates = getQuickStartTemplates();
  const templateNames = Object.keys(templates);

  let listHtml = '<p style="text-align: center; color: #ccc;">没有已保存的模板。</p>';
  if (templateNames.length > 0) {
    listHtml = templateNames
      .map(
        name => `
          <div class="choice-item" data-template-name="${name}">
            <div class="choice-item-title">${name}</div>
            <div class="item-actions">
              <button class="editor-btn edit-template-btn" data-action="edit">编辑</button>
              <button class="editor-btn btn-danger delete-template-btn" data-action="delete">删除</button>
            </div>
          </div>
        `,
      )
      .join('');
  }

  container.innerHTML = `
        <h2 class="title">快速开始模板</h2>
        <div class="panel-section" style="padding: 15px; margin-bottom: 20px;">
          <button type="button" id="create-new-template-btn" class="action-btn" style="width:100%;">创建新模板</button>
        </div>
        <div class="choice-list">${listHtml}</div>
        <div style="text-align: center; margin-top: 30px;">
            <button type="button" id="back-to-main-from-quick-start-btn" class="generate-btn">返回主页</button>
        </div>
      `;
}

async function startWithQuickStart(templateName) {
  const templates = getQuickStartTemplates();
  const prompt = templates[templateName];
  if (!prompt) {
    guiXuAlert('找不到该模板。');
    return;
  }

  if (!(await guiXuConfirm(`确定要使用模板 "${templateName}" 开始游戏吗？`))) return;

  document.getElementById('loading-overlay').style.display = 'flex';
  try {
    const generateConfig = {
      injects: [
        {
          role: 'user',
          content: prompt,
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
    document.getElementById('loading-overlay').style.display = 'none';
  }
}

function deleteQuickStartTemplate(templateName) {
  const templates = getQuickStartTemplates();
  delete templates[templateName];
  localStorage.setItem(QUICK_START_KEY, JSON.stringify(templates));
  renderQuickStartList();
}


// 获取一个新的游戏状态对象。它会首先尝试从浏览器的临时存储（sessionStorage）中恢复上次未完成的游戏进度。
// 如果找不到或恢复失败，则创建一个全新的、默认的游戏状态。

function getNewGameState() {
  const savedState = sessionStorage.getItem(GAME_STATE_KEY);
  if (savedState) {
    try {
      const parsedState = JSON.parse(savedState);
      // Basic validation to ensure it's a valid game state
      if (parsedState && typeof parsedState === 'object' && parsedState.currentStep) {
        // Re-add getter properties as they are not serialized
        Object.defineProperty(parsedState, 'spentPoints', {
          get: function () {
            let attributeCost = 0;
            for (const key in this.spentAttributePoints) {
              const spent = this.spentAttributePoints[key];
              attributeCost += key === 'qi_yun' ? spent * 10 : spent;
            }
            const talentCost = this.selectedTalents.reduce((sum, talentInstance) => {
              return sum + (talentInstance.cost || 0);
            }, 0);
            return attributeCost + talentCost + this.spentGachaPoints;
          },
          enumerable: true,
          configurable: true,
        });
        Object.defineProperty(parsedState, 'remainingPoints', {
          get: function () {
            return this.totalPoints - this.spentPoints;
          },
          enumerable: true,
          configurable: true,
        });
        Object.defineProperty(parsedState, 'finalAttributes', {
          get: function () {
            const final = {};
            for (const key in baseAttributes) {
              final[key] = (baseAttributes[key] || 0) + (this.spentAttributePoints[key] || 0);
            }
            return final;
          },
          enumerable: true,
          configurable: true,
        });
        return parsedState;
      }
    } catch (error) {
      console.error('Failed to parse saved game state:', error);
      sessionStorage.removeItem(GAME_STATE_KEY);
    }
  }

  return {
    currentStep: 'difficulty',
    talentSelectionMode: 'gacha', // 'gacha' or 'store'
    selectedDifficulty: null,
    selectedRuleDifficulty: null, // 新增：用于存储规则难度
    totalPoints: 0,
    spentAttributePoints: { fa_li: 0, shen_hai: 0, dao_xin: 0, kong_su: 0, qi_yun: 0 },
    selectedTalents: [],
    requiredTalents: [],
    customTalent: '',
    selectedBackground: null,
    customBackground: '',
    bondCharacter: { name: '', setting: '', appearance: '', identity: '', other: '' },
    selectedGender: null,
    startingPresetName: null,
    gachaTalentPool: [], // For storing drawn talents
    pity5: 0,
    pity4: 0,
    is5StarGuaranteed: false,
    spentGachaPoints: 0,
    get spentPoints() {
      let attributeCost = 0;
      for (const key in this.spentAttributePoints) {
        const spent = this.spentAttributePoints[key];
        attributeCost += key === 'qi_yun' ? spent * 10 : spent;
      }
      const talentCost = this.selectedTalents.reduce((sum, talentInstance) => {
        return sum + (talentInstance.cost || 0);
      }, 0);
      return attributeCost + talentCost + this.spentGachaPoints;
    },
    get remainingPoints() {
      return this.totalPoints - this.spentPoints;
    },
    get finalAttributes() {
      const final = {};
      for (const key in baseAttributes) {
        final[key] = (baseAttributes[key] || 0) + (this.spentAttributePoints[key] || 0);
      }
      return final;
    },
  };
}


//------------------------------ 保存游戏状态 --------------------------------

  function saveGameState() {
    try {
      sessionStorage.setItem(GAME_STATE_KEY, JSON.stringify(gameState));
    } catch (error) {
      console.error('Failed to save game state:', error);
    }
  }

//------------------------------ 刷新本地存储 --------------------------------

  async function refreshLocalStorage() {
    try {
      ['guixu_equipped_items', 'guixu_pending_actions'].forEach(key => localStorage.removeItem(key));
      // await guiXuAlert('核心游戏缓存已清除！如果是新开聊天，这将有助于解决变量更新问题。'); // 根据需求，取消弹窗，改为静默处理
    } catch (e) {
      console.error('清除缓存失败:', e);
      await guiXuAlert('清除缓存失败：' + e.message, '错误');
    }
  }

