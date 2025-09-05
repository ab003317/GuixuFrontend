

//TalentBackgroundEditor function Start Here -----------------------------------------------------------------------------------------------------------

//当用户在模态框中点击“保存”后，此函数负责收集表单数据、进行验证、检查重名，并最终通过 WorldBookManager 将数据保存到世界书。
//保存天赋或背景数据
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


//控制一个通用的编辑/添加表单模态框的显示和内容填充。--------------------------------------------------------------------
// 它可以根据传入的参数，智能地切换为“添加新项目”或“编辑已有项目”模式，并自动填充相应的表单数据。
//显示天赋或背景编辑器模态框
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


//隐藏模态框---------------------------------------------------------------------------

function hideModal() {
  modal.style.display = 'none';
}
