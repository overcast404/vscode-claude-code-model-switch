import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { FlatPreset, GlobalSettings, ProjectSettings, ResolvedPreset, ActiveModelResult, OrphanedPreset, CustomPreset } from './types';
import { GLOBAL_SETTINGS_PATH, getProjectSettingsPath } from './constants';
import { readJSON, writeJSON, deleteFile } from './storage';
import { matchPreset } from './providers';

// ==================== 配置读取 ====================

export function getGlobalPreset(): FlatPreset | null {
	const settings = readJSON<GlobalSettings>(GLOBAL_SETTINGS_PATH);
	const presetId = settings?.presetId || '';
	return matchPreset(presetId);
}

export function getProjectPreset(wsRoot: string | null): ResolvedPreset {
	const projectPath = wsRoot ? getProjectSettingsPath(wsRoot) : null;
	if (!projectPath || !fs.existsSync(projectPath)) return null;

	const settings = readJSON<ProjectSettings>(projectPath);
	if (!settings) return null;

	const presetLabel = settings.presetId || '';

	// 有 presetId，尝试匹配预设
	if (presetLabel) {
		const matched = matchPreset(presetLabel);
		if (matched) return matched;
		// presetId 存在但匹配不到预设，返回孤立配置标记
		if (settings.env && Object.keys(settings.env).length > 0) {
			const orphaned: OrphanedPreset = {
				id: `(预设丢失: ${presetLabel})`,
				description: '预设已被删除，环境变量仍在生效',
				env: settings.env,
				_orphaned: true as const
			};
			return orphaned;
		}
		// 有 presetId 但没有 env，预设也找不到，视为跟随全局
		return null;
	}

	// 没有 presetId 但有 env，视为自定义配置
	if (settings.env && Object.keys(settings.env).length > 0) {
		const custom: CustomPreset = {
			id: '自定义配置',
			description: '手动配置的环境变量',
			env: settings.env,
			_custom: true as const
		};
		return custom;
	}

	return null;
}

/** 获取当前生效的模型来源 */
export function getActiveModel(wsRoot: string | null): ActiveModelResult {
	const projectPreset = getProjectPreset(wsRoot);
	if (projectPreset) {
		if ('_orphaned' in projectPreset) {
			return { preset: projectPreset, source: 'project_orphaned' };
		}
		if ('_custom' in projectPreset) {
			return { preset: projectPreset, source: 'project_custom' };
		}
		return { preset: projectPreset, source: 'project' };
	}
	const globalPreset = getGlobalPreset();
	return { preset: globalPreset, source: 'followGlobal' };
}

// ==================== 配置写入 ====================

export async function switchGlobalPreset(preset: FlatPreset): Promise<void> {
	const settings = readJSON<GlobalSettings>(GLOBAL_SETTINGS_PATH) || {};
	settings.env = { ...preset.env };
	settings.presetId = preset.id;
	writeJSON<GlobalSettings>(GLOBAL_SETTINGS_PATH, settings);
	vscode.window.showInformationMessage(`全局模型已切换为: ${preset.id}`);
}

export async function switchProjectPreset(wsRoot: string, preset: FlatPreset): Promise<void> {
	const projectPath = getProjectSettingsPath(wsRoot);
	const existing = readJSON<ProjectSettings>(projectPath) || {};

	// 合并环境变量：保留用户添加的自定义变量，预设变量覆盖
	const mergedEnv = { ...existing.env, ...preset.env };

	existing.env = mergedEnv;
	existing.presetId = preset.id;
	writeJSON<ProjectSettings>(projectPath, existing);
	addToGitignore(wsRoot);
	vscode.window.showInformationMessage(`项目模型已设置为: ${preset.id}`);
}

export async function restoreFollowGlobal(wsRoot: string): Promise<void> {
	const projectPath = getProjectSettingsPath(wsRoot);
	const existing = readJSON<ProjectSettings>(projectPath) || {};

	// 只删除 env 和 presetId 字段，保留其他配置
	delete existing.env;
	delete existing.presetId;

	// 如果文件为空对象，则删除文件；否则写入保留的配置
	if (Object.keys(existing).length === 0) {
		deleteFile(projectPath);
	} else {
		writeJSON<ProjectSettings>(projectPath, existing);
	}

	vscode.window.showInformationMessage('项目已恢复跟随全局');
}

// ==================== .gitignore ====================

export function addToGitignore(wsRoot: string): void {
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
