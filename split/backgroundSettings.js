
// --- 背景设置管理器 ---
// 本文件负责处理启动页面的背景图片、效果(模糊、遮罩)等相关设置的加载、保存和应用.
//
// 功能函数:
// - loadBackgroundSettings(): 从localStorage加载背景设置.
// - saveBackgroundSettings(): 将当前背景设置保存到localStorage.
// - applyBackgroundSettings(): 将当前设置应用到页面背景上.
// - renderSettingsModal(): 渲染设置模态框中的UI控件.
// - setupUnifiedIndexControls(): 为背景设置相关的UI控件绑定事件.
//
// 加载顺序:
// - 本文件应在主UI渲染逻辑之后、在调用 applyBackgroundSettings 之前加载.

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
      }
      else {
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
