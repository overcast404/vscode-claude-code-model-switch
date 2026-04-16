"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
const fs = __importStar(require("fs"));

// 默认预设（仅当全局 envs.json 也不存在时用作兜底）
const DEFAULT_PRESETS = [
    {
        id: 'qwen',
        label: 'cc:qwen3.6-plus',
        description: 'DashScope qwen3.6-plus',
        env: {
            ANTHROPIC_AUTH_TOKEN: '',
            ANTHROPIC_BASE_URL: 'https://coding.dashscope.aliyuncs.com/apps/anthropic',
            API_TIMEOUT_MS: '300000',
            CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '1',
            ANTHROPIC_MODEL: 'qwen3.6-plus',
            ANTHROPIC_DEFAULT_HAIKU_MODEL: 'qwen3.6-plus',
            ANTHROPIC_DEFAULT_SONNET_MODEL: 'qwen3.6-plus',
            ANTHROPIC_DEFAULT_OPUS_MODEL: 'qwen3.6-plus'
        }
    },
    {
        id: 'glm5',
        label: 'cc:GLM-5',
        description: 'DashScope GLM-5',
        env: {
            ANTHROPIC_AUTH_TOKEN: '',
            ANTHROPIC_BASE_URL: 'https://coding.dashscope.aliyuncs.com/apps/anthropic',
            API_TIMEOUT_MS: '300000',
            CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '1',
            ANTHROPIC_MODEL: 'glm-5',
            ANTHROPIC_DEFAULT_HAIKU_MODEL: 'glm-5',
            ANTHROPIC_DEFAULT_SONNET_MODEL: 'glm-5',
            ANTHROPIC_DEFAULT_OPUS_MODEL: 'glm-5'
        }
    },
    {
        id: 'kimi',
        label: 'cc:kimi-k2.5',
        description: 'DashScope kimi-k2.5',
        env: {
            ANTHROPIC_AUTH_TOKEN: '',
            ANTHROPIC_BASE_URL: 'https://coding.dashscope.aliyuncs.com/apps/anthropic',
            API_TIMEOUT_MS: '300000',
            CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '1',
            ANTHROPIC_MODEL: 'kimi-k2.5',
            ANTHROPIC_DEFAULT_HAIKU_MODEL: 'kimi-k2.5',
            ANTHROPIC_DEFAULT_SONNET_MODEL: 'kimi-k2.5',
            ANTHROPIC_DEFAULT_OPUS_MODEL: 'kimi-k2.5'
        }
    },
    {
        id: 'minimax',
        label: 'cc:MiniMax-M2.5',
        description: 'DashScope MiniMax-M2.5',
        env: {
            ANTHROPIC_AUTH_TOKEN: '',
            ANTHROPIC_BASE_URL: 'https://coding.dashscope.aliyuncs.com/apps/anthropic',
            API_TIMEOUT_MS: '300000',
            CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '1',
            ANTHROPIC_MODEL: 'MiniMax-M2.5',
            ANTHROPIC_DEFAULT_HAIKU_MODEL: 'MiniMax-M2.5',
            ANTHROPIC_DEFAULT_SONNET_MODEL: 'MiniMax-M2.5',
            ANTHROPIC_DEFAULT_OPUS_MODEL: 'MiniMax-M2.5'
        }
    }
];

// ==================== 作用域管理 ====================
// 当前配置作用域：'global' 或 'project'
let currentScope = 'project'; // 默认项目级

// 保存扩展上下文
let extensionContext;

// 获取当前工作区根路径
function getWorkspaceRoot() {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (workspaceFolders && workspaceFolders.length > 0) {
        return workspaceFolders[0].uri.fsPath;
    }
    return null;
}

// 根据作用域获取 settings.json 路径
function getSettingsPath() {
    if (currentScope === 'project') {
        const wsRoot = getWorkspaceRoot();
        if (wsRoot) {
            return path.join(wsRoot, '.claude', 'settings.json');
        }
    }
    // global 或无工作区时回退到全局
    return path.join(os.homedir(), '.claude', 'settings.json');
}

// 根据作用域获取 envs.json 路径
function getEnvsConfigPath() {
    if (currentScope === 'project') {
        const wsRoot = getWorkspaceRoot();
        if (wsRoot) {
            return path.join(wsRoot, '.claude', 'envs.json');
        }
    }
    return path.join(os.homedir(), '.claude', 'envs.json');
}

// 作用域标签
function getScopeLabel() {
    return currentScope === 'project' ? '项目' : '全局';
}

