
// --- 游戏状态管理器 ---
// 本文件负责管理和持久化前端的整体游戏状态, 包括玩家的选择、点数、属性等.
//
// 功能函数:
// - getNewGameState(): 初始化或从sessionStorage恢复游戏状态对象, 并为其附加计算属性(getter).
// - saveGameState(): 将当前游戏状态序列化并保存到sessionStorage.
// - refreshLocalStorage(): 清理特定的本地存储缓存项.
//
// 数据对象:
// - baseAttributes: 定义角色的基础属性值.
// - GAME_STATE_KEY: 用于在sessionStorage中存取游戏状态的键名.
// - gameState: 全局的游戏状态响应式对象.
//
// 加载顺序:
// - 本文件应在 gameData.js 之后加载, 因为 baseAttributes 依赖 GAME_DATA.
// - 应在任何修改 gameState 的逻辑之前加载.

const baseAttributes = {
  fa_li: 1,
  shen_hai: 1,
  dao_xin: 1,
  kong_su: 1,
  qi_yun: 10,
};

function getNewGameState() {
  const savedState = sessionStorage.getItem(GAME_STATE_KEY);
  if (savedState) {
    try {
      const parsedState = JSON.parse(savedState);
      // Basic validation to ensure it's a valid game state
      if (parsedState && typeof parsedState === 'object' && parsedState.currentStep) {
        // Re-add getter properties as they are not serialized
        Object.defineProperty(parsedState, 'spentPoints', {
          get: function () {
            let attributeCost = 0;
            for (const key in this.spentAttributePoints) {
              const spent = this.spentAttributePoints[key];
              attributeCost += key === 'qi_yun' ? spent * 10 : spent;
            }
            const talentCost = this.selectedTalents.reduce((sum, talentInstance) => {
              return sum + (talentInstance.cost || 0);
            }, 0);
            return attributeCost + talentCost + this.spentGachaPoints;
          },
          enumerable: true,
          configurable: true,
        });
        Object.defineProperty(parsedState, 'remainingPoints', {
          get: function () {
            return this.totalPoints - this.spentPoints;
          },
          enumerable: true,
          configurable: true,
        });
        Object.defineProperty(parsedState, 'finalAttributes', {
          get: function () {
            const final = {};
            for (const key in baseAttributes) {
              final[key] = (baseAttributes[key] || 0) + (this.spentAttributePoints[key] || 0);
            }
            return final;
          },
          enumerable: true,
          configurable: true,
        });
        return parsedState;
      }
    } catch (error) {
      console.error('Failed to parse saved game state:', error);
      sessionStorage.removeItem(GAME_STATE_KEY);
    }
  }

  return {
    currentStep: 'difficulty',
    talentSelectionMode: 'gacha', // 'gacha' or 'store'
    selectedDifficulty: null,
    selectedRuleDifficulty: null, // 新增：用于存储规则难度
    totalPoints: 0,
    spentAttributePoints: { fa_li: 0, shen_hai: 0, dao_xin: 0, kong_su: 0, qi_yun: 0 },
    selectedTalents: [],
    requiredTalents: [],
    customTalent: '',
    selectedBackground: null,
    customBackground: '',
    bondCharacter: { name: '', setting: '', appearance: '', identity: '', other: '' },
    selectedGender: null,
    startingPresetName: null,
    gachaTalentPool: [], // For storing drawn talents
    pity5: 0,
    pity4: 0,
    is5StarGuaranteed: false,
    spentGachaPoints: 0,
    get spentPoints() {
      let attributeCost = 0;
      for (const key in this.spentAttributePoints) {
        const spent = this.spentAttributePoints[key];
        attributeCost += key === 'qi_yun' ? spent * 10 : spent;
      }
      const talentCost = this.selectedTalents.reduce((sum, talentInstance) => {
        return sum + (talentInstance.cost || 0);
      }, 0);
      return attributeCost + talentCost + this.spentGachaPoints;
    },
    get remainingPoints() {
      return this.totalPoints - this.spentPoints;
    },
    get finalAttributes() {
      const final = {};
      for (const key in baseAttributes) {
        final[key] = (baseAttributes[key] || 0) + (this.spentAttributePoints[key] || 0);
      }
      return final;
    },
  };
}

const GAME_STATE_KEY = 'guixu_kaiju_gameState';
let gameState = getNewGameState();

function saveGameState() {
  try {
    sessionStorage.setItem(GAME_STATE_KEY, JSON.stringify(gameState));
  } catch (error) {
    console.error('Failed to save game state:', error);
  }
}

async function refreshLocalStorage() {
  try {
    ['guixu_equipped_items', 'guixu_pending_actions'].forEach(key => localStorage.removeItem(key));
    // await guiXuAlert('核心游戏缓存已清除！如果是新开聊天，这将有助于解决变量更新问题。'); // 根据需求，取消弹窗，改为静默处理
  } catch (e) {
    console.error('清除缓存失败:', e);
    await guiXuAlert('清除缓存失败：' + e.message, '错误');
  }
}
