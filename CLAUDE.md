# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Claude Code Model Switch is a VS Code extension that enables quick switching between AI models for Claude Code CLI. It supports both global and project-level configurations, allowing each project to independently choose models while sharing a common preset list.

## Architecture

**Configuration Layers:**
- **Global settings**: `~/.claude/settings.json` — Default for all projects
- **Global presets**: `~/.claude/envs.json` — Shared model preset definitions
- **Project settings**: `{project}/.claude/settings.json` — Optional override per project

**Priority:** Project settings > Global settings. Projects can "follow global" (no project file) or use independent config.

**Key Components:**
- `out/extension.js` — Single compiled entry point containing all logic
- Status bar item (right side) — Shows current model with quick action menu
- Webview panel — Visual configuration interface with preset selection
- Auto `.gitignore` — Prevents API key leakage when creating project configs

## Development

```bash
# Install dependencies
npm install

# Compile TypeScript (if source exists)
npm run compile

# Debug: Press F5 in VS Code to launch Extension Development Host
```

The extension uses pre-compiled JavaScript. The `vscode:prepublish` script just echoes a message since compilation is done separately.

## Key Environment Variables

Presets configure these variables that Claude Code CLI reads:
- `ANTHROPIC_AUTH_TOKEN` — API authentication token
- `ANTHROPIC_BASE_URL` — API endpoint URL
- `ANTHROPIC_MODEL` — Default model ID
- `ANTHROPIC_DEFAULT_SONNET_MODEL`, `ANTHROPIC_DEFAULT_OPUS_MODEL`, `ANTHROPIC_DEFAULT_HAIKU_MODEL` — Model aliases

## Extension Commands

| Command | Description |
|---------|-------------|
| `ccSwitch.selectEnv` | Quick action menu for switching models |
| `ccSwitch.showConfig` | Open visual configuration panel |
| `ccSwitch.editSettings` | Open global `settings.json` |
| `ccSwitch.editEnvs` | Open global `envs.json` |

## Security

The extension automatically appends `.claude/*.json` patterns to `.gitignore` when creating project-level config to prevent accidental API key commits.