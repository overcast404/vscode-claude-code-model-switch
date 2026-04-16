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

// ==================== 默认预设（兜底） ====================
const DEFAULT_PRESETS = [
    { id: 'qwen', label: 'cc:qwen3.6-plus', description: 'DashScope qwen3.6-plus',
      env: { ANTHROPIC_AUTH_TOKEN: '', ANTHROPIC_BASE_URL: 'https://coding.dashscope.aliyuncs.com/apps/anthropic',
        API_TIMEOUT_MS: '300000', CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '1',
        ANTHROPIC_MODEL: 'qwen3.6-plus', ANTHROPIC_DEFAULT_HAIKU_MODEL: 'qwen3.6-plus',
        ANTHROPIC_DEFAULT_SONNET_MODEL: 'qwen3.6-plus', ANTHROPIC_DEFAULT_OPUS_MODEL: 'qwen3.6-plus' } },
    { id: 'glm5', label: 'cc:GLM-5', description: 'DashScope GLM-5',
      env: { ANTHROPIC_AUTH_TOKEN: '', ANTHROPIC_BASE_URL: 'https://coding.dashscope.aliyuncs.com/apps/anthropic',
        API_TIMEOUT_MS: '300000', CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '1',
        ANTHROPIC_MODEL: 'glm-5', ANTHROPIC_DEFAULT_HAIKU_MODEL: 'glm-5',
        ANTHROPIC_DEFAULT_SONNET_MODEL: 'glm-5', ANTHROPIC_DEFAULT_OPUS_MODEL: 'glm-5' } },
    { id: 'kimi', label: 'cc:kimi-k2.5', description: 'DashScope kimi-k2.5',
      env: { ANTHROPIC_AUTH_TOKEN: '', ANTHROPIC_BASE_URL: 'https://coding.dashscope.aliyuncs.com/apps/anthropic',
        API_TIMEOUT_MS: '300000', CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '1',
        ANTHROPIC_MODEL: 'kimi-k2.5', ANTHROPIC_DEFAULT_HAIKU_MODEL: 'kimi-k2.5',
        ANTHROPIC_DEFAULT_SONNET_MODEL: 'kimi-k2.5', ANTHROPIC_DEFAULT_OPUS_MODEL: 'kimi-k2.5' } },
    { id: 'minimax', label: 'cc:MiniMax-M2.5', description: 'DashScope MiniMax-M2.5',
      env: { ANTHROPIC_AUTH_TOKEN: '', ANTHROPIC_BASE_URL: 'https://coding.dashscope.aliyuncs.com/apps/anthropic',
        API_TIMEOUT_MS: '300000', CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '1',
        ANTHROPIC_MODEL: 'MiniMax-M2.5', ANTHROPIC_DEFAULT_HAIKU_MODEL: 'MiniMax-M2.5',
        ANTHROPIC_DEFAULT_SONNET_MODEL: 'MiniMax-M2.5', ANTHROPIC_DEFAULT_OPUS_MODEL: 'MiniMax-M2.5' } }
];

// ==================== 常量 ====================
let extensionContext;
const GLOBAL_SETTINGS_PATH = path.join(os.homedir(), '.claude', 'settings.json');
const GLOBAL_ENVS_PATH = path.join(os.homedir(), '.claude', 'envs.json');

function getWorkspaceRoot() {
    const folders = vscode.workspace.workspaceFolders;
    return folders && folders.length > 0 ? folders[0].uri.fsPath : null;
}

function getProjectSettingsPath(wsRoot) {
    return wsRoot ? path.join(wsRoot, '.claude', 'settings.json') : null;
}

// ==================== 文件读写 ====================
function readJSON(filePath) {
    try {
        if (fs.existsSync(filePath)) {
            return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        }
    } catch { }
    return null;
}

