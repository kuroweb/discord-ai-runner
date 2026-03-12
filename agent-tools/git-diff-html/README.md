# git-diff-html

`git diff` を `diff2html` で整形し、静的 HTML として出力する repo-local CLI。

## Runtime assumption

通常利用では、このツールは依存導入済み・ビルド済みである前提で
`agent-tools/bin/git-diff-html` を直接実行する。

## Maintenance setup

```bash
cd agent-tools/git-diff-html
npm install
```

## Usage

```bash
agent-tools/bin/git-diff-html --output /tmp/diff.html
```

差分引数をそのまま `git diff` に渡したい場合:

```bash
agent-tools/bin/git-diff-html --output /tmp/index.html -- --cached src/index.ts
```

## Options

- `-o, --output <path>`: 出力 HTML パス。省略時は `./git-diff.html`
- `--repo <path>`: `git diff` を実行する作業ディレクトリ。省略時は `git rev-parse --show-toplevel` で解決した repo root
- `--format <line-by-line|side-by-side>`: diff2html の表示形式。省略時は `line-by-line`
- diff2html の dark color scheme を使う
- `-h, --help`: ヘルプ表示

## Notes

- `--repo` 未指定時は repo root を基準にし、未追跡ファイルも自動で含める
- `node_modules/` と `dist/` などの生成物は自動除外する
- 出力 HTML は `diff2html` のデフォルト CSS を内包するので単体で開ける
- セットアップコマンドは、このツール自体を保守・再構築する場合にだけ必要
