import * as vscode from 'vscode';

// ==================== 核心数据模型 ====================

export interface Model {
	id: string;
	label: string;
	description: string;
	env: Record<string, string>;
}

export interface Provider {
	id: string;
	description: string;
	env: Record<string, string>;
	models: Model[];
}

/** 扁平预设：Model 与 Provider env 合并后的结果 */
export interface FlatPreset {
	id: string;
	label: string;
	description: string;
	env: Record<string, string>;
	_providerId: string;
	_providerLabel: string;
}

// ==================== 文件格式 ====================

export interface EnvsFileV2 {
	version: 2;
	providers: Provider[];
}

export interface LegacyEnvFile {
	version?: number;
	presets?: LegacyPreset[];
}

export interface LegacyPreset {
	id: string;
	label: string;
	description: string;
	env: Record<string, string>;
}

export interface GlobalSettings {
	presetId?: string;
	env?: Record<string, string>;
	[key: string]: unknown;
}

export interface ProjectSettings {
	presetId?: string;
	env?: Record<string, string>;
	[key: string]: unknown;
}

// ==================== 解析结果类型 ====================

export interface OrphanedPreset {
	id: string;
	description: string;
	env: Record<string, string>;
	_orphaned: true;
}

export interface CustomPreset {
	id: string;
	description: string;
	env: Record<string, string>;
	_custom: true;
}

export type ResolvedPreset = FlatPreset | OrphanedPreset | CustomPreset | null;

export type ActiveSource = 'project' | 'project_orphaned' | 'project_custom' | 'followGlobal';

export interface ActiveModelResult {
	preset: ResolvedPreset;
	source: ActiveSource;
}

// ==================== Webview 消息类型 ====================

export type WebviewCommand =
	| { command: 'switchGlobal'; presetId: string }
	| { command: 'switchProject'; presetId: string }
	| { command: 'followGlobal' }
	| { command: 'editSettings' }
	| { command: 'editEnvs' }
	| { command: 'editProjectSettings' }
	| { command: 'addProvider'; provider: Provider; model: Model }
	| { command: 'addModel'; providerId: string; model: Model }
	| { command: 'updateProvider'; providerId: string; provider: Provider }
	| { command: 'updateModel'; modelId: string; model: Model }
	| { command: 'deleteProvider'; providerId: string }
	| { command: 'deleteModel'; modelId: string };

// ==================== 面板数据 ====================

export interface PanelData {
	globalPreset: FlatPreset | null;
	projectPreset: ResolvedPreset;
	activePreset: ResolvedPreset;
	source: ActiveSource;
	presets: FlatPreset[];
	providers: Provider[];
	wsRoot: string | null;
}

// ==================== QuickPick 操作类型 ====================

export type QuickAction = 'switchProject' | 'switchGlobal' | 'followGlobal' | 'showConfig' | 'editEnvs';

export interface QuickPickAction extends vscode.QuickPickItem {
	action: QuickAction;
}
