import * as vscode from 'vscode';
import * as path from 'path';
import { getWorkspaceRoot } from './constants';
import { getActiveModel } from './config';

// ==================== 状态栏 ====================

let statusBarItem: vscode.StatusBarItem | undefined;

export function createStatusBar(context: vscode.ExtensionContext): void {
	statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
	statusBarItem.command = 'ccSwitch.showConfig';
	updateStatusBar();
	statusBarItem.show();
	context.subscriptions.push(statusBarItem);
}

export function updateStatusBar(): void {
	if (!statusBarItem) return;
	const wsRoot = getWorkspaceRoot();
	const { preset, source } = getActiveModel(wsRoot);
	const wsName = wsRoot ? path.basename(wsRoot) : '';
	const label = preset?.id || '未设置';

	let text: string;
	let tooltip: string;
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