function getScopeIcon() {
    return currentScope === 'project' ? '$(folder)' : '$(gear)';
}

// 切换作用域
async function toggleScope() {
    const wsRoot = getWorkspaceRoot();
    if (!wsRoot) {
        vscode.window.showWarningMessage('请先打开一个项目文件夹，再切换到项目级配置');
        return;
    }
    currentScope = currentScope === 'global' ? 'project' : 'global';
    // 保存作用域到全局状态
    await extensionContext.globalState.update('ccSwitch.scope', currentScope);
    updateStatusBar();
    const scopeName = getScopeLabel();
    const target = getSettingsPath();
    vscode.window.showInformationMessage(`已切换到${scopeName}级配置 → ${target}`);
}

// ==================== 配置文件读写 ====================

// 读取全局 envs.json（始终从用户目录读取）
function readGlobalEnvs() {
    const globalPath = path.join(os.homedir(), '.claude', 'envs.json');
    try {
        if (fs.existsSync(globalPath)) {
            const content = fs.readFileSync(globalPath, 'utf-8');
            const parsed = JSON.parse(content);
            if (parsed.presets && parsed.presets.length > 0) {
                return parsed;
            }
        }
    }
    catch { }
    return null;
}

// 初始化默认 envs.json 配置
// 项目级时：从全局 envs.json 复制预设
// 全局级时：从全局 envs.json 读取，不存在则用内置兜底
function initDefaultEnvsConfig() {
    const configPath = getEnvsConfigPath();
    if (!fs.existsSync(configPath)) {
        // 优先从全局预设复制
        const globalEnvs = readGlobalEnvs();
        const presets = (globalEnvs && globalEnvs.presets)
            ? globalEnvs.presets
            : DEFAULT_PRESETS;

        const defaultConfig = { presets: presets };
        try {
            // 确保 .claude 目录存在
            const dir = path.dirname(configPath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2), 'utf-8');
            console.log(`已初始化: ${configPath}`);

            // 项目模式下：添加到 .gitignore
            if (currentScope === 'project') {
                const wsRoot = getWorkspaceRoot();
                if (wsRoot) {
                    addToGitignore(wsRoot);
                }
            }
        }
        catch (e) {
            console.error('初始化 envs.json 失败:', e);
        }
    }
}

// 初始化项目级配置（创建 .claude/settings.json）
async function initProjectConfig() {
    const wsRoot = getWorkspaceRoot();
    if (!wsRoot) {
        vscode.window.showWarningMessage('请先打开一个项目文件夹');
        return;
    }

    // 强制切换到项目模式
    currentScope = 'project';
    await extensionContext.globalState.update('ccSwitch.scope', currentScope);

    const projectSettingsPath = path.join(wsRoot, '.claude', 'settings.json');
    const projectEnvsPath = path.join(wsRoot, '.claude', 'envs.json');

    // 检查是否已存在
    if (fs.existsSync(projectSettingsPath)) {
        const result = await vscode.window.showWarningMessage(
            '项目已存在 .claude/settings.json，是否覆盖？',
            '覆盖', '取消'
        );
        if (result !== '覆盖') return;
    }

    // 从全局设置复制当前配置
    const globalSettings = readSettingsRaw(path.join(os.homedir(), '.claude', 'settings.json'));

    // 创建项目级配置
    const dir = path.dirname(projectSettingsPath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }

    // 写入 settings.json
    fs.writeFileSync(projectSettingsPath, JSON.stringify(globalSettings || { env: {} }, null, 2), 'utf-8');

    // 从全局 envs.json 读取预设，写入项目级 envs.json
    const globalEnvs = readGlobalEnvs();
    const presets = (globalEnvs && globalEnvs.presets)
        ? globalEnvs.presets
        : DEFAULT_PRESETS;
    fs.writeFileSync(projectEnvsPath, JSON.stringify({ presets: presets }, null, 2), 'utf-8');

    // 添加到 .gitignore
    addToGitignore(wsRoot);

    updateStatusBar();
    vscode.window.showInformationMessage(
        `✅ 项目级配置已初始化！\n📁 ${projectSettingsPath}\n📁 ${projectEnvsPath}\n📝 已添加到 .gitignore`
    );
}

