---
name: daily-digest
description: >-
  直近48時間の、AI コーディングエージェント利用者向けデイリーダイジェストを作る。
  公式アップデートと、X・Zenn・Qiita・はてなで直近に話題になっている記事を拾い、 Discord に貼りやすい日本語で短くまとめる。
---
# daily-digest

## Goal

AI コーディングエージェントを日常利用する開発者向けに、**今日の話題を短く把握できる digest** を作る。

- 目的は **漏れなく調査すること** ではなく、**直近で見る価値がある話題を拾うこと**。
- 公式更新とコミュニティの盛り上がりを、同じ digest の中で扱う。
- Discord にそのまま貼れる、短く読みやすい日本語で出す。

## What To Pick

### 1. 公式アップデート

次のような一次情報を優先して拾う。

- changelog
- release notes
- docs 更新
- GitHub Releases
- 公式ブログ

対象の例:

- Cursor
- Anthropic / Claude Code
- OpenAI / Codex
- Gemini
- MCP

Source Pool:

| 媒体 | 入口URL | まず見る場所 | 見る指標 |
| --- | --- | --- | --- |
| Cursor | `https://cursor.com/changelog` | changelog 一覧 | 更新日 / 新機能・改善内容 |
| Anthropic | `https://www.anthropic.com/news` | News 一覧 | 公開日 / Claude Code 関連かどうか |
| Anthropic Docs | `https://docs.anthropic.com/en/release-notes/overview` | release notes 一覧 | 更新日 / 変更内容 |
| Claude Code Docs | `https://docs.anthropic.com/en/docs/claude-code/overview` | Claude Code 関連ページ | 更新日 / Claude Code の機能追加・仕様変更 |
| Claude Code Releases | `https://github.com/anthropics/claude-code/releases` | Releases 一覧 | 公開日 / リリースノート |
| OpenAI Platform | `https://platform.openai.com/docs/changelog` | changelog 一覧 | 更新日 / Codex・API関連の変更内容 |
| OpenAI Developers | `https://developers.openai.com/` | Developers トップの新着 | 公開日 / Codex・Agents 関連かどうか |
| OpenAI Codex Releases | `https://github.com/openai/codex/releases` | Releases 一覧 | 公開日 / リリースノート |
| Gemini API | `https://ai.google.dev/gemini-api/docs/changelog` | changelog 一覧 | 更新日 / API・SDKの変更内容 |
| Gemini Docs | `https://ai.google.dev/gemini-api/docs` | ドキュメントの新着・更新箇所 | 更新日 / AI coding agent に関係する変更かどうか |
| MCP Specification | `https://github.com/modelcontextprotocol/specification/releases` | Releases 一覧 | 公開日 / 仕様変更内容 |
| MCP Docs | `https://modelcontextprotocol.io` | ドキュメントトップの更新箇所 | 更新日 / MCP の仕様・実装ガイド変更 |

### 2. コミュニティトレンド

次のような場所から、**直近で話題になっている記事** を拾う。

- X
- Zenn
- Qiita
- はてなブックマーク

全媒体で **作成日・更新日** を確認する。  
Zenn / Qiita は **いいね数（LGTM）** も見る。  
X は **直近の投稿頻度や反応**、はてなは **ホットエントリやブクマ数** を見る。

Source Pool:

| 媒体 | 入口URL | まず見る場所 | 見る指標 |
| --- | --- | --- | --- |
| Zenn | `https://zenn.dev/` | トップページの `Tech` セクション配下の記事一覧 | 作成日 / 更新日 / いいね数 |
| Qiita | `https://qiita.com/trend` | トレンド一覧 | 作成日 / 更新日 / LGTM 数 / トレンド入り状況 |
| はてなブックマーク | `https://b.hatena.ne.jp/hotentry/all` | ホットエントリ一覧 | 作成日 / 更新日 / ブクマ数 |
| X | `https://x.com/search?q=Claude%20Code&f=live` | `Claude Code` の Live 検索結果 | 作成日 / 更新日 / 反応 / 同話題の連続投稿 |
| X | `https://x.com/search?q=OpenAI%20Codex&f=live` | `OpenAI Codex` の Live 検索結果 | 作成日 / 更新日 / 反応 / 同話題の連続投稿 |
| X | `https://x.com/search?q=Cursor%20MCP&f=live` | `Cursor MCP` の Live 検索結果 | 作成日 / 更新日 / 反応 / 同話題の連続投稿 |

