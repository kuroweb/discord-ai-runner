# diff-preview-markdown

`git diff` を Markdown コードブロック形式で stdout に出力する Node.js 製 CLI。
Discord の 2000 文字制限を考慮したチャンク分割は呼び出し側で行う。

- Entry point: `agent-tools/bin/diff-preview-markdown`
- Maintenance setup: `cd agent-tools/diff-preview-markdown && npm install`
- Usage: `agent-tools/bin/diff-preview-markdown --repo /path/to/repo [-- <git diff args...>]`
