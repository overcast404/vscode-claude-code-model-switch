import * as vscode from 'vscode';
import { GLOBAL_SETTINGS_PATH, GLOBAL_ENVS_PATH } from './constants';
import { initGlobalEnvs } from './providers';
import { createStatusBar, updateStatusBar } from './statusBar';
import { showQuickActions } from './quickPick';
import { showConfigPanel } from './panel';

// ==================== 激活 ====================

export function activate(context: vscode.ExtensionContext): void {
	initGlobalEnvs();

	createStatusBar(context);

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

export function deactivate(): void {
	// noop
}
