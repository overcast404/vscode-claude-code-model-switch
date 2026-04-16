# vs-cc-switch 插件规范

## 1. 项目概述

- **项目名称**: vs-cc-switch
- **类型**: VSCode 插件
- **核心功能**: 在 VSCode 右上角提供 UI，切换 Claude Code 的模型和 API Endpoint URL
- **目标用户**: 使用 Claude Code 的开发者

## 2. UI/UX 规范

### 布局结构

- **位置**: VSCode 编辑器右上角（与 Claude Code 原生 UI 相同位置）
- **组件**: 下拉按钮 + 弹出面板

### 视觉设计

- **配色**:
  - 主色: VSCode 主题色（跟随 VSCode 深色/浅色主题）
  - 强调色: #007ACC (VSCode 蓝色)
  - 背景: VSCode 面板背景色
- **字体**: VSCode 默认字体，12px
- **间距**: 8px 内边距

### 组件

1. **状态栏按钮** (在右上角)
   - 显示当前模型名称
   - 点击展开下拉面板

2. **下拉面板**
   - 模型输入框
   - API URL 输入框
   - 保存按钮
   - 重置为默认按钮

## 3. 功能规范

### 核心功能

1. **读取当前配置**: 从 `~/.claude.json` 读取当前模型和 URL
2. **修改配置**: 用户输入模型名和 URL 后，保存到配置文件
3. **状态显示**: 在右上角显示当前使用的模型

### 用户交互

1. 点击右上角按钮 → 展开面板
2. 输入模型名称 → 保存
3. 输入 API URL → 保存
4. 点击重置 → 恢复默认配置

### 配置路径

- Windows: `C:\Users\{username}\.claude.json`
- Mac/Linux: `~/.claude.json`

### 配置文件格式

```json
{
  "model": "claude-opus-4-6",
  "apiUrl": "https://api.anthropic.com"
}
```

## 4. 验收标准

- [ ] 插件成功安装到 VSCode
- [ ] 右上角显示当前模型名称
- [ ] 点击展开配置面板
- [ ] 可以输入并保存模型名称
- [ ] 可以输入并保存 API URL
- [ ] 配置文件正确更新
- [ ] 支持重置为默认值
