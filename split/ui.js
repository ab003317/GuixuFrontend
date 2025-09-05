
// --- UI 交互组件 ---
// 本文件包含所有用于生成用户交互界面(UI)的函数, 例如模态框、提示框和状态显示.
//
// 功能函数:
// - showCustomModal(options): 创建并显示一个可高度自定义的模态框, 返回一个Promise.
// - guiXuAlert(content, title): 显示一个简单的警告框.
// - guiXuConfirm(content, title): 显示一个确认框, 返回布尔值.
// - guiXuPrompt(content, defaultValue, title): 显示一个带输入框的提示框, 返回输入值或null.
// - guiXuPromptEditable(content, defaultValue, title, mode): 显示一个带可编辑文本域的复杂提示框.
// - showSaveStatus(message, isSuccess, isError): 在右下角显示一个保存状态的提示信息.
//
// 加载顺序:
// - 本文件应在核心逻辑之后、在任何调用这些UI函数的主程序之前加载.

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
