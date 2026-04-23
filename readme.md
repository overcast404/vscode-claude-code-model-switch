# Claude Code Model Switch

> 为 Claude Code 提供全局默认模型与项目级独立模型的一键切换。

一款专为 Claude Code 用户打造的 VS Code 扩展。它把模型切换拆成两个层级：**全局默认配置**和**项目独立配置**。你可以让项目继续跟随全局，也可以只为当前项目单独指定模型与环境变量，互不干扰。

---

> 💡 **致谢**：本项目基于 [Skyrain](https://marketplace.visualstudio.com/items?itemName=Skyrain.vs-cc-switch) 的 [Claude Code Env Switcher](https://gitcode.com/TogetherAI/vs-cc-switch) 改造而来。感谢原作者的思路和贡献；本项目在此基础上补充了全局 / 项目双层配置、跟随全局、自动 `.gitignore` 等能力。原项目采用 MIT 许可证。

---

## 核心特性

- **全局默认模型**：所有项目默认读取 `~/.claude/settings.json`
- **项目独立模型**：当前项目可写入独立配置，覆盖全局默认
- **共享预设列表**：所有预设统一存放在 `~/.claude/envs.json`
- **跟随全局**：项目可随时恢复为使用全局默认模型
- **来源可见**：状态栏会明确显示当前是全局、项目独立、自定义配置还是预设丢失
- **快速操作**：支持状态栏菜单、配置面板、命令面板三种入口
- **自动保护敏感文件**：写入项目配置时自动补充 `.gitignore`

## 支持的服务商

- **Anthropic 官方** — claude.ai 订阅 / API Key
- **阿里云 DashScope** — 通义千问、GLM、Kimi、MiniMax 等
- **智谱 GLM** — open.bigmodel.cn
- **Kimi** — Moonshot AI
- **MiniMax** — MiniMax API
- **DeepSeek** — DeepSeek API
- **任意兼容 Anthropic 协议的 API** — 可自由添加

## 配置文件与生效优先级

扩展使用三类配置文件：

| 层级 | 配置文件 | 作用 |
|------|---------|------|
| 全局配置 | `~/.claude/settings.json` | 所有项目默认使用的 Claude Code 配置 |
| 全局预设 | `~/.claude/envs.json` | 全局共享的模型预设列表 |
| 项目配置 | `{project}/.claude/settings.local.json` | 当前项目的独立配置，优先级高于全局 |

生效规则如下：

1. 如果项目的 `.claude/settings.local.json` 中存在有效项目配置，则优先使用项目配置。
2. 如果项目没有有效项目配置，则跟随 `~/.claude/settings.json`。
3. 预设列表始终来自 `~/.claude/envs.json`，项目不会维护单独的预设列表。

首次使用时，如果 `~/.claude/envs.json` 不存在，扩展会自动初始化默认预设。

## 2.1.4 的 4 种实际状态

2.1.4 不只是“全局 / 项目”两种模式，实际会区分以下 4 种状态：

### 1. 跟随全局

项目没有有效的项目级 `env` 或 `presetId` 时，当前项目直接使用全局配置。

状态栏会显示类似：

- `$(sync) cc:GLM-5 [跟随全局]`

### 2. 项目独立预设

当前项目在 `{project}/.claude/settings.local.json` 中保存了有效的 `presetId`，并且该预设仍能在 `~/.claude/envs.json` 中找到。

状态栏会显示类似：

- `$(folder) cc:Kimi-k2.5 项目(my-project)`

### 3. 项目自定义配置

如果项目配置文件中没有 `presetId`，但存在 `env`，扩展会把它识别为手动维护的自定义配置。

状态栏会显示类似：

- `$(edit) 自定义配置 项目(my-project)`

### 4. 项目预设丢失

如果项目里记录了 `presetId`，但该预设已经不在 `~/.claude/envs.json` 中，同时项目文件仍保留了 `env`，扩展会继续使用这些环境变量，并提示这是“预设丢失”状态。

状态栏会显示类似：

- `$(warning) (预设丢失: xxx) 项目(my-project)`

这意味着：即使某个预设后来被删掉，旧项目也不一定立刻失效；只要项目文件里还保留了对应 `env`，它仍会继续生效。

## 常用操作

### 状态栏

扩展激活后，VS Code 右侧状态栏会显示当前生效模型。显示内容会根据来源变化：

- 无工作区：显示全局模式
- 有工作区且项目独立：显示项目模式
- 有工作区但跟随全局：显示 `[跟随全局]`
- 项目自定义配置或预设丢失：显示特殊标识

点击状态栏即可打开快速操作菜单。

### 快速操作菜单

状态栏菜单支持以下动作：

- **切换项目模型**：为当前项目选择独立预设
- **切换全局模型**：修改全局默认模型
- **恢复跟随全局**：移除项目级模型来源，改回使用全局默认配置
- **打开配置面板**：查看当前生效来源与预设列表
- **编辑全局预设 (envs.json)**：维护共享预设

### 配置面板

配置面板会同时展示：

- 当前生效的模型
- 当前来源是全局、项目独立、自定义配置还是预设丢失
- 全局预设列表
- 当前项目可选的“跟随全局”与独立预设

面板内还可以直接打开：

- 全局 `settings.json`
- 全局 `envs.json`
- 项目 `settings.local.json`

### 命令面板

按 `Cmd+Shift+P`（macOS）或 `Ctrl+Shift+P`（Windows/Linux），搜索 `Claude Code Model Switch`，可使用以下命令：

| 命令 | 说明 |
|------|------|
| 切换模型 | 打开模型切换入口 |
| 打开配置面板 | 查看全局与项目配置 |
| 编辑全局 settings.json | 直接编辑全局配置 |
| 编辑全局预设 (envs.json) | 添加或修改共享预设 |

## 切换行为说明

### 切换全局模型

切换全局模型时，扩展会把所选预设的 `env` 写入：

- `~/.claude/settings.json`

同时写入对应的 `presetId`，作为全局默认模型来源。

### 切换项目模型

切换项目模型时，扩展会写入：

- `{project}/.claude/settings.local.json`

写入规则不是简单覆盖，而是：

1. 先读取当前项目已有的 `existing.env`
2. 再用所选预设的 `preset.env` 覆盖同名键
3. 保存新的 `env` 与 `presetId`

这意味着项目文件中已有的自定义环境变量会尽量保留，而预设中定义的键会以预设值为准。

### 恢复跟随全局

恢复跟随全局时，扩展只会删除项目配置中的：

- `env`
- `presetId`

其他字段会被保留。如果删除后整个项目配置文件已经为空，扩展才会删除这个文件。

因此，“恢复跟随全局”不等于无条件删除整个 `.claude/settings.local.json`。

## 典型工作流

```text
全局设置：cc:GLM-5

项目 A → 跟随全局 → 使用 cc:GLM-5
项目 B → 项目独立 → 使用 cc:Kimi-k2.5
项目 C → 项目独立 → 使用 cc:MiniMax-M2.5
```

每个项目都可以独立决定是否覆盖全局默认配置。

## `envs.json` 示例

预设列表存储在 `~/.claude/envs.json` 中，格式如下：

```json
{
  "presets": [
    {
      "id": "glm5",
      "label": "cc:GLM-5",
      "description": "阿里云 DashScope GLM-5 模型",
      "env": {
        "ANTHROPIC_AUTH_TOKEN": "your-api-key",
        "ANTHROPIC_BASE_URL": "https://coding.dashscope.aliyuncs.com/apps/anthropic",
        "API_TIMEOUT_MS": "300000",
        "CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC": "1",
        "ANTHROPIC_MODEL": "glm-5",
        "ANTHROPIC_DEFAULT_SONNET_MODEL": "glm-5",
        "ANTHROPIC_DEFAULT_OPUS_MODEL": "glm-5",
        "ANTHROPIC_DEFAULT_HAIKU_MODEL": "glm-5"
      }
    }
  ]
}
```

### 关键环境变量

| 变量 | 说明 |
|------|------|
| `ANTHROPIC_AUTH_TOKEN` | API 认证令牌 |
| `ANTHROPIC_BASE_URL` | API 基础 URL |
| `ANTHROPIC_MODEL` | 默认模型 ID |
| `ANTHROPIC_DEFAULT_SONNET_MODEL` | Sonnet 模型别名 |
| `ANTHROPIC_DEFAULT_OPUS_MODEL` | Opus 模型别名 |
| `ANTHROPIC_DEFAULT_HAIKU_MODEL` | Haiku 模型别名 |

## 安全与 `.gitignore`

当扩展为项目写入配置时，会自动把以下内容加入项目根目录 `.gitignore`：

```gitignore
# Claude Code 配置（含 API Key，不要提交）
.claude/settings.json
.claude/envs.json
.claude/settings.local.json
```

> 请勿将包含 API Key 的配置文件提交到代码仓库。

## 安装

从 VS Code Marketplace 搜索 **Claude Code Model Switch** 安装。

## 开发

```bash
git clone https://github.com/overcast404/claude-code-model-switch.git
cd claude-code-model-switch
npm install
npm run compile
# 按 F5 启动调试
```

## 许可证

MIT
