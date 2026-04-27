import * as vscode from 'vscode';
import * as path from 'path';
import { FlatPreset, QuickPickAction } from './types';
import { GLOBAL_ENVS_PATH, getWorkspaceRoot } from './constants';
import { getActiveModel, getGlobalPreset, getProjectPreset, switchGlobalPreset, switchProjectPreset, restoreFollowGlobal } from './config';
import { getAllPresets } from './providers';
import { updateStatusBar } from './statusBar';
import { showConfigPanel } from './panel';

// ==================== 快速操作菜单 ====================

export async function showQuickActions(): Promise<void> {
	const wsRoot = getWorkspaceRoot();
	const { preset, source } = getActiveModel(wsRoot);
	const currentDesc = source === 'project'
		? `${preset?.id || '未设置'} (项目独立)`
		: `${preset?.id || '未设置'} (跟随全局)`;

	const actions: QuickPickAction[] = [
		{
			label: '$(folder) 切换项目模型',
			description: '为当前项目选择模型（打破跟随）',
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
		{ label: '$(server) 打开配置面板', description: '查看所有配置', action: 'showConfig' as const },
		{ label: '$(edit) 编辑全局预设 (envs.json)', description: '添加/修改模型预设', action: 'editEnvs' as const }
	);

	const selected = await vscode.window.showQuickPick(actions, {
		placeHolder: `当前: ${currentDesc}`
	});
	if (!selected) return;

	switch (selected.action) {
		case 'switchProject':
			await selectProjectModel();
			break;
		case 'switchGlobal':
			await selectGlobalModel();
			break;
		case 'followGlobal':
			if (wsRoot) {
				await restoreFollowGlobal(wsRoot);
				updateStatusBar();
			}
			break;
		case 'showConfig':
			showConfigPanel();
			break;
		case 'editEnvs':
			vscode.commands.executeCommand('vscode.open', vscode.Uri.file(GLOBAL_ENVS_PATH));
			break;
	}
}

// ==================== 切换模型 ====================

async function selectGlobalModel(): Promise<void> {
	const globalPreset = getGlobalPreset();
	const presets = getAllPresets();
	const items: (vscode.QuickPickItem & { preset: FlatPreset })[] = presets.map(p => ({
		label: p.id,
		description: p.description,
		detail: p.env.ANTHROPIC_BASE_URL,
		picked: globalPreset?.id === p.id,
		preset: p
	}));
	const selected = await vscode.window.showQuickPick(items, {
		placeHolder: `当前全局: ${globalPreset?.id || '未设置'}`,
		matchOnDescription: true,
		matchOnDetail: true
	});
	if (!selected) return;
	await switchGlobalPreset(selected.preset);
	updateStatusBar();
}

async function selectProjectModel(): Promise<void> {
	const wsRoot = getWorkspaceRoot();
	if (!wsRoot) {
		vscode.window.showWarningMessage('请先打开一个项目');
		return;
	}

	const projectPreset = getProjectPreset(wsRoot);
	const presets = getAllPresets();
	const items: (vscode.QuickPickItem & { preset: FlatPreset })[] = presets.map(p => ({
		label: p.id,
		description: p.description,
		detail: p.env.ANTHROPIC_BASE_URL,
		picked: projectPreset?.id === p.id,
		preset: p
	}));
	const selected = await vscode.window.showQuickPick(items, {
		placeHolder: `当前项目: ${projectPreset?.id || '未设置（跟随全局）'}`,
		matchOnDescription: true,
		matchOnDetail: true
	});
	if (!selected) return;
	await switchProjectPreset(wsRoot, selected.preset);
	updateStatusBar();
}
