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
const constants_1 = require("./constants");
const providers_1 = require("./providers");
const statusBar_1 = require("./statusBar");
const quickPick_1 = require("./quickPick");
const panel_1 = require("./panel");
// ==================== 激活 ====================
function activate(context) {
    (0, providers_1.initGlobalEnvs)();
    (0, statusBar_1.createStatusBar)(context);
    context.subscriptions.push(vscode.commands.registerCommand('ccSwitch.selectEnv', quickPick_1.showQuickActions));
    context.subscriptions.push(vscode.commands.registerCommand('ccSwitch.showConfig', panel_1.showConfigPanel));
    context.subscriptions.push(vscode.commands.registerCommand('ccSwitch.editSettings', () => {
        vscode.commands.executeCommand('vscode.open', vscode.Uri.file(constants_1.GLOBAL_SETTINGS_PATH));
    }));
    context.subscriptions.push(vscode.commands.registerCommand('ccSwitch.editEnvs', () => {
        vscode.commands.executeCommand('vscode.open', vscode.Uri.file(constants_1.GLOBAL_ENVS_PATH));
    }));
    context.subscriptions.push(vscode.commands.registerCommand('ccSwitch.showQuickActions', quickPick_1.showQuickActions));
    context.subscriptions.push(vscode.workspace.onDidChangeWorkspaceFolders(() => (0, statusBar_1.updateStatusBar)()));
}
function deactivate() {
    // noop
}
//# sourceMappingURL=extension.js.map