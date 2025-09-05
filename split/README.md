
# GuixuFrontend 脚本拆分文档

本文档描述了从 `scripts.js` 拆分出的各个独立脚本文件及其功能和正确的加载顺序。

## 文件加载顺序

为了确保脚本正常运行, 请务必严格按照以下顺序在 HTML 文件中引入这些脚本。

```html
<!-- 基础配置与核心数据 (必须最先加载) -->
<script src="./config.js"></script>
<script src="./gameData.js"></script>
<script src="./gameState.js"></script>

<!-- 工具与管理器 -->
<script src="./yamlParser.js"></script>
<script src="./ui.js"></script>
<script src="./utils.js"></script>
<script src="./worldbookManager.js"></script>
<script src="./seriesManager.js"></script>
<script src="./saveLoadManager.js"></script>
<script src="./snapshotManager.js"></script>
<script src="./backgroundSettings.js"></script>
<script src="./unifiedIndexControls.js"></script>
<script src="./quickStart.js"></script>

<!-- 编辑器核心 -->
<script src="./editor.js"></script>

<!-- 主程序入口 (必须最后加载) -->
<script src="./main.js"></script>
```

## 文件功能说明

### 1. `config.js`
- **功能**: 包含脚本运行所需的基础配置信息, 如世界书名称、游戏难度定义, 以及用于验证TavernHelper API是否可用的检查代码。
- **依赖**: 无。
- **加载顺序**: 最先加载。

### 2. `gameData.js`
- **功能**: 定义了游戏的核心静态数据, 如属性列表、性别, 以及为新用户提供的默认天赋和背景数据。
- **依赖**: 无。
- **加载顺序**: 在 `config.js` 之后。

### 3. `gameState.js`
- **功能**: 负责管理和持久化前端的整体游戏状态, 包括玩家的选择、点数、属性等。
- **依赖**: `gameData.js`。
- **加载顺序**: 在 `gameData.js` 之后。

### 4. `yamlParser.js`
- **功能**: 提供一个简单的YAML解析器对象, 用于将特定格式的YAML字符串与JavaScript对象之间进行相互转换。
- **依赖**: 无。
- **加载顺序**: 在核心数据之后, 在 `worldbookManager.js` 之前。

### 5. `ui.js`
- **功能**: 包含所有用于生成用户交互界面(UI)的函数, 例如模态框、提示框和状态显示。
- **依赖**: 无。
- **加载顺序**: 在核心管理器之前。

### 6. `utils.js`
- **功能**: 包含一些通用工具函数, 例如防抖动保存 (`debouncedSave`)。
- **依赖**: `ui.js`, `editor.js` (间接依赖)。
- **加载顺序**: 在 `ui.js` 之后。

### 7. `worldbookManager.js`
- **功能**: 负责处理与"归墟"世界书相关的所有数据操作, 包括加载、解析、分类和生成条目。
- **依赖**: `config.js`, `yamlParser.js`。
- **加载顺序**: 在 `yamlParser.js` 之后。

### 8. `seriesManager.js`
- **功能**: 提供一个SeriesManager对象, 用于根据"系列"对天赋、背景和预设进行筛选和组织。
- **依赖**: `editor.js` (间接依赖 `editorData` 对象)。
- **加载顺序**: 在 `worldbookManager.js` 之后。

### 9. `saveLoadManager.js`
- **功能**: 负责处理游戏的多存档、读档、导入和导出功能。
- **依赖**: `ui.js`, `worldbookManager.js`。
- **加载顺序**: 在管理器模块中靠后加载。

### 10. `snapshotManager.js`
- **功能**: 提供了一个用于管理和批量删除世界书中由存档产生的快照条目的工具。
- **依赖**: `ui.js`, `worldbookManager.js`。
- **加载顺序**: 在管理器模块中靠后加载。

### 11. `backgroundSettings.js`
- **功能**: 负责处理启动页面的背景图片、效果(模糊、遮罩)等相关设置。
- **依赖**: `ui.js`。
- **加载顺序**: 在管理器模块中靠后加载。

### 12. `unifiedIndexControls.js`
- **功能**: 负责处理"归墟Plus"模式下的读写序号统一控制功能。
- **依赖**: `worldbookManager.js`。
- **加载顺序**: 在管理器模块中靠后加载。

### 13. `quickStart.js`
- **功能**: 负责处理“快速开始”功能, 允许用户保存和使用开局prompt模板。
- **依赖**: `ui.js`。
- **加载顺序**: 在管理器模块中靠后加载。

### 14. `editor.js`
- **功能**: 编辑器功能的核心, 包含了数据管理、渲染、事件处理、模态框逻辑以及导入/导出功能。
- **依赖**: `gameState.js`, `ui.js`, `worldbookManager.js`, `seriesManager.js`, `utils.js`。
- **加载顺序**: 在所有管理器和工具脚本之后。

### 15. `main.js`
- **功能**: 整个前端的总入口和流程控制器。它负责初始化、视图切换、UI渲染以及将所有模块的事件监听器绑定到DOM上。
- **依赖**: 所有其他JS文件。
- **加载顺序**: 最后加载。
