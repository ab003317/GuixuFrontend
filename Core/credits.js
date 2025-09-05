(function() {
    'use strict';

    const contentCredits = `
**【大家好，这里是梦星，这是我的第15张卡，也是我目前花费精力最大的一张卡】**

**【感谢您的游玩，希望能多些反馈或者游玩截图，您的点赞和评论是我创造的最大动力】**

**【归墟应该就是我的封笔作了，所以精益求精，打磨了很久，非常抱歉，但还是希望给大家留下一个好印象，或者说，一个很棒的梦星大人 】**

**【祝大家玩的开心！】**


**【必备前置：酒馆助手 】**

**【遇到问题怎么办？帖子标注——kk的游玩攻略及其问题排查 ——排查不行——看标注，查找相同问题/搜索关键词——还不行，带上详细截图（完整的正文和最后的变量更新，api端口，酒馆助手，正则列表截图）提问】**

**【1.禁止二传！！！！，允许二创】**

**【2.禁止一切商业化用途，本卡只在discord社区类脑/旅程免费无偿发布，请不要成为它人的韭菜】**

**【3.本卡前端允许二改/借鉴/修改/学习，二改/直接使用需要询问，借鉴和摘抄结构需要发布时带上帖子链接以及@梦星标明来源 。之后有时间我也会写一篇mvu+同层游玩相关的教程，以及各种前端运用的思路和技巧，感谢大家支持和游玩，梦星再次拜谢】**


### 最新感谢名单（排名不分先后）
### ✋ 😭 🤚   赞美孑孓！
赞美孑孓帮忙修复开局前端以及大量更新优化
### ✋ 😭 🤚  孑孓大人，我们敬爱你口牙！
### ✋ 😭 🤚  孑孓大人，我们敬爱你口牙！
### ✋ 😭 🤚  孑孓大人，我们敬爱你口牙！

——————
### ✋ 😭 🤚   赞美夜幕！
### ✋ 😭 🤚   赞美起物！
### ✋ 😭 🤚   赞美gydg！
超绝黑奴（不是
———————
### 感谢Serafim帮忙测试新版本和排查bug
### 感谢Stone，缝了点拼好卡设定
### 感谢拼好卡相关设定的作者
———————

### 最后欢迎大家加入梦星的归墟小团体
里面有归墟相关二创、投稿、扩展、预设等内容，也欢迎大家来讨论，目前归墟的境界打算重构，希望大家可以给出一些建议，感谢！

### [归墟小团体](https://discord.gg/epymFhrfHe)

    `;
    const contentEditor = `
### 归墟使用教程

#### 1. 天赋背景编辑器
1.  进入开局选择发现没有天赋背景？
- 主页——天赋背景编辑器——重置编辑器
- 
2.  新增200+天赋背景，请务必重置编辑器后即可使用
- 其中很多并非来自梦星，而是其他积极参与建设的创作者，但因为时间久远，且过于杂乱，根本无法统计，又因为格式需要，因此打上了梦星的名字，在这里说一声抱歉，如果您发现其中的天赋/背景是您的创意，请联系梦星，我立刻修改，在这里再次说一声抱歉

#### 2. 选择开局方式
1.  进入选择开局方式后，你只能看到你选中的预设下的系列天赋和背景以及无归属的通用天赋与背景。
- 这避免了导入太多预设导致天赋堆成屎山的问题。

2.  选择预设后
- 会自动开启选择的预设所设置好的系列同名前缀【世界书】
- 并自动关闭其他预设相关的【世界书】，避免多个预设的世界书同时开启而忘记关闭，造成污染。

### 3.抽卡开启，可以选择抽卡/商店购买相关天赋

#### 4. 世界书编辑器
1.  可以自由创建和编辑所选择预设的系列世界书以及普通世界书的条目。
2.  可以分类筛选和查询天赋、背景、预设世界书。

#### 5. 预设编辑器
1.  在预设编辑器下的系列内容栏可以查看你所选择的预设下的所有专属天赋、背景、世界书扩展。
2.  可以通过编辑器勾选天赋为可选（开局自动勾选）或必选（开局强制勾选）。
3.  导出预设时，会抓取并打包所有与预设同系列、同作者前缀的世界书条目。
4.  所有设置了系列专属的天赋、背景，只有绑定了该系列的预设才能选择。没有设置系列归属的天赋、背景，不受此限制。


### 常见疑问：
1.开局是三个点怎么办？

酒馆信息右上角——编辑（小铅笔）——点开再关闭即可

2.太难了怎么办
- 替换文风，本次更新给出了4个文风，切换简单版本即可
- 关闭合理性审查
- 关闭高难cot，打开爽文cot
- 闭眼享受




### 归墟创意工坊（首创思路）

### 目前归墟的世界书基础功能全开的情况下，已经压到10400token，且世界书结构清晰，划分明确，非常适合二创/使用编辑器换不同玩法

### 本编辑器提供了丰富的接口和可扩展性，可以大规模支持二创

### 您可以来归墟小团体，链接：[归墟小团体](https://discord.gg/epymFhrfHe)分享或者获取有趣的相关设定/或者超绝瑟瑟设定

### 希望大家能够积极参与分享！！
## 感谢您的参与，梦星感激不尽！

    `;
    const contentVersion = `
### 本次更新
### 归墟4.3版本
【秋梧坠寒影，孤鹤唳霜铭】
——————————
# 归墟4.3更新
# 一.界面彻底全自定义
## 1.背景图自定义
- 支持本地上传
- 图库外链
  - 批量导入
  - 统一管理
  - 每次回复随机显示一张
  - 固定一张
## 2.窗口界面大小自定义
## 3.文字自定义
- 正文、对话、景物描写、心理活动颜色自定义
- 字体大小自定义
- 字体自定义，支持上传字体文件
## 4.背景透明度自定义
- 调低——背景清晰，大图高清享受
- 调高——文学清晰，眼睛友好
# 二.界面ui高度精简优化
## 1.核心属性优化，删去了生理、心理年龄
- 精炼优化界面，整洁干净
- 去除重复，改到归墟空间中查看年龄
- 低重要数值避免占据主界面
## 2.境界、修为进度、境界映射、突破瓶颈统一整合到左侧、核心属性下方
- 去除了没用的角色详情
- 一目了然，直观简练
## 3.界面高度精炼
- 10个按钮变为6个，逻辑层次鲜明
  - 删去了亲密关系
  - 删去了角色详情
  - 统合了指令中心、地图、查看提取内容为设置
- 全屏/切换手机端/调整窗口大小统合进设置，精简主界面内容
- 当前指令按钮删除
- 输入框移到中间，优化输入框界面布局
  - 回车发送统合到设置
- 两侧面板支持折叠展开
- 装备栏滑动条隐形，视觉效果优化
## 4.手机端界面优化
- 优化面板布局，正文占比95%
- 装备/面板变为小按钮，可拖拽，点击即展开
# 三.变量重构
## 1.变量结构彻底优化
### > 不采用单扩展结构，采取单键扩展，整体结构清晰，层次鲜明
-
- **彻底杜绝杂灵根底层逻辑**
- **彻底杜绝ai生成重复物品**
 - **彻底杜绝ai下标计算错误导致人物历程写错**
### > 变量与描述分离
- token大幅度压缩，3700变为670
- 全操作范例参考，大幅降低格式错误
- 描述不占据d1，避免因为数值和描述分散注意力
- 结构层次优化，干净清晰，列表结构统一
- 避免史山变量结构，可扩展和二次开发便捷度大幅度提升
## 2.增强变量回顾与反思
- variable结构优化
- cot变量思考层次优化
- 增加变量回顾反思，让哈基米自己纠错
## 3.变量更新提醒
### 正文下增加变量改变折叠框，中文转义mvu语法
  - set、add、assign、remove全兼容
 - 显示 设置 xx ，xx物品被添加进xx，xx数值增加等直观显示
 - 清晰可感，操作简化
 - 流式时自动隐藏
## 4.增加mvu变量全显示
### 直观感受整个变量结构
- 便于排查错误
- 方便优化纠正
## 5.人物变量优化
- 增加外貌、性格、身份信息
- 人物增加四维属性
- 过往交集结构优化
- 过往交集数量优化，精炼token
## 双重组合拳杜绝ai错填
# 四.人物关系界面优化
## 1.亲密人物和人物关系整合
- 分为亲密人物和全部人物
- 点三下增加亲密标注，操作简单，避免ui占据人物信息
## 2.增加人物排序功能
- 支持五种排序方式，好感度高低、修为高低等
- 避免低层级npc占眼
- 系统健全性提升，与亲密关系互补
## 3.人物界面信息完善
- 增加人物信息描述详情
- 过往交集详情
- 人物界面直观角色四维显示
# 五.本世历程/往世涟漪优化
## 1.增加修剪控制台
- 标签、地点、人物、重要信息、伏笔、自动化系统修剪
- 标签可自由勾选
- 可选保留最近几层修剪
- 增加彻底删除
- 支持自选单个/多个事件历程修剪
- 系统健全性高，自由度高
## 2.往世涟漪格式优化，界面优化
- 格式兼容性增强，避免哈气格式错误
- 增加颜色，层次鲜明
- 剪切本世历程
- 扔给ai总结
- 复制到手动总结
从复杂性和必要性角度权衡，属实是没必要单加个总结模块
# 六.彻底杜绝掉前端
## 1.格式审查优化
- 可以看到什么标签掉了/没有闭合
- 大掉格式回退到上文
- 小掉格式打开小铅笔补全即可
- 自动补全标签，前端焊死
# 即便空回，照样前端焊死不掉，回档即可
————
# 开局前端修改
## 1.加入快速开始
- 允许在正常创建流程时保存发送的提示词
- 允许点击保存的提示词快速开始
- 可以自由创建/编辑提示词
## 2.加入提示词预览
- 可以直观看到发送的提示词
- 可以手动修改
- 可以保存不用反复开局，避免截断导致反复繁琐重开
## 3.清除缓存窗口静默
## 4.初步修改开始的文档介绍
## 5.初始加入234个天赋出生
# 6.感恩孑孓大人打好的底子以及修复开局前端导致的变量bug


# 加入抽卡功能+品阶染色+提示词预览+快速开始+批量导入天赋/出生

# 世界书极致优化压缩
## 全卡基础功能全开仅10400token



——————————

### 归墟5.x（完结）版本介绍
### 一. 手机UI再度大幅度优化
*   全屏UI布局调整
*   手机横屏输入法占比太大？——**悬浮输入框，超绝体验**
*   格式审查再度优化，一键无缝无感回退，输入保存，截断仅仅只需要点一次发送

### 二. 整体布局调整
*   功能一多？做减求空，去除繁杂布局，只留干净整洁的按钮和界面
*   思维链样式修改，半透明横幅，支持Markdown语法
*   变量修改可视化，中文转义MVU语法
*   整体界面按钮极度简化
*   属性布局优化
*   小说模式，本世历程写入，行动选项显示，行动选项缓存，格式审查开关全部移到设置
*   大部分功能集成设置
*   二级窗口丝滑退出逻辑

> ### 然，不止于此

### 三. 世界书管理
*   关键词搜索
*   前缀搜索
*   本世历程/往世涟漪搜索
*   批量删除/开启/关闭
*   单个删除/开启/关闭
*   **手机端横屏世界书UI顶尖适配**
    *   按钮完美布局
    *   界面高度适配
    *   全屏都是内容显示
    *   恍如游戏既视感

> ## 仅此而已？
> # 请，且听风吟！

### 四. 世界书预设！
*   行动选项/无行动一键切换，只需要点一下！
*   合理性审查/高难合理性审查/媚user一键切换！
*   神桥叙事/非神桥叙事，一键切换！
*   **支持世界书预设导入/导出！**
*   一键控制条目开/关，批量开启/关闭/删除！

> # 且，不止于此！
> *   不同境界开启/关闭不同批次世界书
> *   配合开局前端预设实现真正自定义/分阶段/分境界/分世界观/分cot/分模式世界书
> *   无需提示词模板
> *   世界链条，变迁等等
> ## 全部，一键即可！

### 五. 真正意义上的无缝读档重roll
*   **以往的读档:** 刷新界面，退出全屏，读档，破坏沉浸感
*   **现在的读档:** **一键即可！** 全程无缝读档，全程全屏实现，绝不退出，0.1秒一闪即读档

> ## 但，这些组合起来代表什么？

### 六. 顶尖沉浸式体验
> ### 功能好写，细节难磨
> 真正影响体验的，往往是不起眼的地方:一次返回，一次关闭，一个圆角，一个时序，一个大小
> ### 但:
> *   **所有细节打磨极致！**
> *   **全部不便充分考虑！**
> *   **一切布局全部适配！**
> # 便是:
> ## 全过程全屏幕全操作全方位全沉浸式游玩！！！

### 真正实现:
*   输入沉浸式
*   发送沉浸式
*   缓存沉浸式
*   读档沉浸式
*   存档沉浸式
*   掉格式/截断丝滑回退沉浸式
*   前端焊死沉浸式
*   世界书开/关沉浸式
*   模式切换沉浸式
*   快捷键沉浸式
*   全屏沉浸式
*   流式沉浸式
*   极简UI沉浸式
*   面板折叠最大化正文沉浸式
*   重roll沉浸式
*   写入沉浸式
*   全篇上下文阅读沉浸式
*   思维链显示沉浸式
*   变量改变沉浸式
*   行动选项点击沉浸式
*   回车发送沉浸式
*   大小总结沉浸式
*   修剪世界书沉浸式
*   背景图自定义沉浸式
*   透明度自定义沉浸式
*   字体自定义沉浸式
*   颜色自定义沉浸式
*   窗口/二级窗口大小全部自定义沉浸式
*   **打造绝对顶尖沉浸式游玩体验！**

[归墟小团体](https://discord.gg/epymFhrfHe)

    `;

    document.addEventListener('DOMContentLoaded', () => {
      const ABOUT_READ_KEY = 'guixu_has_read_about';
      const COUNTDOWN_SECONDS = 120;
      
      const VALID_CODES = [
        '孑孓大人太厉害了!!!',
        '梦星大人太会摸鱼了!!!'
      ];

      const aboutBtn = document.getElementById('about-guixu-btn');
      const aboutModal = document.getElementById('about-guixu-modal');
      const readBtn = document.getElementById('about-read-btn');
      const countdownTimerEl = document.getElementById('about-countdown-timer');
      const tabContainer = aboutModal.querySelector('.about-tabs');
      const contentPanes = aboutModal.querySelectorAll('.about-tab-content');
      const redemptionContainer = document.getElementById('redemption-container');
      const redemptionInput = document.getElementById('redemption-code-input');
      const redemptionBtn = document.getElementById('redemption-code-btn');

      function normalizeString(str) {
        if (!str) return '';
        return str.replace(/！/g, '!');
      }

      function renderMarkdown(rawText) {
        if (typeof marked === 'undefined') {
          console.error('Markdown parser (marked.js) not loaded.');
          return rawText.replace(/\n/g, '<br>');
        }
        const renderer = new marked.Renderer();
        const defaultLinkRenderer = renderer.link;
        renderer.link = (href, title, text) => {
            const html = defaultLinkRenderer.call(renderer, href, title, text);
            return html.replace(/^<a /, '<a target="_blank" rel="noopener noreferrer" ');
        };
        return marked.parse(rawText, { renderer: renderer, gfm: true, breaks: true });
      }

      document.querySelector('[data-tab-content="credits"]').innerHTML = renderMarkdown(contentCredits);
      document.querySelector('[data-tab-content="editor-guide"]').innerHTML = renderMarkdown(contentEditor);
      document.querySelector('[data-tab-content="version-info"]').innerHTML = renderMarkdown(contentVersion);

      let countdownInterval;

      const bypassCountdown = () => {
        clearInterval(countdownInterval);
        countdownTimerEl.style.display = 'none';
        readBtn.disabled = false;
      };

      const startCountdown = () => {
        let timeLeft = COUNTDOWN_SECONDS;
        readBtn.disabled = true;
        readBtn.textContent = '已阅读';
        countdownTimerEl.style.display = 'block';
        countdownTimerEl.textContent = `请等待 ${timeLeft} 秒...`;

        countdownInterval = setInterval(() => {
          timeLeft--;
          countdownTimerEl.textContent = `请等待 ${timeLeft} 秒...`;
          if (timeLeft <= 0) {
            bypassCountdown();
          }
        }, 1000);
      };

      const showAboutModal = (isForced = false) => {
        aboutModal.style.display = 'flex';
        clearInterval(countdownInterval);
        redemptionContainer.classList.remove('visible');

        if (isForced) {
          startCountdown();
        } else {
          readBtn.disabled = false;
          readBtn.textContent = '关闭';
          countdownTimerEl.style.display = 'none';
        }
      };

      const hideAboutModal = () => {
        aboutModal.style.display = 'none';
        clearInterval(countdownInterval);
      };
      
      const handleScroll = (event) => {
        const el = event.target;
        if (el.scrollTop + el.clientHeight >= el.scrollHeight - 5) {
          redemptionContainer.classList.add('visible');
        }
      };

      contentPanes.forEach(pane => {
        pane.addEventListener('scroll', handleScroll);
      });

      // --- 兑换逻辑（无加密版） ---
      const handleRedemption = () => {
        const userInput = redemptionInput.value.trim();
        if (!userInput) return;

        const normalizedInput = normalizeString(userInput);
        
        // ★★★ 关键修改：直接比较标准化后的字符串 ★★★
        if (VALID_CODES.includes(normalizedInput)) {
          alert('兑换成功！已为您跳过等待。');
          bypassCountdown();
          redemptionContainer.classList.remove('visible');
        } else {
          alert('兑换码无效！');
          redemptionInput.value = '';
        }
      };

      redemptionBtn.addEventListener('click', handleRedemption);
      redemptionInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
          handleRedemption();
        }
      });
      
      if (aboutBtn) { aboutBtn.addEventListener('click', () => showAboutModal(false)); }
      if (readBtn) { readBtn.addEventListener('click', () => { if (!readBtn.disabled) { if (readBtn.textContent === '已阅读') { localStorage.setItem(ABOUT_READ_KEY, 'true'); } hideAboutModal(); } }); }
      if (aboutModal) { aboutModal.addEventListener('click', (e) => { const isForced = readBtn.textContent === '已阅读' && readBtn.disabled; if (e.target === aboutModal && !isForced) { hideAboutModal(); } }); }
      if (tabContainer) { tabContainer.addEventListener('click', (e) => { const clickedTab = e.target.closest('.about-tab-btn'); if (!clickedTab) return; tabContainer.querySelectorAll('.about-tab-btn').forEach(btn => btn.classList.remove('active')); clickedTab.classList.add('active'); const tabName = clickedTab.dataset.tab; contentPanes.forEach(pane => { pane.classList.toggle('active', pane.dataset.tabContent === tabName); }); }); }
      if (localStorage.getItem(ABOUT_READ_KEY) !== 'true') { setTimeout(() => showAboutModal(true), 500); }
    });
  })();