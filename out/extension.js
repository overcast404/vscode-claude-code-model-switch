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

// ==================== 默认供应商（兜底） ====================
const ENVS_VERSION = 2;
const DEFAULT_PROVIDERS = [
    { id: 'dashscope', label: 'DashScope', description: '阿里云百炼 DashScope API',
      env: { ANTHROPIC_AUTH_TOKEN: '', ANTHROPIC_BASE_URL: 'https://coding.dashscope.aliyuncs.com/apps/anthropic',
        API_TIMEOUT_MS: '300000', CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '1' },
      models: [
        { id: 'cc:qwen3.6-plus', label: 'cc:qwen3.6-plus', description: 'DashScope qwen3.6-plus',
          env: { ANTHROPIC_MODEL: 'qwen3.6-plus', ANTHROPIC_DEFAULT_HAIKU_MODEL: 'qwen3.6-plus',
            ANTHROPIC_DEFAULT_SONNET_MODEL: 'qwen3.6-plus', ANTHROPIC_DEFAULT_OPUS_MODEL: 'qwen3.6-plus' } },
        { id: 'cc:GLM-5', label: 'cc:GLM-5', description: 'DashScope GLM-5',
          env: { ANTHROPIC_MODEL: 'glm-5', ANTHROPIC_DEFAULT_HAIKU_MODEL: 'glm-5',
            ANTHROPIC_DEFAULT_SONNET_MODEL: 'glm-5', ANTHROPIC_DEFAULT_OPUS_MODEL: 'glm-5' } },
        { id: 'cc:kimi-k2.5', label: 'cc:kimi-k2.5', description: 'DashScope kimi-k2.5',
          env: { ANTHROPIC_MODEL: 'kimi-k2.5', ANTHROPIC_DEFAULT_HAIKU_MODEL: 'kimi-k2.5',
            ANTHROPIC_DEFAULT_SONNET_MODEL: 'kimi-k2.5', ANTHROPIC_DEFAULT_OPUS_MODEL: 'kimi-k2.5' } },
        { id: 'cc:MiniMax-M2.5', label: 'cc:MiniMax-M2.5', description: 'DashScope MiniMax-M2.5',
          env: { ANTHROPIC_MODEL: 'MiniMax-M2.5', ANTHROPIC_DEFAULT_HAIKU_MODEL: 'MiniMax-M2.5',
            ANTHROPIC_DEFAULT_SONNET_MODEL: 'MiniMax-M2.5', ANTHROPIC_DEFAULT_OPUS_MODEL: 'MiniMax-M2.5' } }
      ] }
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
    return wsRoot ? path.join(wsRoot, '.claude', 'settings.local.json') : null;
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

// ==================== 供应商 & 预设（仅全局） ====================
function flattenProviders(providers) {
    const result = [];
    for (const p of providers) {
        for (const m of (p.models || [])) {
            result.push({
                id: m.id,
                label: m.label || m.id,
                description: m.description || p.description || '',
                env: { ...(p.env || {}), ...(m.env || {}) },
                _providerId: p.id,
                _providerLabel: p.label || p.id
            });
        }
    }
    return result;
}

function migratePresetsToProviders(presets) {
    const groups = new Map();
    for (const preset of presets) {
        const key = `${preset.env.ANTHROPIC_BASE_URL || ''}::${preset.env.ANTHROPIC_AUTH_TOKEN || ''}`;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(preset);
    }
    return Array.from(groups.entries()).map(([, group]) => {
        const sharedKeys = ['ANTHROPIC_BASE_URL', 'ANTHROPIC_AUTH_TOKEN', 'API_TIMEOUT_MS', 'CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC'];
        const sharedEnv = {};
        for (const k of sharedKeys) {
            const val = group[0].env[k];
            if (val !== undefined && group.every(p => p.env[k] === val)) sharedEnv[k] = val;
        }
        const url = group[0].env.ANTHROPIC_BASE_URL || '';
        const hostname = url.replace('https://', '').split('/')[0] || 'provider';
        const pDesc = group[0].description || hostname;
        return {
            id: hostname.replace(/[^a-zA-Z0-9_-]/g, '_'),
            label: hostname,
            description: pDesc,
            env: sharedEnv,
            models: group.map(p => {
                const mEnv = { ...p.env };
                for (const k of Object.keys(sharedEnv)) delete mEnv[k];
                return { id: p.id, label: p.label || p.id, description: p.description || '', env: mEnv };
            })
        };
    });
}

function getAllProviders() {
    const data = readJSON(GLOBAL_ENVS_PATH);
    if (!data) return JSON.parse(JSON.stringify(DEFAULT_PROVIDERS));
    if (data.version === 2 && Array.isArray(data.providers)) return data.providers;
    if (Array.isArray(data.presets)) {
        const providers = migratePresetsToProviders(data.presets);
        try { writeJSON(GLOBAL_ENVS_PATH, { version: ENVS_VERSION, providers }); } catch (e) { console.error('迁移 envs.json 失败:', e); }
        return providers;
    }
    return JSON.parse(JSON.stringify(DEFAULT_PROVIDERS));
}

function saveAllProviders(providers) {
    writeJSON(GLOBAL_ENVS_PATH, { version: ENVS_VERSION, providers });
}

// ==================== 供应商 CRUD ====================
function findModel(modelId) {
    const providers = getAllProviders();
    for (const p of providers) {
        const m = p.models.find(x => x.id === modelId);
        if (m) return { provider: p, model: m };
    }
    return null;
}

function addModelToProvider(providerId, model) {
    const providers = getAllProviders();
    const p = providers.find(x => x.id === providerId);
    if (!p || p.models.find(x => x.id === model.id)) return false;
    p.models.push(model);
    saveAllProviders(providers);
    return true;
}

function addProviderWithModel(providerData, model) {
    const providers = getAllProviders();
    if (providers.find(x => x.id === providerData.id)) return false;
    providerData.models = [model];
    providers.push(providerData);
    saveAllProviders(providers);
    return true;
}

function updateModel(modelId, updated) {
    const providers = getAllProviders();
    for (const p of providers) {
        const idx = p.models.findIndex(x => x.id === modelId);
        if (idx >= 0) { p.models[idx] = updated; saveAllProviders(providers); return true; }
    }
    return false;
}

function deleteModel(modelId) {
    const providers = getAllProviders();
    for (const p of providers) {
        const idx = (p.models || []).findIndex(x => x.id === modelId);
        if (idx >= 0) {
            p.models.splice(idx, 1);
            if (p.models.length === 0) {
                const pIdx = providers.indexOf(p);
                if (pIdx >= 0) providers.splice(pIdx, 1);
            }
            saveAllProviders(providers);
            return true;
        }
    }
    return false;
}

function getModelCount() {
    return getAllProviders().reduce((sum, p) => sum + (p.models?.length || 0), 0);
}

function getAllPresets() {
    return flattenProviders(getAllProviders());
}

function matchPreset(presetId) {
    const presets = getAllPresets();
    return presets.find(p => p.id === presetId) || null;
}

function initGlobalEnvs() {
    if (!fs.existsSync(GLOBAL_ENVS_PATH)) {
        try {
            const dir = path.dirname(GLOBAL_ENVS_PATH);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            writeJSON(GLOBAL_ENVS_PATH, { version: ENVS_VERSION, providers: DEFAULT_PROVIDERS });
        } catch (e) { console.error('初始化 envs.json 失败:', e); }
    }
}

// ==================== 配置读取 ====================
function getGlobalPreset() {
    const settings = readJSON(GLOBAL_SETTINGS_PATH);
    const presetId = settings?.presetId || '';
    return matchPreset(presetId);
}

function getProjectPreset(wsRoot) {
    const projectPath = getProjectSettingsPath(wsRoot);
    if (!projectPath || !fs.existsSync(projectPath)) return null;

    const settings = readJSON(projectPath);
    if (!settings) return null;

    const presetLabel = settings.presetId || '';

    // 情况1: 有 presetId，尝试匹配预设
    if (presetLabel) {
        const matched = matchPreset(presetLabel);
        if (matched) return matched;
        // presetId 存在但匹配不到预设，返回孤立配置标记
        if (settings.env && Object.keys(settings.env).length > 0) {
            return {
                id: `(预设丢失: ${presetLabel})`,
                description: '预设已被删除，环境变量仍在生效',
                env: settings.env,
                _orphaned: true
            };
        }
        // 有 presetId 但没有 env，预设也找不到，视为跟随全局
        return null;
    }

    // 情况2: 没有 presetId 但有 env，视为自定义配置
    if (settings.env && Object.keys(settings.env).length > 0) {
        return {
            id: '自定义配置',
            description: '手动配置的环境变量',
            env: settings.env,
            _custom: true
        };
    }

    // 文件存在但内容为空或只有非相关字段
    return null;
}

/** 获取当前生效的模型来源 */
function getActiveModel(wsRoot) {
    const projectPreset = getProjectPreset(wsRoot);
    if (projectPreset) {
        if (projectPreset._orphaned) {
            return { preset: projectPreset, source: 'project_orphaned' };
        }
        if (projectPreset._custom) {
            return { preset: projectPreset, source: 'project_custom' };
        }
        return { preset: projectPreset, source: 'project' };
    }
    const globalPreset = getGlobalPreset();
    return { preset: globalPreset, source: 'followGlobal' };
}

// ==================== 配置写入 ====================
async function switchGlobalPreset(preset) {
    const settings = readJSON(GLOBAL_SETTINGS_PATH) || {};
    settings.env = { ...preset.env };
    settings.presetId = preset.id;
    writeJSON(GLOBAL_SETTINGS_PATH, settings);
    vscode.window.showInformationMessage(`全局模型已切换为: ${preset.id}`);
}

async function switchProjectPreset(wsRoot, preset) {
    if (!wsRoot) return;
    const projectPath = getProjectSettingsPath(wsRoot);
    const existing = readJSON(projectPath) || {};

    // 合并环境变量：保留用户添加的自定义变量，预设变量覆盖
    const mergedEnv = { ...existing.env, ...preset.env };

    existing.env = mergedEnv;
    existing.presetId = preset.id;
    writeJSON(projectPath, existing);
    addToGitignore(wsRoot);
    vscode.window.showInformationMessage(`项目模型已设置为: ${preset.id}`);
}

async function restoreFollowGlobal(wsRoot) {
    if (!wsRoot) return;
    const projectPath = getProjectSettingsPath(wsRoot);
    const existing = readJSON(projectPath) || {};

    // 只删除 env 和 presetId 字段，保留其他配置
    delete existing.env;
    delete existing.presetId;

    // 如果文件为空对象，则删除文件；否则写入保留的配置
    if (Object.keys(existing).length === 0) {
        deleteFile(projectPath);
    } else {
        writeJSON(projectPath, existing);
    }

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
    const label = preset?.id || '未设置';

    let text, tooltip;
    if (source === 'project' || source === 'project_orphaned' || source === 'project_custom') {
        const icon = source === 'project_orphaned' ? '$(warning)' : (source === 'project_custom' ? '$(edit)' : '$(folder)');
        text = `${icon} ${label} 项目(${wsName})`;
        const extraInfo = source === 'project_orphaned'
            ? '\n⚠️ 预设已丢失'
            : (source === 'project_custom' ? '\n📝 自定义配置' : '\n📝 项目独立配置');
        tooltip = `📂 项目 (${wsName}): ${label}${extraInfo}\n\n点击切换配置`;
    } else if (wsRoot) {
        text = `$(sync) ${label} [跟随全局]`;
        tooltip = `🔄 跟随全局 (${label})\n\n点击切换配置`;
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
        ? `${preset?.id || '未设置'} (项目独立)`
        : `${preset?.id || '未设置'} (跟随全局)`;

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
            label: p.id,
            description: p.description,
            detail: p.env.ANTHROPIC_BASE_URL,
            picked: globalPreset?.id === p.id
        }))
    ];
    const selected = await vscode.window.showQuickPick(items, {
        placeHolder: `当前全局: ${globalPreset?.id || '未设置'}`,
        matchOnDescription: true, matchOnDetail: true
    });
    if (!selected) return;
    const preset = presets.find(p => p.id === selected.label);
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
            label: p.id,
            description: p.description,
            detail: p.env.ANTHROPIC_BASE_URL,
            picked: projectPreset?.id === p.id
        }))
    ];
    const selected = await vscode.window.showQuickPick(items, {
        placeHolder: `当前项目: ${projectPreset?.id || '未设置（跟随全局）'}`,
        matchOnDescription: true, matchOnDetail: true
    });
    if (!selected) return;
    const preset = presets.find(p => p.id === selected.label);
    if (preset) { await switchProjectPreset(wsRoot, preset); updateStatusBar(); }
}

