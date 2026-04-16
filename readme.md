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
| 🌍 **全局配置** | 所有项目共用一套配置 |
| 📊 **可视化面板** | 查看所有预设和当前生效的环境变量 |
| 🛡️ **自动 .gitignore** | 项目级配置自动加入 gitignore，防止 API Key 泄露 |
| 🔧 **自定义预设** | 支持任意数量环境预设 |
| 💾 **配置持久化** | 作用域选择自动保存，重启不丢失 |

## 🎯 支持的服务商

- **Anthropic 官方** — claude.ai 订阅 / API Key
- **阿里云 DashScope** — 通义千问、GLM、Kimi、MiniMax 等
- **智谱 GLM** — open.bigmodel.cn
- **Kimi** — Moonshot AI
- **MiniMax** — MiniMax API
- **DeepSeek** — DeepSeek API
- **任意兼容 Anthropic 协议的 API** — 可自由添加

## 📋 两种配置模式

| 模式 | 配置文件路径 | 作用范围 |
|------|-------------|---------|
| **全局** | `~/.claude/settings.json` | 所有项目共用 |
| **项目** | `{项目根目录}/.claude/settings.json` | 仅当前项目 |

## 🚀 快速开始

1. 安装插件后，状态栏右侧会显示当前使用的模型
2. 点击状态栏图标，即可切换模型或进行其他操作

### 典型工作流

```
项目 A（使用 GLM-5）：
  打开项目 A → 初始化项目级配置 → 选择 GLM-5
  配置文件写入：项目 A/.claude/settings.json

项目 B（使用 Kimi）：
  打开项目 B → 初始化项目级配置 → 选择 Kimi
  配置文件写入：项目 B/.claude/settings.json

两个项目的模型配置完全独立，互不影响！
```

### 命令面板

按 `Cmd+Shift+P` (macOS) 或 `Ctrl+Shift+P` (Windows/Linux)，搜索 "Claude Code Switch"：

| 命令 | 说明 |
|------|------|
| 初始化项目级配置 | 在项目根目录创建 `.claude/` 目录和配置文件 |
| 切换配置作用域（全局/项目） | 切换配置写入位置 |
| 切换 Claude Code 环境配置 | 快速选择并切换模型 |
| 打开环境配置面板 | 查看所有预设和当前配置 |
| 编辑环境预设配置 | 编辑 `envs.json`，自定义模型列表 |
| 编辑 settings.json | 直接编辑 Claude Code 配置 |

## ⚙️ 配置格式

预设配置存储在 `envs.json` 中，格式如下：

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

初始化项目级配置时，自动将以下内容追加到 `.gitignore`：

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
