import * as vscode from 'vscode';
import * as path from 'path';
import { Provider, Model, FlatPreset, PanelData, WebviewCommand, EnvsFileV2 } from './types';
import { GLOBAL_SETTINGS_PATH, GLOBAL_ENVS_PATH, getWorkspaceRoot, getProjectSettingsPath } from './constants';
import { readJSON } from './storage';
import { getAllProviders, saveAllProviders, getAllPresets, matchPreset, getModelCount, deleteModel, updateModel, addModelToProvider, addProviderWithModel, findModel } from './providers';
import { getGlobalPreset, getProjectPreset, getActiveModel, switchGlobalPreset, switchProjectPreset, restoreFollowGlobal } from './config';
import { updateStatusBar } from './statusBar';

// ==================== 配置面板 ====================

export function showConfigPanel(): void {
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

	panel.webview.onDidReceiveMessage((message: WebviewCommand) => {
		switch (message.command) {
			case 'switchGlobal': {
				const preset = getAllPresets().find(p => p.id === message.presetId);
				if (preset) {
					switchGlobalPreset(preset);
					updateStatusBar();
				}
				refreshPanelView(panel, wsRoot);
				break;
			}
			case 'switchProject': {
				const preset = getAllPresets().find(p => p.id === message.presetId);
				if (preset && wsRoot) {
					switchProjectPreset(wsRoot, preset);
					updateStatusBar();
				}
				refreshPanelView(panel, wsRoot);
				break;
			}
			case 'followGlobal': {
				if (wsRoot) {
					restoreFollowGlobal(wsRoot);
					updateStatusBar();
				}
				refreshPanelView(panel, wsRoot);
				break;
			}
			case 'editSettings':
				vscode.commands.executeCommand('vscode.open', vscode.Uri.file(GLOBAL_SETTINGS_PATH));
				break;
			case 'editEnvs':
				vscode.commands.executeCommand('vscode.open', vscode.Uri.file(GLOBAL_ENVS_PATH));
				break;
			case 'editProjectSettings':
				if (wsRoot) {
					const pPath = getProjectSettingsPath(wsRoot);
					vscode.commands.executeCommand('vscode.open', vscode.Uri.file(pPath));
				}
				break;
			case 'addProvider':
				if (addProviderWithModel(message.provider, message.model)) {
					updateStatusBar();
					refreshPanelView(panel, wsRoot);
				} else {
					vscode.window.showErrorMessage(`供应商 "${message.provider.id}" 已存在`);
				}
				break;
			case 'addModel':
				if (addModelToProvider(message.providerId, message.model)) {
					updateStatusBar();
					refreshPanelView(panel, wsRoot);
				} else {
					vscode.window.showErrorMessage('添加模型失败：供应商不存在或模型 ID 重复');
				}
				break;
			case 'updateProvider': {
				const allProviders = getAllProviders();
				const idx = allProviders.findIndex(p => p.id === message.providerId);
				if (idx >= 0) {
					const models = allProviders[idx].models;
					allProviders[idx] = message.provider;
					allProviders[idx].models = models;
					saveAllProviders(allProviders);
					updateStatusBar();
					refreshPanelView(panel, wsRoot);
				}
				break;
			}
			case 'updateModel':
				if (updateModel(message.modelId, message.model)) {
					updateStatusBar();
					refreshPanelView(panel, wsRoot);
				}
				break;
			case 'deleteProvider': {
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
				break;
			}
			case 'deleteModel':
				if (getModelCount() <= 1) {
					vscode.window.showWarningMessage('至少需要保留一个模型');
					return;
				}
				if (deleteModel(message.modelId)) {
					updateStatusBar();
					refreshPanelView(panel, wsRoot);
				}
				break;
		}
	});
}