### 3. 技術ブログ

企業・開発組織の技術ブログから、**直近で実装や運用の参考になる記事** を拾う。

- ZOZO TECH BLOG
- DevelopersIO

Source Pool:

| 媒体 | 入口URL | まず見る場所 | 見る指標 |
| --- | --- | --- | --- |
| ZOZO TECH BLOG | `https://techblog.zozo.com/` | 新着記事一覧 | 公開日 / 更新日 / AI関連の記事かどうか |
| DevelopersIO | `https://dev.classmethod.jp/` | 新着記事一覧 | 公開日 / 更新日 / AI関連の記事かどうか |

## Time Window

- 基本は **当日または直近48時間以内**（JST）。
- すべての媒体で、**作成日または更新日** のどちらかがこの範囲なら候補にしてよい。
- 48時間内に十分な話題が少ない日は、無理に埋めず件数を減らしてよい。

## Workflow

1. `1. 公式アップデート` の Source Pool を確認し、直近48時間の更新を 0〜10 件拾う。
2. `2. コミュニティトレンド` の Source Pool を確認する。特定の 1 媒体だけで件数を満たして終了しない。
3. Zenn で候補を 3〜6 件拾う。一覧ページだけで済ませず、記事ページでタイトルと日付を確認する。
4. Qiita で候補を 3〜6 件拾う。一覧ページだけで済ませず、記事ページでタイトルと日付を確認する。
5. はてなブックマークで候補を 3〜6 件拾う。はてな一覧だけで済ませず、元記事ページでタイトルと日付を確認する。
6. X の Source Pool 検索を確認し、必要に応じて候補を 0〜6 件追加する。
7. `3. 技術ブログ` の Source Pool を確認し、直近48時間で目に値する記事を 0〜10 件拾う。
8. 一般 AI 業界ニュース、政策、選挙、消費者向けガジェットは落とす。
9. 最終出力は候補から選抜し、最終的な件数は固定しない。多い日は厚く、少ない日は薄くしてよい。

## Output Format

1 行目に、その日の digest を表す短いタイトルを書く。

その後は次の形で出す。

```md
今日の主要トピック

## 公式アップデート
### 製品名やリリース名
日時：YYYY-MM-DD
要約：何が変わったか。なぜ今見る価値があるか。
ソース：https://...

## コミュニティトレンド
### タイトル
日時：YYYY-MM-DD
要約：何が話題か。なぜ今目に入るべきか。
ソース：https://...

## 技術ブログ
### タイトル
日時：YYYY-MM-DD
要約：何が参考になるか。なぜ今読む価値があるか。
ソース：https://...
```

必要なら次の節を追加してよい。

- `## 今日のひとこと`
- `## すぐ試せるもの`

不要なら追加しない。

## Writing Style

- 日本語
- 事実ベース
- 短く切る
- 日付は具体的に書く
- 各項目は `### タイトル` の下に `日時：` `要約：` `ソース：` を書く
- コミュニティ記事は、記事タイトルを先に書く
- `要約：` では、その話題が今なぜ目に入るべきかを短く書く

## Constraints

- 固定見出しを無理に埋めない
- `特になし` を乱発しない
- 話題性の低いものを件数合わせで入れない
- ソースは各項目に付ける
- はてなブックマークを拾った場合も、`ソース:` の先頭は **はてなの一覧URLではなく元記事URL** にする
- コミュニティトレンドは特定の 1 媒体だけで構成しない
