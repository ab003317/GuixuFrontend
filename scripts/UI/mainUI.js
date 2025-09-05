//---------------------------------------------------加载背景设置。----------------------------------------------
function loadBackgroundSettings() {
  try {
    const saved = localStorage.getItem(BG_SETTINGS_KEY);
    backgroundSettings = saved ? { ...defaultBgSettings, ...JSON.parse(saved) } : { ...defaultBgSettings };
  } catch (e) {
    backgroundSettings = { ...defaultBgSettings };
  }
}

//---------------------------------------------------保存背景设置。----------------------------------------------
function saveBackgroundSettings() {
  localStorage.setItem(BG_SETTINGS_KEY, JSON.stringify(backgroundSettings));
}

//---------------------------------------------------应用背景设置。----------------------------------------------
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

//---------------------------------------------------启动背景更换器。----------------------------------------------
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

//---------------------------------------------------渲染设置模态框。----------------------------------------------

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

//---------------------------------------------------更新设置UI。----------------------------------------------

function updateSettingsUI() {
  document.getElementById('network-bg-toggle').checked = backgroundSettings.network;
  document.getElementById('local-bg-toggle').checked = backgroundSettings.local;
  document.getElementById('opacity-slider').value = backgroundSettings.opacity;
  document.getElementById('opacity-value').textContent = backgroundSettings.opacity.toFixed(2);
  document.getElementById('blur-slider').value = backgroundSettings.blur;
  document.getElementById('blur-value').textContent = `${backgroundSettings.blur.toFixed(1)}px`;
}

//---------------------------------------------------保存并应用背景设置。----------------------------------------------

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
// ---------------------------------------- Background PART END ------------------------------------------------


//------------------------------ 一个高质量、可复用的UI组件(显示标题、内容、输入框和自定义按钮。) --------------------------------

// 此函数在guixuAlert、guiXuConfirm、guiXuPrompt、guiXuPromptEditable中被调用
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
//使用了showCustomModal的函数
async function guiXuAlert(content, title = '提示') {
  await showCustomModal({
    title: title,
    content: content,
    buttons: [{ text: '确定', value: true, class: 'btn-primary' }],
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

//------------ 显示保存状态(在屏幕右下角创建一个会自动淡入和淡出的临时提示框，用来向用户显示操作结果（如成功、失败或普通信息）。) --------------------------------

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



//控制应用中不同主要页面（视图）的显示和隐藏，实现单页面应用（SPA）式的页面切换效果。-----------------------------------------

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
