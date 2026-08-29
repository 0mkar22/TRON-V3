import * as vscode from 'vscode';

export function createStatusBarItem(): vscode.StatusBarItem {
    const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBarItem.text = `$(zap) TRON: Active`;
    statusBarItem.show();
    return statusBarItem;
}

export function updateStatusBarItem(statusBarItem: vscode.StatusBarItem, taskId?: string) {
    if (taskId) {
        statusBarItem.text = `$(zap) TRON: ${taskId}`;
    } else {
        statusBarItem.text = `$(zap) TRON: Active`;
    }
}
