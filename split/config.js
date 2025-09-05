
// --- 全局配置与API检查 ---
// 本文件包含脚本运行所需的基础配置信息, 以及用于验证TavernHelper API是否可用的检查代码.
//
// 功能函数:
// - 无直接函数, 主要为常量定义和环境检查.
//
// 加载顺序:
// - 本文件应在所有其他脚本之前最先加载.

(function () {
  // --- 全局配置 ---
  const LOREBOOK_NAME = '1归墟';

  // --- 新增：游戏难度规则配置 ---
  const DIFFICULTY_LORE_ENTRIES = [
    '【cot】【简单】必要关键cot（1-5）',
    '【cot】【标配】【困难】必要关键cot（1-6）',
    '【系统】【标配】超级无敌合理性审查',
    '【系统】【标配】合理性审查【修改】',
    '【cot】合理性审查加强',
  ];

  const GAME_DIFFICULTY_DEFINITIONS = {
    easy: {
      id: 'easy',
      name: '简单模式',
      description: '爽文模式。适合想要体验剧情、轻松游玩的玩家，AI会像一个友好的故事引导者来推进剧情。',
      entriesToEnable: ['【cot】【简单】必要关键cot（1-5）'],
    },
    normal: {
      id: 'normal',
      name: '普通模式',
      description: '标准的游戏模式。世界遵循其自身的逻辑，玩家需要谨慎思考。',
      entriesToEnable: ['【cot】【标配】【困难】必要关键cot（1-6）', '【系统】【标配】合理性审查【修改】'],
    },
    hard: {
      id: 'hard',
      name: '困难模式',
      description: '一个残酷、真实、充满恶意的修仙世界。生存本身就是一种挑战，每一次行动都可能带来灾难性的后果。',
      entriesToEnable: [
        '【cot】【标配】【困难】必要关键cot（1-6）',
        '【系统】【标配】合理性审查【修改】',
        '【系统】【标配】超级无敌合理性审查',
        '【cot】合理性审查加强',
      ],
    },
  };

  // --- API 可用性检查 ---
  /* global TavernHelper, eventEmit, getChatMessages, getCurrentMessageId */
  if (
    typeof TavernHelper === 'undefined' ||
    typeof TavernHelper.getWorldbook === 'undefined' || // 检查新API是否存在
    typeof eventEmit === 'undefined' ||
    typeof getChatMessages === 'undefined' ||
    typeof getCurrentMessageId === 'undefined'
  ) {
    console.error('TavernHelper API 或事件系统未找到，或者版本过旧。');
    document.addEventListener('DOMContentLoaded', () => {
      document.body.innerHTML =
        '<h1 style="color: red; text-align: center;">错误：SillyTavern 环境 API 未找到或不兼容。请确保TavernHelper插件已更新。</h1>';
    });
    return;
  }
})();
