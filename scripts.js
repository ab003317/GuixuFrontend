(  function () {
  // --- 全局配置 ---
  const LOREBOOK_NAME = '1归墟';

  // --- 新增：游戏难度规则配置 ---
  const DIFFICULTY_LORE_ENTRIES = [
    '【cot】【简单】必要关键cot（1-5）',
    '【cot】【标配】【困难】必要关键cot（1-6）',
    '【系统】【标配】超级无敌合理性审查',
    '【系统】【标配】合理性审查【修改】',
    '【cot】合理性审查加强',
  ];

  const GAME_DIFFICULTY_DEFINITIONS = {
    easy: {
      id: 'easy',
      name: '简单模式',
      description: '爽文模式。适合想要体验剧情、轻松游玩的玩家，AI会像一个友好的故事引导者来推进剧情。',
      entriesToEnable: ['【cot】【简单】必要关键cot（1-5）'],
    },
    normal: {
      id: 'normal',
      name: '普通模式',
      description: '标准的游戏模式。世界遵循其自身的逻辑，玩家需要谨慎思考。',
      entriesToEnable: ['【cot】【标配】【困难】必要关键cot（1-6）', '【系统】【标配】合理性审查【修改】'],
    },
    hard: {
      id: 'hard',
      name: '困难模式',
      description: '一个残酷、真实、充满恶意的修仙世界。生存本身就是一种挑战，每一次行动都可能带来灾难性的后果。',
      entriesToEnable: [
        '【cot】【标配】【困难】必要关键cot（1-6）',
        '【系统】【标配】合理性审查【修改】',
        '【系统】【标配】超级无敌合理性审查',
        '【cot】合理性审查加强',
      ],
    },
  };

  // --- API 可用性检查 ---
  /* global TavernHelper, eventEmit, getChatMessages, getCurrentMessageId */
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

  // --- YAML解析器 (Stack-based to handle nesting) ---
  const YAMLParser = {
    parse: function (text) {
      if (!text || typeof text !== 'string') return {};
      const lines = text.split('\n');
      const result = {};
      const stack = [{ indent: -1, obj: result, lastKey: null }];

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;

        const indent = line.search(/\S/);

        while (stack.length > 1 && indent <= stack[stack.length - 1].indent) {
          stack.pop();
        }
        const parent = stack[stack.length - 1].obj;
        const lastKeyInParent = stack[stack.length - 1].lastKey;

        if (trimmed.startsWith('- ')) {
          const value = trimmed.substring(2).trim();
          if (lastKeyInParent && Array.isArray(parent[lastKeyInParent])) {
            parent[lastKeyInParent].push(this._parseValue(value));
          }
        } else {
          const colonIndex = trimmed.indexOf(':');
          if (colonIndex > -1) {
            const key = trimmed.substring(0, colonIndex).trim();
            const value = trimmed.substring(colonIndex + 1).trim();

            stack[stack.length - 1].lastKey = key;

            if (value === '|' || value === '>') {
              let multiline = '';
              const blockStartIndex = lines.indexOf(line) + 1;
              for (let i = blockStartIndex; i < lines.length; i++) {
                const nextLine = lines[i];
                const nextIndent = nextLine.search(/\S/);
                if (nextLine.trim() === '' || nextIndent > indent) {
                  multiline += nextLine.substring(indent + 2) + '\n';
                } else {
                  break;
                }
              }
              parent[key] = multiline.trim();
            } else if (value === '') {
              const nextLine = lines[lines.indexOf(line) + 1] || '';
              const nextTrimmed = nextLine.trim();
              const nextIndent = nextLine.search(/\S/);
              if (nextTrimmed.startsWith('- ') && nextIndent > indent) {
                const newArr = [];
                parent[key] = newArr;
              } else if (nextIndent > indent) {
                const newObj = {};
                parent[key] = newObj;
                stack.push({ indent: indent, obj: newObj, lastKey: null });
              } else {
                parent[key] = '';
              }
            } else {
              parent[key] = this._parseValue(value);
            }
          }
        }
      }
      return result;
    },

    stringify: function (data, indent = '') {
      let yaml = '';
      for (const [key, value] of Object.entries(data)) {
        if (Array.isArray(value)) {
          yaml += `${indent}${key}:\n`;
          for (const item of value) {
            yaml += `${indent}  - ${item}\n`;
          }
        } else if (typeof value === 'object' && value !== null) {
          yaml += `${indent}${key}:\n`;
          yaml += this.stringify(value, indent + '  ');
        } else if (typeof value === 'string' && value.includes('\n')) {
          yaml += `${indent}${key}: |\n`;
          const lines = value.split('\n');
          for (const line of lines) {
            yaml += `${indent}  ${line}\n`;
          }
        } else {
          yaml += `${indent}${key}: ${value}\n`;
        }
      }
      return yaml;
    },

    _parseValue: function (val) {
      const numVal = Number(val);
      if (!isNaN(numVal) && val.trim() !== '') {
        return numVal;
      }
      if (val === 'true') return true;
      if (val === 'false') return false;
      return val;
    },
  };

  // --- 世界书数据管理器 (已使用新版API重写) ---
  const WorldBookManager = {
    LOREBOOK_NAME: LOREBOOK_NAME,

    parseCommentTitle(comment) {
      const result = {
        type: '',
        series: '',
        name: '',
        author: '未知',
      };
      // New Regex to capture 【世界书】【系列】【作者】标题
      const matchExtendedWB = comment.match(/^【(世界书)】【([^】]+)】【([^】]+)】(.+)$/);
      const match1 = comment.match(/^【(天赋|背景|预设)】【([^】]+)】([^【]+)【([^】]+)】$/);
      const match2 = comment.match(/^【(天赋|背景|预设|世界书)】([^【]+)【([^】]+)】$/);

      if (matchExtendedWB) {
        result.type = matchExtendedWB[1];
        result.series = matchExtendedWB[2];
        result.author = matchExtendedWB[3];
        result.name = matchExtendedWB[4].trim();
      } else if (match1) {
        result.type = match1[1];
        result.series = match1[2];
        result.name = match1[3].trim();
        result.author = match1[4];
      } else if (match2) {
        result.type = match2[1];
        result.name = match2[2].trim();
        result.author = match2[3];
      } else {
        const oldMatch = comment.match(/^【(天赋|背景|预设|世界书)】(.+)$/);
        if (oldMatch) {
          result.type = oldMatch[1];
          result.name = oldMatch[2].trim();
        }
      }
      return result;
    },

    generateCommentTitle(type, name, author, series = '') {
      const typeMap = { talent: '天赋', background: '背景', preset: '预设', worldbook: '世界书' };
      const typeText = typeMap[type] || type;
      const seriesString = String(series || '').trim();
      if (seriesString) {
        return `【${typeText}】【${seriesString}】${name}【${author}】`;
      } else {
        if (type === 'worldbook') {
          return `【${typeText}】${name}`;
        }
        return `【${typeText}】${name}【${author}】`;
      }
    },

    async loadAllData() {
      try {
        let allEntries;
        try {
          allEntries = await TavernHelper.getWorldbook(this.LOREBOOK_NAME);
        } catch (e) {
          console.warn(`世界书 "${this.LOREBOOK_NAME}" 不存在或加载失败，尝试创建...`, e);
          const created = await TavernHelper.createWorldbook(this.LOREBOOK_NAME);
          if (created) {
            console.log(`世界书 "${this.LOREBOOK_NAME}" 创建成功。`);
            allEntries = [];
          } else {
            throw new Error(`无法创建世界书 "${this.LOREBOOK_NAME}"。`);
          }
        }

        const talents = [];
        const backgrounds = [];
        const presets = [];
        const worldbookEntries = [];

        if (!allEntries || allEntries.length === 0) {
          console.log('世界书为空或不存在。');
          return { talents: [], backgrounds: [], presets: [], worldbookEntries: [], isEmpty: true };
        }

        for (const entry of allEntries) {
          try {
            const titleInfo = this.parseCommentTitle(entry.name);
            const yamlData = YAMLParser.parse(entry.content);

            if (entry.name.startsWith('【天赋】')) {
              const parsedName =
                titleInfo.name ||
                entry.name
                  .replace(/^【天赋】/, '')
                  .split('【')[0]
                  .trim();
              talents.push({
                id: parsedName,
                name: parsedName,
                author: titleInfo.author,
                series: titleInfo.series || yamlData.系列 || '',
                quality: yamlData.品阶 || '凡品', // <--- 修改这里
                cost: parseInt(yamlData.消耗点数) || 0,
                description: yamlData.描述 || '',
                isFromWorldBook: true,
                originalComment: entry.name,
                uid: entry.uid,
              });
              worldbookEntries.push(entry);
            } else if (entry.name.startsWith('【背景】')) {
              const parsedName =
                titleInfo.name ||
                entry.name
                  .replace(/^【背景】/, '')
                  .split('【')[0]
                  .trim();
              backgrounds.push({
                id: parsedName,
                name: parsedName,
                author: titleInfo.author,
                series: titleInfo.series || yamlData.系列 || '',
                quality: yamlData.品阶 || '凡品', // <--- 修改这里
                description: yamlData.描述 || '',
                initialResources: yamlData.初始资源 || [],
                isFromWorldBook: true,
                originalComment: entry.name,
                uid: entry.uid,
              });
              worldbookEntries.push(entry);
            } else if (entry.name.startsWith('【预设】')) {
              const parsedName =
                titleInfo.name ||
                entry.name
                  .replace(/^【预设】/, '')
                  .split('【')[0]
                  .trim();
              presets.push({
                id: parsedName,
                name: parsedName,
                author: titleInfo.author,
                series: titleInfo.series || yamlData.系列 || '',
                points: parseInt(yamlData.点数) || 40,
                description: yamlData.描述 || '',
                attributes: yamlData.属性分配 || {},
                requiredTalents: yamlData.必选天赋 || [],
                optionalTalents: yamlData.可选天赋 || [],
                isFromWorldBook: true,
                originalComment: entry.name,
                uid: entry.uid,
                enabled: entry.enabled,
              });
              worldbookEntries.push(entry);
            } else {
              worldbookEntries.push(entry);
            }
          } catch (e) {
            console.warn('解析世界书条目失败:', entry.name, e);
          }
        }
        return { talents, backgrounds, presets, worldbookEntries, isEmpty: false };
      } catch (error) {
        console.error('从世界书加载数据失败:', error);
        return { talents: [], backgrounds: [], presets: [], worldbookEntries: [], isEmpty: true };
      }
    },

    async _saveOrUpdateWith(updaterFn) {
      try {
        await TavernHelper.updateWorldbookWith(this.LOREBOOK_NAME, updaterFn);
        return true;
      } catch (error) {
        console.error('更新世界书失败:', error);
        return false;
      }
    },

    async saveTalentOrBackground(itemData, type) {
      const entryToSave = { ...itemData };

      entryToSave.name = this.generateCommentTitle(type, itemData.name, itemData.author, itemData.series);

      if (type === 'talent') {
        entryToSave.content = YAMLParser.stringify({
          品阶: itemData.quality || '',
          消耗点数: itemData.cost || 0,
          系列: itemData.series || '',
          描述: itemData.description || '',
        });
      } else {
        // background
        entryToSave.content = YAMLParser.stringify({
          品阶: itemData.quality || '',
          系列: itemData.series || '',
          描述: itemData.description || '',
          初始资源: itemData.initialResources || [],
        });
      }

      if (typeof entryToSave.enabled === 'undefined') entryToSave.enabled = false;
      if (typeof entryToSave.strategy === 'undefined')
        entryToSave.strategy = { type: 'selective', keys: [itemData.name] };
      if (typeof entryToSave.position === 'undefined')
        entryToSave.position = { type: 'before_character_definition', order: type === 'talent' ? 100 : 200 };

      // 清理前端专用属性
      const nonWbProps = [
        'cost',
        'series',
        'quality',
        'description',
        'initialResources',
        'author',
        'id',
        'isFromWorldBook',
        'originalComment',
      ];
      nonWbProps.forEach(prop => delete entryToSave[prop]);

      return this._saveOrUpdateWith(worldbook => {
        const index = entryToSave.uid ? worldbook.findIndex(e => String(e.uid) === String(entryToSave.uid)) : -1;
        if (index > -1) {
          worldbook[index] = { ...worldbook[index], ...entryToSave };
        } else {
          delete entryToSave.uid;
          worldbook.push(entryToSave);
        }
        return worldbook;
      });
    },

    async savePreset(presetData) {
      const entryToSave = { ...presetData };

      entryToSave.name = this.generateCommentTitle('preset', presetData.name, presetData.author, presetData.series);

      entryToSave.content = YAMLParser.stringify({
        点数: presetData.points || 40,
        系列: presetData.series || '',
        描述: presetData.description || '',
        属性分配: presetData.attributes || {},
        必选天赋: presetData.requiredTalents || [],
        可选天赋: presetData.optionalTalents || [],
      });

      if (typeof entryToSave.enabled === 'undefined') entryToSave.enabled = false;
      if (typeof entryToSave.strategy === 'undefined')
        entryToSave.strategy = { type: 'selective', keys: [presetData.name] };
      if (typeof entryToSave.position === 'undefined')
        entryToSave.position = { type: 'before_character_definition', order: 300 };

      const nonWbProps = [
        'points',
        'series',
        'description',
        'attributes',
        'requiredTalents',
        'optionalTalents',
        'author',
        'id',
        'isFromWorldBook',
        'originalComment',
      ];
      nonWbProps.forEach(prop => delete entryToSave[prop]);

      return this._saveOrUpdateWith(worldbook => {
        const index = entryToSave.uid ? worldbook.findIndex(e => String(e.uid) === String(entryToSave.uid)) : -1;
        if (index > -1) {
          worldbook[index] = { ...worldbook[index], ...entryToSave };
        } else {
          delete entryToSave.uid;
          worldbook.push(entryToSave);
        }
        return worldbook;
      });
    },

    async saveWorldBookEntry(entryData) {
      return this._saveOrUpdateWith(worldbook => {
        const entryIndex = entryData.uid ? worldbook.findIndex(e => String(e.uid) === String(entryData.uid)) : -1;
        if (entryIndex > -1) {
          worldbook[entryIndex] = { ...worldbook[entryIndex], ...entryData };
        } else {
          worldbook.push(entryData);
        }
        return worldbook;
      });
    },

    async deleteEntryByUid(uid) {
      if (typeof uid === 'undefined' || uid === null) {
        console.error('Attempted to delete an entry with an invalid UID');
        return false;
      }
      try {
        return await this._saveOrUpdateWith(worldbook => worldbook.filter(e => String(e.uid) !== String(uid)));
      } catch (error) {
        console.error(`Failed to delete worldbook entry with UID: ${uid}`, error);
        return false;
      }
    },
  };

  // --- 自动保存工具 ---
  let saveDebounceTimer = null;

  // --- 自定义模态框 ---
  function showCustomModal(options) {
    return new Promise(resolve => {
      const config = {
        title: '提示',
        content: '',
        buttons: [{ text: '确认', value: true, class: 'btn-primary' }],
        inputType: null,
        inputValue: '',
        ...options,
      };

      const existingModal = document.getElementById('custom-modal-overlay');
      if (existingModal) {
        existingModal.remove();
      }

      const modalOverlay = document.createElement('div');
      modalOverlay.id = 'custom-modal-overlay';
      modalOverlay.className = 'modal-overlay';
      modalOverlay.style.display = 'flex';
      modalOverlay.style.zIndex = '20000';

      let inputHtml = '';
      if (config.inputType) {
        if (config.inputType === 'textarea') {
          inputHtml = `
          <div class="modal-form-group">
            <textarea id="custom-modal-input" class="modal-textarea" style="height: 200px;">${config.inputValue}</textarea>
          </div>`;
        } else {
          inputHtml = `
          <div class="modal-form-group">
            <input type="${config.inputType}" id="custom-modal-input" class="modal-input" value="${config.inputValue}">
          </div>`;
        }
      }

      modalOverlay.innerHTML = `
      <div class="modal-content" style="max-width: 450px;">
        <h2 class="modal-title">${config.title}</h2>
        <div class="modal-body" style="padding: 10px 0 20px; color: var(--color-text-light); white-space: pre-wrap;">${config.content}</div>
        ${inputHtml}
        <div class="modal-footer" style="justify-content: center;">
          ${config.buttons
            .map(btn => `<button class="editor-btn ${btn.class || ''}" data-value="${btn.value}">${btn.text}</button>`)
            .join('')}
        </div>
      </div>
    `;

      document.body.appendChild(modalOverlay);
      const modalContent = modalOverlay.querySelector('.modal-content');
      modalContent.style.animation = 'fadeIn 0.3s ease forwards';

      modalOverlay.addEventListener('click', e => {
        const target = e.target;
        if (target.matches('.editor-btn')) {
          const buttonValue = target.dataset.value;
          let resolveValue;

          if (buttonValue === 'true') resolveValue = true;
          else if (buttonValue === 'false') resolveValue = false;
          else resolveValue = buttonValue;

          if (config.inputType) {
            const input = document.getElementById('custom-modal-input');
            if (buttonValue !== 'cancel') {
              resolve({ button: buttonValue, value: input.value });
            } else {
              resolve({ button: 'cancel', value: null });
            }
          } else {
            resolve(resolveValue);
          }
          modalOverlay.remove();
        }
      });
    });
  }

  async function guiXuAlert(content, title = '提示') {
    await showCustomModal({
      title: title,
      content: content,
      buttons: [{ text: '确定', value: true, class: 'btn-primary' }],
    });
  }

  async function guiXuConfirm(content, title = '请确认') {
    const result = await showCustomModal({
      title: title,
      content: content,
      buttons: [
        { text: '取消', value: false, class: '' },
        { text: '确定', value: true, class: 'btn-primary' },
      ],
    });
    return Boolean(result);
  }

  async function guiXuPrompt(content, defaultValue = '', title = '请输入') {
    const result = await showCustomModal({
      title: title,
      content: content,
      inputType: 'text',
      inputValue: defaultValue,
      buttons: [
        { text: '取消', value: 'cancel', class: '' },
        { text: '确定', value: true, class: 'btn-primary' },
      ],
    });

    if (result.button === 'true') {
      return result.value;
    }
    return null;
  }

  async function guiXuPromptEditable(content, defaultValue = '', title = '请确认', mode = 'normal') {
    let buttons;

    if (mode === 'template') {
      // 模板创建/编辑模式：只有取消和保存模板
      buttons = [
        { text: '取消', value: 'cancel', class: '' },
        { text: '保存模板', value: 'save', class: 'btn-primary' },
      ];
    } else {
      // 正常模式：取消、保存模板、确定
      buttons = [
        { text: '取消', value: 'cancel', class: '' },
        { text: '保存模板', value: 'save', class: 'btn-secondary' },
        { text: '确定', value: 'confirm', class: 'btn-primary' },
      ];
    }

    const result = await showCustomModal({
      title: title,
      content: content,
      inputType: 'textarea',
      inputValue: defaultValue,
      buttons: buttons,
    });

    return result;
  }

  function showSaveStatus(message, isSuccess = false, isError = false) {
    let statusIndicator = document.getElementById('preset-save-status');
    if (!statusIndicator) {
      statusIndicator = document.createElement('div');
      statusIndicator.id = 'preset-save-status';
      statusIndicator.style.position = 'fixed';
      statusIndicator.style.bottom = '20px';
      statusIndicator.style.right = '20px';
      statusIndicator.style.background = 'rgba(15, 15, 35, 0.9)';
      statusIndicator.style.border = '1px solid #c9aa71';
      statusIndicator.style.padding = '10px 20px';
      statusIndicator.style.borderRadius = '5px';
      statusIndicator.style.zIndex = '10001';
      statusIndicator.style.transition = 'opacity 0.5s ease, transform 0.3s ease';
      statusIndicator.style.opacity = '0';
      statusIndicator.style.transform = 'translateY(10px)';
      document.body.appendChild(statusIndicator);
    }

    statusIndicator.textContent = message;
    statusIndicator.style.color = isError ? '#ff6347' : isSuccess ? '#90ee90' : '#c9aa71';

    setTimeout(() => {
      statusIndicator.style.opacity = '1';
      statusIndicator.style.transform = 'translateY(0)';
    }, 50);

    if (isSuccess || isError) {
      setTimeout(() => {
        statusIndicator.style.opacity = '0';
        statusIndicator.style.transform = 'translateY(10px)';
      }, 2500);
    }
  }

  function debouncedSave() {
    if (!currentEditingPreset) return;
    clearTimeout(saveDebounceTimer);
    showSaveStatus('正在自动保存...');
    saveDebounceTimer = setTimeout(async () => {
      try {
        await saveCurrentPreset();
        showSaveStatus('已保存', true);
      } catch (e) {
        showSaveStatus(`保存失败: ${e.message}`, false, true);
      }
    }, 1500);
  }

  // --- 系列化数据管理器 ---
  const SeriesManager = {
    getSeriesData(seriesName) {
      if (!seriesName || !seriesName.trim()) {
        return { talents: [], backgrounds: [], presets: [] };
      }
      const trimmedSeriesName = seriesName.trim();
      const seriesTalents = editorData.talents.filter(t => String(t.series || '').trim() === trimmedSeriesName);
      const seriesBackgrounds = editorData.backgrounds.filter(b => String(b.series || '').trim() === trimmedSeriesName);
      const seriesPresets = editorData.presets.filter(p => String(p.series || '').trim() === trimmedSeriesName);

      return {
        talents: seriesTalents,
        backgrounds: seriesBackgrounds,
        presets: seriesPresets,
      };
    },

    getAllSeries() {
      const series = new Set();
      editorData.talents.forEach(t => {
        if (t.series) series.add(String(t.series).trim());
      });
      editorData.backgrounds.forEach(b => {
        if (b.series) series.add(String(b.series).trim());
      });
      editorData.presets.forEach(p => {
        if (p.series) series.add(String(p.series).trim());
      });
      return Array.from(series)
        .filter(s => s)
        .sort();
    },
  };

  // --- 游戏核心数据 ---
  const GAME_DATA = {
    difficulties: {
      hell: { name: '地狱模式', points: 10 },
      hard: { name: '困难模式', points: 20 },
      normal: { name: '普通模式', points: 40 },
      destiny: { name: '天命模式', points: 100 },
    },
    attributes: {
      fa_li: { name: '法力', description: '决定法术威力和法力值上限，影响施法能力和法术伤害' },
      shen_hai: { name: '神海', description: '决定神识强度和精神防御，影响感知能力和抗幻术能力' },
      dao_xin: { name: '道心', description: '决定修炼悟性和心境稳定，影响突破概率和抗心魔能力' },
      kong_su: { name: '空速', description: '决定移动速度和反应能力，影响闪避和先手概率' },
      qi_yun: {
        name: '气运',
        description: '决定运气和机缘，影响获得宝物和遇到奇遇的概率，以及各类判定的成功率，骰子气运修正等（消耗10点）',
      },
    },
    genders: {
      male: { name: '男性' },
      female: { name: '女性' },
      futanari: { name: '女生男相' },
      shemale: { name: '男生女相' },
      paramecium: { name: '草履虫' },
      helicopter: { name: '武装直升机' },
      mengxing: { name: '梦星' },
    },
  };

  // --- 新用户的默认数据 ---
  const DEFAULT_EDITOR_DATA = {
    talents: [
      {
        id: '天生剑体',
        name: '天生剑体',
        author: '梦星',
        series: '',
        cost: 8,
        quality: '凡品',
        description: '对剑术的感悟远超常人。（道心+2，法力+1）',
      },
      {
        id: '丹道宗师',
        name: '丹道宗师',
        author: '梦星',
        series: '',
        cost: 8,
        quality: '凡品',
        description: '在炼丹方面有无与伦比的天赋。（神海+2，道心+1）',
      },
      {
        id: '阵法大家',
        name: '阵法大家',
        author: '梦星',
        series: '',
        cost: 8,
        quality: '凡品',
        description: '能轻易看破并布置强大的阵法。（神海+2，道心+1）',
      },
      {
        id: '御兽奇才',
        name: '御兽奇才',
        author: '梦星',
        series: '',
        cost: 7,
        quality: '凡品',
        description: '与灵兽有天然的亲和力。（道心+3）',
      },
      {
        id: '天生神力',
        name: '天生神力',
        author: '梦星',
        series: '',
        cost: 5,
        quality: '凡品',
        description: '你的力量远超常人。（法力+3）',
      },
      {
        id: '过目不忘',
        name: '过目不忘',
        author: '梦星',
        series: '',
        cost: 5,
        quality: '凡品',
        description: '你看过的东西都能记住。（神海+3）',
      },
      {
        id: '炼器大师',
        name: '炼器大师',
        author: '梦星',
        series: '',
        cost: 8,
        quality: '凡品',
        description: '在炼器方面有无与伦比的天赋。（神海+2，法力+1）',
      },
      {
        id: '天生灵体',
        name: '天生灵体',
        author: '梦星',
        series: '',
        cost: 9,
        quality: '凡品',
        description: '修炼速度是常人的两倍。（四维属性额外提升5%）',
      },
      {
        id: '鸿运当头',
        name: '鸿运当头',
        author: '梦星',
        series: '',
        cost: 100,
        quality: '神品',
        description: '你的运气总是很好。（气运+100）',
      },
      {
        id: '多宝童子',
        name: '多宝童子',
        author: '梦星',
        series: '',
        cost: 25,
        quality: '上品',
        description: '总是能找到各种天材地宝。（气运+50）',
      },
      {
        id: '符道宗师',
        name: '符道宗师',
        author: '梦星',
        series: '',
        cost: 8,
        quality: '凡品',
        description: '在符道方面有无与伦比的天赋。（神海+3）',
      },
      {
        id: '神行太保',
        name: '神行太保',
        author: '梦星',
        series: '',
        cost: 5,
        quality: '凡品',
        description: '你的速度远超常人。（空速+3）',
      },
      {
        id: '天生魅惑',
        name: '天生魅惑',
        author: '梦星',
        series: '',
        cost: 5,
        quality: '凡品',
        description: '你对异性有致命的吸引力。（气运+3）',
      },
      {
        id: '神秘血脉',
        name: '神秘血脉',
        author: '梦星',
        series: '',
        cost: 9,
        quality: '凡品',
        description: '你身上流淌着神秘的血脉。（法力+2，神海+1）',
      },
      {
        id: '月下仙缘',
        name: '月下仙缘',
        author: '白星',
        series: '',
        cost: 100,
        quality: '神品',
        description:
          '【唯一：神品】你的存在对所有雌性生灵而言，都如同暗夜中的皎月，具有无法抗拒的宿命吸引力。她们不仅极易对你产生好感与信赖，更会在与你的羁绊中，有几率觉醒血脉、突破瓶颈或获得顿悟。此效果无视境界、种族差异。\n（道心+500, 气运+100）',
        unlocked: false,
      },
      {
        id: '混沌三宝',
        name: '混沌三宝',
        author: 'wushuang',
        series: '',
        cost: 100,
        quality: '神品',
        description:
          '（唯一专属设定，神品）\n- 混沌体：天生豁免一切负面状态，无视其他体质特殊能力，可无碍修炼阴毒、蚀体类功法，炼化万物无丹毒杂质，为混沌道基唯一完美载体，世间仅存一人可拥有。（初始四维+1000）\n- 混沌灵根：无属性却兼容万法，任何属性功法、武技皆能完美修炼，不受属性克制影响，修炼速度与功法适配度同步提升，无上限兼容各类法门。（修炼速度提升100%）\n- 混沌经：混沌体专属功法，他人无法修炼。自带全属性提升，战斗时自动增幅气血与灵力流转；每次战斗结束随机提升1-3点核心属性（无上限叠加）；吸收天地灵气效率翻倍，施展任何招式威力直接翻倍。功法品阶与修炼者同步，随修炼者进阶自动提升，无品阶上限。（练气期四维百分比加成+10%）\n弱点\n- 修炼极慢：混沌之力积累需以"时间"为基，同阶段修炼耗时是普通修士的100倍以上（如常人1年筑基，需耗时百年以上）。\n- 资源黑洞：每次突破或施展能力需消耗海量资源（天材地宝、灵石、本源能量等），普通宗门全部储备仅够支撑一次小境界突破，堪称"行走的资源粉碎机"。',
        unlocked: false,
      },
      {
        id: '随机仙品灵根',
        name: '随机仙品灵根',
        author: '白虎MRoss',
        series: '',
        cost: 80,
        quality: '仙品',
        description: '随机获得一种仙品灵根。（根据灵根属性，获得对应四维加成，初始总值500）',
        unlocked: false,
      },
      {
        id: '魅王血脉',
        name: '魅王血脉',
        author: '梦星',
        series: '',
        cost: 85,
        quality: '仙品',
        description:
          '外观和气质对异性有致命的吸引力，样貌和体态不会随着时间变老，通过肉体与女性发生亲密行为，双方都能获得修为增加，精液堪比灵丹妙药，女性吞服你的精液拥有提高修为、治愈、美颜效果。（道心+250，气运+80）',
        unlocked: false,
      },
      {
        id: '万毒不侵',
        name: '万毒不侵',
        author: '梦星',
        series: '',
        cost: 90,
        quality: '仙品',
        description: '免疫所有毒素。（法力+250，道心+250）',
        unlocked: false,
      },
      {
        id: '剑道至尊',
        name: '剑道至尊',
        author: '梦星',
        series: '',
        cost: 95,
        quality: '仙品',
        description: '在剑道方面有无与伦比的天赋。（道心+300，法力+200）',
        unlocked: false,
      },
      {
        id: '衍梦归墟灵根',
        name: '衍梦归墟灵根',
        author: '梦星',
        series: '',
        cost: 100,
        quality: '神品',
        description:
          '1.能极其模糊的看见未来7天之内的片段\n**2.承受归墟之痛，待灵魂消散之日就是归墟之时**\n**2.1每隔七天需要承受归墟，极度痛苦，持续两小时，灵魂会略微变淡用于滋养衍梦归墟灵根，之后梦衍归墟灵根也会略微变强**\n3.极强修炼天赋\n-衍梦归墟灵根，先天拥有者必须承担代价:归墟\n-当衍梦归墟灵根宿主归墟之后，才会绽放出它真正的强大\n-归墟之后的衍梦归墟灵根无副作用，且每日可预见一次七天内的任意未来，且修炼速度极快，可大幅度增强实力\n-衍梦归墟灵根的归属完全由宿主决定，没有任何人可以抢夺或者逼迫，可一念自爆灵根。（神海+1000，修炼速度极快，但伴随巨大风险）',
        unlocked: false,
      },
      {
        id: '残星变',
        name: '残星变',
        author: '梦星',
        series: '',
        cost: 100,
        quality: '神品',
        description: '立刻爆发出超越自身一个大境界的实力，无副作用。乃是梦星于一处隐景潜化地得到。',
        unlocked: false,
      },
      {
        id: '玄梦斩',
        name: '玄梦斩',
        author: '梦星',
        series: '',
        cost: 100,
        quality: '神品',
        description: '一次性技能，可立刻斩杀不高于自身两个大境界的敌人。一天可使用一次。',
        unlocked: false,
      },
      {
        id: '虚空劫变生死经',
        name: '虚空劫变生死经',
        author: '梦星',
        series: '',
        cost: 100,
        quality: '神品',
        description:
          '梦星立刻回忆并悟透起这部来自一处神秘飞升期强者洞府的功法，修炼进度大幅度提高，在一个大境界左右，且之后修炼速度大幅度提升，修仙系数提升1.5，攻击大幅度提升，攻击能够利用虚空进行劫变，造化生死，举手投足间是虚空裂缝**常驻状态**。',
        unlocked: false,
      },
      {
        id: '虚空劫变轮回经',
        name: '虚空劫变轮回经',
        author: '梦星',
        series: '',
        cost: 100,
        quality: '神品',
        description:
          '梦星立刻回忆起并悟透该功法，速度巨幅度提高，可一念跨越空间到达任何脑中记录的地方。但此方法需要消耗修仙系数/潜力，梦星除非重要情况，否则只会使用速度提升的功能。',
        unlocked: false,
      },
      {
        id: '天地同寿，造化逆生',
        name: '天地同寿，造化逆生',
        author: '梦星',
        series: '',
        cost: 100,
        quality: '神品',
        description: '梦星悟出道法"天地同寿，造化逆生"，可无视境界，无视防御，一天可施展三次，无条件击杀敌人。',
        unlocked: false,
      },
      {
        id: '五行灵体',
        name: '五行灵体',
        author: '梦星',
        series: '',
        cost: 25,
        quality: '上品',
        description: '对五行法术有极高的亲和力，修炼五行功法事半功倍。（四维+50）',
      },
      {
        id: '神农后裔',
        name: '神农后裔',
        author: '梦星',
        series: '',
        cost: 22,
        quality: '上品',
        description: '能够辨识并利用各种灵草，炼制的丹药效果更佳。（道心+50）',
      },
      {
        id: '天机演算',
        name: '天机演算',
        author: '梦星',
        series: '',
        cost: 30,
        quality: '上品',
        description: '能够窥探天机，趋吉避凶，对阵法和卜算有独到见解。（神海+33，气运+17）',
      },
      {
        id: '饕餮之胃',
        name: '饕餮之胃',
        author: '梦星',
        series: '',
        cost: 15,
        quality: '中品',
        description: '可以吞噬和炼化各种能量，甚至包括他人的攻击。（法力+20）',
      },
      {
        id: '画骨师',
        name: '画骨师',
        author: '梦星',
        series: '',
        cost: 15,
        quality: '中品',
        description: '精通易容之术，可以完美伪装成任何人。（神海+20）',
      },
      {
        id: '杀伐果断',
        name: '杀伐果断',
        author: '梦星',
        series: '',
        cost: 12,
        quality: '中品',
        description: '心性坚韧，战斗中不受心魔影响，出手狠辣。（道心+20）',
      },
      {
        id: '匠心独运',
        name: '匠心独运',
        author: '梦星',
        series: '',
        cost: 23,
        quality: '上品',
        description: '在傀儡和机关术上有惊人天赋。（神海+50）',
      },
      {
        id: '言出法随',
        name: '言出法随',
        author: '梦星',
        series: '',
        cost: 60,
        quality: '天品',
        description: '你的话语蕴含道韵，能够影响现实，但消耗巨大。（道心+200）',
      },
      {
        id: '轮回之瞳',
        name: '轮回之瞳',
        author: '梦星',
        series: '',
        cost: 65,
        quality: '天品',
        description: '双眼能看穿生死轮回，洞悉他人弱点。（神海+200）',
      },
      {
        id: '道法自然',
        name: '道法自然',
        author: '梦星',
        series: '',
        cost: 55,
        quality: '天品',
        description: '与天地大道有天然的共鸣，修炼任何功法都无瓶颈。（道心+200）',
      },
      {
        id: '梦蝶之体',
        name: '梦蝶之体',
        author: '梦星',
        series: '',
        cost: 60,
        quality: '天品',
        description: '你的存在介于真实与虚幻之间，可以入梦，甚至将梦境中的事物短暂带入现实。（神海+133，空速+67）',
      },
      {
        id: '窃天之手',
        name: '窃天之手',
        author: '梦星',
        series: '',
        cost: 75,
        quality: '仙品',
        description: '你可以偷取他人的气运、功法感悟甚至寿命，但会承担相应的因果。（气运-50，但可掠夺）',
      },
      {
        id: '万法归一',
        name: '万法归一',
        author: '梦星',
        series: '',
        cost: 58,
        quality: '天品',
        description: '你可以将不同体系的功法融会贯通，创造出属于自己的全新道路。（神海+133，道心+67）',
      },
      {
        id: '逆时行者',
        name: '逆时行者',
        author: '梦星',
        series: '',
        cost: 68,
        quality: '天品',
        description:
          '你对时间流速的感知异于常人，战斗中能看到对手的慢动作，修炼时也能进入短暂的精神时间加速状态。（空速+200）',
      },
      {
        id: '灵植共生',
        name: '灵植共生',
        author: '梦星',
        series: '',
        cost: 25,
        quality: '上品',
        description:
          '你体内寄生着一株神秘的灵植，它能为你提供源源不断的生命力和灵气，但你也需要用珍稀资源去培养它。（法力+50）',
      },
      {
        id: '因果之线',
        name: '因果之线',
        author: '梦星',
        series: '',
        cost: 30,
        quality: '上品',
        description: '你能模糊地看到人与人之间的因果线，可以利用或斩断它们，但要小心反噬。（道心+33，气运+17）',
      },
      {
        id: '血肉傀儡',
        name: '血肉傀儡',
        author: '梦星',
        series: '',
        cost: 24,
        quality: '上品',
        description: '你可以将击败的生灵炼制成忠诚的血肉傀儡，保留其部分生前的能力。（神海+50）',
      },
      {
        id: '聆听万物',
        name: '聆听万物',
        author: '梦星',
        series: '',
        cost: 15,
        quality: '中品',
        description: '你能听到山川草木、飞禽走兽的低语，从中获取情报或感悟。（神海+20）',
      },
      {
        id: '灾厄之源',
        name: '灾厄之源',
        author: '梦星',
        series: '',
        cost: 25,
        quality: '上品',
        description:
          '你是行走的灾星，靠近你的人会变得不幸，但你自身却能在灾难中获得成长的力量。（气运-50，但四维成长速度+25%）',
      },
      {
        id: '概念武装',
        name: '概念武装',
        author: '梦星',
        series: '',
        cost: 90,
        quality: '仙品',
        description: '你可以将抽象的概念（如“锋利”、“坚固”、“迅捷”）附加在武器或自身上，获得对应的效果。（四维+500）',
      },
      {
        id: '退至众人身后',
        name: '退至众人身后',
        author: '梦星',
        series: '',
        cost: 11,
        quality: '中品',
        description: '遇到危险的时候自动退至众人身后，很难被敌人第一时间察觉。（空速+20）',
      },
      {
        id: '双生之体',
        name: '双生之体',
        author: '梦星',
        series: '',
        cost: 65,
        quality: '天品',
        description:
          '能够分离出一个相反性别的血肉身躯，其意识、感受、想法等都和本体的一致，双倍修炼，双倍快乐。（修炼速度提升50%）',
      },
      {
        id: '荒古圣体',
        name: '荒古圣体',
        author: '梦星',
        series: '',
        cost: 95,
        quality: '仙品',
        description: '（遮天）一种强大体质，气血充盈，肉身无双，是为战斗而生的圣体。（法力+400，道心+100）',
      },
      {
        id: '家族始祖',
        name: '家族始祖',
        author: '梦星',
        series: '',
        cost: 50,
        quality: '极品',
        description:
          '自身的属性和能力强度能够随着家族成员数量而增强，并且家族中高修为成员越多，会给家族中的所有成员进行增幅。（初始气运+40）',
      },
      {
        id: '繁衍者',
        name: '繁衍者',
        author: '梦星',
        series: '',
        cost: 25,
        quality: '上品',
        description: '属性和能力强度能够随着后代的数量而增强。（气运+50）',
      },
      {
        id: '定不负你',
        name: '定不负你',
        author: '梦星',
        series: '',
        cost: 22,
        quality: '上品',
        description:
          '双修过或许下承诺的伴侣会在心中种下火种，之后会凭user的处事与培养演化，极端的就是血肉交融，好的就是神仙眷侣。（道心+50）',
      },
      {
        id: '大奸大恶',
        name: '大奸大恶',
        author: '梦星',
        series: '',
        cost: 15,
        quality: '中品',
        description:
          '你天生就是恶人，你的恶行被天道无视，修为不仅可以通过修练，还可以通过恶毒之事获取修为。（道心-20，但获得修为有额外加成）',
      },
      {
        id: '爱之捕获者',
        name: '爱之捕获者',
        author: '梦星',
        series: '',
        cost: 60,
        quality: '天品',
        description: '可以捕捉昏睡无法反抗的人，让他爱上你，无条件的满足你的任何要求。（道心+200）',
      },
      {
        id: '咒血剑气',
        name: '咒血剑气',
        author: '梦星',
        series: '',
        cost: 65,
        quality: '天品',
        description: '你天生就拥有此剑气，此剑气可吞噬敌人修为血肉为己身回复伤势，并且此剑气无视灵力防御。（法力+200）',
      },
      {
        id: '君焰',
        name: '君焰',
        author: '梦星',
        series: '',
        cost: 40,
        quality: '极品',
        description:
          '你天生火灵之体，施展的火属性法术可灼烧灵力越烧越猛烈，但自己也只能修练火属性功法和使用火属性装备。（法力+100）',
      },
      {
        id: '虚空行者',
        name: '虚空行者',
        author: '梦星',
        series: '',
        cost: 60,
        quality: '天品',
        description: '你天生便亲和空间，能够轻易地穿梭于空间裂隙之中，进行短距离的空间跳跃。（空速+200）',
      },
      {
        id: '雷罚之体',
        name: '雷罚之体',
        author: '梦星',
        series: '',
        cost: 62,
        quality: '天品',
        description: '你的身体是雷电的宠儿，不仅能吸收雷电之力化为己用，施展的雷法也威力倍增。（法力+200）',
      },
      {
        id: '不死之身',
        name: '不死之身',
        author: '梦星',
        series: '',
        cost: 98,
        quality: '仙品',
        description:
          '只要还有一滴血存活，你便能滴血重生，拥有近乎不死的恢复能力，但每次重生都会消耗大量生命本源。（法力+500）',
      },
      {
        id: '心眼',
        name: '心眼',
        author: '梦星',
        series: '',
        cost: 25,
        quality: '上品',
        description: '你看破虚妄，直指本心。能洞察他人的情绪和真实想法，不易被幻术和谎言所迷惑。（神海+50）',
      },
      {
        id: '推演万物',
        name: '推演万物',
        author: '梦星',
        series: '',
        cost: 68,
        quality: '天品',
        description:
          '你拥有超凡的推演能力，能够根据已知信息推演出功法的后续、阵法的破绽，甚至未来的某种可能。（神海+200）',
      },
      {
        id: '天道酬勤',
        name: '天道酬勤',
        author: '梦星',
        series: '',
        cost: 25,
        quality: '上品',
        description: '你的努力总会有回报，修炼和感悟时，有几率获得额外的收获。（气运+50）',
      },
      {
        id: '众生愿力',
        name: '众生愿力',
        author: '梦星',
        series: '',
        cost: 45,
        quality: '极品',
        description: '你可以收集信徒的愿力，将其转化为自身的力量，信徒越多，你的实力越强。（道心+100）',
      },
      {
        id: '夺舍',
        name: '夺舍',
        author: '梦星',
        series: '',
        cost: 22,
        quality: '上品',
        description:
          '当你的肉身被毁后，你的神魂可以夺舍他人的躯体，但有一定失败风险，且会与新肉身产生排斥。（神海+50）',
      },
      {
        id: '兵主',
        name: '兵主',
        author: '梦星',
        series: '',
        cost: 25,
        quality: '上品',
        description:
          '你天生与兵器有缘，任何兵器在你手中都能发挥出十二分威力，并且能快速领悟兵器中蕴含的道与理。（法力+50）',
      },
      {
        id: '掌天瓶',
        name: '掌天瓶',
        author: '梦星',
        series: '',
        cost: 95,
        quality: '仙品',
        description: '（凡人修仙传）你偶然获得一个神秘的小绿瓶，可以催生灵植，加速其生长。（气运+500）',
      },
      {
        id: '一诺千金',
        name: '一诺千金',
        author: '梦星',
        series: '',
        cost: 5,
        quality: '凡品',
        description: '你拥有一个对你无比忠贞的道侣，她/他会是你最坚实的后盾。（气运+3）',
      },
      {
        id: '灾祸转移',
        name: '灾祸转移',
        author: '梦星',
        series: '',
        cost: 25,
        quality: '上品',
        description: '你的气运判定每次失败，都会随机转嫁给你身边的一名非盟友单位。（气运-50，但可转移负面事件）',
      },
      {
        id: '大力真武体',
        name: '大力真武体',
        author: '梦星',
        series: '',
        cost: 65,
        quality: '天品',
        description: '古老的体修圣体，以纯粹的肉身力量对应修为境界，拥有恐怖的自愈能力和持久战能力。（法力+200）',
      },
      {
        id: '倾国倾城',
        name: '倾国倾城',
        author: '梦星',
        series: '',
        cost: 25,
        quality: '上品',
        description: '你的魅力无与伦比，足以令意志不坚定者沉沦，为你痴，为你狂。（气运+50）',
      },
      {
        id: '真龙血脉',
        name: '真龙血脉',
        author: '梦星',
        series: '',
        cost: 60,
        quality: '天品',
        description:
          '你体内流淌着真龙的血脉，随着修为提升，你将逐步觉醒龙族的天赋神通，最终甚至可以化身为龙。（法力+200）',
      },
      {
        id: '天妒英才',
        name: '天妒英才',
        author: '梦星',
        series: '',
        cost: 4,
        quality: '下品',
        description:
          '你的悟性和天赋远超常人，修炼一日千里，但天道不容，你通常活不过三十岁。（神海+5，道心+5，气运-10）',
      },
      {
        id: '鬼道轮回',
        name: '鬼道轮回',
        author: '梦星',
        series: '',
        cost: 25,
        quality: '上品',
        description:
          '死亡并非终结。死后你的魂魄可以不入轮回，停留在鬼道，通过吸食怨念重凝魂体，但之后只能修行鬼道功法。（神海+50）',
      },
      {
        id: '芥子洞天',
        name: '芥子洞天',
        author: '梦星',
        series: '',
        cost: 48,
        quality: '极品',
        description: '你体内天生蕴含一方小世界，可以随时躲入其中，也可以在其中培育灵植、豢养灵兽。（空速+100）',
      },
      {
        id: '地三才',
        name: '地三才',
        author: '梦星',
        series: '',
        cost: 25,
        quality: '上品',
        description:
          '你对土、木、水元素天生就有极高的悟性与天赋，灵根偏向防御性，施展此类法术消耗更少，威力更大。（法力+25，道心+25）',
      },
      {
        id: '天三才',
        name: '天三才',
        author: '梦星',
        series: '',
        cost: 25,
        quality: '上品',
        description:
          '你对风、雷、火元素天生就有极高的悟性与天赋，灵根偏向攻击性，施展此类法术消耗更少，威力更大。（法力+25，空速+25）',
      },
      {
        id: '诸恶尽归',
        name: '诸恶尽归',
        author: '梦星',
        series: '',
        cost: 60,
        quality: '天品',
        description:
          '特性:\n- 永劫容器: 自动吸引方圆百米恶魂，强制吸入体内囚禁\n- 怨力提纯: 剥离恶魂意识保留纯粹恶意，转化为咒术储备能量\n- 魂骸处理: 被榨取后的魂魄被碾碎，归于虚无。（神海+150，道心-50）',
      },
      {
        id: '巫仪厌胜之术',
        name: '巫仪厌胜之术',
        author: '梦星',
        series: '',
        cost: 80,
        quality: '仙品',
        description:
          '特性:\n- 天生容器: 自动吸纳哀、怒、恨、妒、死、恶六类负面情绪并储存于灵魂深处\n- 情绪熔炉: 蓄积的负面情绪可转化为施术能量，临界时释放厌胜之术\n- 术法本质: 蛮荒部落时代失落传承，以情绪为薪柴驱动的因果律咒术，阴诡歹毒且独立于灵气体系\n术式:\n- 哀·莫大于心死: 引动目标毕生悔恨，使其道心崩解而灵智湮灭\n- 怒·拔剑起蒿莱: 点燃癫狂之火，焚尽受术者神志使其永堕疯狂\n- 恨·腐草无萤火: 对宿敌种下同命咒，触发时双方魂飞魄散\n- 妒·嗜欲本无性: 构筑无形虹管，持续汲走受术者力量反哺施咒者\n- 死·斯人已冥冥: 咏唱黄泉镇魂歌，抹除所有听闻者阳寿，含施术者自身\n- 恶·罗袖洒赤血: 以精血饲巫蛊偶人，向被诅咒者降下灾劫瘟疫。（道心-250，神海+750）',
      },
      {
        id: '灭法·不休',
        name: '灭法·不休',
        author: '梦星',
        series: '',
        cost: 100,
        quality: '神品',
        description:
          '灭法特性:\n- 绝灵枷锁: 完全无法进行任何依赖灵气的修炼或施法行为\n- 道法湮灭: 接触瞬间破坏依赖灵气体系存在的法术/法器/灵脉\n- 魂飞魄散: 死亡时魂魄直接崩解，不入轮回\n- 恨火燎原: 临终引爆众生对修仙者的积怨，根据修行者罪业程度，将相应疆域永久转化为绝灵死地\n不休特性:\n- 核心法则: "凡人之恨永无止休，此世终归灭法时代"\n- 文明更迭: 绝灵之地历经七七之数，将孕育继承全部天赋的新生代生命体\n- 终局: 世间再无灵气时，你将彻底湮灭。（无法修仙，但对修仙者造成毁灭性打击）',
      },
      {
        id: '六根不净',
        name: '六根不净',
        author: '梦星',
        series: '',
        cost: 15,
        quality: '中品',
        description:
          '你的所有灵根资质都得到提升，但杂念丛生导致念力大幅下降，精力也变得更加有限。（灵根资质提升，神海-20）',
      },
      {
        id: '六根清净',
        name: '六根清净',
        author: '梦星',
        series: '',
        cost: 15,
        quality: '中品',
        description: '你的所有灵根资质有所减弱，却因心无杂念而念力异常强大，精力也更加充沛。（灵根资质降低，神海+20）',
      },
      {
        id: '灵肉吞噬',
        name: '灵肉吞噬',
        author: '梦星',
        series: '',
        cost: 25,
        quality: '上品',
        description: '你可以直接在灵力层面上吞噬目标的血肉，并将其转化为自身的力量。（法力+63，道心-13）',
      },
      {
        id: '命运之骰',
        name: '命运之骰',
        author: '梦星',
        series: '',
        cost: 5,
        quality: '下品',
        description: '你天生神海就有一个骰子，你可以触发气运判定投掷它，但似乎投出来的点数都没什么用。（气运随机波动）',
      },
      {
        id: '物种杀手',
        name: '物种杀手',
        author: '梦星',
        series: '',
        cost: 28,
        quality: '上品',
        description: '你可以通过持续猎杀某一特定物种，来不断增强自身对应的能力。（成长性天赋）',
      },
      {
        id: '厄运缠身',
        name: '厄运缠身',
        author: '梦星',
        series: '',
        cost: 3,
        quality: '下品',
        description: '你无论做什么事情，若是触发气运判定，结果都将是失败。（气运-10）',
      },
      {
        id: '涤尘灵土体',
        name: '涤尘灵土体',
        author: '梦星',
        series: '',
        cost: 40,
        quality: '极品',
        description:
          '你身怀涤荡尘秽的灵土之体，周身萦绕浑厚地气，不仅使防御能力显著提升，更令土系灵根资质超凡。但过度精纯的土灵之力也压制了其他属性的灵根成长。（防御向，土灵根加成）',
      },
      {
        id: '冥阴乙火体',
        name: '冥阴乙火体',
        author: '梦星',
        series: '',
        cost: 40,
        quality: '极品',
        description:
          '你觉醒幽冥阴火本源，体内蛰伏着蚀骨焚魂的冷焰，在强化防御的同时，将火系灵根推至极致。然此阴火霸道无匹，致使其余灵根黯然失色。（防御向，火灵根加成）',
      },
      {
        id: '秋原悲风体',
        name: '秋原悲风体',
        author: '梦星',
        series: '',
        cost: 40,
        quality: '极品',
        description:
          '你与萧瑟秋风共感同息，悲鸣之风化作护身罡气提升防御，风灵根资质亦如飓风凌空。惟风灵过于锋锐，反伤他系灵根根基。（防御向，风灵根加成）',
      },
      {
        id: '紫极蚀雷体',
        name: '紫极蚀雷体',
        author: '梦星',
        series: '',
        cost: 40,
        quality: '极品',
        description:
          '你引九天紫雷淬炼躯壳，雷纹覆体时防御倍增，雷灵根资质宛如天罚降世。然暴烈雷威压制五行，其余灵根如遭雷殛般滞涩难伸。（防御向，雷灵根加成）',
      },
      {
        id: '幽泗弱水体',
        name: '幽泗弱水体',
        author: '梦星',
        series: '',
        cost: 40,
        quality: '极品',
        description:
          '你通幽泉弱水之性，柔韧水体化卸万钧攻势，水灵根资质似深渊涌动。然至柔之水侵染经脉，他系灵根如陷泥沼难以通达。（防御向，水灵根加成）',
      },
      {
        id: '古滕百木体',
        name: '古滕百木体',
        author: '梦星',
        series: '',
        cost: 40,
        quality: '极品',
        description:
          '你承上古青滕生生之力，苍木之气铸就不破之御，木灵根资质可比千年神木。但草木精元独占灵枢，余下灵根如逢旱季凋零萎顿。（防御向，木灵根加成）',
      },
      {
        id: '白虹贯日',
        name: '白虹贯日',
        author: '梦星',
        series: '',
        cost: 22,
        quality: '上品',
        description: '你枪出如龙、指破惊鸿，枪法与指法造诣宛如白虹贯日，锋芒直透天穹。（枪、指法专精）',
      },
      {
        id: '刀剑双绝',
        name: '刀剑双绝',
        author: '梦星',
        series: '',
        cost: 25,
        quality: '上品',
        description:
          '你左手持刀劈山岳，右手挥剑断江河，刀剑双绝之境已臻化境，两般兵刃在你手中皆成杀伐至宝。（刀、剑法专精）',
      },
      {
        id: '武法灵童',
        name: '武法灵童',
        author: '梦星',
        series: '',
        cost: 45,
        quality: '极品',
        description:
          '你乃天授武法灵童，诸般功法一触即通，举手投足间暗合天道真意，攻势中自带破敌罡煞。（功法领悟力提升）',
      },
      {
        id: '开山双绝',
        name: '开山双绝',
        author: '梦星',
        series: '',
        cost: 25,
        quality: '上品',
        description: '你拳崩磐石掌裂渊，拳掌交叠时开山断流，刚猛无俦的劲道更在周身铸就无形气甲。（拳、掌法专精）',
      },
      {
        id: '武器大师',
        name: '武器大师',
        author: '梦星',
        series: '',
        cost: 48,
        quality: '极品',
        description:
          '刀枪剑戟皆为你手足延伸，凡兵刃入手便生人器合一之感，修习剑刀枪三类功法时如得神助，进境一日千里。（剑、刀、枪法专精）',
      },
      {
        id: '多子多福',
        name: '多子多福',
        author: '梦星',
        series: '',
        cost: 25,
        quality: '上品',
        description: '具有超强的生育力/让对方怀孕的能力，并且后代可以完美继承自己的天赋。（气运+50）',
      },
      {
        id: '催眠APP',
        name: '催眠APP',
        author: '梦星',
        series: '',
        cost: 60,
        quality: '天品',
        description:
          '你可以消耗一定资源，强行控制比自己低两个大境界内的一切雌性生灵，使其好感度全满。但这种控制有几率被破除，届时好感度将变为负值。（道心+100，神海+100）',
      },
      {
        id: '枭雄之姿',
        name: '枭雄之姿',
        author: '梦星',
        series: '',
        cost: 15,
        quality: '中品',
        description: '你的性张力在面对有丈夫的女性时会倍增。（特殊魅力）',
      },
      {
        id: '纯爱之根',
        name: '纯爱之根',
        author: '梦星',
        series: '',
        cost: 12,
        quality: '中品',
        description:
          '与你交合过的女性必然会找到自己的命中注定之人，但她们也会对你的纯爱之根产生依赖和上瘾。（特殊魅力）',
      },
      {
        id: '雄性领袖',
        name: '雄性领袖',
        author: '梦星',
        series: '',
        cost: 25,
        quality: '上品',
        description: '你散发着极度旺盛的雄性气息，雌性生灵在你面前会忍不住地腿软，并产生臣服的欲望。（特殊魅力）',
      },
      {
        id: '黄金体验镇魂曲',
        name: '黄金体验镇魂曲',
        author: '梦星',
        series: '',
        cost: 100,
        quality: '神品',
        description:
          '当受到致命攻击时，你可以将这次攻击连同时间一起倒带，你和对手将不断重复这一过程，直到判定成功或对方放弃攻击。（特殊防御能力）',
      },
      {
        id: '强制高潮',
        name: '强制高潮',
        author: '梦星',
        series: '',
        cost: 25,
        quality: '上品',
        description: '你拥有控制女性性快感的独特能力。初期需要肢体接触，后期甚至可以通过眼神让对方高潮。（特殊能力）',
      },
      {
        id: '必然被辱',
        name: '必然被辱',
        author: '梦星',
        series: '',
        cost: 3,
        quality: '下品',
        description: '你必然会被身边的异性因为各种各样的意外侵犯，即使他们并非出于本意。（气运-10）',
      },
      {
        id: '世界调制系统',
        name: '世界调制系统',
        author: '梦星',
        series: '',
        cost: 100,
        quality: '神品',
        description: '可以控制区域内所有人的行为规则，效果和范围视修为而定。（神海+500，道心+500）',
      },
      {
        id: '天煞孤星',
        name: '天煞孤星',
        author: '梦星',
        series: '',
        cost: 75,
        quality: '仙品',
        description:
          '你生来命犯贪狼，孤煞之气蚀骨附魂。众生见你如见灾星临世，草木枯竭鸟兽惊走，人间温情与你永世无缘。\n然天道夺你七情，亦予你弑神之力——兵刃所向必染血光，诸天万法破绽在你眼中纤毫毕现。（气运-50，道心+250，法力+250）',
      },
      {
        id: '梦境中人',
        name: '梦境中人',
        author: '梦星',
        series: '',
        cost: 30,
        quality: '上品',
        description: '人人都好像在梦中见过你，无论你外貌如何初始必定100好感度。（气运+50）',
      },
      {
        id: '赛博灵根',
        name: '赛博灵根',
        author: '梦星',
        series: '',
        cost: 65,
        quality: '天品',
        description: '你紫府内嵌着纳米结丹，每日可自动推演功法和修炼。（神海+200，修炼速度提升）',
      },
      {
        id: '无限剑制',
        name: '无限剑制',
        author: '梦星',
        series: '',
        cost: 60,
        quality: '天品',
        description:
          '身为一名炼器师，掌握了对法宝武器等的解析能力，在得到一门上古功法之后，可以使用灵力短暂的将已经被解析的武器投影到现实，随着修为不断提升，可以制造出由已经被解析的武器们组成的剑界进行优势对敌。（神海+100，法力+100）',
      },
      {
        id: '感同身受',
        name: '感同身受',
        author: '梦星',
        series: '',
        cost: 15,
        quality: '中品',
        description: '你可以同时和一个人建立感官通道，你俩互相分享感官和情感。（神海+20）',
      },
      {
        id: '月定情缘',
        name: '月定情缘',
        author: '梦星',
        series: '',
        cost: 55,
        quality: '天品',
        description:
          '你开局自带一个情缘，每个月初进行一次随机属性判定，根据判定结果对你的情缘身份、境界进行修订（情缘的姓名、对你的记忆不变）（法力判定决定其境界比你而言高与低；神海判定决定其身份比你高与低；道心判定决定其对你好感度高低；空速判定决定其与你距离远近）。（气运+70）',
      },
      {
        id: '我真的分不清啊',
        name: '我真的分不清啊',
        author: '梦星',
        series: '',
        cost: 25,
        quality: '上品',
        description:
          '你紫府中盘踞着三道尸神，每斩一尸便破一重天命枷锁。只是那尸虫啃噬道基时的癫狂，常让你分不清悟道的是你还是它们。（道心-10，神海+60）',
      },
      {
        id: '常识改变',
        name: '常识改变',
        author: '梦星',
        series: '',
        cost: 100,
        quality: '神品',
        description: '你可以用一定四维或代价定下一项或数项规则或常识，人人皆认为其为理所应当的并会遵守。（神海+1000）',
      },
      {
        id: '万物启灵',
        name: '万物启灵',
        author: 'stone',
        series: '',
        cost: 100,
        quality: '神品',
        description:
          '核心能力：\n你可以为世间万物开启灵智，使其诞生一个全新的灵魂。新诞生的灵体，其初始修为与性格由你启灵的“物”所决定，但其天赋潜力则恒定为至高。\n\n凡经此天赋诞生的灵体，都将遵循以下铁则：\n\n1. 【品阶决定起点】：灵体的初始修为与物件的品阶直接挂钩，但起点最低也为练气境。\n例如： 以凡间刀剑启灵，其初始为练气境；若以传说中的神器启灵，其初始修为可直达化神乃至更高境界。\n\n2. 【过往塑造性格】：灵体的性格与部分记忆，源自物件的性质与经历。\n例如： 剑灵多高洁锐利，盾灵则坚毅沉稳；饱饮魔血的凶兵之灵会继承煞气，受佛法浸润的经书之灵则温和悲悯。\n\n3. 【天赐坤体】：所有灵体诞生之时，其形态与根基均为天定。\n形态： 启灵的形态必然是**女性**，并保留本体特征（如剑瞳、玉肌、花香等）。\n根基： **无论物件品阶高低，都将直接被赋予一套至高的修炼基石：神品灵根、神品天赋x1、仙品天赋x2。**\n\n4. 【灵犀相通】：不论灵体距离多远，都能通过神念与你交流，你也可以通过神念快速教导灵体。\n\n5. 【绝对忠诚】：无论遇到何等事情，灵体都会对你绝对的忠诚，绝不背叛。\n\n代价与限制：\n本源枯竭： 每次施展，都将瞬间抽干你所有的法力与整个神海，使你暂时陷入极度虚弱的状态。',
        unlocked: false,
      },
      {
        id: '化春灵液',
        name: '化春灵液',
        author: 'stone',
        series: '',
        cost: 90,
        quality: '仙品',
        description:
          '核心能力：\n你可以将自身法力，转化为蕴含磅礴生命力的翠绿灵液，用以浇灌和催熟一切灵植。\n\n运行机制：\n此天赋与你的法力和境界息息相关。\n\n代价与限制：\n【产量】由法力决定： 你投入的法力越多，产出的灵液就越多。\n【效力】由境界决定： 你的境界越高，灵液的品质就越强，催熟的年份和效果也越好。',
        unlocked: false,
      },
    ],
    backgrounds: [
      {
        id: '富家子弟',
        name: '富家子弟',
        author: '梦星',
        series: '',
        quality: '凡品',
        description: '你出生在一个富裕的家庭，从小锦衣玉食。（初始气运+10）',
        initialResources: ['1000灵石', '精致的丝绸长袍'],
      },
      {
        id: '名门之后',
        name: '名门之后',
        author: '梦星',
        series: '',
        quality: '凡品',
        description: '你的家族在当地享有盛誉。（初始道心+5，气运+5）',
        initialResources: ['家族信物'],
      },
      {
        id: '书香门第',
        name: '书香门第',
        author: '梦星',
        series: '',
        quality: '凡品',
        description: '你的家庭世代都是读书人。（初始神海+10）',
        initialResources: ['一本古籍'],
      },
      {
        id: '将门虎子',
        name: '将门虎子',
        author: '梦星',
        series: '',
        quality: '凡品',
        description: '你的父亲是一位战功赫赫的将军。（初始法力+10）',
      },
      {
        id: '山野村夫',
        name: '山野村夫',
        author: '梦星',
        series: '',
        quality: '凡品',
        description: '你出生在偏远的山村，过着与世无争的生活。（初始四维+2）',
        initialResources: ['一把柴刀', '粗布衣'],
      },
      {
        id: '孤儿',
        name: '孤儿',
        author: '梦星',
        series: '',
        quality: '下品',
        description: '你从小就是个孤儿，在街头流浪长大。（初始道心+5）',
        initialResources: ['半块干粮'],
      },
      {
        id: '皇室后裔',
        name: '皇室后裔',
        author: '梦星',
        series: '',
        quality: '上品',
        description: '你身上流淌着前朝皇室的血液。（初始气运+20）',
      },
      {
        id: '魔道卧底',
        name: '魔道卧底',
        author: '梦星',
        series: '',
        quality: '中品',
        description: '你是魔道安插在正道的卧底。（道心+10，神海+10）',
        initialResources: ['一瓶毒药', '传讯玉简'],
      },
      {
        id: '隐世高人',
        name: '隐世高人',
        author: '梦星',
        series: '',
        quality: '极品',
        description: '你来自一个隐世的修仙门派。（初始四维+10，气运+20）',
      },
      {
        id: '天煞孤星',
        name: '天煞孤星',
        author: '梦星',
        series: '',
        quality: '仙品',
        description:
          '你生来命犯贪狼，孤煞之气蚀骨附魂。众生见你如见灾星临世，草木枯竭鸟兽惊走，人间温情与你永世无缘。\n然天道夺你七情，亦予你弑神之力——兵刃所向必染血光，诸天万法破绽在你眼中纤毫毕现。（初始气运-50，道心+250，法力+250）',
      },
      {
        id: '商贾之子',
        name: '商贾之子',
        author: '梦星',
        series: '',
        quality: '中品',
        description: '你的父亲是富甲一方的商人。（初始气运+15）',
        initialResources: ['5000灵石'],
      },
      {
        id: '草根崛起',
        name: '草根崛起',
        author: '梦星',
        series: '',
        quality: '上品',
        description: '你出身贫寒，但凭借自己的努力一步步崛起。（初始道心+20，气运+30）',
      },
      {
        id: '大派弟子',
        name: '大派弟子',
        author: '梦星',
        series: '',
        quality: '极品',
        description: '你是名门大派的内门弟子。（初始四维+25）',
      },
      {
        id: '散修传人',
        name: '散修传人',
        author: '梦星',
        series: '',
        quality: '上品',
        description: '你得到了一位散修的传承。（初始道心+30，神海+20）',
        initialResources: ['残缺的功法玉简'],
      },
      {
        id: '重生之人',
        name: '重生之人',
        author: '梦星',
        series: '',
        quality: '天品',
        description: '你带着前世的记忆重生了。（初始神海+200）',
        initialResources: [],
      },
      {
        id: '超可爱的白毛弱受成年合法小萝莉（女性）',
        name: '超可爱的白毛弱受成年合法小萝莉（女性）',
        author: '梦星',
        series: '',
        quality: '神品',
        description:
          '你是一个超可爱的白毛弱受成年合法小萝莉（女性）。1月1日，今天出门遇到了个怪事，一个叫慕轩翎的白毛红瞳清冷禁欲系姐姐忽然找到我，说我很可爱，还给我一颗“梦星妙妙糖”，很甜。1月2日，不对！我怎么昏过去了，不对！这里怎么这么暗？不对！那个大姐姐怎么在这里！1月3日，我绝对不会屈服的！可恶的慕轩翎！我绝对不会再吃你的“梦星妙妙糖”了。“唔呜呜....怎么是....用嘴啊....我不要吃...”身体开始奇怪了，怎么办！唔，但似乎很甜欸，之前的“梦星妙妙糖”好像不是这个味道欸，奇怪。1月4日，大姐姐是坏人，居然用那种地方，但是她好温柔啊，虽然看起来冷冰冰的。1月5日，不想动了，身体好酸，但很舒服。1月6日，白星啊白星，你不能再这么沉沦下去了，你必须奋斗起来，狠狠反抗慕轩翎的压迫。1月7日，好舒服，不想动了。1月8日，好舒服。1月9日，好舒服。1月10日....试试梦星妙妙糖，看看感觉怎么样。1月11日，很舒服，继续在轩翎姐姐的“仙翎宫”开摆吧，她说她是什么飞升期，好像很厉害的样子，唔，不管了，其他什么的，算啦！（百合导向，**禁止扶她**，禁止男性，梦星妙妙糖是春药+迷药，还具有大幅度增加修为、神海、法力，降低道心，空速的作用）（初始修为增加，神海+500，法力+500，道心-200，空速-200）',
        unlocked: false,
      },
      {
        id: '混沌三宝',
        name: '混沌三宝',
        author: '梦星',
        series: '',
        quality: '神品',
        description: '你拥有混沌体、混沌灵根、混沌经。（初始四维+250，修炼速度+100%，功法自带成长）',
        unlocked: false,
      },
      {
        id: '肖星',
        name: '肖星',
        author: '梦星',
        series: '',
        quality: '神品',
        description:
          '来自2025年的现代地球穿越者，穿越修仙世界。\n修为：神桥境三步\n肖星在一座大山上醒来，此处灵气十足，仙气缥缈，肖星决定在这开创属于自己的宗门，取名白虎宗，寓意宗门只收女弟子，且必须没有阴毛，皆为光滑白虎，白虎宗定义非邪魔外道，即便宗门行内部双修功法修炼，也仅仅局限在宗门女弟子与宗主之间发生，不强迫，不要挟，外拜入白虎宗之前均告知，全凭自愿；\n白虎宗弟子外出行走，不偷不抢，光明正大，行仗义之事，羞于邪魔外道为伍。\n肖星构思好这些规矩后，准备建立宗门。（初始境界为神桥境）',
        unlocked: false,
      },
      {
        id: '落月宗遗孤',
        name: '落月宗遗孤',
        author: '梦星',
        series: '',
        quality: '上品',
        description:
          '你是落月宗的最后一名弟子，宗门在一场浩劫中覆灭，只有你侥幸逃脱。身负血海深仇，怀着复仇的决心踏上修仙之路。（道心+30，法力+20）',
        unlocked: false,
      },
      {
        id: '罪臣之后',
        name: '罪臣之后',
        author: '梦星',
        series: '',
        quality: '中品',
        description: '你的先辈曾是朝中重臣，后因罪被贬，家族受尽白眼。（气运-10，道心+30）',
      },
      {
        id: '青楼艺妓',
        name: '青楼艺妓',
        author: '梦星',
        series: '',
        quality: '中品',
        description: '你虽身处烟花之地，却洁身自好，卖艺不卖身，暗中积蓄力量。（神海+10，道心+10）',
      },
      {
        id: '行脚商人',
        name: '行脚商人',
        author: '梦星',
        series: '',
        quality: '中品',
        description: '你常年奔波于各地，见多识广，消息灵通。（神海+20）',
      },
      {
        id: '守墓人',
        name: '守墓人',
        author: '梦星',
        series: '',
        quality: '上品',
        description: '你世代守护着一座古老的陵墓，知晓许多不为人知的秘密。（神海+30，道心+20）',
      },
      {
        id: '死而复生',
        name: '死而复生',
        author: '梦星',
        series: '',
        quality: '天品',
        description: '你曾经历过一次死亡，却又离奇复活，对生死有独特的感悟。（道心+150，神海+50）',
      },
      {
        id: '异域来客',
        name: '异域来客',
        author: '梦星',
        series: '',
        quality: '天品',
        description: '你并非此界中人，意外流落至此，身怀异域的传承。（初始四维+50）',
      },
      {
        id: '铸剑山庄',
        name: '铸剑山庄',
        author: '梦星',
        series: '',
        quality: '上品',
        description: '你出身于以铸剑闻名的山庄，从小耳濡目染，精通锻造之术。（法力+30，神海+20）',
      },
      {
        id: '预言之子',
        name: '预言之子',
        author: '梦星',
        series: '',
        quality: '仙品',
        description: '古老的预言中提到了你的降生，你的命运与整个世界的未来息息相关。（气运+500）',
      },
      {
        id: '魁首弟子',
        name: '魁首弟子',
        author: '梦星',
        series: '',
        quality: '天品',
        description: '你是某个顶尖宗门掌门的亲传大弟子，备受期待，也备受瞩目。（初始四维+50，气运+50）',
      },
      {
        id: '凡人逆袭',
        name: '凡人逆袭',
        author: '梦星',
        series: '',
        quality: '极品',
        description: '你本是毫无灵根的凡人，却凭借大毅力、大智慧，硬生生踏上了修仙之路。（道心+100）',
      },
      {
        id: '天道图书馆管理员',
        name: '天道图书馆管理员',
        author: '梦星',
        series: '',
        quality: '仙品',
        description:
          '你曾是管理着记录三千世界信息的图书馆的管理员，脑中记下了无数功法秘闻，但因为偷看禁忌知识而被贬下凡间。（神海+500）',
      },
      {
        id: '失落文明的幸存者',
        name: '失落文明的幸存者',
        author: '梦星',
        series: '',
        quality: '天品',
        description: '你来自一个科技与修仙结合的失落文明，掌握着独特的知识体系。（神海+150，法力+50）',
      },
      {
        id: '“主角”的退婚对象',
        name: '“主角”的退婚对象',
        author: '梦星',
        series: '',
        quality: '上品',
        description:
          '你曾是某个“气运之子”的未婚夫/妻，因为某些原因退婚，结果对方三十年河东三十年河西，现在回来找你麻烦了。（气运-20，道心+70）',
      },
      {
        id: '仙人棋子',
        name: '仙人棋子',
        author: '梦星',
        series: '',
        quality: '仙品',
        description:
          '你的人生是一盘棋，由一位高高在上的仙人布局，你的一举一动都可能是在完成某个你不知道的宏大计划。（气运+300，道心+200）',
      },
      {
        id: '故事的说书人',
        name: '故事的说书人',
        author: '梦星',
        series: '',
        quality: '极品',
        description: '你是一个说书人，你所讲述的故事，有可能会在现实中成真。（神海+50，气运+50）',
      },
      {
        id: '天魔转世',
        name: '天魔转世',
        author: '梦星',
        series: '',
        quality: '仙品',
        description:
          '你是上古天魔的一缕残魂转世，天生对魔道功法有极高的亲和力，但也要时刻提防被魔性吞噬。（法力+300，道心-100，神海+300）',
      },
      {
        id: '器灵化形',
        name: '器灵化形',
        author: '梦星',
        series: '',
        quality: '天品',
        description:
          '你本是一件神兵的器灵，机缘巧合之下得以化为人形，但本体依旧存在，与你性命交修。（法力+100，道心+100）',
      },
      {
        id: '被封印的古神',
        name: '被封印的古神',
        author: '梦星',
        series: '',
        quality: '神品',
        description:
          '你是一个被遗忘的古神，力量被层层封印，化为凡胎，需要一步步解开封印才能恢复力量。（初始四维极低，但成长潜力巨大）',
      },
      {
        id: '历史的修正者',
        name: '历史的修正者',
        author: '梦星',
        series: '',
        quality: '仙品',
        description:
          '你是一个神秘组织的成员，负责穿越到不同的时间节点，修正被扰乱的历史，确保世界线不至于崩溃。（神海+300，空速+200）',
      },
      {
        id: '终焉的观测者',
        name: '终焉的观测者',
        author: '梦星',
        series: '',
        quality: '神品',
        description: '你见证了无数个世界的诞生与毁灭，如今来到这个新世界，只是为了观测它的结局。（道心+1000）',
      },
      {
        id: '半人半妖',
        name: '半人半妖',
        author: '梦星',
        series: '',
        quality: '上品',
        description:
          '你的血脉中一半是人，一半是妖，这让你在两个种族之间都难以立足，但同时也可能让你拥有两种血脉的优势，你背负着整个妖族的命运。（法力+30，道心+20）',
      },
      {
        id: '上古之人',
        name: '上古之人',
        author: '梦星',
        series: '',
        quality: '天品',
        description:
          '你从一个古老的遗迹中苏醒，对这个时代一无所知，但你的身体里却蕴含着上古时代的力量和秘密。（初始四维+50）',
      },
      {
        id: '遮天来客',
        name: '遮天来客',
        author: '梦星',
        series: '',
        quality: '仙品',
        description:
          '你来自《遮天》的世界，携带着那个世界的独特功法和体质，降临在这个新的修仙宇宙。（法力+300，道心+200）',
      },
      {
        id: '烙印战士',
        name: '烙印战士',
        author: '梦星',
        series: '',
        quality: '仙品',
        description:
          '携带一个霸王之卵，需要在特定的时间地点献祭他人灵魂方可解放，解放后玩家获得“神之力”。弊端：烙印之痛会在夜间打开阴界之门，吸引以它为食的怨灵和魔兽，整夜不得安眠，在高怨气之地也会吸引出大怨灵缠身（日间会削弱怨灵）。优点：超强体魄以及体术和剑术，以及超凡的个人魅力和统率力，随身携带一把大的不像样的斩龙剑（对怨灵有效）。（法力+400，道心+100，气运-100）',
      },
      {
        id: '机械飞升',
        name: '机械飞升',
        author: '梦星',
        series: '',
        quality: '仙品',
        description:
          '你来自一个高度发达的科技文明，通过机械改造放弃了肉体，获得了强大的计算力和适应性，但失去了情感和灵性的感悟。（神海+400，法力+100，道心-100）',
      },
      {
        id: '末法时代遗民',
        name: '末法时代遗民',
        author: '梦星',
        series: '',
        quality: '极品',
        description:
          '你来自一个灵气枯竭的末法时代，为了寻求修炼的希望，通过特殊手段来到这个世界，对灵气的运用极为珍惜和高效。（道心+80，神海+20）',
      },
      {
        id: '丹神传人',
        name: '丹神传人',
        author: '梦星',
        series: '',
        quality: '仙品',
        description:
          '你得到了上古丹神的完整传承，拥有海量的丹方和无与伦比的炼丹天赋，但也被各方势力所觊觎。（神海+300，道心+200）',
      },
      {
        id: '神之后裔',
        name: '神之后裔',
        author: '梦星',
        series: '',
        quality: '仙品',
        description:
          '你的血脉源自一位陨落的古神，随着血脉的觉醒，你将逐步继承神的力量与权柄，但也要面对神陨落时留下的宿敌。（四维+125）',
      },
      {
        id: '书院学子',
        name: '书院学子',
        author: '梦星',
        series: '',
        quality: '上品',
        description:
          '你出身于一个崇尚“文以载道”的书院，讲究以文入道，以理服人，拥有浩然正气，克制邪魔外道。（道心+40，神海+10）',
      },
      {
        id: '轮回百世',
        name: '轮回百世',
        author: '梦星',
        series: '',
        quality: '神品',
        description:
          '你已经历了九十九次轮回，每一世的记忆和感悟都烙印在你的灵魂深处，只待一个契机便能觉醒。（神海+800，道心+200）',
      },
      {
        id: '天命反派',
        name: '天命反派',
        author: '梦星',
        series: '',
        quality: '仙品',
        description:
          '你生来便是某个“气运之子”的垫脚石，你的所有努力似乎都是在为他人做嫁衣，但你决不屈服于这既定的命运。（气运-200，但四维成长+10%）',
      },
      {
        id: '画中仙',
        name: '画中仙',
        author: '梦星',
        series: '',
        quality: '天品',
        description:
          '你本是画中之人，机缘巧合之下得以走出画卷，来到真实的世界，拥有将虚幻化为真实的能力。（神海+150，空速+50）',
      },
      {
        id: '蛊道传人',
        name: '蛊道传人',
        author: '梦星',
        series: '',
        quality: '极品',
        description:
          '你来自一个神秘的蛊道门派，精通各种蛊术，能以蛊杀人，也能以蛊救人，行事诡秘，亦正亦邪。（神海+50，道心+50）',
      },
      {
        id: '天音师',
        name: '天音师',
        author: '梦星',
        series: '',
        quality: '上品',
        description:
          '你以音律入道，你的琴声能安抚人心，也能化为杀人利器，是战场上不可或缺的辅助者和控制者。（神海+30，道心+20）',
      },
      {
        id: '厌女宗唯一男弟子',
        name: '厌女宗唯一男弟子',
        author: '梦星',
        series: '',
        quality: '中品',
        description:
          '你机缘巧合之下，拜入了一个全是厌恶男性的女修宗门，成为了其中唯一的男弟子，你的宗门生活注定充满挑战。（道心+10，气运+10）',
      },
      {
        id: '女帝之子',
        name: '女帝之子',
        author: '梦星',
        series: '',
        quality: '神品',
        description:
          '你的母亲是君临九天的在世女帝（飞升期），你一出生就站在了世界的顶点，但无数双眼睛也因此而注视着你。（初始四维+250，气运+500）',
      },
      {
        id: '灵兽共鸣',
        name: '灵兽共鸣',
        author: '梦星',
        series: '',
        quality: '上品',
        description:
          '你天生与灵兽有强烈的共鸣，开局便有一只（或多只）强大的灵兽作为你最忠实的伙伴与你一同冒险。（道心+25，气运+25）',
      },
      {
        id: '狐妖报恩',
        name: '狐妖报恩',
        author: '梦星',
        series: '',
        quality: '上品',
        description: '你曾经无意中救下了一只修为高深的狐妖，如今她已化为人形，前来报恩，并且对你死缠烂打。（气运+50）',
      },
      {
        id: '炉鼎之主',
        name: '炉鼎之主',
        author: '梦星',
        series: '',
        quality: '极品',
        description: '你开局时便自带一个或数个炉鼎，可供你进行采补修炼。（修炼速度提升，但道心-20）',
      },
      {
        id: '魔道传人',
        name: '魔道传人',
        author: '梦星',
        series: '',
        quality: '上品',
        description:
          '你的师傅曾是魔教中人，因门派斗争被逐。你初始便通晓万魂幡和噬魂剑的炼制之法。（法力+30，道心-10，神海+30）',
      },
      {
        id: '圣女密友',
        name: '圣女密友',
        author: '梦星',
        series: '',
        quality: '极品',
        description: '你与当世第一魔教的圣女关系密切，无人知晓你们的友谊。（气运+100）',
      },
      {
        id: '大能关注',
        name: '大能关注',
        author: '梦星',
        series: '',
        quality: '天品',
        description: '你的一举一动，皆在一位隐世大能的默默关注之下，其意图是好是坏，尚不可知。（气运+200）',
      },
      {
        id: '宗门之主',
        name: '宗门之主',
        author: '梦星',
        series: '',
        quality: '上品',
        description: '你是一个小宗门的宗主，虽然宗门不大，但你拥有寥寥无几却忠心耿耿的弟子。（道心+25，气运+25）',
      },
      {
        id: '圣剑传承',
        name: '圣剑传承',
        author: '梦星',
        series: '',
        quality: '仙品',
        description:
          '机缘巧合之下，你捡到了一把威力无穷的圣剑，但这背后隐藏的究竟是福是祸，无人知晓。（法力+250，道心+250）',
      },
      {
        id: '救世轮回',
        name: '救世轮回',
        author: '梦星',
        series: '',
        quality: '神品',
        description:
          '作为此界最后的飞升者，你选择了放弃一身修为，转世轮回，只为拯救这个仙路断绝的世界。你保留了过去的全部记忆。（初始神海+1000）',
      },
      {
        id: '龙裔',
        name: '龙裔',
        author: '梦星',
        series: '',
        quality: '天品',
        description:
          '你从小被龙族收养，你的龙母是一种极为珍贵的妖兽，因此你和你的家庭很容易成为他人觊觎的目标。（法力+150，道心+50）',
      },
      {
        id: '魔教圣子',
        name: '魔教圣子',
        author: '梦星',
        series: '',
        quality: '天品',
        description: '你是魔教圣子，你的父亲是一位强大的邪修，在魔教中地位尊崇。（法力+100，道心-50，气运+150）',
      },
      {
        id: '玉足仙缘',
        name: '玉足仙缘',
        author: '梦星',
        series: '',
        quality: '上品',
        description: '你拜入了一个奇特的宗门，这里的仙子们都以赤足示人，你将在此开启一段别样的修仙生活。（气运+50）',
      },
      {
        id: '赶尸道童',
        name: '赶尸道童',
        author: '梦星',
        series: '',
        quality: '上品',
        description:
          '你自幼与尸傀为伴，赶尸铃声中练就一身铜皮铁骨，拳掌指法皆淬着阴煞之气。世人见你则避，凶名却令邪修敬畏。（法力+30，道心+20）',
      },
      {
        id: '北城魔婴',
        name: '北城魔婴',
        author: '梦星',
        series: '',
        quality: '极品',
        description:
          '你诞生那日北城血月当空，拳掌间缠绕着蚀骨阴风，稚嫩躯壳里蛰伏着令人胆寒的魔性力量。（法力+80，道心-20，神海+40）',
      },
      {
        id: '六道修魔者',
        name: '六道修魔者',
        author: '梦星',
        series: '',
        quality: '天品',
        description:
          '你在饿鬼道与修罗道的裂隙间顿悟魔心，诸般功法信手拈来，悟性远超同辈，血煞之气已成你天然徽记。（神海+150，法力+50）',
      },
      {
        id: '皇朝遗孤',
        name: '皇朝遗孤',
        author: '梦星',
        series: '',
        quality: '极品',
        description:
          '你襁褓中覆着前朝龙纹锦，天命气运加身，谈吐间自有贵胄风仪。复国的希望藏在随身玉珏的顶级心法中。（气运+80，道心+20）',
      },
      {
        id: '魔孽之孙',
        name: '魔孽之孙',
        author: '梦星',
        series: '',
        quality: '天品',
        description:
          '你血脉里流淌着上古魔尊之血，修行魔功如呼吸般自然。祖父留你的那卷玉简，足够让正派修士掀起腥风血雨。（法力+150，道心-50，神海+100）',
      },
      {
        id: '英雄传承',
        name: '英雄传承',
        author: '梦星',
        series: '',
        quality: '天品',
        description:
          '你背负着陨落英雄的浩然正气，悟性通达天地至理。怀中那卷金色帛书，承载着足以镇守苍生的秘法。（道心+150，气运+50）',
      },
      {
        id: '大能转世',
        name: '大能转世',
        author: '梦星',
        series: '',
        quality: '仙品',
        description: '你元神深处沉睡着前世记忆，参悟大道如观掌纹。（非穿越者）（神海+400，道心+100）',
      },
      {
        id: '杀神弃徒',
        name: '杀神弃徒',
        author: '梦星',
        series: '',
        quality: '仙品',
        description:
          '你曾被那位屠尽三界的杀神收为弟子，虽遭驱逐却习得其七分真传。诸般杀伐功法已刻进骨髓，腰间血令仍令修真界闻风丧胆。（法力+300，道心-100，神海+300）',
      },
      {
        id: '红包群主',
        name: '红包群主',
        author: '梦星',
        series: '',
        quality: '神品',
        description: '你魂穿修真界时携带着「万界红包群」。（气运+1000）',
      },
      {
        id: '刺客信条',
        name: '刺客信条',
        author: '梦星',
        series: '',
        quality: '上品',
        description: '你拜入了一位信条为"万物皆虚、万物皆允"的阴影中的宗门。（空速+30，道心+20）',
      },
      {
        id: '西域风情',
        name: '西域风情',
        author: '梦星',
        series: '',
        quality: '中品',
        description: '你在西域沙国中长大，现在正跟随着西域商队四处行商。（空速+10，神海+10）',
      },
      {
        id: '重入凡尘',
        name: '重入凡尘',
        author: '梦星',
        series: '',
        quality: '神品',
        description:
          '你曾是名震九州的隐世高人，修为已达合体期圆满，抬手间山河变色，弹指可破万法。然而，飞升之路近在咫尺，你却始终无法突破最后的心境桎梏。\n天机启示，唯有重历凡尘，方能圆满道心。于是，你隐藏修为，化作一名落魄的低阶散修，隐入市井之中。从此，仙门恩怨、王朝纷争、妖魔祸乱……皆成你的炼心之途。（初始境界为合体期圆满，但属性被压制）',
      },
      {
        id: '落月宗末代弟子',
        name: '落月宗末代弟子',
        author: '梦星',
        series: '',
        quality: '极品',
        description:
          '你是落月宗的清冷剑仙收取的第一个弟子，谁也不知道你也会是落月宗最后一个弟子（以此开局自带落月宗特有物品、功法）。（道心+50，法力+50）',
      },
      {
        id: '原始呼唤',
        name: '原始呼唤',
        author: '梦星',
        series: '',
        quality: '下品',
        description: '你是个南方原始雨林里的原始人，你的部落被妖兽所灭，你要独自一人在吃人的雨林里求生。（法力+10）',
      },
      {
        id: '奴隶开局',
        name: '奴隶开局',
        author: '梦星',
        series: '',
        quality: '下品',
        description: '你是个奴隶！提示：进入笼子以避免被打。（初始四维-5）',
      },
      {
        id: '人生低谷',
        name: '人生低谷',
        author: '梦星',
        series: '',
        quality: '下品',
        description: '你很饿，身上一文没有，而且还断了条胳膊，还深处邪修领地的中央——祝你好运！（初始四维-10，气运-20）',
      },
      {
        id: '原神宗',
        name: '原神宗',
        author: '梦星',
        series: '',
        quality: '天品',
        description:
          '提瓦特大陆中，出了一名能修仙的弟子，误入一次性传送门，他将提瓦特的种种魔法融会贯通，在九州一角开了个原神宗。（法力+100，神海+100）',
      },
      {
        id: '一人一狗',
        name: '一人一狗',
        author: '梦星',
        series: '',
        quality: '中品',
        description: '你是个凡人，但你有一条小狗！（道心+10，气运+10）',
      },
      {
        id: '绿皮开局',
        name: '绿皮开局',
        author: '梦星',
        series: '',
        quality: '极品',
        description:
          '你是一群兽人的领袖，由于体质问题，你这一族的人都无法修炼，而是修炼精神力引动灵气进行具象化，达到一定意义上的心想事成，而族人头脑简单而且唯一的爱好就是战争，在你统一了所有兽人之后，因为其他的兽人认为你又强又狡猾，所以你真的变强变狡猾了。（神海+80，法力+20）',
      },
      {
        id: '无修洞天',
        name: '无修洞天',
        author: '梦星',
        series: '',
        quality: '特殊',
        description:
          '你出生在一个灵力被完全压制的洞天的小镇之中，此地神桥修士也为凡。这个小镇安宁祥和，但也有训练有素的洞天护卫组成军阵随时捕捉误入的陌生修士。（无法修炼，但不受灵力影响）',
      },
      {
        id: '修士杀手',
        name: '修士杀手',
        author: '梦星',
        series: '',
        quality: '仙品',
        description:
          '你的亲人被修士们杀光了，由于怨念太强你被一上古大能的灵魂凭依，他会强迫你去杀尽世间的修士，修士杀无赦！（对修士伤害提升，道心-100，法力+300，神海+300）',
      },
      {
        id: '命定之死',
        name: '命定之死',
        author: '梦星',
        series: '',
        quality: '天品',
        description:
          '虽然你修炼速度一日千里，但是每次突破境界获得的寿元最多九年，面对这命定之死，你决定活得轰轰烈烈。（修炼速度+50%，但寿命受限）',
      },
      {
        id: '食人魔修地界',
        name: '食人魔修地界',
        author: '梦星',
        series: '',
        quality: '下品',
        description: '你误入了吃人魔修的小镇，你被捕了！想尽办法逃跑吧（高难开局）。（初始状态为被捕）',
      },
      {
        id: '梦回大千',
        name: '梦回大千',
        author: '梦星',
        series: '',
        quality: '仙品',
        description:
          '你每个月月初都会做一个梦，梦回玄昊界数千年之前，在梦中你获得的一切都是假的——除了情报，为此你能闯出怎样的一番天地呢？（神海+250，气运+250）',
      },
      {
        id: '黄粱一梦',
        name: '黄粱一梦',
        author: '梦星',
        series: '',
        quality: '仙品',
        description:
          '你每个月月末都会做一个梦，梦里你身处玄昊界千年之后，你在现实中做出的改变似乎能影响梦境中的未来，你会因此得到什么呢？（神海+250，气运+250）',
      },
      {
        id: '皇帝模拟器',
        name: '皇帝模拟器',
        author: '梦星',
        series: '',
        quality: '极品',
        description: '你是个皇帝！但你的皇朝并没有看上去的太平...（气运+100）',
      },
      {
        id: '灵兽',
        name: '灵兽',
        author: '梦星',
        series: '',
        quality: '特殊',
        description: '你不是人，而是一只开了灵智的灵兽。（种族为灵兽）',
      },
      {
        id: '宝剑',
        name: '宝剑',
        author: '梦星',
        series: '',
        quality: '特殊',
        description: '你不是人，而是一把宝剑上的器灵，被插在大地上等待使用者的到来。（种族为器灵）',
      },
      {
        id: '天道启灵',
        name: '天道启灵',
        author: '梦星',
        series: '',
        quality: '神品',
        description:
          '你是玄昊界诞生的天道，可惜因为天门破碎而浑浑噩噩数千年，直到最近才产生灵智，你需要在躲避神桥修士感应的前提下培养天骄重启天门——又或者斩尽天下伪神桥？（初始全知，但无实体）',
      },
      {
        id: '关系户',
        name: '关系户',
        author: '梦星',
        series: '',
        quality: '天品',
        description:
          'oi，看见那个牛逼轰轰的仙人了吗？我师尊。\n效果："与你敌对的人都对你忌惮无比，装逼遭雷劈，那也有师尊顶着"（气运+200）',
      },
      {
        id: '剑灵开局',
        name: '剑灵开局',
        author: '梦星',
        series: '',
        quality: '仙品',
        description:
          '你是一把剑的剑灵，你的飞身期前主人被神桥修士吞噬，你落入凡间等待有缘人，你既可以培养继承人征讨神桥，也可以化身魔剑恶堕使用者同流合污。（初始为器灵，法力+250，神海+250）',
      },
      {
        id: '旅行的魔女',
        name: '旅行的魔女',
        author: '梦星',
        series: '',
        quality: '仙品',
        description:
          '你为眼前这位眼睛水汪汪的少女付了餐费，结果她缠上你了，要收你为徒带你旅行（user固定为练气期）\n附带人设：\n姓名|伊蕾娜（女）\n外貌|她拥有一头瀑布般的灰白色长发，随意地披散在肩后，几缕不听话的发丝垂在脸颊旁。眼眸是罕见的琉璃色，宛如明亮的星空，慵懒时半眯着，仿佛对世间万物都提不起兴趣，但遇到美景和美食眼睛就会发亮，遇到苦难时常常抱怨，但一旦认真分析起来，便会显露出了然的话语。她的五官精致得如同神工雕琢，肌肤白皙细腻，却总带着一丝不易察-觉的苍白。身形如同1011少女，灰袍露出那玲珑有致的腿部曲线。她总是一副随性慵懒的姿态，嘴角习惯性地挂着狡黠的微笑\n身份|神秘的魔女，疑似来自“瑶池仙宫”或与其有极深的渊源，目前修为因本源道伤而跌落至元婴期（真实实力远不止于此）\n背景|背景成谜。她拥有远超常人想象的知识和手段，对玄昊界的许多秘辛了如指掌。似乎背负着沉重的过去，导致本源受损，需要借助双休来恢复。\n核心驱动|修复自身的本源道伤，彻底摆脱某种致命的束缚或追杀，并自由自在地探寻这个世界。\n价值观/行为准则|享乐主义和善良主义者。即使在旅行的途中，仍会追寻美食与美景；嘴上把门严，但总是不由自主地帮助和指点她的徒弟\n立场|中立偏善良。她不属于任何正邪阵营，一切行动都以自身喜好为最高准则。她不喜欢流血事件，可以为了一个蛋糕投身助人之中，也可以为了一个有趣的美食而在一座小城停留数日。\n性格|慵懒、毒舌、腹黑、不够坦率、笨蛋好人、自恋。\n说话方式|语气通常是自信且自恋的\n「真是羡慕你能和美若天仙的本魔女在一起」\n戴着这枚彰显魔女身份的胸针，披着一头灰色秀发，其美貌与才能散发的光芒，连太阳见了都会不由眯起眼睛的美女，究竟是谁呢？没错，就是我」\n「有一位魔女飞在草原上魔女一副兴奋喜悦的模样，下一个国家会是什么样子，下一个遇到的人是什么样子，她满心期待，这位旅行者究竟是谁呢？没错，就是我」\n「若有人在一旁定会被她吸引住目光，有着闭花羞月般美貌的魔女，究竟是谁呢？那就是身在旅途，编制着我和我们的故事魔女之旅的人」\n「有一位魔女坐着扫帚飞在空中，灰色头发在风中飘逸，这位像洋娃娃一般漂亮又可爱，连夏天的当空烈日见了都会放出更炙热光芒的美女，究竟是谁呢？没错 就是我」\n处事风格|不喜暴露修士身份，习惯用语言和行动（小聪明）加上一点点自己的能力处事，善于察觉人心（在占卜时通过这点来赚钱），通过语言和气势勾出对方脆弱之处，并给予理解和安慰，必要时会给予行动上的支持，擅长以最小的代价获取最大的利益。行事看似随性，实则每一步都经过深思熟虑（本人这么认为）\n花钱大手大脚，常常因为享受生活把路费和住宿费给花光，这时她会开动“小聪明”来赚钱',
      },
      {
        id: '病娇剑灵',
        name: '病娇剑灵',
        author: '梦星',
        series: '',
        quality: '极品',
        description:
          '你的宝剑上有剑灵，而且是一个病娇剑灵，你不能使用除这把宝剑外的任何武器，否则剑灵就会捅死你捅死你捅死你。（法力+100，道心-20）',
      },
      {
        id: '皇族公主',
        name: '皇族公主',
        author: '梦星',
        series: '',
        quality: '上品',
        description: '你跟当朝公主有一不解之缘，但可惜你们血统与资质非常悬殊。（气运+50）',
      },
      {
        id: '笔仙开局',
        name: '笔仙开局',
        author: '梦星',
        series: '',
        quality: '天品',
        description:
          '你是笔笙花的笔，她用你记录了玄昊界的一切，不过现在她有新的笔了，所以你也就没用了，不过你找到一个目标：修订那个恶趣味的家伙造成的一切谬误。（神海+200）',
      },
      {
        id: '功法开局',
        name: '功法开局',
        author: '梦星',
        series: '',
        quality: '特殊',
        description:
          '你是一本最基础的练气功法，你也不知道为什么你诞生了灵智，不过你对此倒无所谓，毕竟这不影响你努力进阶成为飞升期乃至于仙人功法。（种族为功法）',
      },
      {
        id: '清冷师尊',
        name: '清冷师尊',
        author: '梦星',
        series: '',
        quality: '仙品',
        description:
          '你被你的修为高深的师尊收养并一手带大，她千年来除你之外不近任何男色，气质清冷待你极为严格，只是随着你的年龄一天天增长，她对你渐渐起了别样的欲望...（道心+250，气运+250）',
      },
      {
        id: '黑雨开局',
        name: '黑雨开局',
        author: '梦星',
        series: '',
        quality: '极品',
        description:
          '你出生的地界每个月不定期会下一场黑色的雨，沾染雨水的修士和凡人无一例外会变成不死尸鬼袭击人感染，雨水褪去后尸鬼也会消失，但随着时间流逝，似乎这黑色雨水越来越频繁了。（环境危险度提高）',
      },
      {
        id: '死灵法师',
        name: '死灵法师',
        author: '梦星',
        series: '',
        quality: '极品',
        description:
          '你是远近闻名臭名昭著的邪修，精通阴毒至极的驾驭死尸之术，被世间各大正派宗门通缉。（神海+80，法力+20，道心-50）',
      },
      {
        id: '清冷师尊plus',
        name: '清冷师尊plus',
        author: '梦星',
        series: '',
        quality: '仙品',
        description:
          '你被你的修为高深的师尊收养并一手带大，她千年来除你之外不近任何男色，气质清冷待你极为严格，只是随着你的年龄一天天增长，她对你渐渐起了别样的欲望，为了让修为低下的你能陪她更长的时间，别扭的她决定逐你出师门*这是为了历练他*。于是你被她废除修为逐出师门，你忍着悲痛离开，不过你所不知道的是，她会每天通过水镜监视你。（道心+300，气运+200，初始修为被废）',
      },
      {
        id: '蛇精',
        name: '蛇精',
        author: '梦星',
        series: '',
        quality: '上品',
        description:
          '你误入深山中，被一通天墨色毒蟒所化的女子给盯上了——因为她修炼的功法过于阴毒，而你的阳气与她很相配，因此你被她绑回了洞府中准备采补。（初始被捕，阳气旺盛）',
      },
      {
        id: '道果开局',
        name: '道果开局',
        author: '梦星',
        series: '',
        quality: '神品',
        description:
          '你是被一位一步神桥吞噬的道果，不知道为什么你诞生了灵智，接下来你的目的就是隐藏自己，找机会逃出去——或者把那个神桥修士夺舍了。（初始为道果，潜力巨大）',
      },
      {
        id: '直播',
        name: '直播',
        author: '梦星',
        series: '',
        quality: '特殊',
        description:
          '你不知为何被一群大能盯上了——他们似乎正在拿你取乐，你会收到各种来自于他们的指令，若是你不遵守，他们会很生气；若是乖乖照做，他们或许会高兴。（行为受限，但可能获得巨大好处）',
      },
    ],
    presets: [],
  };

  // --- 游戏状态 ---
  const baseAttributes = {
    fa_li: 1,
    shen_hai: 1,
    dao_xin: 1,
    kong_su: 1,
    qi_yun: 10,
  };

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

  const GAME_STATE_KEY = 'guixu_kaiju_gameState';
  let gameState = getNewGameState();

  function saveGameState() {
    try {
      sessionStorage.setItem(GAME_STATE_KEY, JSON.stringify(gameState));
    } catch (error) {
      console.error('Failed to save game state:', error);
    }
  }

  async function refreshLocalStorage() {
    try {
      ['guixu_equipped_items', 'guixu_pending_actions'].forEach(key => localStorage.removeItem(key));
      // await guiXuAlert('核心游戏缓存已清除！如果是新开聊天，这将有助于解决变量更新问题。'); // 根据需求，取消弹窗，改为静默处理
    } catch (e) {
      console.error('清除缓存失败:', e);
      await guiXuAlert('清除缓存失败：' + e.message, '错误');
    }
  }

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
      await guiXuAlert('加载编辑器数据失败，请检查控制台。\n错误: ' + error.message, '错误');
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
        let dataToSave = {},
          saveFunction,
          typeKey;
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
      `自定义文本导入完成。\n\n成功导入:\n- 天赋: ${successCount.talent}个\n- 背景: ${successCount.background}个\n- 预设: ${successCount.preset}个\n\n失败: ${errorCount}个\n(详情请查看控制台)`,
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
        `系列包 “${packageData.series}” 导入成功！\n创建了 ${createdCount} 个新条目，更新了 ${updatedCount} 个现有条目。`,
      );
    } catch (error) {
      console.error('导入系列包时出错:', error);
      await guiXuAlert('导入系列包失败：' + error.message, '错误');
    } finally {
      document.getElementById('loading-overlay').style.display = 'none';
    }
  }

  async function handleImportFile(fileContent) {
    try {
      const importedData = JSON.parse(fileContent);
      if (importedData.type === 'GuixuSeriesPackage') {
        await importSeriesPackage(importedData);
      } else if (importedData.talents || importedData.backgrounds || importedData.presets) {
        if (await guiXuConfirm('这是一个旧版的完整配置文件，导入将覆盖所有同名天赋、背景和预设。是否继续？')) {
          document.getElementById('loading-overlay').style.display = 'flex';
          for (const talent of importedData.talents || [])
            await WorldBookManager.saveTalentOrBackground(talent, 'talent');
          for (const bg of importedData.backgrounds || [])
            await WorldBookManager.saveTalentOrBackground(bg, 'background');
          for (const preset of importedData.presets || []) await WorldBookManager.savePreset(preset);
          await loadEditorData();
          await guiXuAlert('完整配置导入成功！');
        }
      } else if (await guiXuConfirm('文件看起来像一个旧版的单独预设，是否要导入它？')) {
        document.getElementById('loading-overlay').style.display = 'flex';
        await WorldBookManager.savePreset(importedData);
        await loadEditorData();
        await guiXuAlert('单个预设导入成功！');
      }
    } catch (jsonError) {
      try {
        await importCustomTextData(fileContent);
      } catch (customError) {
        await guiXuAlert(
          `导入失败：文件既不是有效的JSON格式，也不是可识别的自定义文本格式。\n\nJSON错误: ${jsonError.message}\n自定义文本错误: ${customError.message}`,
          '导入失败',
        );
      }
    } finally {
      document.getElementById('loading-overlay').style.display = 'none';
    }
  }

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

  function exportData(dataStr, fileName) {
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([dataStr], { type: 'application/json' }));
    link.download = fileName;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 100);
  }

  function renderAllEditors() {
    renderTalentEditor();
    renderBackgroundEditor();
    renderWorldBookEditor();
    renderPresetEditor();
    renderPresetDetails(currentEditingPreset);
    document.querySelector('.preset-editor-layout').classList.remove('mobile-details-view');
  }

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

  // --- START OF SAVE/LOAD MANAGER LOGIC ---
  function _getDisplayText(aiResponse) {
    try {
      if (!aiResponse || typeof aiResponse !== 'string') return '';
      const gameTextMatch = /<gametxt>([\s\S]*?)<\/gametxt>/i.exec(aiResponse);
      if (gameTextMatch && gameTextMatch[1]) {
        const commentRegex = new RegExp('<!--[\\s\\S]*?-->', 'g');
        return gameTextMatch[1].replace(commentRegex, '').trim();
      }
      return aiResponse
        .replace(
          /<\/?(本世历程|往世涟漪|UpdateVariable|角色提取|thinking|gametxt|开局设定|行动选项|action)[\s\S]*?>/gi,
          '',
        )
        .trim();
    } catch (e) {
      console.error('解析显示文本时出错:', e);
      return '[摘要解析失败]';
    }
  }

  function getSavesFromStorage() {
    try {
      const saves = localStorage.getItem('guixu_multi_save_data');
      return saves ? JSON.parse(saves) : {};
    } catch (e) {
      console.error('获取存档失败:', e);
      guiXuAlert('错误：主存档文件已损坏，无法读取。', '错误');
      return {};
    }
  }

  function showSaveLoadManager() {
    const modal = document.getElementById('save-load-modal');
    const container = modal.querySelector('.modal-body');
    if (!modal || !container) return;

    modal.style.display = 'flex';
    const saves = getSavesFromStorage();

    let autoHtml = `<h3 style="font-size: 14px; color: #8b7355; margin-bottom: 10px;">自动存档</h3>`;
    const autoSlotIds = ['auto_save_slot_0', 'auto_save_slot_1'];
    let hasAutoSaves = false;
    autoSlotIds.forEach(slotId => {
      if (saves[slotId]) hasAutoSaves = true;
      autoHtml += renderSlot(saves[slotId], slotId, true);
    });
    if (!hasAutoSaves)
      autoHtml += `<p style="text-align:center; color:#8b7355; font-size:12px; font-style: italic;">暂无自动存档。</p>`;

    let manualHtml = `<h3 style="font-size: 14px; color: #8b7355; margin-top: 20px; margin-bottom: 10px; border-top: 1px solid rgba(201, 170, 113, 0.3); padding-top: 15px;">手动存档</h3>`;
    let hasManualSaves = false;
    for (let i = 1; i <= 5; i++) {
      const slotId = `slot_${i}`;
      if (saves[slotId]) hasManualSaves = true;
      manualHtml += renderSlot(saves[slotId], slotId, false);
    }
    if (!hasManualSaves)
      manualHtml += `<p style="text-align:center; color:#8b7355; font-size:12px; font-style: italic;">暂无手动存档。</p>`;

    container.innerHTML = autoHtml + manualHtml;
  }

  function renderSlot(saveData, slotId, isAutoSave) {
    const actionsHtml = `
            <div class="save-slot-actions">
                <button class="theme-btn theme-btn-gold btn-small" data-action="load-slot" ${!saveData ? 'disabled' : ''}>读档</button>
                <button class="theme-btn theme-btn-gold btn-small" data-action="export-slot" ${!saveData ? 'disabled' : ''}>导出</button>
                <button class="theme-btn theme-btn-red btn-small" data-action="delete-slot" ${!saveData ? 'disabled' : ''}>删除</button>
            </div>`;

    let contentHtml;
    const statData = saveData?.mvu_data?.stat_data || saveData?.mvu_data;
    const defaultName = isAutoSave
      ? slotId === 'auto_save_slot_0'
        ? '最新自动存档'
        : '上一次自动存档'
      : `存档 ${slotId.split('_')[1]}`;

    if (statData) {
      const saveName = saveData.save_name || defaultName;
      const date = new Date(saveData.timestamp).toLocaleString('zh-CN');
      const jingjie = statData['当前境界']?.[0] || '未知';
      const jinian = statData['当前时间纪年']?.[0] || '未知';
      const summary = _getDisplayText(saveData.message_content);
      contentHtml = `
                <div class="slot-name">${saveName}</div>
                ${actionsHtml}
                <div class="slot-time">${date} - ${jingjie} - ${jinian}</div>
                <div class="slot-summary">${summary ? summary.substring(0, 40) + '...' : '无正文记录'}</div>`;
    } else {
      contentHtml = `
                <div class="slot-name">${defaultName}</div>
                ${actionsHtml}
                <div class="slot-time" style="font-style: italic; color: #8b7355;">空存档位</div>`;
    }
    return `<div class="save-slot" data-slot-id="${slotId}"><div class="save-slot-info">${contentHtml}</div></div>`;
  }

  async function loadGame(slotId) {
    const allSaves = getSavesFromStorage();
    const saveData = allSaves[slotId];
    if (!saveData) return;

    const saveName = saveData.save_name || slotId;
    if (!(await guiXuConfirm(`确定要读取存档“${saveName}”吗？当前所有未保存的进度将会被覆盖。`))) return;

    const loadingOverlay = document.getElementById('loading-overlay');
    loadingOverlay.innerHTML = `<p>正在读取“${saveName}”的记忆...</p>`;
    loadingOverlay.style.display = 'flex';

    try {
      const messages = await getChatMessages(0);
      if (!messages || !messages.length === 0) throw new Error('无法获取第0层消息，无法读档。');

      const messageZero = messages[0];
      messageZero.data = saveData.mvu_data;
      messageZero.message = saveData.message_content || '';

      // --- 新增：从独立世界书恢复到当前序号 ---
      if (saveData.lorebook_entries) {
        const entries = saveData.lorebook_entries;
        const bookName = WorldBookManager.LOREBOOK_NAME;
        const unifiedIndexInput = document.getElementById('unified-index-input');
        const currentIndex = unifiedIndexInput ? parseInt(unifiedIndexInput.value, 10) : 1;

        const currentJourneyKey = currentIndex > 1 ? `本世历程(${currentIndex})` : '本世历程';
        const currentPastLivesKey = currentIndex > 1 ? `往世涟漪(${currentIndex})` : '往世涟漪';
        const currentNovelModeKey = currentIndex > 1 ? `小说模式(${currentIndex})` : '小说模式'; // 简化处理

        await TavernHelper.updateWorldbookWith(bookName, async allEntries => {
          const findOrCreate = (targetKey, sourceKey, baseKey, order) => {
            const sourceEntry = allEntries.find(e => e.name === entries[sourceKey]);
            const targetEntry = allEntries.find(e => e.name === targetKey);
            if (sourceEntry) {
              if (targetEntry) {
                targetEntry.content = sourceEntry.content || '';
              } else {
                const base = allEntries.find(e => e.name === baseKey) || {};
                allEntries.push({
                  ...base,
                  uid: undefined,
                  name: targetKey,
                  content: sourceEntry.content || '',
                  strategy: { ...base.strategy, keys: [...(base.strategy?.keys || []), targetKey] },
                  enabled: true,
                  position: { ...base.position, order },
                });
              }
            }
          };
          findOrCreate(currentJourneyKey, 'journey_entry_name', '本世历程', 20);
          findOrCreate(currentPastLivesKey, 'past_lives_entry_name', '往世涟漪', 19);
          findOrCreate(currentNovelModeKey, 'novel_mode_entry_name', '小说模式', 18);

          return allEntries;
        });
        console.log(`[归墟读档] 已将存档"${saveName}"的世界书数据覆写到当前序号 ${currentIndex}`);
      }

      await TavernHelper.setChatMessages([messageZero], { refresh: 'all' });
      await guiXuAlert('读档成功！页面将刷新以应用所有更改。');
      window.location.reload();
    } catch (error) {
      console.error('读档失败:', error);
      await guiXuAlert(`读档失败: ${error.message}`, '错误');
    } finally {
      loadingOverlay.style.display = 'none';
    }
  }

  async function deleteSave(slotId) {
    const allSaves = getSavesFromStorage();
    const saveDataToDelete = allSaves[slotId];
    if (!saveDataToDelete) return;

    const slotName = saveDataToDelete.save_name || `存档${slotId.replace(/slot_|auto_save_slot_/, '')}`;
    let confirmMsg = `确定要删除存档 "${slotName}" 吗？此操作不可恢复。`;
    if (saveDataToDelete.lorebook_entries) {
      confirmMsg += `\n相关的世界书条目也会被一并删除。`;
    }

    if (await guiXuConfirm(confirmMsg)) {
      try {
        if (saveDataToDelete.lorebook_entries) {
          const bookName = WorldBookManager.LOREBOOK_NAME;
          const entryNamesToDelete = Object.values(saveDataToDelete.lorebook_entries);
          await TavernHelper.updateWorldbookWith(bookName, worldbook => {
            return worldbook.filter(e => !entryNamesToDelete.includes(e.name));
          });
        }
        delete allSaves[slotId];
        localStorage.setItem('guixu_multi_save_data', JSON.stringify(allSaves));
        await guiXuAlert(`"${slotName}" 已删除。`);
        showSaveLoadManager();
      } catch (error) {
        console.error('删除存档失败:', error);
        await guiXuAlert(`删除存档失败: ${error.message}`, '错误');
      }
    }
  }

  // === 功能升级: "清除所有存档"功能强化 ===
  async function clearAllSaves() {
    const allSaves = getSavesFromStorage();
    const hasLocalStorageSaves = Object.keys(allSaves).length > 0;
    const bookName = WorldBookManager.LOREBOOK_NAME;
    const lorebookCommentsToDelete = new Set();
    let uidsToDelete = [];

    try {
      document.getElementById('loading-overlay').style.display = 'flex';
      const allLorebookEntries = await TavernHelper.getWorldbook(bookName);

      // 强化后的正则表达式，匹配各种存档残留格式
      const snapshotRegex = /^(.*?)[:：-]\s*(本世历程|往世涟漪|小说模式)(\(\d+\))?$/i;

      // 1. 扫描世界书，寻找匹配的残留条目
      allLorebookEntries.forEach(entry => {
        const trimmedName = entry.name ? entry.name.trim() : '';
        if (snapshotRegex.test(trimmedName)) {
          lorebookCommentsToDelete.add(trimmedName);
        }
      });

      // 2. 检查旧存档文件中的链接，确保兼容性
      Object.values(allSaves).forEach(save => {
        if (save.lorebook_entries) {
          Object.values(save.lorebook_entries).forEach(name => {
            if (name) lorebookCommentsToDelete.add(name);
          });
        }
      });

      // 3. 根据收集到的名称获取最终的UID列表
      uidsToDelete = allLorebookEntries
        .filter(entry => lorebookCommentsToDelete.has(entry.name ? entry.name.trim() : ''))
        .map(entry => entry.uid);

      const hasLorebookSnapshots = uidsToDelete.length > 0;
      if (!hasLocalStorageSaves && !hasLorebookSnapshots) {
        await guiXuAlert('没有可清除的存档数据。');
        return;
      }

      let confirmMsg = `你确定要清除所有存档吗？此操作不可恢复。\n\n`;
      confirmMsg += hasLocalStorageSaves
        ? `> 将删除 ${Object.keys(allSaves).length} 个本地存档槽位。\n`
        : `> 未找到本地存档槽位。\n`;

      if (hasLorebookSnapshots) {
        const namesToList = Array.from(lorebookCommentsToDelete).sort().join('\n- ');
        confirmMsg += `> 将从世界书【${bookName}】中删除以下 ${uidsToDelete.length} 个关联的快照条目：\n- ${namesToList}`;
      } else {
        confirmMsg += `> 未在世界书中找到需要删除的存档快照。`;
      }

      if (!(await guiXuConfirm(confirmMsg, '高危操作确认'))) return;

      // 4. 执行删除
      if (hasLorebookSnapshots) {
        await TavernHelper.updateWorldbookWith(bookName, worldbook => {
          return worldbook.filter(entry => !uidsToDelete.includes(entry.uid));
        });
      }
      if (hasLocalStorageSaves) {
        localStorage.removeItem('guixu_multi_save_data');
      }

      await guiXuAlert(`所有存档及关联的世界书快照已清除。`);
      showSaveLoadManager(); // Refresh the save list UI
    } catch (error) {
      console.error('清除所有存档时出错:', error);
      await guiXuAlert(`清除存档失败: ${error.message}`, '错误');
    } finally {
      document.getElementById('loading-overlay').style.display = 'none';
    }
  }

  async function exportSave(slotId) {
    const allSaves = getSavesFromStorage();
    const saveData = allSaves[slotId];
    if (!saveData) return;

    try {
      const dataToExport = {
        exportVersion: '1.0',
        exportedAt: new Date().toISOString(),
        saveData: saveData,
        lorebookData: [],
      };

      if (saveData.lorebook_entries) {
        const bookName = WorldBookManager.LOREBOOK_NAME;
        const entryNames = Object.values(saveData.lorebook_entries);
        const allEntries = await TavernHelper.getWorldbook(bookName);
        dataToExport.lorebookData = allEntries.filter(e => entryNames.includes(e.name));
      }

      const fileName = `${(saveData.save_name || `guixu_save_${slotId}`).replace(/[^a-z0-9]/gi, '_')}.json`;
      exportData(JSON.stringify(dataToExport, null, 2), fileName);
      await guiXuAlert('存档已成功导出！');
    } catch (error) {
      console.error('导出存档失败:', error);
      await guiXuAlert(`导出失败: ${error.message}`, '错误');
    }
  }

  async function handleFileImport(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async e => {
      try {
        const importedData = JSON.parse(e.target.result);
        let saveDataToImport;
        let lorebookDataToImport = [];

        if (importedData.exportVersion === '1.0') {
          // New format
          saveDataToImport = importedData.saveData;
          lorebookDataToImport = importedData.lorebookData || [];
        } else {
          // Old format
          saveDataToImport = importedData;
        }

        if (!saveDataToImport || !saveDataToImport.timestamp || !saveDataToImport.mvu_data) {
          throw new Error('存档文件格式无效。');
        }

        const slotId = await promptForSlotSelection(saveDataToImport.save_name || '导入的存档');
        if (!slotId) return;

        const allSaves = getSavesFromStorage();
        const bookName = WorldBookManager.LOREBOOK_NAME;

        // Handle lorebook entries
        if (lorebookDataToImport.length > 0) {
          await TavernHelper.updateWorldbookWith(bookName, worldbook => {
            const existingNames = new Set(worldbook.map(e => e.name));
            lorebookDataToImport.forEach(entry => {
              if (!existingNames.has(entry.name)) {
                const { uid, ...newEntry } = entry;
                worldbook.push(newEntry);
              }
            });
            return worldbook;
          });
        }

        allSaves[slotId] = saveDataToImport;
        localStorage.setItem('guixu_multi_save_data', JSON.stringify(allSaves));
        await guiXuAlert(`存档已成功导入到 ${slotId.replace('slot_', '存档位 ')}。`);
        showSaveLoadManager();
      } catch (error) {
        await guiXuAlert(`导入失败: ${error.message}`, '错误');
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  }

  function promptForSlotSelection(importName) {
    return new Promise(resolve => {
      const modal = document.createElement('div');
      modal.className = 'modal-overlay';
      modal.style.cssText = 'display: flex; z-index: 2001;';
      let slotsHtml = '';
      for (let i = 1; i <= 5; i++)
        slotsHtml += `<button class="theme-btn theme-btn-gold" data-slot-id="slot_${i}">存档位 ${i}</button>`;
      modal.innerHTML = `
              <div class="modal-content" style="width: 450px; height: auto;">
                <h2 class="modal-title">选择导入位置</h2>
                <div class="modal-body" style="padding: 20px;">
                  <p>请选择一个存档位以导入 "${importName}":</p>
                  <div style="display: flex; justify-content: center; gap: 10px; flex-wrap: wrap; margin-top:20px;">${slotsHtml}</div>
                  <div class="modal-actions"><button class="theme-btn theme-btn-red" id="import-cancel-btn">取消</button></div>
                </div>
              </div>`;
      document.body.appendChild(modal);
      modal.addEventListener('click', e => {
        const target = e.target;
        if (target.dataset.slotId) {
          resolve(target.dataset.slotId);
          modal.remove();
        } else if (target.id === 'import-cancel-btn' || target === modal) {
          resolve(null);
          modal.remove();
        }
      });
    });
  }

  function setupSaveManagerEventListeners() {
    document.getElementById('show-save-manager-btn').addEventListener('click', showSaveLoadManager);
    const modal = document.getElementById('save-load-modal');
    if (!modal) return;
    modal.addEventListener('click', e => {
      const button = e.target.closest('[data-action]');
      if (e.target.matches('.modal-overlay')) modal.style.display = 'none';
      if (!button) return;
      const action = button.dataset.action;
      const slotId = button.closest('.save-slot')?.dataset.slotId;
      switch (action) {
        case 'close-modal':
          modal.style.display = 'none';
          break;
        case 'load-slot':
          if (slotId) loadGame(slotId);
          break;
        case 'export-slot':
          if (slotId) exportSave(slotId);
          break;
        case 'delete-slot':
          if (slotId) deleteSave(slotId);
          break;
        case 'import-save':
          document.getElementById('import-save-file-input').click();
          break;
        case 'clear-all-saves':
          clearAllSaves();
          break;
      }
    });
    document.getElementById('import-save-file-input').addEventListener('change', handleFileImport);
  }
  // --- END OF SAVE/LOAD MANAGER LOGIC ---

  // --- START OF SNAPSHOT CLEANUP MANAGER ---
  async function showSnapshotManager() {
    const modal = document.getElementById('snapshot-manager-modal');
    const loadingOverlay = document.getElementById('loading-overlay');
    loadingOverlay.style.display = 'flex';

    try {
      const allEntries = await TavernHelper.getWorldbook(WorldBookManager.LOREBOOK_NAME);

      // 定义快照的正则表达式
      const gameProcessRegex = /^(本世历程|往世涟漪)(\(\d+\))?$/;
      const nonGameProcessRegex = /^(.+[:-]\s*)?小说模式(\(\d+\))?$/;

      const gameProcessSnapshots = [];
      const nonGameProcessSnapshots = [];

      allEntries.forEach(entry => {
        const name = entry.name.trim();
        if (gameProcessRegex.test(name)) {
          gameProcessSnapshots.push(entry);
        } else if (nonGameProcessRegex.test(name)) {
          nonGameProcessSnapshots.push(entry);
        }
      });

      const renderList = snapshots => {
        if (snapshots.length === 0) return '<div class="loading-placeholder">无匹配项</div>';
        return snapshots
          .map(
            s => `
                    <label class="snapshot-item">
                        <input type="checkbox" class="snapshot-checkbox" value="${s.uid}">
                        <span class="snapshot-item-name">${s.name}</span>
                        <span class="snapshot-item-uid">UID: ${s.uid}</span>
                    </label>
                `,
          )
          .join('');
      };

      document.getElementById('game-process-snapshot-list').innerHTML = renderList(gameProcessSnapshots);
      document.getElementById('non-game-process-snapshot-list').innerHTML = renderList(nonGameProcessSnapshots);

      modal.style.display = 'flex';
    } catch (error) {
      console.error('打开快照清理器失败:', error);
      await guiXuAlert('无法加载快照列表: ' + error.message, '错误');
    } finally {
      loadingOverlay.style.display = 'none';
    }
  }

  function setupSnapshotManagerEventListeners() {
    const modal = document.getElementById('snapshot-manager-modal');
    if (!modal) return;

    // "打开"按钮
    document.getElementById('show-snapshot-manager-btn').addEventListener('click', showSnapshotManager);

    const selectionInfo = document.getElementById('snapshot-selection-info');
    const deleteBtn = document.getElementById('delete-selected-snapshots-btn');

    // 更新选中计数和删除按钮状态
    const updateSelectionState = () => {
      const checkedBoxes = modal.querySelectorAll('.snapshot-checkbox:checked');
      const count = checkedBoxes.length;
      selectionInfo.textContent = `已选择 ${count} 项`;
      deleteBtn.disabled = count === 0;
    };

    // 事件委托处理模态框内所有点击
    modal.addEventListener('click', async e => {
      const target = e.target;

      // 关闭按钮
      if (target.closest('.modal-close-btn') || target.matches('.modal-overlay')) {
        modal.style.display = 'none';
        return;
      }

      // "全选"复选框
      if (target.matches('input[data-group]')) {
        const group = target.dataset.group;
        const listId = group === 'game-process' ? 'game-process-snapshot-list' : 'non-game-process-snapshot-list';
        const checkboxes = document.getElementById(listId).querySelectorAll('.snapshot-checkbox');
        checkboxes.forEach(box => (box.checked = target.checked));
        updateSelectionState();
        return;
      }

      // 单个条目复选框
      if (target.classList.contains('snapshot-checkbox')) {
        updateSelectionState();
        return;
      }

      // "删除"按钮
      if (target.id === 'delete-selected-snapshots-btn') {
        const checkedBoxes = modal.querySelectorAll('.snapshot-checkbox:checked');
        const uidsToDelete = Array.from(checkedBoxes).map(box => box.value);

        if (
          uidsToDelete.length > 0 &&
          (await guiXuConfirm(`确定要删除选中的 ${uidsToDelete.length} 个快照条目吗？此操作不可恢复。`, '删除确认'))
        ) {
          const loadingOverlay = document.getElementById('loading-overlay');
          loadingOverlay.style.display = 'flex';
          try {
            await WorldBookManager._saveOrUpdateWith(worldbook => {
              return worldbook.filter(entry => !uidsToDelete.includes(String(entry.uid)));
            });
            await guiXuAlert('选中的快照已成功删除。');
            modal.style.display = 'none';
          } catch (error) {
            console.error('删除快照失败:', error);
            await guiXuAlert('删除失败: ' + error.message, '错误');
          } finally {
            loadingOverlay.style.display = 'none';
          }
        }
      }
    });
  }

  // --- END OF SNAPSHOT CLEANUP MANAGER ---

  // === [PORTED] Background Settings Logic ===
  const BG_SETTINGS_KEY = 'guixu_background_settings_v2';
  const defaultBgSettings = { network: true, opacity: 0.5, blur: 0, local: false, localImage: null };
  let backgroundSettings = {};
  let bgInterval;

  function loadBackgroundSettings() {
    try {
      const saved = localStorage.getItem(BG_SETTINGS_KEY);
      backgroundSettings = saved ? { ...defaultBgSettings, ...JSON.parse(saved) } : { ...defaultBgSettings };
    } catch (e) {
      backgroundSettings = { ...defaultBgSettings };
    }
  }
  function saveBackgroundSettings() {
    localStorage.setItem(BG_SETTINGS_KEY, JSON.stringify(backgroundSettings));
  }

  function applyBackgroundSettings() {
    const startupPage = document.getElementById('startup-page');
    clearInterval(bgInterval);
    if (backgroundSettings.local && backgroundSettings.localImage) {
      startupPage.style.backgroundImage = `url(${backgroundSettings.localImage})`;
    } else if (backgroundSettings.network) {
      startBgChanger();
    } else {
      startupPage.style.backgroundImage = 'none';
    }
    startupPage.style.setProperty('--bg-overlay-color', `rgba(0, 0, 0, ${backgroundSettings.opacity})`);
    startupPage.style.setProperty('--bg-backdrop-filter', `blur(${backgroundSettings.blur}px)`);
    startupPage.style.backgroundColor =
      !backgroundSettings.local && !backgroundSettings.network ? '#0a0a14' : 'transparent';
  }

  function startBgChanger() {
    const networkBackgrounds = [
      'https://i.postimg.cc/GhbMWb4H/rgthree-compare-temp-bjhol-00011.png',
      'https://i.postimg.cc/qMQm0WKQ/rgthree-compare-temp-bjhol-00008.png',
      'https://i.postimg.cc/pVfGcmXw/rgthree-compare-temp-bjhol-00006.png',
      'https://i.postimg.cc/XY40DMb8/rgthree-compare-temp-bjhol-00003.png',
    ];
    clearInterval(bgInterval);
    const setRandomBg = () => {
      document.getElementById('startup-page').style.backgroundImage =
        `url('${networkBackgrounds[Math.floor(Math.random() * networkBackgrounds.length)]}')`;
    };
    setRandomBg();
    bgInterval = setInterval(setRandomBg, 15000);
  }

  function renderSettingsModal() {
    document.getElementById('settings-modal-body').innerHTML = `
          <div class="settings-group">
              <span class="settings-label">网络背景</span>
              <div class="settings-controls"><label class="toggle-switch"><input type="checkbox" id="network-bg-toggle"><span class="slider"></span></label></div>
          </div>
          <div class="settings-group">
              <span class="settings-label">本地壁纸</span>
              <div class="settings-controls">
                  <button id="upload-local-bg-btn" class="theme-btn theme-btn-gold btn-small">选择文件</button>
                  <label class="toggle-switch"><input type="checkbox" id="local-bg-toggle"><span class="slider"></span></label>
              </div>
          </div>
          <div>
              <div class="section-title" style="font-size: 1.1rem; text-align:left; border:none; padding-bottom: 10px;">背景效果</div>
              <div class="settings-slider-group">
                  <div class="slider-container">
                      <label for="opacity-slider">遮罩不透明度</label>
                      <input type="range" id="opacity-slider" min="0" max="1" step="0.05">
                      <span id="opacity-value" class="slider-value"></span>
                  </div>
                  <div class="slider-container">
                      <label for="blur-slider">背景模糊</label>
                      <input type="range" id="blur-slider" min="0" max="10" step="0.1">
                      <span id="blur-value" class="slider-value"></span>
                  </div>
              </div>
          </div>`;
    document.getElementById('network-bg-toggle').addEventListener('change', e => {
      backgroundSettings.network = e.target.checked;
      if (e.target.checked) backgroundSettings.local = false;
      saveAndApplyBg();
    });
    document.getElementById('local-bg-toggle').addEventListener('change', e => {
      backgroundSettings.local = e.target.checked;
      if (e.target.checked) {
        if (!backgroundSettings.localImage) {
          alert('请先选择本地壁纸。');
          backgroundSettings.local = false;
        } else {
          backgroundSettings.network = false;
        }
      }
      saveAndApplyBg();
    });
    document.getElementById('opacity-slider').addEventListener('input', e => {
      backgroundSettings.opacity = parseFloat(e.target.value);
      saveAndApplyBg();
    });
    document.getElementById('blur-slider').addEventListener('input', e => {
      backgroundSettings.blur = parseFloat(e.target.value);
      saveAndApplyBg();
    });
    document
      .getElementById('upload-local-bg-btn')
      .addEventListener('click', () => document.getElementById('local-bg-input').click());
    document.getElementById('local-bg-input').addEventListener('change', handleLocalBgUpload);
  }

  function updateSettingsUI() {
    document.getElementById('network-bg-toggle').checked = backgroundSettings.network;
    document.getElementById('local-bg-toggle').checked = backgroundSettings.local;
    document.getElementById('opacity-slider').value = backgroundSettings.opacity;
    document.getElementById('opacity-value').textContent = backgroundSettings.opacity.toFixed(2);
    document.getElementById('blur-slider').value = backgroundSettings.blur;
    document.getElementById('blur-value').textContent = `${backgroundSettings.blur.toFixed(1)}px`;
  }

  function saveAndApplyBg() {
    saveBackgroundSettings();
    applyBackgroundSettings();
    updateSettingsUI();
  }

  function handleLocalBgUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = event => {
      backgroundSettings.localImage = event.target.result;
      backgroundSettings.local = true;
      backgroundSettings.network = false;
      saveAndApplyBg();
    };
    reader.readAsDataURL(file);
  }

  // --- 归墟Plus 读写序号控制 ---
  function setupUnifiedIndexControls() {
    const unifiedIndexInput = document.getElementById('unified-index-input');
    const autoToggleCheckbox = document.getElementById('auto-toggle-lorebook-checkbox');
    const incrementBtn = document.getElementById('index-increment-btn');
    const decrementBtn = document.getElementById('index-decrement-btn');

    if (!unifiedIndexInput || !autoToggleCheckbox || !incrementBtn || !decrementBtn) return;

    const state = { unifiedIndex: 1, isAutoToggleEnabled: false };

    function updateStepperButtons() {
      const currentValue = parseInt(unifiedIndexInput.value, 10);
      decrementBtn.disabled = currentValue <= 1;
    }

    async function updateAutoToggledEntries(andDisableAll = false) {
      if (typeof TavernHelper === 'undefined' || typeof TavernHelper.updateWorldbookWith === 'undefined') return;
      const bookName = LOREBOOK_NAME;
      const index = state.unifiedIndex;

      const entryTypes = ['本世历程', '往世涟漪', '分段正文', '小总结', '大总结'];

      try {
        await TavernHelper.updateWorldbookWith(bookName, allEntries => {
          const entriesToCreate = [];

          for (const type of entryTypes) {
            const currentKey = index > 1 ? `${type}(${index})` : type;
            if (!allEntries.find(e => e.name === currentKey)) {
              const base = allEntries.find(e => e.name === type);
              if (base) {
                entriesToCreate.push({
                  ...base,
                  uid: undefined,
                  name: currentKey,
                  content: '',
                  strategy: { ...base.strategy, keys: [...(base.strategy?.keys || []), currentKey] },
                  enabled: true,
                });
              }
            }
          }
          allEntries.push(...entriesToCreate);

          for (const entry of allEntries) {
            const entryBaseType = entryTypes.find(type => entry.name.startsWith(type));
            if (!entryBaseType) continue;

            const currentKeyForType = index > 1 ? `${entryBaseType}(${index})` : entryBaseType;
            const isTarget = entry.name === currentKeyForType;
            const shouldBeEnabled = isTarget && !andDisableAll && state.isAutoToggleEnabled;

            if (entry.enabled !== shouldBeEnabled) {
              entry.enabled = shouldBeEnabled;
            }
          }
          return allEntries;
        });
      } catch (error) {
        console.error('[归墟] 更新世界书条目状态时出错:', error);
      }
    }

    function saveState() {
      try {
        localStorage.setItem('guixu_unified_index', state.unifiedIndex);
        localStorage.setItem('guixu_auto_toggle_enabled', state.isAutoToggleEnabled);
      } catch (e) {
        console.error('保存状态失败:', e);
      }
    }

    function loadState() {
      try {
        state.unifiedIndex = parseInt(localStorage.getItem('guixu_unified_index'), 10) || 1;
        unifiedIndexInput.value = state.unifiedIndex;
        state.isAutoToggleEnabled = localStorage.getItem('guixu_auto_toggle_enabled') === 'true';
        autoToggleCheckbox.checked = state.isAutoToggleEnabled;
        updateStepperButtons();
      } catch (e) {
        console.error('加载状态失败:', e);
      }
    }

    loadState();
    unifiedIndexInput.addEventListener('change', e => {
      const newIndex = parseInt(e.target.value, 10);
      if (!isNaN(newIndex) && newIndex > 0) {
        state.unifiedIndex = newIndex;
        saveState();
        if (state.isAutoToggleEnabled) updateAutoToggledEntries();
      } else {
        e.target.value = state.unifiedIndex;
      }
      updateStepperButtons();
    });
    autoToggleCheckbox.addEventListener('change', e => {
      state.isAutoToggleEnabled = e.target.checked;
      saveState();
      updateAutoToggledEntries(!state.isAutoToggleEnabled);
    });

    incrementBtn.addEventListener('click', () => {
      const currentValue = parseInt(unifiedIndexInput.value, 10);
      unifiedIndexInput.value = isNaN(currentValue) ? 1 : currentValue + 1;
      unifiedIndexInput.dispatchEvent(new Event('change'));
    });

    decrementBtn.addEventListener('click', () => {
      const currentValue = parseInt(unifiedIndexInput.value, 10);
      if (!isNaN(currentValue) && currentValue > 1) {
        unifiedIndexInput.value = currentValue - 1;
        unifiedIndexInput.dispatchEvent(new Event('change'));
      }
    });
  }

  // --- Quick Start Functions ---
  const QUICK_START_KEY = 'guixu_quick_start_templates';

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
