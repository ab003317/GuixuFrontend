// --- 快速开始管理器 ---
// 本文件负责处理“快速开始”功能, 允许用户保存和使用开局prompt模板.
//
// 功能函数:
// - getQuickStartTemplates(): 从localStorage获取已保存的模板.
// - saveQuickStartTemplate(name, prompt): 保存一个新的模板.
// - renderQuickStartList(): 渲染快速开始模板列表界面.
// - startWithQuickStart(templateName): 使用指定的模板开始游戏.
// - deleteQuickStartTemplate(templateName): 删除一个模板.
//
// 加载顺序:
// - 本文件应在 ui.js 和主事件监听器设置之后加载.

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
