# Claude Code Model Switch

> 为 Claude Code 提供全局和项目级模型一键切换 🔄

一款专为 Claude Code 用户打造的模型切换工具。支持在多个 AI 服务商之间快速切换，同时提供**项目级独立配置**——每个项目可以独立选择模型和 API，互不干扰。

---

> 💡 **致谢**：本项目基于 [Skyrain](https://marketplace.visualstudio.com/items?itemName=Skyrain.vs-cc-switch) 的 [Claude Code Env Switcher](https://gitcode.com/TogetherAI/vs-cc-switch) 改造而来。感谢原作者的思路和贡献，项目级的全局/作用域切换、自动 gitignore 等增强功能在此基础上新增。原项目采用 MIT 许可证。

---

## ✨ 功能亮点

| 功能 | 说明 |
|------|------|
| 🔄 **一键切换** | 状态栏直接点击，秒级切换模型 |
| 📂 **项目级配置** | 每个项目独立模型配置，按项目自动隔离 |
| 🌍 **全局配置** | 所有项目共用一套配置，项目可选择「跟随全局」 |
| 📊 **可视化面板** | 同时查看全局和项目配置，一目了然 |
| 🛡️ **自动 .gitignore** | 项目级配置自动加入 gitignore，防止 API Key 泄露 |
| 🔧 **自定义预设** | 支持任意数量环境预设 |

## 🎯 支持的服务商

- **Anthropic 官方** — claude.ai 订阅 / API Key
- **阿里云 DashScope** — 通义千问、GLM、Kimi、MiniMax 等
- **智谱 GLM** — open.bigmodel.cn
- **Kimi** — Moonshot AI
- **MiniMax** — MiniMax API
- **DeepSeek** — DeepSeek API
- **任意兼容 Anthropic 协议的 API** — 可自由添加

## 📋 配置架构

全局和项目级配置**同时存在**，不需要切换：

| 层级 | 配置文件 | 说明 |
|------|---------|------|
| **全局** | `~/.claude/settings.json` | 始终生效，所有项目默认使用 |
| **项目** | `{项目}/.claude/settings.json` | 可选覆盖，优先级高于全局 |
| **预设** | `~/.claude/envs.json` | 全局共享的模型预设列表 |

**项目可以选择：**
- **跟随全局** — 不创建项目配置文件，自动使用全局配置
- **独立配置** — 为当前项目选择独立的模型，覆盖全局设置

## 🚀 快速开始

1. 安装插件后，状态栏右侧会显示当前使用的模型
2. 点击状态栏图标，即可切换模型或进行其他操作

### 典型工作流

```
全局设置：cc:GLM-5

项目 A → 跟随全局 → 使用 GLM-5
项目 B → 独立设置 → cc:Kimi-k2.5
项目 C → 独立设置 → cc:qwen3.6-plus

每个项目独立决定，互不影响。
```

### 命令面板

按 `Cmd+Shift+P` (macOS) 或 `Ctrl+Shift+P` (Windows/Linux)，搜索 "Claude Code Model Switch"：

| 命令 | 说明 |
|------|------|
| 切换模型 | 为当前项目或全局选择模型 |
| 打开配置面板 | 同时查看全局和项目配置 |
| 编辑全局预设 (envs.json) | 添加/修改模型预设 |
| 编辑全局 settings.json | 直接编辑全局配置 |

## ⚙️ 配置格式

预设配置存储在 `~/.claude/envs.json` 中，格式如下：

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

## 🔒 安全

设置项目级配置时，自动将以下内容追加到 `.gitignore`：

```
# Claude Code 配置（含 API Key，不要提交）
.claude/settings.json
.claude/envs.json
.claude/settings.local.json
```

> ⚠️ 请勿将包含 API Key 的配置文件提交到代码仓库！

## 📦 安装

从 VS Code Marketplace 搜索 **Claude Code Model Switch** 安装。

## 📝 开发

```bash
git clone https://github.com/overcast404/claude-code-model-switch.git
cd claude-code-model-switch
npm install
npm run compile
# 按 F5 启动调试
```

## 📜 许可证

MIT