// 确保 .claude 配置文件被 .gitignore 排除
function addToGitignore(wsRoot) {
    const gitignorePath = path.join(wsRoot, '.gitignore');
    const ignorePatterns = [
        '# Claude Code 配置（含 API Key，不要提交）',
        '.claude/settings.json',
        '.claude/envs.json',
        '.claude/settings.local.json'
    ];

    let gitignoreContent = '';
    if (fs.existsSync(gitignorePath)) {
        gitignoreContent = fs.readFileSync(gitignorePath, 'utf-8');
    }

    // 只追加还不存在的条目
    const missingPatterns = ignorePatterns.filter(p =>
        !p.startsWith('#') && !gitignoreContent.includes(p)
    );

    if (missingPatterns.length > 0) {
        const trailing = gitignoreContent.endsWith('\n') ? '' : '\n';
        const newContent = trailing + ignorePatterns.join('\n') + '\n';
        fs.appendFileSync(gitignorePath, newContent, 'utf-8');
        console.log(`已更新 .gitignore: ${gitignorePath}`);
    }
}

// 读取指定路径的 settings.json
function readSettingsRaw(settingsPath) {
    try {
        if (fs.existsSync(settingsPath)) {
            const content = fs.readFileSync(settingsPath, 'utf-8');
            return JSON.parse(content);
        }
    }
    catch { }
    return {};
}

// 读取当前作用域的 settings.json
function readSettings() {
    return readSettingsRaw(getSettingsPath());
}