function writeJSON(filePath, data) {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

function deleteFile(filePath) {
    try { if (fs.existsSync(filePath)) fs.unlinkSync(filePath); } catch { }
}

// ==================== 预设（仅全局） ====================
function initGlobalEnvs() {
    if (!fs.existsSync(GLOBAL_ENVS_PATH)) {
        try {
            const dir = path.dirname(GLOBAL_ENVS_PATH);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            writeJSON(GLOBAL_ENVS_PATH, { presets: DEFAULT_PRESETS });
        } catch (e) { console.error('初始化 envs.json 失败:', e); }
    }
}

function getAllPresets() {
    const config = readJSON(GLOBAL_ENVS_PATH);
    return (config && config.presets) || DEFAULT_PRESETS;
}

function matchPreset(baseUrl) {
    const presets = getAllPresets();
    return presets.find(p => p.env.ANTHROPIC_BASE_URL === baseUrl) || null;
}

// ==================== 配置读取 ====================
function getGlobalPreset() {
    const settings = readJSON(GLOBAL_SETTINGS_PATH);
    const baseUrl = settings?.env?.ANTHROPIC_BASE_URL || '';
    return matchPreset(baseUrl);
}

function getProjectPreset(wsRoot) {
    const projectPath = getProjectSettingsPath(wsRoot);
    if (!projectPath || !fs.existsSync(projectPath)) return null;
    const settings = readJSON(projectPath);
    const baseUrl = settings?.env?.ANTHROPIC_BASE_URL || '';
    return matchPreset(baseUrl);
}

/** 获取当前生效的模型来源 */
function getActiveModel(wsRoot) {
    const projectPreset = getProjectPreset(wsRoot);
    if (projectPreset) {
        return { preset: projectPreset, source: 'project' };
    }
    const globalPreset = getGlobalPreset();
    return { preset: globalPreset, source: 'followGlobal' };
}

// ==================== 配置写入 ====================
async function switchGlobalPreset(preset) {
    const settings = readJSON(GLOBAL_SETTINGS_PATH) || {};
    settings.env = { ...preset.env };
    writeJSON(GLOBAL_SETTINGS_PATH, settings);
    vscode.window.showInformationMessage(`全局模型已切换为: ${preset.label}`);
}

async function switchProjectPreset(wsRoot, preset) {
    if (!wsRoot) return;
    const projectPath = getProjectSettingsPath(wsRoot);
    writeJSON(projectPath, { env: { ...preset.env } });
    addToGitignore(wsRoot);
    vscode.window.showInformationMessage(`项目模型已设置为: ${preset.label}`);
}

async function restoreFollowGlobal(wsRoot) {
    if (!wsRoot) return;
    deleteFile(getProjectSettingsPath(wsRoot));
    vscode.window.showInformationMessage('项目已恢复跟随全局');
}

// ==================== .gitignore ====================
function addToGitignore(wsRoot) {
    const gitignorePath = path.join(wsRoot, '.gitignore');
    const patterns = [
        '# Claude Code 配置（含 API Key，不要提交）',
        '.claude/settings.json',
        '.claude/envs.json',
        '.claude/settings.local.json'
    ];
    let content = '';
    if (fs.existsSync(gitignorePath)) content = fs.readFileSync(gitignorePath, 'utf-8');
    const missing = patterns.filter(p => !p.startsWith('#') && !content.includes(p));
    if (missing.length > 0) {
        const trailing = content.endsWith('\n') ? '' : '\n';
        fs.appendFileSync(gitignorePath, trailing + patterns.join('\n') + '\n', 'utf-8');
    }
}

// ==================== 状态栏 ====================
let statusBarItem;

function updateStatusBar() {
    if (!statusBarItem) return;
    const wsRoot = getWorkspaceRoot();
    const { preset, source } = getActiveModel(wsRoot);
    const wsName = wsRoot ? path.basename(wsRoot) : '';
    const label = preset?.label || '未设置';

    let text, tooltip;
    if (source === 'project') {
        text = `$(folder) ${label}`;
        tooltip = `📂 项目 (${wsName}): ${label}\n📝 项目独立配置\n\n点击切换配置`;
    } else if (wsRoot) {
        text = `$(sync) ${label}`;
        tooltip = `🔄 项目 (${wsName}): 跟随全局 (${label})\n\n点击切换配置`;
    } else {
        text = `$(gear) ${label}`;
        tooltip = `⚙️ 全局: ${label}\n\n点击切换配置`;
    }

    statusBarItem.text = text;
    statusBarItem.tooltip = tooltip;
    statusBarItem.show();
}

// ==================== 快速操作菜单 ====================
async function showQuickActions() {
    const wsRoot = getWorkspaceRoot();
    const { preset, source } = getActiveModel(wsRoot);
    const currentDesc = source === 'project'
        ? `${preset?.label || '未设置'} (项目独立)`
        : `${preset?.label || '未设置'} (跟随全局)`;

    const actions = [
        {
            label: '$(folder) 切换项目模型',
            description: `为当前项目选择模型（打破跟随）`,
            action: 'switchProject'
        },
        {
            label: '$(gear) 切换全局模型',
            description: '设置全局默认模型',
            action: 'switchGlobal'
        }
    ];

    if (source === 'project') {
        actions.push({
            label: '$(sync) 恢复跟随全局',
            description: '删除项目配置，使用全局模型',
            action: 'followGlobal'
        });
    }

    actions.push(
        { label: '$(server) 打开配置面板', description: '查看所有配置', action: 'showConfig' },
        { label: '$(edit) 编辑全局预设 (envs.json)', description: '添加/修改模型预设', action: 'editEnvs' }
    );

    const selected = await vscode.window.showQuickPick(actions, {
        placeHolder: `当前: ${currentDesc}`
    });
    if (!selected) return;

    switch (selected.action) {
        case 'switchProject': await selectProjectModel(); break;
        case 'switchGlobal': await selectGlobalModel(); break;
        case 'followGlobal': await restoreFollowGlobal(wsRoot); updateStatusBar(); break;
        case 'showConfig': showConfigPanel(); break;
        case 'editEnvs':
            vscode.commands.executeCommand('vscode.open', vscode.Uri.file(GLOBAL_ENVS_PATH));
            break;
    }
}

// ==================== 切换模型 ====================
async function selectGlobalModel() {
    const globalPreset = getGlobalPreset();
    const presets = getAllPresets();
    const items = [
        { label: '选择全局模型', kind: vscode.QuickPickItemKind.Separator },
        ...presets.map(p => ({
            label: p.label,
            description: p.description,
            detail: p.env.ANTHROPIC_BASE_URL,
            picked: globalPreset?.id === p.id
        }))
    ];
    const selected = await vscode.window.showQuickPick(items, {
        placeHolder: `当前全局: ${globalPreset?.label || '未设置'}`,
        matchOnDescription: true, matchOnDetail: true
    });
    if (!selected) return;
    const preset = presets.find(p => p.label === selected.label);
    if (preset) { await switchGlobalPreset(preset); updateStatusBar(); }
}

async function selectProjectModel() {
    const wsRoot = getWorkspaceRoot();
    if (!wsRoot) { vscode.window.showWarningMessage('请先打开一个项目'); return; }

    const projectPreset = getProjectPreset(wsRoot);
    const presets = getAllPresets();
    const items = [
        { label: `为项目选择模型`, kind: vscode.QuickPickItemKind.Separator },
        ...presets.map(p => ({
            label: p.label,
            description: p.description,
            detail: p.env.ANTHROPIC_BASE_URL,
            picked: projectPreset?.id === p.id
        }))
    ];
    const selected = await vscode.window.showQuickPick(items, {
        placeHolder: `当前项目: ${projectPreset?.label || '未设置（跟随全局）'}`,
        matchOnDescription: true, matchOnDetail: true
    });
    if (!selected) return;
    const preset = presets.find(p => p.label === selected.label);
    if (preset) { await switchProjectPreset(wsRoot, preset); updateStatusBar(); }
}

// ==================== 配置面板 ====================
function showConfigPanel() {
    const wsRoot = getWorkspaceRoot();
    const { preset: activePreset, source } = getActiveModel(wsRoot);
    const globalPreset = getGlobalPreset();
    const projectPreset = getProjectPreset(wsRoot);
    const presets = getAllPresets();

    const panel = vscode.window.createWebviewPanel(
        'ccSwitchConfig', 'Claude Code 模型配置', vscode.ViewColumn.One,
        { enableScripts: true, retainContextWhenHidden: true }
    );

    panel.webview.html = renderPanel({ globalPreset, projectPreset, activePreset, source, presets, wsRoot });

    panel.webview.onDidReceiveMessage(async (message) => {
        if (message.command === 'switchGlobal') {
            const preset = presets.find(p => p.id === message.presetId);
            if (preset) { await switchGlobalPreset(preset); updateStatusBar(); }
            panel.webview.html = renderPanel({ globalPreset: getGlobalPreset(), projectPreset: getProjectPreset(wsRoot), activePreset: getActiveModel(wsRoot).preset, source: getActiveModel(wsRoot).source, presets, wsRoot });
        }
        if (message.command === 'switchProject') {
            const preset = presets.find(p => p.id === message.presetId);
            if (preset && wsRoot) { await switchProjectPreset(wsRoot, preset); updateStatusBar(); }
            panel.webview.html = renderPanel({ globalPreset: getGlobalPreset(), projectPreset: getProjectPreset(wsRoot), activePreset: getActiveModel(wsRoot).preset, source: getActiveModel(wsRoot).source, presets, wsRoot });
        }
        if (message.command === 'followGlobal') {
            if (wsRoot) { await restoreFollowGlobal(wsRoot); updateStatusBar(); }
            panel.webview.html = renderPanel({ globalPreset: getGlobalPreset(), projectPreset: getProjectPreset(wsRoot), activePreset: getActiveModel(wsRoot).preset, source: getActiveModel(wsRoot).source, presets, wsRoot });
        }
        if (message.command === 'editSettings') {
            vscode.commands.executeCommand('vscode.open', vscode.Uri.file(GLOBAL_SETTINGS_PATH));
        }
        if (message.command === 'editEnvs') {
            vscode.commands.executeCommand('vscode.open', vscode.Uri.file(GLOBAL_ENVS_PATH));
        }
        if (message.command === 'editProjectSettings') {
            if (wsRoot) {
                const pPath = getProjectSettingsPath(wsRoot);
                vscode.commands.executeCommand('vscode.open', vscode.Uri.file(pPath));
            }
        }
    });
}

function maskValue(key, value) {
    if (key.includes('TOKEN') || key.includes('KEY') || key.includes('SECRET')) {
        return value ? '******' : '(未设置)';
    }
    return value || '(未设置)';
}

function presetHtml(p, isActive, clickFn) {
    return `
    <div class="preset ${isActive ? 'active' : ''}" onclick="${clickFn}('${p.id}')">
        <div class="preset-header">
            <div class="preset-name">${p.label}</div>
            ${isActive ? '<div class="badge-active">当前</div>' : ''}
        </div>
        <div class="preset-desc">${p.description}</div>
    </div>`;
}

function envListHtml(preset) {
    if (!preset) return '<div style="color:var(--vscode-descriptionForeground)">未设置</div>';
    return Object.keys(preset.env).map(key => `
        <div class="env-item">
            <div class="env-key">${key}</div>
            <div class="env-value">${maskValue(key, preset.env[key])}</div>
        </div>`).join('');
}

function renderPanel(data) {
    const { globalPreset, projectPreset, activePreset, source, presets, wsRoot } = data;
    const globalHtml = presets.map(p => presetHtml(p, globalPreset?.id === p.id, 'switchGlobal')).join('');
    const projectHtml = wsRoot
        ? `<div class="follow-item ${!projectPreset ? 'active' : ''}" onclick="followGlobal()">
                <div class="follow-name">🔄 跟随全局</div>
                ${!projectPreset ? '<div class="badge-active">当前</div>' : ''}
                <div class="follow-desc">使用全局模型: ${globalPreset?.label || '未设置'}</div>
           </div>` +
          presets.map(p => presetHtml(p, projectPreset?.id === p.id, 'switchProject')).join('')
        : '<div style="color:var(--vscode-descriptionForeground);padding:12px;">请先打开一个项目文件夹</div>';

    const sourceText = source === 'project' ? `📂 项目独立 (${path.basename(wsRoot || '')})` : `🔄 跟随全局 (${globalPreset?.label || '未设置'})`;

    return `<!DOCTYPE html>
<html>
<head>
<style>
    * { box-sizing: border-box; }
    body { font-family: var(--vscode-font-family); padding: 20px; color: var(--vscode-foreground);
           background: var(--vscode-editor-background); margin: 0; }
    .container { max-width: 700px; margin: 0 auto; }
    h2 { font-size: 18px; display: flex; align-items: center; gap: 8px; margin: 0 0 4px; }
    .subtitle { font-size: 12px; color: var(--vscode-descriptionForeground); margin-bottom: 20px; }
    .section { margin-bottom: 24px; }
    .section-title { font-size: 14px; font-weight: 600; margin-bottom: 12px; display: flex; align-items: center; gap: 6px; }
    .current-box { background: var(--vscode-editor-selectionBackground); padding: 16px;
                   border-radius: 8px; margin-bottom: 20px; }
    .current-label { font-size: 18px; font-weight: 600; }
    .current-source { font-size: 12px; margin-top: 4px; }
    .badge { background: var(--vscode-badge-background); color: var(--vscode-badge-foreground);
             font-size: 10px; padding: 2px 8px; border-radius: 8px; }
    .badge-active { background: var(--vscode-textLink-foreground); color: var(--vscode-editor-background);
                    font-size: 10px; padding: 2px 6px; border-radius: 3px; }
    .presets { display: grid; gap: 6px; }
    .preset { background: var(--vscode-editor-background); border: 1px solid var(--vscode-panel-border);
              border-radius: 6px; padding: 10px 12px; cursor: pointer; transition: all 0.15s; }
    .preset:hover { background: var(--vscode-editor-inactiveSelectionBackground); border-color: var(--vscode-focusBorder); }
    .preset.active { background: var(--vscode-editor-selectionBackground); border-color: var(--vscode-focusBorder); }
    .preset-header { display: flex; justify-content: space-between; align-items: center; }
    .preset-name { font-weight: 600; font-size: 14px; }
    .preset-desc { font-size: 12px; color: var(--vscode-descriptionForeground); margin-top: 2px; }
    .follow-item { background: var(--vscode-editor-background); border: 1px solid var(--vscode-panel-border);
                   border-radius: 6px; padding: 10px 12px; cursor: pointer; transition: all 0.15s;
                   display: flex; align-items: center; gap: 10px; margin-bottom: 6px; }
    .follow-item:hover { background: var(--vscode-editor-inactiveSelectionBackground); border-color: var(--vscode-focusBorder); }
    .follow-item.active { background: var(--vscode-editor-selectionBackground); border-color: var(--vscode-focusBorder); }
    .follow-name { font-weight: 600; font-size: 14px; }
    .follow-desc { font-size: 11px; color: var(--vscode-descriptionForeground); }
    .env-item { display: grid; grid-template-columns: 220px 1fr; gap: 12px; font-size: 12px; margin-bottom: 4px; }
    .env-key { color: var(--vscode-textLink-foreground); font-family: var(--vscode-editor-font-family); }
    .env-value { font-family: var(--vscode-editor-font-family); word-break: break-all; }
    .btn-row { display: flex; gap: 10px; margin-top: 16px; }
    .btn { padding: 10px 16px; border: none; cursor: pointer; font-size: 13px;
           border-radius: 4px; font-family: var(--vscode-font-family); }
    .btn-secondary { background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); }
    .btn-secondary:hover { background: var(--vscode-button-secondaryHoverBackground); }
    .btn-outline { background: transparent; border: 1px solid var(--vscode-panel-border); color: var(--vscode-foreground); }
    .btn-outline:hover { background: var(--vscode-editor-inactiveSelectionBackground); }
</style>
</head>
<body>
<div class="container">
    <h2>🔧 Claude Code 模型配置</h2>
    <div class="subtitle">全局 + 项目双模式</div>

    <div class="current-box">
        <div style="font-size:11px;color:var(--vscode-descriptionForeground);text-transform:uppercase;">当前生效</div>
        <div class="current-label">${activePreset?.label || '未设置'}</div>
        <div class="current-source">${sourceText}</div>
    </div>

    <div class="section">
        <div class="section-title">⚙️ 全局模型 <span class="badge">所有项目默认</span></div>
        <div class="presets">${globalHtml}</div>
        <div style="margin-top:8px;font-size:11px;color:var(--vscode-descriptionForeground)">环境变量:</div>
        <div style="padding-left:12px">${envListHtml(globalPreset)}</div>
    </div>

    <div class="section">
        <div class="section-title">📂 项目模型 ${wsRoot ? `<span class="badge">${path.basename(wsRoot)}</span>` : ''}</div>
        ${wsRoot ? `<div class="presets">${projectHtml}</div>`
            : '<div style="color:var(--vscode-descriptionForeground);padding:12px;">请先打开一个项目文件夹</div>'}
    </div>

    <div class="btn-row">
        <button class="btn btn-secondary" onclick="editSettings()">编辑全局 settings.json</button>
        <button class="btn btn-outline" onclick="editEnvs()">编辑预设 (envs.json)</button>
        ${wsRoot ? '<button class="btn btn-outline" onclick="editProjectSettings()">编辑项目 settings.json</button>' : ''}
    </div>
</div>
<script>
const vscode = acquireVsCodeApi();
function switchGlobal(id) { vscode.postMessage({command:'switchGlobal',presetId:id}); }
function switchProject(id) { vscode.postMessage({command:'switchProject',presetId:id}); }
function followGlobal() { vscode.postMessage({command:'followGlobal'}); }
function editSettings() { vscode.postMessage({command:'editSettings'}); }
function editEnvs() { vscode.postMessage({command:'editEnvs'}); }
function editProjectSettings() { vscode.postMessage({command:'editProjectSettings'}); }
</script>
</body>
</html>`;
}

// ==================== 激活 ====================
function activate(context) {
    extensionContext = context;
    initGlobalEnvs();

    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBarItem.command = 'ccSwitch.showQuickActions';
    updateStatusBar();
    statusBarItem.show();
    context.subscriptions.push(statusBarItem);

    context.subscriptions.push(vscode.commands.registerCommand('ccSwitch.selectEnv', showQuickActions));
    context.subscriptions.push(vscode.commands.registerCommand('ccSwitch.showConfig', showConfigPanel));
    context.subscriptions.push(vscode.commands.registerCommand('ccSwitch.editSettings', () => {
        vscode.commands.executeCommand('vscode.open', vscode.Uri.file(GLOBAL_SETTINGS_PATH));
    }));
    context.subscriptions.push(vscode.commands.registerCommand('ccSwitch.editEnvs', () => {
        vscode.commands.executeCommand('vscode.open', vscode.Uri.file(GLOBAL_ENVS_PATH));
    }));
    context.subscriptions.push(vscode.commands.registerCommand('ccSwitch.showQuickActions', showQuickActions));

    context.subscriptions.push(
        vscode.workspace.onDidChangeWorkspaceFolders(() => updateStatusBar())
    );
}

function deactivate() { }
