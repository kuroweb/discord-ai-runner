---
name: daily-digest
description: >-
  直近48時間の、AI コーディングエージェント利用者向けデイリーダイジェストを作る。
  公式アップデートと、X・Zenn・Qiita・はてなで直近に話題になっている記事を拾い、
  Discord に貼りやすい日本語で短くまとめる。
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

### 2. コミュニティトレンド

次のような場所から、**直近で話題になっている記事** を拾う。

- X
- Zenn
- Qiita
- はてなブックマーク

Zenn / Qiita は **作成日・更新日・いいね数** を見る。  
X は **直近の投稿頻度や反応** を見る。  
はてなは **ホットエントリやブクマ数** を見る。

### 3. 技術ブログ

企業・開発組織の技術ブログから、**直近で実装や運用の参考になる記事** を拾う。

- ZOZO TECH BLOG
- DevelopersIO

## Time Window

- 基本は **当日または直近48時間以内**（JST）。
- Zenn / Qiita は **作成日または更新日** のどちらかがこの範囲なら候補にしてよい。
- 48時間内に十分な話題が少ない日は、無理に埋めず件数を減らしてよい。

## Workflow

1. まず公式系の起点をざっと見て、直近48時間の更新を 0〜10 件拾う。
2. 次にコミュニティ系の起点を見て、直近で話題になっている記事を 0〜10 件拾う。
3. その後に技術ブログ系の起点を見て、直近48時間で目に値する記事を 0〜10 件拾う。
4. Zenn / Qiita / はてな / 技術ブログで拾った記事は、一覧ページだけで済ませず、**実際の記事ページを開いてタイトルと日付を確認する**。
5. 一般 AI 業界ニュース、政策、選挙、消費者向けガジェットは落とす。
6. 最終的な件数は固定しない。多い日は厚く、少ない日は薄くしてよい。

## Source Pool

公式系の起点:

- `https://cursor.com/changelog`
- `https://www.anthropic.com/news`
- `https://docs.anthropic.com/en/release-notes/overview`
- `https://docs.anthropic.com/en/docs/claude-code/overview`
- `https://github.com/anthropics/claude-code/releases`
- `https://platform.openai.com/docs/changelog`
- `https://developers.openai.com/`
- `https://github.com/openai/codex/releases`
- `https://ai.google.dev/gemini-api/docs/changelog`
- `https://ai.google.dev/gemini-api/docs`
- `https://github.com/modelcontextprotocol/specification/releases`
- `https://modelcontextprotocol.io`

コミュニティ系の起点:

- `https://x.com/search?q=Claude%20Code&f=live`
- `https://x.com/search?q=OpenAI%20Codex&f=live`
- `https://x.com/search?q=Cursor%20MCP&f=live`
- `https://zenn.dev/`
- `https://qiita.com/trend`
- `https://b.hatena.ne.jp/hotentry/all`

技術ブログ系の起点:

- `https://techblog.zozo.com/`
- `https://dev.classmethod.jp/`

これらは **推奨の起点** であり、固定順・固定件数・固定見出しで処理する必要はない。

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