// 写入当前作用域的 settings.json
function writeSettings(settings) {
    const settingsPath = getSettingsPath();
    try {
        const dir = path.dirname(settingsPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf-8');
        return true;
    }
    catch (e) {
        vscode.window.showErrorMessage(`写入 settings.json 失败: ${e}`);
        return false;
    }
}

// 读取当前作用域的 envs.json
// 项目模式下如果不存在，自动回退到全局预设
function readEnvsConfig() {
    const configPath = getEnvsConfigPath();
    try {
        if (fs.existsSync(configPath)) {
            const content = fs.readFileSync(configPath, 'utf-8');
            return JSON.parse(content);
        }
    }
    catch { }

    // 项目模式下：回退到全局预设
    if (currentScope === 'project') {
        const globalEnvs = readGlobalEnvs();
        if (globalEnvs && globalEnvs.presets) {
            return globalEnvs;
        }
    }
    return { presets: DEFAULT_PRESETS };
}

// ==================== 预设与切换 ====================

// 获取所有预设
function getAllPresets() {
    const config = readEnvsConfig();
    return config.presets || [];
}

// 获取当前 env 配置的标识
function getCurrentPresetId() {
    const settings = readSettings();
    const baseUrl = settings.env?.ANTHROPIC_BASE_URL || '';
    const presets = getAllPresets();
    const matched = presets.find(p => p.env.ANTHROPIC_BASE_URL === baseUrl);
    return matched?.id || '';
}

// 切换到指定预设
async function switchToPreset(preset) {
    // 项目模式下检查是否有工作区
    if (currentScope === 'project' && !getWorkspaceRoot()) {
        vscode.window.showWarningMessage('请先打开一个项目文件夹，或切换到全局模式');
        return false;
    }

    const settings = readSettings();
    settings.env = {};
    settings.env = { ...preset.env };
    if (writeSettings(settings)) {
        updateStatusBar(preset);
        const scopeName = getScopeLabel();
        vscode.window.showInformationMessage(`已切换到: ${preset.label}（${scopeName}级）`);
        return true;
    }
    return false;
}

// ==================== 状态栏 ====================

let statusBarItem;

function updateStatusBar(preset) {
    if (statusBarItem) {
        const currentPreset = preset || getCurrentPreset();
        const scopeIcon = getScopeIcon();
        const scopeLabel = getScopeLabel();
        const wsName = getWorkspaceRoot() ? path.basename(getWorkspaceRoot()) : '';
        const scopeInfo = currentScope === 'project' && wsName ? ` [${wsName}]` : '';

        statusBarItem.text = `${scopeIcon} ${currentPreset?.label || '未设置'} (${scopeLabel}${scopeInfo})`;
        statusBarItem.tooltip =
            `当前配置: ${currentPreset?.label || '未知'}\n` +
            `${currentPreset?.description || ''}\n` +
            `作用域: ${scopeLabel}\n` +
            `配置文件: ${getSettingsPath()}\n\n` +
            `点击切换配置`;
        statusBarItem.show();
    }
}

function getCurrentPreset() {
    const currentId = getCurrentPresetId();
    const presets = getAllPresets();
    return presets.find(p => p.id === currentId);
}

// ==================== 命令实现 ====================

async function selectEnv() {
    if (currentScope === 'project' && !getWorkspaceRoot()) {
        vscode.window.showWarningMessage('请先打开一个项目文件夹，或切换到全局模式');
        return;
    }

    const currentId = getCurrentPresetId();
    const presets = getAllPresets();
    const scopeLabel = getScopeLabel();

    const items = [
        { label: `选择环境配置（当前: ${scopeLabel}级）`, kind: vscode.QuickPickItemKind.Separator },
        ...presets.map(p => ({
            label: p.label,
            description: p.description,
            detail: p.env.ANTHROPIC_BASE_URL,
            picked: p.id === currentId
        }))
    ];

    const selected = await vscode.window.showQuickPick(items, {
        placeHolder: `当前: ${getCurrentPreset()?.label || '未知'}（${scopeLabel}级）`,
        matchOnDescription: true,
        matchOnDetail: true
    });

    if (!selected) return;

    const preset = presets.find(p => p.label === selected.label);
    if (preset) {
        await switchToPreset(preset);
    }
}

function showConfigPanel() {
    if (currentScope === 'project' && !getWorkspaceRoot()) {
        vscode.window.showWarningMessage('请先打开一个项目文件夹，或切换到全局模式');
        return;
    }

    const currentPreset = getCurrentPreset();
    const presets = getAllPresets();
    const scopeLabel = getScopeLabel();
    const settingsPath = getSettingsPath();

    const panel = vscode.window.createWebviewPanel(
        'ccSwitchConfig',
        `Claude Code 环境配置（${scopeLabel}级）`,
        vscode.ViewColumn.One,
        { enableScripts: true, retainContextWhenHidden: true }
    );

    panel.webview.html = getConfigHtml(currentPreset, presets, scopeLabel, settingsPath);
    panel.webview.onDidReceiveMessage(async (message) => {
        if (message.command === 'switch') {
            const preset = presets.find(p => p.id === message.presetId);
            if (preset && await switchToPreset(preset)) {
                panel.webview.html = getConfigHtml(preset, getAllPresets(), getScopeLabel(), getSettingsPath());
            }
        }
        else if (message.command === 'edit') {
            vscode.commands.executeCommand('vscode.open', vscode.Uri.file(getSettingsPath()));
        }
        else if (message.command === 'openEnvs') {
            vscode.commands.executeCommand('vscode.open', vscode.Uri.file(getEnvsConfigPath()));
        }
    });
}

function maskValue(key, value) {
    if (key.includes('TOKEN') || key.includes('KEY') || key.includes('SECRET')) {
        return value ? '******' : '(未设置)';
    }
    return value || '(未设置)';
}

function getConfigHtml(currentPreset, presets, scopeLabel, settingsPath) {
    const presetsHtml = presets.map(p => {
        const isActive = currentPreset?.id === p.id;
        return `
		<div class="preset ${isActive ? 'active' : ''}" onclick="switchPreset('${p.id}')">
			<div class="preset-header">
				<div class="preset-name">${p.label}</div>
				${isActive ? '<div class="preset-badge">当前</div>' : ''}
			</div>
			<div class="preset-desc">${p.description}</div>
			<div class="preset-url">${p.env.ANTHROPIC_BASE_URL || '未设置 URL'}</div>
		</div>
	`;
    }).join('');

    const envKeys = currentPreset ? Object.keys(currentPreset.env) : [];
    const envHtml = envKeys.map(key => `
		<div class="env-item">
			<div class="env-key">${key}</div>
			<div class="env-value">${maskValue(key, currentPreset.env[key])}</div>
		</div>
	`).join('');

    return `<!DOCTYPE html>
<html>
<head>
	<style>
		* { box-sizing: border-box; }
		body {
			font-family: var(--vscode-font-family);
			padding: 20px;
			color: var(--vscode-foreground);
			background-color: var(--vscode-editor-background);
			margin: 0;
		}
		.container { max-width: 700px; margin: 0 auto; }
		h2 {
			margin-bottom: 5px;
			font-size: 18px;
			display: flex;
			align-items: center;
			gap: 8px;
		}
		.subtitle {
			font-size: 12px;
			color: var(--vscode-descriptionForeground);
			margin-bottom: 20px;
		}
		.scope-badge {
			display: inline-block;
			background: var(--vscode-badge-background);
			color: var(--vscode-badge-foreground);
			font-size: 11px;
			padding: 2px 8px;
			border-radius: 10px;
			margin-left: 8px;
		}
		.current {
			background: var(--vscode-editor-selectionBackground);
			padding: 16px;
			border-radius: 8px;
			margin-bottom: 20px;
		}
		.current-header {
			display: flex;
			justify-content: space-between;
			align-items: center;
			margin-bottom: 12px;
		}
		.current-title {
			font-size: 11px;
			color: var(--vscode-descriptionForeground);
			text-transform: uppercase;
			letter-spacing: 0.5px;
		}
		.current-label {
			font-size: 18px;
			font-weight: 600;
		}
		.env-list {
			display: grid;
			gap: 8px;
			margin-top: 12px;
		}
		.env-item {
			display: grid;
			grid-template-columns: 200px 1fr;
			gap: 12px;
			font-size: 12px;
		}
		.env-key {
			color: var(--vscode-textLink-foreground);
			font-family: var(--vscode-editor-font-family);
		}
		.env-value {
			color: var(--vscode-foreground);
			font-family: var(--vscode-editor-font-family);
			word-break: break-all;
		}
		.section-title {
			font-size: 13px;
			font-weight: 600;
			margin-bottom: 12px;
			color: var(--vscode-foreground);
		}
		.presets {
			display: grid;
			gap: 10px;
		}
		.preset {
			background: var(--vscode-editor-background);
			border: 1px solid var(--vscode-panel-border);
			border-radius: 6px;
			padding: 12px;
			cursor: pointer;
			transition: all 0.15s ease;
		}
		.preset:hover {
			background: var(--vscode-editor-inactiveSelectionBackground);
			border-color: var(--vscode-focusBorder);
		}
		.preset.active {
			background: var(--vscode-editor-selectionBackground);
			border-color: var(--vscode-focusBorder);
		}
		.preset-header {
			display: flex;
			justify-content: space-between;
			align-items: center;
		}
		.preset-name {
			font-weight: 600;
			font-size: 14px;
		}
		.preset-badge {
			background: var(--vscode-textLink-foreground);
			color: var(--vscode-editor-background);
			font-size: 10px;
			padding: 2px 6px;
			border-radius: 3px;
		}
		.preset-desc {
			font-size: 12px;
			color: var(--vscode-descriptionForeground);
			margin: 4px 0;
		}
		.preset-url {
			font-size: 11px;
			color: var(--vscode-textLink-foreground);
			font-family: var(--vscode-editor-font-family);
		}
		.buttons {
			display: flex;
			gap: 10px;
			margin-top: 20px;
		}
		button {
			flex: 1;
			padding: 10px 16px;
			border: none;
			cursor: pointer;
			font-size: 13px;
			border-radius: 4px;
			font-family: var(--vscode-font-family);
		}
		.edit-btn {
			background-color: var(--vscode-button-secondaryBackground);
			color: var(--vscode-button-secondaryForeground);
		}
		.edit-btn:hover {
			background-color: var(--vscode-button-secondaryHoverBackground);
		}
		.envs-btn {
			background-color: transparent;
			border: 1px solid var(--vscode-panel-border);
			color: var(--vscode-foreground);
		}
		.envs-btn:hover {
			background-color: var(--vscode-editor-inactiveSelectionBackground);
		}
	</style>
</head>
<body>
	<div class="container">
		<h2><span style="font-size: 20px;">🔧</span> Claude Code 环境配置
			<span class="scope-badge">${scopeLabel}级</span>
		</h2>
		<div class="subtitle">配置文件: ${settingsPath}</div>

		${currentPreset ? `
		<div class="current">
			<div class="current-header">
				<div>
					<div class="current-title">当前配置</div>
					<div class="current-label">${currentPreset.label}</div>
				</div>
			</div>
			<div class="env-list">
				${envHtml}
			</div>
		</div>
		` : ''}

		<div class="section-title">配置预设</div>
		<div class="presets">
			${presetsHtml}
		</div>

		<div class="buttons">
			<button class="edit-btn" onclick="editSettings()">编辑 settings.json</button>
			<button class="envs-btn" onclick="openEnvsConfig()">编辑预设配置</button>
		</div>
	</div>

	<script>
		const vscode = acquireVsCodeApi();

		function switchPreset(presetId) {
			vscode.postMessage({ command: 'switch', presetId: presetId });
		}

		function editSettings() {
			vscode.postMessage({ command: 'edit' });
		}

		function openEnvsConfig() {
			vscode.postMessage({ command: 'openEnvs' });
		}
	</script>
</body>
</html>`;
}

// ==================== 插件激活 ====================

function activate(context) {
    console.log('=== Claude Code Env Switcher (Patched) 正在激活 ===');
    extensionContext = context;

    // 恢复上次使用的作用域
    const savedScope = context.globalState.get('ccSwitch.scope', 'project');
    currentScope = savedScope;
    console.log(`当前作用域: ${currentScope}`);

    // 初始化默认配置文件
    initDefaultEnvsConfig();
    // 如果项目模式，也初始化项目级 envs.json
    if (currentScope === 'project' && getWorkspaceRoot()) {
        initDefaultEnvsConfig();
    }

    // 创建状态栏项
    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    updateStatusBar();
    statusBarItem.command = 'ccSwitch.showQuickActions';
    context.subscriptions.push(statusBarItem);
    statusBarItem.show();

    // 注册命令
    const selectCommand = vscode.commands.registerCommand('ccSwitch.selectEnv', selectEnv);
    context.subscriptions.push(selectCommand);

    const configCommand = vscode.commands.registerCommand('ccSwitch.showConfig', showConfigPanel);
    context.subscriptions.push(configCommand);

    const editCommand = vscode.commands.registerCommand('ccSwitch.editSettings', () => {
        vscode.commands.executeCommand('vscode.open', vscode.Uri.file(getSettingsPath()));
    });
    context.subscriptions.push(editCommand);

    const envsCommand = vscode.commands.registerCommand('ccSwitch.editEnvs', () => {
        vscode.commands.executeCommand('vscode.open', vscode.Uri.file(getEnvsConfigPath()));
    });
    context.subscriptions.push(envsCommand);

    // ⭐ 新增：切换作用域
    const toggleCommand = vscode.commands.registerCommand('ccSwitch.toggleScope', toggleScope);
    context.subscriptions.push(toggleCommand);

    // ⭐ 新增：初始化项目配置
    const initCommand = vscode.commands.registerCommand('ccSwitch.initProjectConfig', initProjectConfig);
    context.subscriptions.push(initCommand);

    // 快速操作菜单
    const quickActionsCommand = vscode.commands.registerCommand('ccSwitch.showQuickActions', async () => {
        const scopeLabel = getScopeLabel();
        const actions = [
            {
                label: `$(server) 打开环境配置面板`,
                description: `查看当前配置和所有预设（${scopeLabel}级）`,
                action: 'showConfig'
            },
            {
                label: '$(arrow-swap) 切换环境配置',
                description: `快速切换到其他环境预设（${scopeLabel}级）`,
                action: 'selectEnv'
            },
            {
                label: getScopeIcon() === '$(folder)'
                    ? '$(folder) 切换到全局配置'
                    : '$(gear) 切换到项目级配置',
                description: `当前: ${scopeLabel}级 → 切换到${scopeLabel === '全局' ? '项目' : '全局'}级`,
                action: 'toggleScope'
            },
            {
                label: '$(new-file) 初始化项目级配置',
                description: '在项目根目录创建 .claude/ 配置',
                action: 'initProjectConfig'
            },
            {
                label: '$(edit) 编辑环境预设 (envs.json)',
                description: '修改环境变量配置',
                action: 'editEnvs'
            },
            {
                label: '$(settings-edit) 编辑 Claude Code 设置 (settings.json)',
                description: `修改 Claude Code 配置（${scopeLabel}级）`,
                action: 'editSettings'
            }
        ];

        const selected = await vscode.window.showQuickPick(actions, {
            placeHolder: `当前配置: ${getCurrentPreset()?.label || '未设置'}（${scopeLabel}级）`
        });

        if (selected) {
            switch (selected.action) {
                case 'showConfig':
                    vscode.commands.executeCommand('ccSwitch.showConfig');
                    break;
                case 'selectEnv':
                    vscode.commands.executeCommand('ccSwitch.selectEnv');
                    break;
                case 'toggleScope':
                    vscode.commands.executeCommand('ccSwitch.toggleScope');
                    break;
                case 'initProjectConfig':
                    vscode.commands.executeCommand('ccSwitch.initProjectConfig');
                    break;
                case 'editEnvs':
                    vscode.commands.executeCommand('ccSwitch.editEnvs');
                    break;
                case 'editSettings':
                    vscode.commands.executeCommand('ccSwitch.editSettings');
                    break;
            }
        }
    });
    context.subscriptions.push(quickActionsCommand);

    // 监听工作区变化，更新状态栏
    context.subscriptions.push(
        vscode.workspace.onDidChangeWorkspaceFolders(() => {
            updateStatusBar();
        })
    );
}

function deactivate() { }

//# sourceMappingURL=extension.js.map
