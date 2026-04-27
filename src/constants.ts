import * as path from 'path';
import * as os from 'os';
import * as vscode from 'vscode';
import { Provider } from './types';

// ==================== 常量 ====================

export const ENVS_VERSION = 2;

export const GLOBAL_SETTINGS_PATH = path.join(os.homedir(), '.claude', 'settings.json');
export const GLOBAL_ENVS_PATH = path.join(os.homedir(), '.claude', 'envs.json');

export const DEFAULT_PROVIDERS: Provider[] = [
	{
		id: 'dashscope', label: 'DashScope', description: '阿里云百炼 DashScope API',
		env: {
			ANTHROPIC_AUTH_TOKEN: '',
			ANTHROPIC_BASE_URL: 'https://coding.dashscope.aliyuncs.com/apps/anthropic',
			API_TIMEOUT_MS: '300000',
			CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '1'
		},
		models: [
			{
				id: 'cc:qwen3.6-plus', label: 'cc:qwen3.6-plus', description: 'DashScope qwen3.6-plus',
				env: {
					ANTHROPIC_MODEL: 'qwen3.6-plus',
					ANTHROPIC_DEFAULT_HAIKU_MODEL: 'qwen3.6-plus',
					ANTHROPIC_DEFAULT_SONNET_MODEL: 'qwen3.6-plus',
					ANTHROPIC_DEFAULT_OPUS_MODEL: 'qwen3.6-plus'
				}
			},
			{
				id: 'cc:GLM-5', label: 'cc:GLM-5', description: 'DashScope GLM-5',
				env: {
					ANTHROPIC_MODEL: 'glm-5',
					ANTHROPIC_DEFAULT_HAIKU_MODEL: 'glm-5',
					ANTHROPIC_DEFAULT_SONNET_MODEL: 'glm-5',
					ANTHROPIC_DEFAULT_OPUS_MODEL: 'glm-5'
				}
			},
			{
				id: 'cc:kimi-k2.5', label: 'cc:kimi-k2.5', description: 'DashScope kimi-k2.5',
				env: {
					ANTHROPIC_MODEL: 'kimi-k2.5',
					ANTHROPIC_DEFAULT_HAIKU_MODEL: 'kimi-k2.5',
					ANTHROPIC_DEFAULT_SONNET_MODEL: 'kimi-k2.5',
					ANTHROPIC_DEFAULT_OPUS_MODEL: 'kimi-k2.5'
				}
			},
			{
				id: 'cc:MiniMax-M2.5', label: 'cc:MiniMax-M2.5', description: 'DashScope MiniMax-M2.5',
				env: {
					ANTHROPIC_MODEL: 'MiniMax-M2.5',
					ANTHROPIC_DEFAULT_HAIKU_MODEL: 'MiniMax-M2.5',
					ANTHROPIC_DEFAULT_SONNET_MODEL: 'MiniMax-M2.5',
					ANTHROPIC_DEFAULT_OPUS_MODEL: 'MiniMax-M2.5'
				}
			}
		]
	}
];

// ==================== 路径工具 ====================

export function getWorkspaceRoot(): string | null {
	const folders = vscode.workspace.workspaceFolders;
	return folders && folders.length > 0 ? folders[0].uri.fsPath : null;
}

export function getProjectSettingsPath(wsRoot: string): string {
	return path.join(wsRoot, '.claude', 'settings.local.json');
}
