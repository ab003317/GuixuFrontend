
// --- 世界书快照清理器 ---
// 本文件提供了一个用于管理和批量删除世界书中由存档产生的快照条目的工具.
//
// 功能函数:
// - showSnapshotManager(): 显示快照管理器模态框, 并列出所有可清理的快照条目.
// - setupSnapshotManagerEventListeners(): 为快照管理器界面的按钮和复选框绑定事件.
//
// 加载顺序:
// - 本文件应在 ui.js 和 worldbookManager.js 之后加载.

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
