# agent-tools

このディレクトリは、エージェント向けCLIツール群を置くための領域。
Bot 本体の依存や `package.json` に混ぜず、ツールごとに独立して保守する。

## Rules

- 各ツールは `agent-tools/<tool-name>/` に配置する
- 実行入口は `agent-tools/bin/<tool-name>` に統一する
- `PATH` には載せず、repo 内の絶対パスまたは相対パスで直接実行する
- 依存管理は各ツール配下に閉じる
- 既存ツールで解ける作業は ad-hoc な shell pipeline を再実装しない

## Layout

```text
agent-tools/
  README.md
  bin/
    <tool-name>
  <tool-name>/
    README.md
    src/
    lib/
    Gemfile
    package.json
    tsconfig.json
```

使わないファイルやディレクトリは作らなくてよい。

## Runtime conventions

- shell: 依存なし
- Ruby: ツール配下の `Gemfile` で管理
- Node.js: ツール配下の `package.json` で管理
- 実装言語はツールごとに自由に選んでよい
- このリポジトリでツールを使う側は、基本的にセットアップ済み環境を前提に `agent-tools/bin/<tool-name>` をそのまま実行してよい
- セットアップ手順はツールの保守・再構築が必要な場合にだけ参照する

## Available tools

### `diff-preview-html`

`git diff` を `diff2html` で整形し、HTML に出力する Node.js 製 CLI。

- Entry point: `agent-tools/bin/diff-preview-html`
- Runtime assumption: 通常利用では依存導入済み・ビルド済みを前提とする
- Maintenance setup: `cd agent-tools/diff-preview-html && npm install`
- Usage: `agent-tools/bin/diff-preview-html --output /tmp/diff.html`

### `diff-preview-markdown`

`git diff` を Markdown コードブロック形式で stdout に出力する Node.js 製 CLI。

- Entry point: `agent-tools/bin/diff-preview-markdown`
- Runtime assumption: 通常利用では依存導入済み・ビルド済みを前提とする
- Maintenance setup: `cd agent-tools/diff-preview-markdown && npm install`
- Usage: `agent-tools/bin/diff-preview-markdown --repo /path/to/repo [-- <git diff args...>]`