function refreshPanelView(panel: vscode.WebviewPanel, wsRoot: string | null): void {
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

function maskValue(key: string, value: string | undefined): string {
	if (key.includes('TOKEN') || key.includes('KEY') || key.includes('SECRET')) {
		return value ? '******' : '(未设置)';
	}
	return value || '(未设置)';
}

function envListHtml(preset: FlatPreset | null): string {
	if (!preset) return '<div class="no-workspace">未设置</div>';
	return Object.keys(preset.env).map(key => `
		<div class="env-item">
			<div class="env-key">${key}</div>
			<div class="env-value">${maskValue(key, preset.env[key])}</div>
		</div>`).join('');
}

function providerGroupHtml(providers: Provider[], activeId: string | null, clickFn: string): string {
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
				<span class="provider-name">${p.id}</span>
				<span class="provider-badge">${p.models.length}</span>
			</div>
			<div class="provider-models">
				${items}
			</div>
		</div>`;
	}).join('');
}

function renderPanel(data: PanelData): string {
	const { globalPreset, projectPreset, activePreset, source, presets, providers, wsRoot } = data;

	const isFollowGlobal = source === 'followGlobal';
	const isOrphaned = source === 'project_orphaned';
	const isCustom = source === 'project_custom';

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
				<span class="provider-name">${p.id}</span>
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
				<div class="warning-desc">项目引用的预设 "${(projectPreset as any)?.id}" 已不存在</div>
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
			   providerGroupHtml(providers, projectPreset && !isOrphaned && !isCustom ? (projectPreset as FlatPreset).id : null, 'switchProject');
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
		  <label class="form-label">名称 <span style="color:var(--vscode-inputValidation-errorForeground)">*</span></label>
		  <input class="form-input" id="providerId" placeholder="例如: DashScope" oninput="onProviderNameChange()" />
		</div>
		<div class="form-group">
		  <label class="form-label">描述</label>
		  <input class="form-input" id="providerDesc" placeholder="供应商描述" oninput="onProviderDescChange()" />
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
		  <input class="form-input" id="presetLabel" placeholder="例如: my-model" oninput="onModelNameChange()" />
		</div>
		<div class="form-group">
		  <label class="form-label">描述</label>
		  <input class="form-input" id="presetDesc" placeholder="模型描述" oninput="onModelDescChange()" />
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
		<div class="form-group">
		  <label class="form-label">CLAUDE_CODE_SUBAGENT_MODEL</label>
		  <input class="form-input" id="subagentModel" placeholder="留空则使用 ANTHROPIC_MODEL" />
		</div>
		<div class="form-group">
		  <label class="form-label">CLAUDE_CODE_EFFORT_LEVEL</label>
		  <input class="form-input" id="effortLevel" placeholder="max" />
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
var dirty = { sonnet: false, opus: false, haiku: false, providerDesc: false, modelDesc: false };
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
	  if (p) showConfirm('删除供应商', '确定要删除供应商 "' + (p.id) + '" 及其下所有模型吗？', function() {
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
	opt.textContent = p.id;
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
  byId('providerDesc').value = p.description || '';
  dirty.providerDesc = !!(p.description) && p.description !== p.id;
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
  dirty.modelDesc = !!(m.description) && m.description !== m.id;
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
  byId('subagentModel').value = e.CLAUDE_CODE_SUBAGENT_MODEL || '';
  byId('effortLevel').value = e.CLAUDE_CODE_EFFORT_LEVEL || '';
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

window.onProviderNameChange = function() {
  if (!dirty.providerDesc) {
	byId('providerDesc').value = byId('providerId').value;
  }
};

window.onProviderDescChange = function() {
  dirty.providerDesc = true;
};

window.onModelNameChange = function() {
  if (!dirty.modelDesc) {
	byId('presetDesc').value = byId('presetLabel').value;
  }
};

window.onModelDescChange = function() {
  dirty.modelDesc = true;
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
  byId('subagentModel').value = '';
  byId('effortLevel').value = '';
  dirty.sonnet = false;
  dirty.opus = false;
  dirty.haiku = false;
  dirty.providerDesc = false;
  dirty.modelDesc = false;
  updateFieldUI('sonnet', false);
  updateFieldUI('opus', false);
  updateFieldUI('haiku', false);
}

// ==================== 保存 ====================
window.saveModal = function() {
  if (editMode === 'addProvider' || editMode === 'editProvider') {
	var pid = byId('providerId').value.trim();
	if (!pid) { alert('请输入名称'); return; }

	var provider = {
	  id: pid,
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
	  var model = {
		id: modelId, label: modelId,
		description: modelId,
		env: {
		  ANTHROPIC_MODEL: modelId,
		  ANTHROPIC_DEFAULT_SONNET_MODEL: modelId,
		  ANTHROPIC_DEFAULT_OPUS_MODEL: modelId,
		  ANTHROPIC_DEFAULT_HAIKU_MODEL: modelId,
		  CLAUDE_CODE_SUBAGENT_MODEL: modelId,
		  CLAUDE_CODE_EFFORT_LEVEL: 'max'
		}
	  };
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
	var sub = byId('subagentModel').value.trim();
	var effort = byId('effortLevel').value.trim();
	if (sub) model.env.CLAUDE_CODE_SUBAGENT_MODEL = sub;
	if (effort) model.env.CLAUDE_CODE_EFFORT_LEVEL = effort;

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
