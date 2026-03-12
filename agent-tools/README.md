# agent-tools

このディレクトリは、エージェント向けの repo-local CLI 群を置くための領域。
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

## Available tools

### `git-diff-html`

`git diff` を `diff2html` で整形し、HTML に出力する Node.js 製 CLI。

- Entry point: `agent-tools/bin/git-diff-html`
- Setup: `cd agent-tools/git-diff-html && npm install`
- Usage: `agent-tools/bin/git-diff-html --output /tmp/diff.html`
