// ----------------------------- 新增：游戏难度规则配置 -----------------------------------

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

// ----------------------------- 自动保存工具 (For debouncedSave(), 但不知道有什么用，可能是预设世界书的自动保存)-----------------------------------
const saveDebounceTimer = null;

// ----------------------------- 游戏核心数据 -----------------------------------
const GAME_DATA = {
  difficulties: {
    hell: { name: '地狱模式', points: 10 },
    hard: { name: '困难模式', points: 20 },
    normal: { name: '普通模式', points: 40 },
    destiny: { name: '天命模式', points: 100 },
  },
  attributes: {
    fa_li: { name: '法力', description: '决定法术威力和法力值上限，影响施法能力和法术伤害' },
    shen_hai: { name: '神海', description: '决定神识强度和精神防御，影响感知能力和抗幻术能力' },
    dao_xin: { name: '道心', description: '决定修炼悟性和心境稳定，影响突破概率和抗心魔能力' },
    kong_su: { name: '空速', description: '决定移动速度和反应能力，影响闪避和先手概率' },
    qi_yun: {
      name: '气运',
      description: '决定运气和机缘，影响获得宝物和遇到奇遇的概率，以及各类判定的成功率，骰子气运修正等（消耗10点）',
    },
  },
  genders: {
    male: { name: '男性' },
    female: { name: '女性' },
    futanari: { name: '女生男相' },
    shemale: { name: '男生女相' },
    paramecium: { name: '草履虫' },
    helicopter: { name: '武装直升机' },
    mengxing: { name: '梦星' },
  },
};

// ----------------------------- 初始属性 -----------------------------------

const baseAttributes = {
  fa_li: 1,
  shen_hai: 1,
  dao_xin: 1,
  kong_su: 1,
  qi_yun: 10,
};

// ----------------------------- 开局游戏状态 -----------------------------------

const GAME_STATE_KEY = 'guixu_kaiju_gameState';
const gameState = getNewGameState();

// ----------------------------- 编辑器数据（统一管理） -----------------------------------
const editorData = {
  talents: [],
  backgrounds: [],
  presets: [],
  worldbookEntries: [],
  isLoading: false,
  lastLoadTime: null,
};

// ----------------------------- 当前世界书过滤器 -----------------------------------

const currentWbFilter = 'all';

// ----------------------------- 当前编辑中的预设 -----------------------------------

const currentEditingPreset = null;

// ----------------------------- 编辑器模态框逻辑 -----------------------------------
const modal = document.getElementById('editor-modal');
const modalForm = document.getElementById('modal-form');
const modalTitle = document.getElementById('modal-title');
const modalItemType = document.getElementById('modal-item-type');
const modalEditIdentifier = document.getElementById('modal-edit-identifier');
const modalEditUid = document.getElementById('modal-edit-uid');
const modalNameInput = document.getElementById('modal-name');
const modalAuthorInput = document.getElementById('modal-author');
const modalSeriesInput = document.getElementById('modal-series');
const modalCostGroup = document.getElementById('modal-cost-group');
const modalCostInput = document.getElementById('modal-cost');
const modalDescriptionInput = document.getElementById('modal-description');
const modalInitialResourcesGroup = document.getElementById('modal-initial-resources-group');
const modalInitialResourcesInput = document.getElementById('modal-initial-resources');

// ----------------------------- 世界书编辑器模态框逻辑 -----------------------------------

const wbModal = document.getElementById('worldbook-editor-modal');

// -------------------------------批量导入功能的变量
document.getElementById('batch-import-cancel-btn').addEventListener('click', () => {
  document.getElementById('batch-import-modal').style.display = 'none';
});

document.getElementById('batch-import-save-btn').addEventListener('click', handleBatchImport);

// ----------------------------- 主页面视图 -----------------------------------
const mainViews = [
  'main-page-content',
  'editor-container',
  'setup-form',
  'startup-choice-container',
  'quick-start-container',
];

// ----------------------------- 背景设置 -----------------------------------
const BG_SETTINGS_KEY = 'guixu_background_settings_v2';
const defaultBgSettings = { network: true, opacity: 0.5, blur: 0, local: false, localImage: null };
let backgroundSettings = {};
let bgInterval;



// ----------------------------- 快速开始模板 -----------------------------------
const QUICK_START_KEY = 'guixu_quick_start_templates';