//YAML解析器(用于解析预设世界书的YAML格式数据)
//将 YAML 字符串解析成 JavaScript 对象。
//将 JavaScript 对象转换回 YAML 字符串。
//（内部方法）将字符串值转换为其可能的数据类型（数字、布尔值或保持字符串）。

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
      let lastKeyInParent = stack[stack.length - 1].lastKey;

      if (trimmed.startsWith('- ')) {
        const value = trimmed.substring(2).trim();
        if (lastKeyInParent && Array.isArray(parent[lastKeyInParent])) {
          parent[lastKeyInParent].push(this._parseValue(value));
        }
      } else {
        const colonIndex = trimmed.indexOf(':');
        if (colonIndex > -1) {
          const key = trimmed.substring(0, colonIndex).trim();
          let value = trimmed.substring(colonIndex + 1).trim();

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



//世界书数据管理器(为了实现编辑器功能，专门编写的，用于管理世界书数据)-----------------------------------------
//完整地实现了数据的增（Create）、查（Read）、改（Update）、删（Delete） 功能。

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



//--------------------------------------系列管理器(用于管理预设世界书的系列数据)------------------------------------------------------

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

//负责从“世界书”中获取所有数据，初始化编辑器状态，并在必要时引导用户初始化数据。----------------------

async function loadEditorData() {
  if (editorData.isLoading) return true;
  editorData.isLoading = true;
  document.getElementById('loading-overlay').style.display = 'flex';

  try {
    const loadingPlaceholder = `<div class="loading-placeholder">正在从世界书加载数据...</div>`;
    ['talent-list-container', 'background-list-container', 'preset-list-container', 'worldbook-list-container'].forEach(
      id => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = loadingPlaceholder;
      },
    );

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


//实现延迟自动保存，防止因用户频繁操作（如快速输入）而导致的过度、不必要的保存请求。
//当一个事件被连续频繁触发时，函数不会立即执行，而是在事件停止触发后等待一段指定的时间，只执行最后一次。
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



