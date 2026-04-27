import * as fs from 'fs';

// ==================== 文件读写 ====================

export function readJSON<T>(filePath: string): T | null {
	try {
		if (fs.existsSync(filePath)) {
			return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as T;
		}
	} catch {
		// ignore
	}
	return null;
}

export function writeJSON<T>(filePath: string, data: T): void {
	const dir = require('path').dirname(filePath);
	if (!fs.existsSync(dir)) {
		fs.mkdirSync(dir, { recursive: true });
	}
	fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

export function deleteFile(filePath: string): void {
	try {
		if (fs.existsSync(filePath)) {
			fs.unlinkSync(filePath);
		}
	} catch {
		// ignore
	}
}
