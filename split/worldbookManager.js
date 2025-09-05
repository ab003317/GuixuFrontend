
// --- 世界书数据管理器 ---
// 本文件负责处理与"归墟"世界书相关的所有数据操作, 包括加载、解析、分类和生成条目.
//
// 功能函数:
// - WorldBookManager.parseCommentTitle(comment): 解析世界书条目的标题, 提取类型、系列、名称等信息.
// - WorldBookManager.generateCommentTitle(type, name, author, series): 根据信息生成标准格式的条目标题.
// - WorldBookManager.loadAllData(): 异步加载并解析世界书中的所有条目, 将它们分类为天赋、背景、预设等.
//
// 依赖:
// - YAMLParser: 用于解析条目内容中的YAML数据.
// - LOREBOOK_NAME (from config.js): 指定要操作的世界书名称.
//
// 加载顺序:
// - 本文件应在 yamlParser.js 之后加载.

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
