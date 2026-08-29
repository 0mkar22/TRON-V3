import * as vscode from 'vscode';

export function showAIReviewPanel(taskId: string, reviewText: string) {
    const panel = vscode.window.createWebviewPanel(
        'tronAIReview', 
        `AI Review: TASK-${taskId}`, 
        vscode.ViewColumn.Beside,
        { enableScripts: true }
    );

    panel.webview.html = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>T.R.O.N. AI Code Review</title>
            <style>
                :root {
                    --card-bg: var(--vscode-editorWidget-background);
                    --card-border: var(--vscode-widget-border);
                    --text-muted: var(--vscode-descriptionForeground);
                }
                body { 
                    font-family: var(--vscode-font-family), -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; 
                    padding: 32px 24px; 
                    line-height: 1.6; 
                    color: var(--vscode-editor-foreground); 
                    background-color: var(--vscode-editor-background);
                    max-width: 900px;
                    margin: 0 auto;
                }
                .header {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    margin-bottom: 24px;
                    padding-bottom: 16px;
                    border-bottom: 1px solid var(--vscode-panel-border);
                }
                .header-title {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                }
                .header h2 { 
                    margin: 0;
                    font-size: 1.5rem;
                    font-weight: 600;
                    color: var(--vscode-editor-foreground);
                }
                .badge {
                    background-color: var(--vscode-badge-background);
                    color: var(--vscode-badge-foreground);
                    padding: 6px 12px;
                    border-radius: 4px;
                    font-size: 0.8rem;
                    font-weight: 600;
                    letter-spacing: 0.5px;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                }
                .review-card {
                    background: var(--card-bg);
                    border: 1px solid var(--card-border);
                    border-radius: 8px;
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
                    overflow: hidden;
                }
                .review-card-header {
                    background: var(--vscode-editorGroupHeader-tabsBackground);
                    padding: 12px 20px;
                    border-bottom: 1px solid var(--card-border);
                    font-size: 0.85rem;
                    color: var(--text-muted);
                    text-transform: uppercase;
                    letter-spacing: 1px;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }
                pre { 
                    margin: 0;
                    padding: 24px; 
                    white-space: pre-wrap; 
                    word-wrap: break-word;
                    font-family: var(--vscode-editor-font-family), "Fira Code", monospace;
                    font-size: 0.95rem;
                    color: var(--vscode-editor-foreground);
                }
                .logo-icon {
                    font-size: 1.8rem;
                }
            </style>
        </head>
        <body>
            <div class="header">
                <div class="header-title">
                    <span class="logo-icon">💠</span>
                    <h2>T.R.O.N. Engine AI</h2>
                </div>
                <span class="badge">TASK-${taskId}</span>
            </div>

            <div class="review-card">
                <div class="review-card-header">
                    <span>✨</span> Automated Code Analysis
                </div>
                <pre>${reviewText}</pre>
            </div>
        </body>
        </html>
    `;
    return panel;
}
