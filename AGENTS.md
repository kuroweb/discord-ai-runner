# プロジェクト概要

`discord-ai-runner` は、Discord メンションを起点に会話スレッドを作成し、AI 応答を継続する Bot。
本番常駐は macOS の `launchd` を前提とする。

## 主要機能

- メンション時に会話用スレッドを自動作成して応答開始
- 作成済みスレッドではメンションなしで継続応答
- スラッシュコマンドでセッション / モデル / 作業ディレクトリを確認・切り替え
- スレッド単位の状態とチャンネル既定設定を永続化

## 技術スタック

- Runtime: Node.js
- Language: TypeScript
- Package manager: npm
- Platform: macOS（`launchd` 運用）

## ディレクトリ構成

- `src/`: Bot 本体
- `agent-tools/`: エージェント向け CLI ツール
- `.rulesync/`: ルール・スキルの編集正本
- `scripts/`: ビルド補助スクリプト
- `launchd/`: LaunchDaemon 用 plist
- `dist/`: ビルド成果物
- `logs/`: 実行ログ

# エージェント設定

## Rules

- 正本は本ファイル（`AGENTS.md`）。`CLAUDE.md` は `@AGENTS.md` のインポートのみとし、他ツール向けの Rules 生成物は置かない。
- 変更は `AGENTS.md` を直接編集する。

## Skills

- 正本はリポジトリの `skills/`（`skills/*/SKILL.md`）。エージェントツール向けの配置先（`.agents/skills/` 等）は生成物であり、直接編集しない。
- 利用前に、リポジトリからプロジェクト配下へ展開する:

  ```bash
  gh skill install . --from-local --all --scope project --agent <cursor|claude-code|codex> --force
  ```

- `skills/` を編集したら`gh skill install`を再実行すること
