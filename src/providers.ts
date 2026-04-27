import { Provider, Model, FlatPreset, EnvsFileV2, LegacyEnvFile, LegacyPreset } from './types';
import { ENVS_VERSION, GLOBAL_ENVS_PATH, DEFAULT_PROVIDERS } from './constants';
import { readJSON, writeJSON } from './storage';

// ==================== 供应商 & 预设管理 ====================

export function flattenProviders(providers: Provider[]): FlatPreset[] {
	const result: FlatPreset[] = [];
	for (const p of providers) {
		for (const m of p.models || []) {
			result.push({
				id: m.id,
				label: m.label || m.id,
				description: m.description || p.description || '',
				env: { ...(p.env || {}), ...(m.env || {}) },
				_providerId: p.id,
				_providerLabel: p.id
			});
		}
	}
	return result;
}

export function migratePresetsToProviders(presets: LegacyPreset[]): Provider[] {
	const groups = new Map<string, LegacyPreset[]>();
	for (const preset of presets) {
		const key = `${preset.env.ANTHROPIC_BASE_URL || ''}::${preset.env.ANTHROPIC_AUTH_TOKEN || ''}`;
		if (!groups.has(key)) groups.set(key, []);
		groups.get(key)!.push(preset);
	}

	return Array.from(groups.entries()).map(([, group]) => {
		const sharedKeys = ['ANTHROPIC_BASE_URL', 'ANTHROPIC_AUTH_TOKEN', 'API_TIMEOUT_MS', 'CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC'] as const;
		const sharedEnv: Record<string, string> = {};
		for (const k of sharedKeys) {
			const val = group[0].env[k];
			if (val !== undefined && group.every(p => p.env[k] === val)) sharedEnv[k] = val;
		}
		const url = group[0].env.ANTHROPIC_BASE_URL || '';
		const hostname = url.replace('https://', '').split('/')[0] || 'provider';
		const pDesc = group[0].description || hostname;
		return {
			id: hostname.replace(/[^a-zA-Z0-9_-]/g, '_'),
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

export function getAllProviders(): Provider[] {
	const data = readJSON<EnvsFileV2 | LegacyEnvFile>(GLOBAL_ENVS_PATH);
	if (!data) return JSON.parse(JSON.stringify(DEFAULT_PROVIDERS)) as Provider[];

	if ('version' in data && data.version === 2 && 'providers' in data && Array.isArray(data.providers)) {
		return data.providers;
	}

	if ('presets' in data && Array.isArray(data.presets)) {
		const providers = migratePresetsToProviders(data.presets);
		try {
			writeJSON<EnvsFileV2>(GLOBAL_ENVS_PATH, { version: ENVS_VERSION, providers });
		} catch (e) {
			console.error('迁移 envs.json 失败:', e);
		}
		return providers;
	}

	return JSON.parse(JSON.stringify(DEFAULT_PROVIDERS)) as Provider[];
}

export function saveAllProviders(providers: Provider[]): void {
	writeJSON<EnvsFileV2>(GLOBAL_ENVS_PATH, { version: ENVS_VERSION, providers });
}

// ==================== 供应商 CRUD ====================

export function findModel(modelId: string): { provider: Provider; model: Model } | null {
	const providers = getAllProviders();
	for (const p of providers) {
		const m = p.models.find(x => x.id === modelId);
		if (m) return { provider: p, model: m };
	}
	return null;
}

export function addModelToProvider(providerId: string, model: Model): boolean {
	const providers = getAllProviders();
	const p = providers.find(x => x.id === providerId);
	if (!p || p.models.find(x => x.id === model.id)) return false;
	p.models.push(model);
	saveAllProviders(providers);
	return true;
}

export function addProviderWithModel(providerData: Provider, model: Model): boolean {
	const providers = getAllProviders();
	if (providers.find(x => x.id === providerData.id)) return false;
	providerData.models = [model];
	providers.push(providerData);
	saveAllProviders(providers);
	return true;
}

export function updateModel(modelId: string, updated: Model): boolean {
	const providers = getAllProviders();
	for (const p of providers) {
		const idx = p.models.findIndex(x => x.id === modelId);
		if (idx >= 0) {
			p.models[idx] = updated;
			saveAllProviders(providers);
			return true;
		}
	}
	return false;
}

export function deleteModel(modelId: string): boolean {
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

export function getModelCount(): number {
	return getAllProviders().reduce((sum, p) => sum + (p.models?.length || 0), 0);
}

export function getAllPresets(): FlatPreset[] {
	return flattenProviders(getAllProviders());
}

export function matchPreset(presetId: string): FlatPreset | null {
	const presets = getAllPresets();
	return presets.find(p => p.id === presetId) || null;
}

export function initGlobalEnvs(): void {
	const fs = require('fs');
	const path = require('path');
	if (!fs.existsSync(GLOBAL_ENVS_PATH)) {
		try {
			const dir = path.dirname(GLOBAL_ENVS_PATH);
			if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
			writeJSON<EnvsFileV2>(GLOBAL_ENVS_PATH, { version: ENVS_VERSION, providers: DEFAULT_PROVIDERS });
		} catch (e) {
			console.error('初始化 envs.json 失败:', e);
		}
	}
}