// ==================== 配置面板 ====================
function showConfigPanel() {
    const wsRoot = getWorkspaceRoot();
    const { preset: activePreset, source } = getActiveModel(wsRoot);
    const globalPreset = getGlobalPreset();
    const projectPreset = getProjectPreset(wsRoot);
    const presets = getAllPresets();
    const providers = getAllProviders();

    const panel = vscode.window.createWebviewPanel(
        'ccSwitchConfig', 'Claude Code 模型配置', vscode.ViewColumn.One,
        { enableScripts: true, retainContextWhenHidden: true }
    );

    panel.webview.html = renderPanel({ globalPreset, projectPreset, activePreset, source, presets, providers, wsRoot });

    panel.webview.onDidReceiveMessage(async (message) => {
        if (message.command === 'switchGlobal') {
            const preset = getAllPresets().find(p => p.id === message.presetId);
            if (preset) { await switchGlobalPreset(preset); updateStatusBar(); }
            refreshPanelView(panel, wsRoot);
        }
        if (message.command === 'switchProject') {
            const preset = getAllPresets().find(p => p.id === message.presetId);
            if (preset && wsRoot) { await switchProjectPreset(wsRoot, preset); updateStatusBar(); }
            refreshPanelView(panel, wsRoot);
        }
        if (message.command === 'followGlobal') {
            if (wsRoot) { await restoreFollowGlobal(wsRoot); updateStatusBar(); }
            refreshPanelView(panel, wsRoot);
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
        if (message.command === 'addProvider') {
            if (addProviderWithModel(message.provider, message.model)) {
                updateStatusBar();
                refreshPanelView(panel, wsRoot);
            } else {
                vscode.window.showErrorMessage(`供应商 "${message.provider.id}" 已存在`);
            }
        }
        if (message.command === 'addModel') {
            if (addModelToProvider(message.providerId, message.model)) {
                updateStatusBar();
                refreshPanelView(panel, wsRoot);
            } else {
                vscode.window.showErrorMessage('添加模型失败：供应商不存在或模型 ID 重复');
            }
        }
        if (message.command === 'updateProvider') {
            const providers = getAllProviders();
            const idx = providers.findIndex(p => p.id === message.providerId);
            if (idx >= 0) {
                const models = providers[idx].models;
                providers[idx] = message.provider;
                providers[idx].models = models;
                saveAllProviders(providers);
                updateStatusBar();
                refreshPanelView(panel, wsRoot);
            }
        }
        if (message.command === 'updateModel') {
            if (updateModel(message.modelId, message.model)) {
                updateStatusBar();
                refreshPanelView(panel, wsRoot);
            }
        }
        if (message.command === 'deleteProvider') {
            const allProviders = getAllProviders();
            if (allProviders.length <= 1) {
                vscode.window.showWarningMessage('至少需要保留一个供应商');
                return;
            }
            const idx = allProviders.findIndex(p => p.id === message.providerId);
            if (idx >= 0) {
                allProviders.splice(idx, 1);
                saveAllProviders(allProviders);
                updateStatusBar();
                refreshPanelView(panel, wsRoot);
            }
        }
        if (message.command === 'deleteModel') {
            if (getModelCount() <= 1) {
                vscode.window.showWarningMessage('至少需要保留一个模型');
                return;
            }
            if (deleteModel(message.modelId)) {
                updateStatusBar();
                refreshPanelView(panel, wsRoot);
            }
        }
    });
}

function refreshPanelView(panel, wsRoot) {
    const freshProviders = getAllProviders();
    const freshPresets = getAllPresets();
    panel.webview.html = renderPanel({
        globalPreset: getGlobalPreset(),
        projectPreset: getProjectPreset(wsRoot),
        activePreset: getActiveModel(wsRoot).preset,
        source: getActiveModel(wsRoot).source,
        presets: freshPresets,
        providers: freshProviders,
        wsRoot
    });
}

function maskValue(key, value) {
    if (key.includes('TOKEN') || key.includes('KEY') || key.includes('SECRET')) {
        return value ? '******' : '(未设置)';
    }
    return value || '(未设置)';
}

function envListHtml(preset) {
    if (!preset) return '<div class="no-workspace">未设置</div>';
    return Object.keys(preset.env).map(key => `
        <div class="env-item">
            <div class="env-key">${key}</div>
            <div class="env-value">${maskValue(key, preset.env[key])}</div>
        </div>`).join('');
}

function renderPanel(data) {
    const { globalPreset, projectPreset, activePreset, source, presets, providers, wsRoot } = data;

    const isFollowGlobal = source === 'followGlobal';
    const isOrphaned = source === 'project_orphaned';
    const isCustom = source === 'project_custom';

    // ==================== 供应商分组渲染函数（通用，用于项目列） ====================
    function providerGroupHtml(providers, activeId, clickFn) {
        return providers.map(p => {
            const items = p.models.map(m => {
                const isActive = activeId === m.id;
                return `
                <div class="preset ${isActive ? 'active' : ''}" data-cmd="${clickFn}" data-id="${m.id}">
                    <div class="preset-header">
                        <div class="preset-name">${m.id}</div>
                        <div style="display:flex;align-items:center;gap:4px;">
                            ${isActive ? '<div class="badge-active">当前</div>' : ''}
                        </div>
                    </div>
                    <div class="preset-desc">${m.description || ''}</div>
                </div>`;
            }).join('');
            return `
            <div class="provider-group">
                <div class="provider-header" data-cmd="toggle">
                    <span class="provider-toggle">&#9660;</span>
                    <span class="provider-name">${p.label || p.id}</span>
                    <span class="provider-badge">${p.models.length}</span>
                </div>
                <div class="provider-models">
                    ${items}
                </div>
            </div>`;
        }).join('');
    }

    // ==================== 全局列（带添加供应商和模型操作） ====================
    const globalHtml = providers.map(p => {
        const items = p.models.map(m => {
            const isActive = globalPreset?.id === m.id;
            const disableDel = getModelCount() <= 1;
            return `
            <div class="preset ${isActive ? 'active' : ''}" data-cmd="switchGlobal" data-id="${m.id}">
                <div class="preset-header">
                    <div class="preset-name">${m.id}</div>
                    <div style="display:flex;align-items:center;gap:4px;">
                        ${isActive ? '<div class="badge-active">当前</div>' : ''}
                        <button class="pact" data-cmd="editModel" data-id="${m.id}" title="编辑模型">&#9998;</button>
                        <button class="pact pdel" data-cmd="delModel" data-id="${m.id}" title="删除模型"${disableDel ? ' disabled' : ''}>&#10005;</button>
                    </div>
                </div>
                <div class="preset-desc">${m.description || ''}</div>
            </div>`;
        }).join('');
        const disableProviderDel = providers.length <= 1;
        return `
        <div class="provider-group">
            <div class="provider-header" data-cmd="toggle">
                <span class="provider-toggle">&#9660;</span>
                <span class="provider-name">${p.label || p.id}</span>
                <span class="provider-badge">${p.models.length}</span>
                <button class="pact" data-cmd="editProvider" data-id="${p.id}" title="编辑供应商">&#9998;</button>
                <button class="pact pdel" data-cmd="delProvider" data-id="${p.id}" title="删除供应商"${disableProviderDel ? ' disabled' : ''}>&#10005;</button>
                <button class="btn btn-add-provider" data-cmd="addModel" data-id="${p.id}">+ 模型</button>
            </div>
            <div class="provider-models">
                ${items}
            </div>
        </div>`;
    }).join('');

    // ==================== 项目列 ====================
    let projectHtml = '';
    if (wsRoot) {
        if (isOrphaned) {
            projectHtml = `<div class="warning-box">
                <div class="warning-title">⚠️ 预设配置丢失</div>
                <div class="warning-desc">项目引用的预设 "${projectPreset.id}" 已不存在</div>
            </div>`;
        }
        if (isCustom) {
            projectHtml = `<div class="info-box">
                <div class="info-title">📝 自定义配置</div>
                <div class="info-desc">项目使用手动配置的环境变量</div>
            </div>`;
        }
        projectHtml += `<div class="follow-item ${isFollowGlobal ? 'active' : ''}" data-cmd="followGlobal">
                <div class="follow-name">🔄 跟随全局</div>
                ${isFollowGlobal ? '<div class="badge-active">当前</div>' : ''}
                <div class="follow-desc">${globalPreset?.id || '未设置'}</div>
           </div>` +
           providerGroupHtml(providers, projectPreset?.id && !isOrphaned && !isCustom ? projectPreset.id : null, 'switchProject');
    } else {
        projectHtml = '<div class="no-workspace">请先打开一个项目文件夹</div>';
    }

    let sourceText = '';
    if (source === 'project') sourceText = `📂 项目独立 (${path.basename(wsRoot || '')})`;
    else if (source === 'project_orphaned') sourceText = `⚠️ 预设丢失 (${path.basename(wsRoot || '')})`;
    else if (source === 'project_custom') sourceText = `📝 自定义配置 (${path.basename(wsRoot || '')})`;
    else sourceText = `🔄 跟随全局 (${globalPreset?.id || '未设置'})`;

    return `<!DOCTYPE html>
<html>
<head>
<style>
    * { box-sizing: border-box; }
    html, body { height: 100%; margin: 0; overflow: hidden; }
    body { font-family: var(--vscode-font-family); padding: 16px; color: var(--vscode-foreground);
           background: var(--vscode-editor-background); }
    .container { display: flex; flex-direction: column; gap: 12px; height: 100%; }
    .header { flex-shrink: 0; display: flex; justify-content: space-between; align-items: center; padding-bottom: 12px; border-bottom: 1px solid var(--vscode-panel-border); }
    .header-title { font-size: 16px; font-weight: 600; }
    .header-current { font-size: 12px; color: var(--vscode-descriptionForeground); }
    .header-current-active { color: var(--vscode-textLink-foreground); font-weight: 500; }
    .main-content { display: flex; gap: 16px; flex: 1; min-height: 0; overflow: hidden; }
    .column { flex: 1; min-width: 0; display: flex; flex-direction: column; overflow-y: auto; min-height: 0; }
    .section { display: flex; flex-direction: column; }
    .section-title { font-size: 13px; font-weight: 600; margin-bottom: 8px; display: flex; align-items: center; gap: 6px; flex-shrink: 0; }
    .badge { background: var(--vscode-badge-background); color: var(--vscode-badge-foreground);
             font-size: 10px; padding: 2px 6px; border-radius: 8px; }
    .badge-active { background: var(--vscode-textLink-foreground); color: var(--vscode-editor-background);
                    font-size: 10px; padding: 2px 6px; border-radius: 3px; }
    .presets { display: flex; flex-direction: column; gap: 4px; }
    .preset { background: var(--vscode-editor-background); border: 1px solid var(--vscode-panel-border);
              border-radius: 4px; padding: 8px 10px; cursor: pointer; transition: all 0.15s; margin-left: 12px; }
    .preset:hover { background: var(--vscode-editor-inactiveSelectionBackground); border-color: var(--vscode-focusBorder); }
    .preset.active { background: var(--vscode-editor-selectionBackground); border-color: var(--vscode-focusBorder); }
    .preset-header { display: flex; justify-content: space-between; align-items: center; }
    .preset-name { font-weight: 600; font-size: 13px; }
    .preset-desc { font-size: 11px; color: var(--vscode-descriptionForeground); margin-top: 2px; }
    .follow-item { background: var(--vscode-editor-background); border: 1px solid var(--vscode-panel-border);
                   border-radius: 4px; padding: 8px 10px; cursor: pointer; transition: all 0.15s;
                   display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }
    .follow-item:hover { background: var(--vscode-editor-inactiveSelectionBackground); border-color: var(--vscode-focusBorder); }
    .follow-item.active { background: var(--vscode-editor-selectionBackground); border-color: var(--vscode-focusBorder); }
    .follow-name { font-weight: 600; font-size: 13px; }
    .follow-desc { font-size: 11px; color: var(--vscode-descriptionForeground); }
    .env-section { margin-top: 8px; padding-top: 8px; border-top: 1px solid var(--vscode-panel-border); }
    .env-title { font-size: 11px; color: var(--vscode-descriptionForeground); margin-bottom: 4px; }
    .env-list { display: flex; flex-direction: column; gap: 2px; }
    .env-item { display: flex; gap: 8px; font-size: 11px; }
    .env-key { color: var(--vscode-textLink-foreground); font-family: var(--vscode-editor-font-family); min-width: 180px; }
    .env-value { font-family: var(--vscode-editor-font-family); word-break: break-all; }
    .warning-box { background: var(--vscode-inputValidation-warningBackground); border: 1px solid var(--vscode-inputValidation-warningBorder);
                   padding: 8px; border-radius: 4px; margin-bottom: 6px; }
    .warning-title { font-weight: 600; font-size: 12px; }
    .warning-desc { font-size: 11px; margin-top: 2px; color: var(--vscode-descriptionForeground); }
    .info-box { background: var(--vscode-editorInfo-background,rgba(0,122,204,0.1)); border: 1px solid var(--vscode-editorInfo-foreground,rgba(0,122,204,0.5));
                padding: 8px; border-radius: 4px; margin-bottom: 6px; }
    .info-title { font-weight: 600; font-size: 12px; }
    .info-desc { font-size: 11px; margin-top: 2px; color: var(--vscode-descriptionForeground); }
    .no-workspace { color: var(--vscode-descriptionForeground); padding: 12px; text-align: center; }
    .btn-row { flex-shrink: 0; display: flex; gap: 8px; padding-top: 12px; border-top: 1px solid var(--vscode-panel-border); }
    .btn { padding: 8px 12px; border: none; cursor: pointer; font-size: 12px;
           border-radius: 4px; font-family: var(--vscode-font-family); }
    .btn-secondary { background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); }
    .btn-secondary:hover { background: var(--vscode-button-secondaryHoverBackground); }
    .btn-outline { background: transparent; border: 1px solid var(--vscode-panel-border); color: var(--vscode-foreground); }
    .btn-outline:hover { background: var(--vscode-editor-inactiveSelectionBackground); }
    .btn-primary { background: var(--vscode-button-background); color: var(--vscode-button-foreground); }
    .btn-primary:hover { background: var(--vscode-button-hoverBackground); }
    .pact { background: none; border: none; cursor: pointer; font-size: 13px; padding: 1px 3px;
            color: var(--vscode-descriptionForeground); border-radius: 3px; line-height: 1; }
    .pact:hover { background: var(--vscode-editor-inactiveSelectionBackground); color: var(--vscode-foreground); }
    .pdel:hover { color: var(--vscode-inputValidation-errorForeground); }
    .pdel:disabled { opacity: 0.3; cursor: not-allowed; }
    .modal-overlay { position: fixed; top:0; left:0; right:0; bottom:0; background: rgba(0,0,0,0.5);
                     display: flex; align-items: center; justify-content: center; z-index: 1000; }
    .modal { background: var(--vscode-editor-background); border: 1px solid var(--vscode-panel-border);
             border-radius: 8px; width: 560px; max-height: 90vh; display: flex; flex-direction: column;
             box-shadow: 0 8px 32px rgba(0,0,0,0.3); }
    .modal-title { font-size: 15px; font-weight: 600; padding: 16px 20px 12px;
                   border-bottom: 1px solid var(--vscode-panel-border); }
    .modal-body { padding: 12px 20px; overflow-y: auto; flex: 1; }
    .modal-footer { padding: 12px 20px; border-top: 1px solid var(--vscode-panel-border);
                    display: flex; gap: 8px; justify-content: flex-end; }
    .form-group { margin-bottom: 10px; }
    .form-label { display: block; font-size: 12px; font-weight: 500; margin-bottom: 3px; }
    .form-input, .form-select { width: 100%; padding: 6px 8px; font-size: 12px;
        font-family: var(--vscode-editor-font-family); background: var(--vscode-input-background);
        color: var(--vscode-input-foreground); border: 1px solid var(--vscode-input-border);
        border-radius: 3px; outline: none; }
    .form-input:focus, .form-select:focus { border-color: var(--vscode-focusBorder); }
    .form-hint { font-weight: 400; color: var(--vscode-descriptionForeground); }
    .form-divider { border-top: 1px solid var(--vscode-panel-border); margin: 10px 0; }
    .field-synced { border-color: var(--vscode-textLink-foreground); }
    .field-unsynced { border-color: var(--vscode-inputValidation-warningBorder); }
    .provider-group { background: var(--vscode-editor-background); border: 1px solid var(--vscode-panel-border);
                      border-radius: 6px; overflow: hidden; }
    .provider-header { display: flex; align-items: center; gap: 6px; padding: 8px 10px;
                       cursor: pointer; user-select: none; }
    .provider-header:hover { background: var(--vscode-editor-inactiveSelectionBackground); }
    .provider-toggle { font-size: 10px; color: var(--vscode-descriptionForeground); width: 12px; text-align: center; }
    .provider-name { font-weight: 600; font-size: 13px; flex: 1; }
    .provider-badge { background: var(--vscode-badge-background); color: var(--vscode-badge-foreground);
                      font-size: 10px; padding: 1px 6px; border-radius: 8px; }
    .provider-models { display: flex; flex-direction: column; gap: 3px; padding: 0 4px 4px 4px; }
    .provider-models.collapsed { display: none; }
    .btn-add-provider { background: var(--vscode-button-background); color: var(--vscode-button-foreground);
                        font-size: 10px; padding: 2px 6px; border: none; border-radius: 3px; cursor: pointer; }
    .btn-add-provider:hover { background: var(--vscode-button-hoverBackground); }
    .confirm-overlay { position: fixed; top:0; left:0; right:0; bottom:0; background: rgba(0,0,0,0.5);
                       display: none; align-items: center; justify-content: center; z-index: 2000; }
    .confirm-box { background: var(--vscode-editor-background); border: 1px solid var(--vscode-panel-border);
                   border-radius: 8px; width: 400px; box-shadow: 0 8px 32px rgba(0,0,0,0.3); }
    .confirm-body { padding: 20px; text-align: center; }
    .confirm-icon { font-size: 28px; margin-bottom: 8px; }
    .confirm-title { font-size: 15px; font-weight: 600; margin-bottom: 8px; }
    .confirm-desc { font-size: 12px; color: var(--vscode-descriptionForeground); margin-bottom: 4px; }
    .confirm-footer { padding: 12px 20px; border-top: 1px solid var(--vscode-panel-border);
                      display: flex; gap: 8px; justify-content: center; }
    .btn-danger { background: var(--vscode-inputValidation-errorForeground,#e81123);
                  color: white; padding: 8px 20px; border: none; cursor: pointer; font-size: 12px;
                  border-radius: 4px; font-family: var(--vscode-font-family); }
    .btn-danger:hover { opacity: 0.9; }
</style>
</head>
<body>
<div class="container">
    <div class="header">
        <div class="header-title">Claude Code 模型配置</div>
        <div class="header-current">
            当前: <span class="header-current-active">${activePreset?.id || '未设置'}</span>
            <span style="margin-left:6px;">${sourceText}</span>
        </div>
    </div>

    <div class="main-content">
        <div class="column">
            <div class="section">
                <div class="section-title">全局模型 <span class="badge">所有项目默认</span> <button class="btn btn-add" onclick="openAddProvider()">+ 添加供应商</button></div>
                <div class="presets">${globalHtml}</div>
                <div class="env-section">
                    <div class="env-title">环境变量</div>
                    <div class="env-list">${envListHtml(globalPreset)}</div>
                </div>
            </div>
        </div>

        <div class="column">
            <div class="section">
                <div class="section-title">项目模型 ${wsRoot ? `<span class="badge">${path.basename(wsRoot)}</span>` : ''}</div>
                <div class="presets">${projectHtml}</div>
            </div>
        </div>
    </div>

    <div class="btn-row">
        <button class="btn btn-secondary" data-cmd="editSettings">编辑全局 settings.json</button>
        <button class="btn btn-outline" data-cmd="editEnvs">编辑预设</button>
        ${wsRoot ? '<button class="btn btn-outline" data-cmd="editProjectSettings">编辑项目配置</button>' : ''}
    </div>
</div>

<div class="modal-overlay" id="modalOverlay" style="display:none;">
  <div class="modal">
    <div class="modal-title" id="modalTitle">添加供应商</div>
    <div class="modal-body">
      <!-- 供应商字段 -->
      <div id="providerFields">
        <div class="form-group">
          <label class="form-label">供应商 ID <span style="color:var(--vscode-inputValidation-errorForeground)">*</span></label>
          <input class="form-input" id="providerId" placeholder="例如: dashscope" />
        </div>
        <div class="form-group">
          <label class="form-label">供应商名称</label>
          <input class="form-input" id="providerLabel" placeholder="例如: DashScope" />
        </div>
        <div class="form-group">
          <label class="form-label">描述</label>
          <input class="form-input" id="providerDesc" placeholder="供应商描述" />
        </div>
        <div class="form-group" id="initialModelGroup">
          <label class="form-label">初始模型 ID <span style="color:var(--vscode-inputValidation-errorForeground)">*</span></label>
          <input class="form-input" id="initialModelId" placeholder="例如: my-model" />
          <div style="font-size:11px;color:var(--vscode-descriptionForeground);margin-top:2px;">添加供应商后将自动创建此模型</div>
        </div>
        <div class="form-divider"></div>
        <div class="form-group">
          <label class="form-label">ANTHROPIC_AUTH_TOKEN</label>
          <input class="form-input" type="password" id="authToken" placeholder="输入 API Token" />
        </div>
        <div class="form-group">
          <label class="form-label">ANTHROPIC_BASE_URL</label>
          <input class="form-input" id="baseUrl" placeholder="https://..." />
        </div>
        <div class="form-group">
          <label class="form-label">API_TIMEOUT_MS</label>
          <input class="form-input" id="apiTimeout" placeholder="300000" />
        </div>
        <div class="form-group">
          <label class="form-label">CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC</label>
          <input class="form-input" id="disableTraffic" placeholder="1" />
        </div>
      </div>
      <!-- 模型字段（在添加/编辑模型时显示） -->
      <div id="modelFields" style="display:none;">
        <div class="form-divider"></div>
        <div class="form-group" id="modelProviderGroup">
          <label class="form-label">所属供应商</label>
          <select class="form-select" id="modelProvider"></select>
        </div>
        <div class="form-group">
          <label class="form-label">模型 ID <span style="color:var(--vscode-inputValidation-errorForeground)">*</span></label>
          <input class="form-input" id="presetLabel" placeholder="例如: my-model" />
        </div>
        <div class="form-group">
          <label class="form-label">描述</label>
          <input class="form-input" id="presetDesc" placeholder="模型描述" />
        </div>
        <div class="form-divider"></div>
        <div class="form-group">
          <label class="form-label">ANTHROPIC_MODEL <span style="color:var(--vscode-inputValidation-errorForeground)">*</span></label>
          <input class="form-input" id="anthropicModel" oninput="onModelChange()" placeholder="例如: qwen3.6-plus" />
        </div>
        <div class="form-group">
          <label class="form-label">ANTHROPIC_DEFAULT_SONNET_MODEL <span class="form-hint" id="hintSonnet">与 ANTHROPIC_MODEL 同步</span></label>
          <input class="form-input field-synced" id="sonnetModel" oninput="onSubModelChange('sonnet')" />
        </div>
        <div class="form-group">
          <label class="form-label">ANTHROPIC_DEFAULT_OPUS_MODEL <span class="form-hint" id="hintOpus">与 ANTHROPIC_MODEL 同步</span></label>
          <input class="form-input field-synced" id="opusModel" oninput="onSubModelChange('opus')" />
        </div>
        <div class="form-group">
          <label class="form-label">ANTHROPIC_DEFAULT_HAIKU_MODEL <span class="form-hint" id="hintHaiku">与 ANTHROPIC_MODEL 同步</span></label>
          <input class="form-input field-synced" id="haikuModel" oninput="onSubModelChange('haiku')" />
        </div>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-outline" onclick="closeModal()">取消</button>
      <button class="btn btn-primary" onclick="saveModal()">保存</button>
    </div>
  </div>
</div>

<!-- 确认弹窗 -->
<div class="confirm-overlay" id="confirmOverlay">
  <div class="confirm-box">
    <div class="confirm-body">
      <div class="confirm-icon">⚠️</div>
      <div class="confirm-title" id="confirmTitle">确认删除</div>
      <div class="confirm-desc" id="confirmDesc">确定要删除吗？</div>
    </div>
    <div class="confirm-footer">
      <button class="btn btn-outline" id="confirmCancel">取消</button>
      <button class="btn btn-danger" data-cmd="confirmDelete">删除</button>
    </div>
  </div>
</div>

<script id="providers-data" type="application/json">${JSON.stringify(providers)}</script>
<script>
(function(){
const vscode = acquireVsCodeApi();
var allProviders = JSON.parse(document.getElementById('providers-data').textContent);

// 编辑模式: 'addProvider' | 'editProvider' | 'addModel' | 'editModel'
var editMode = 'addProvider';
var editTargetId = null;
var editProviderId = null;
var dirty = { sonnet: false, opus: false, haiku: false };
var pendingConfirm = null;

// ==================== 确认弹窗 ====================
function showConfirm(title, desc, fn) {
  pendingConfirm = fn;
  byId('confirmTitle').textContent = title;
  byId('confirmDesc').textContent = desc;
  byId('confirmOverlay').style.display = 'flex';
}
function closeConfirm() {
  pendingConfirm = null;
  byId('confirmOverlay').style.display = 'none';
}

// ==================== 事件委托：所有 data-cmd 点击 ====================
document.addEventListener('click', function(e) {
  var el = e.target.closest('[data-cmd]');
  if (!el) return;
  e.stopPropagation();
  var cmd = el.getAttribute('data-cmd');
  var id = el.getAttribute('data-id');

  switch (cmd) {
    case 'switchGlobal': vscode.postMessage({command:'switchGlobal',presetId:id}); break;
    case 'switchProject': vscode.postMessage({command:'switchProject',presetId:id}); break;
    case 'followGlobal': vscode.postMessage({command:'followGlobal'}); break;
    case 'editSettings': vscode.postMessage({command:'editSettings'}); break;
    case 'editEnvs': vscode.postMessage({command:'editEnvs'}); break;
    case 'editProjectSettings': vscode.postMessage({command:'editProjectSettings'}); break;
    case 'editModel': openEditModel(id); break;
    case 'delModel':
      var _modelId = id;
      var found = getModelById(_modelId);
      if (found) showConfirm('删除模型', '确定要删除模型 "' + (found.model.label || found.model.id) + '" 吗？', function() {
        vscode.postMessage({command:'deleteModel',modelId:_modelId});
      });
      break;
    case 'editProvider': openEditProvider(id); break;
    case 'delProvider':
      var _providerId = id;
      var p = getProviderById(_providerId);
      if (p) showConfirm('删除供应商', '确定要删除供应商 "' + (p.label || p.id) + '" 及其下所有模型吗？', function() {
        vscode.postMessage({command:'deleteProvider',providerId:_providerId});
      });
      break;
    case 'addModel': openAddModel(id); break;
    case 'toggle':
      var header = el;
      var models = header.parentNode && header.parentNode.querySelector('.provider-models');
      var toggle = header.querySelector('.provider-toggle');
      if (models && toggle) {
        var collapsed = models.classList.toggle('collapsed');
        toggle.innerHTML = collapsed ? '&#9654;' : '&#9660;';
      }
      break;
    case 'confirmDelete':
      if (typeof pendingConfirm === 'function') pendingConfirm();
      closeConfirm();
      break;
  }
});

function byId(id) { return document.getElementById(id); }

function getModelById(id) {
  for (var i = 0; i < allProviders.length; i++) {
    for (var j = 0; j < allProviders[i].models.length; j++) {
      if (allProviders[i].models[j].id === id) return { provider: allProviders[i], model: allProviders[i].models[j] };
    }
  }
  return null;
}

function getProviderById(id) {
  for (var i = 0; i < allProviders.length; i++) {
    if (allProviders[i].id === id) return allProviders[i];
  }
  return null;
}

function populateProviderSelect(selectedId) {
  var sel = byId('modelProvider');
  sel.innerHTML = '';
  allProviders.forEach(function(p) {
    var opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = p.label || p.id;
    sel.appendChild(opt);
  });
  if (selectedId) sel.value = selectedId;
}

// ==================== 打开弹窗 ====================
window.openAddProvider = function() {
  editMode = 'addProvider';
  editTargetId = null;
  byId('modalTitle').textContent = '添加供应商';
  byId('providerFields').style.display = '';
  byId('initialModelGroup').style.display = '';
  byId('modelFields').style.display = 'none';
  clearForm();
  byId('modalOverlay').style.display = 'flex';
};

window.openEditProvider = function(id) {
  editMode = 'editProvider';
  editTargetId = id;
  var p = getProviderById(id);
  if (!p) return;
  byId('modalTitle').textContent = '编辑供应商';
  byId('providerFields').style.display = '';
  byId('initialModelGroup').style.display = 'none';
  byId('modelFields').style.display = 'none';
  byId('providerId').value = p.id;
  byId('providerId').readOnly = true;
  byId('providerLabel').value = p.label || '';
  byId('providerDesc').value = p.description || '';
  var e = p.env || {};
  byId('authToken').value = e.ANTHROPIC_AUTH_TOKEN || '';
  byId('baseUrl').value = e.ANTHROPIC_BASE_URL || '';
  byId('apiTimeout').value = e.API_TIMEOUT_MS || '';
  byId('disableTraffic').value = e.CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC || '';
  byId('modalOverlay').style.display = 'flex';
};

window.openAddModel = function(providerId) {
  editMode = 'addModel';
  editTargetId = null;
  editProviderId = providerId || (allProviders.length > 0 ? allProviders[0].id : null);
  byId('modalTitle').textContent = '添加模型';
  byId('providerFields').style.display = 'none';
  byId('modelFields').style.display = '';
  byId('modelProviderGroup').style.display = '';
  clearForm();
  populateProviderSelect(editProviderId);
  byId('modalOverlay').style.display = 'flex';
};

window.openEditModel = function(id) {
  editMode = 'editModel';
  editTargetId = id;
  var found = getModelById(id);
  if (!found) return;
  editProviderId = found.provider.id;
  byId('modalTitle').textContent = '编辑模型';
  byId('providerFields').style.display = 'none';
  byId('modelFields').style.display = '';
  byId('modelProviderGroup').style.display = 'none';
  populateProviderSelect(found.provider.id);
  var m = found.model;
  byId('presetLabel').value = m.id;
  byId('presetDesc').value = m.description || '';
  var e = m.env || {};
  byId('anthropicModel').value = e.ANTHROPIC_MODEL || '';
  var modelVal = e.ANTHROPIC_MODEL || '';
  byId('sonnetModel').value = e.ANTHROPIC_DEFAULT_SONNET_MODEL || '';
  byId('opusModel').value = e.ANTHROPIC_DEFAULT_OPUS_MODEL || '';
  byId('haikuModel').value = e.ANTHROPIC_DEFAULT_HAIKU_MODEL || '';
  dirty.sonnet = !!e.ANTHROPIC_DEFAULT_SONNET_MODEL && e.ANTHROPIC_DEFAULT_SONNET_MODEL !== modelVal;
  dirty.opus = !!e.ANTHROPIC_DEFAULT_OPUS_MODEL && e.ANTHROPIC_DEFAULT_OPUS_MODEL !== modelVal;
  dirty.haiku = !!e.ANTHROPIC_DEFAULT_HAIKU_MODEL && e.ANTHROPIC_DEFAULT_HAIKU_MODEL !== modelVal;
  updateFieldUI('sonnet', dirty.sonnet);
  updateFieldUI('opus', dirty.opus);
  updateFieldUI('haiku', dirty.haiku);
  byId('modalOverlay').style.display = 'flex';
};

window.closeModal = function() {
  byId('modalOverlay').style.display = 'none';
};

// ==================== 表单逻辑 ====================
window.onModelChange = function() {
  var v = byId('anthropicModel').value;
  if (!dirty.sonnet) byId('sonnetModel').value = v;
  if (!dirty.opus) byId('opusModel').value = v;
  if (!dirty.haiku) byId('haikuModel').value = v;
};

window.onSubModelChange = function(field) {
  dirty[field] = true;
  updateFieldUI(field, true);
};

function updateFieldUI(field, isDirty) {
  var el = byId(field + 'Model');
  var hint = byId('hint' + field.charAt(0).toUpperCase() + field.slice(1));
  if (isDirty) {
    el.classList.remove('field-synced');
    el.classList.add('field-unsynced');
    hint.textContent = '已手动修改';
    hint.style.color = 'var(--vscode-inputValidation-warningForeground)';
  } else {
    el.classList.remove('field-unsynced');
    el.classList.add('field-synced');
    hint.textContent = '与 ANTHROPIC_MODEL 同步';
    hint.style.color = '';
  }
}

function clearForm() {
  byId('providerId').value = '';
  byId('providerId').readOnly = false;
  byId('providerLabel').value = '';
  byId('providerDesc').value = '';
  byId('initialModelId').value = '';
  byId('authToken').value = '';
  byId('baseUrl').value = '';
  byId('apiTimeout').value = '';
  byId('disableTraffic').value = '';
  byId('presetLabel').value = '';
  byId('presetDesc').value = '';
  byId('anthropicModel').value = '';
  byId('sonnetModel').value = '';
  byId('opusModel').value = '';
  byId('haikuModel').value = '';
  dirty.sonnet = false;
  dirty.opus = false;
  dirty.haiku = false;
  updateFieldUI('sonnet', false);
  updateFieldUI('opus', false);
  updateFieldUI('haiku', false);
}

// ==================== 保存 ====================
window.saveModal = function() {
  if (editMode === 'addProvider' || editMode === 'editProvider') {
    var pid = byId('providerId').value.trim();
    if (!pid) { alert('请输入供应商 ID'); return; }

    var provider = {
      id: pid,
      label: byId('providerLabel').value.trim() || pid,
      description: byId('providerDesc').value.trim() || '',
      env: {},
      models: []
    };
    var token = byId('authToken').value.trim();
    var url = byId('baseUrl').value.trim();
    var timeout = byId('apiTimeout').value.trim();
    var disable = byId('disableTraffic').value.trim();
    if (token) provider.env.ANTHROPIC_AUTH_TOKEN = token;
    if (url) provider.env.ANTHROPIC_BASE_URL = url;
    if (timeout) provider.env.API_TIMEOUT_MS = timeout;
    if (disable) provider.env.CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC = disable;

    if (editMode === 'addProvider') {
      var modelId = byId('initialModelId').value.trim();
      if (!modelId) { alert('请输入初始模型 ID'); return; }
      var model = { id: modelId, label: modelId, description: '', env: {} };
      vscode.postMessage({command:'addProvider', provider: provider, model: model});
    } else {
      vscode.postMessage({command:'updateProvider', providerId: editTargetId, provider: provider});
    }
    closeModal();
    return;
  }

  if (editMode === 'addModel' || editMode === 'editModel') {
    var label = byId('presetLabel').value.trim();
    var modelName = byId('anthropicModel').value.trim();
    if (!label) { alert('请输入模型 ID'); return; }
    if (!modelName) { alert('请输入 ANTHROPIC_MODEL'); return; }

    var model = {
      id: label,
      label: label,
      description: byId('presetDesc').value.trim() || '',
      env: {}
    };
    model.env.ANTHROPIC_MODEL = modelName;
    var s = byId('sonnetModel').value.trim();
    var o = byId('opusModel').value.trim();
    var h = byId('haikuModel').value.trim();
    if (s) model.env.ANTHROPIC_DEFAULT_SONNET_MODEL = s;
    if (o) model.env.ANTHROPIC_DEFAULT_OPUS_MODEL = o;
    if (h) model.env.ANTHROPIC_DEFAULT_HAIKU_MODEL = h;

    if (editMode === 'addModel') {
      var pId = byId('modelProvider').value;
      vscode.postMessage({command:'addModel', providerId: pId, model: model});
    } else {
      vscode.postMessage({command:'updateModel', modelId: editTargetId, model: model});
    }
    closeModal();
    return;
  }
};

byId('modalOverlay').addEventListener('click', function(e) {
  if (e.target === byId('modalOverlay')) closeModal();
});
byId('confirmOverlay').addEventListener('click', function(e) {
  if (e.target === byId('confirmOverlay')) closeConfirm();
});
byId('confirmCancel').addEventListener('click', closeConfirm);
})();
</script>
</body>
</html>`;
}

// ==================== 激活 ====================
function activate(context) {
    extensionContext = context;
    initGlobalEnvs();

    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBarItem.command = 'ccSwitch.showConfig';
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
