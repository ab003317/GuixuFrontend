//执行一个危险操作——清空世界书中所有用户创建的天赋和背景，然后重新导入默认数据包。相当于将编辑器的天赋和背景部分“恢复出厂设置”。

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



// 弹出一个模态框（Modal），询问用户是否要导入默认数据。根据用户的选择（“立即导入”或“稍后再说”），执行相应的操作并返回一个结果。
async function promptForDefaultImport() {
  return new Promise(resolve => {
    const modal = document.getElementById('default-import-modal'); //这个在index.html中,再由css渲染
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


// 将一个预设的默认数据包（DEFAULT_EDITOR_DATA）中的天赋、背景和预设批量导入到世界书（Worldbook）中。

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
