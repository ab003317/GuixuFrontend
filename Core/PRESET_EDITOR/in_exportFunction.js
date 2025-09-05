//---------------------------------------- 导出系列包 ----------------------------------------------

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
    const seriesEntries = allEntries.filter(entry => entry.name.includes(authorTag) && entry.name.includes(seriesTag));

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

//---------------------------------------- 导入系列包 ----------------------------------------------

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


//---------------------------------------- 处理导入文件 -----------------------------------------------------
//作为文件导入的统一网关，它尝试解析用户上传的文件内容，并自动判断其数据类型和格式，然后分发给不同的、更专门的导入函数去处理。
// 如果解析失败，则尝试使用自定义文本导入功能。(importCustomTextData())

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
    } else {
      await guiXuConfirm('文件看起来像一个旧版的单独预设，是否要导入它？');
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

//当标准的JSON导入失败时，此函数会尝试解析一种特定的、人类可读的文本格式，------------------------------------------------
// 并将其中的天赋、背景、预设数据批量导入到世界书中。

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

//------------------------------------------ 显示批量导入模态框 ------------------------------------------

function showBatchImportModal(type) {
  const modal = document.getElementById('batch-import-modal');
  document.getElementById('batch-import-type').value = type;
  document.getElementById('batch-import-title').textContent = `批量导入${type === 'talent' ? '天赋' : '背景'}`;
  document.getElementById('batch-import-content').value = '';
  modal.style.display = 'flex';
}

//------------------------------------------ 处理批量导入 ------------------------------------------
//处理批量导入的逻辑，包括解析导入内容、保存导入数据、显示导入结果等。

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



//在浏览器中动态生成一个文件（通常是JSON文件）并触发其下载，将数据保存到用户的本地电脑上。------------------------------------

function exportData(dataStr, fileName) {
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([dataStr], { type: 'application/json' }));
  link.download = fileName;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 100);
}

