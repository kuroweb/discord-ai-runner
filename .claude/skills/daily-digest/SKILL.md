---
name: daily-digest
description: >-
  当日または直近24時間の、実務とエージェント開発に効く情報を収集・要約し、
  日本語のデイリーダイジェストを作成する。公式 changelog / リリースノート、
  ドキュメント新着、X・はてな・Zenn・Qiita の開発者向けトレンド、再現可能な
  テクニックを優先する。立法・連邦政策・汎用消費者向けハード／画像生成のみの
  話題は採用しない。Discord 向けのニュースまとめや当日の AI 開発トピック整理に使う。
---

# daily-digest

## Goal

**読者**: AI コーディングエージェントを日常的に使う開発者。**出力**: Discord 向けに読みやすい日本語デイリーダイジェスト。

- **最優先**: 実装・運用・プロンプト設計に直結する一次情報（changelog、リリースノート、公式ブログ、ドキュメントの新着）。
- **次点**: X / はてな / Zenn / Qiita で検証・議論されているトレンド。技術記事は **本文に手順・コード等の根拠**があるものを優先。**X だけ**の話題は公式・リポジトリ・技術記事で裏取りできたときのみ。
- **採用しない**: 下記「Editorial tiers」の Tier C に相当する話題。件数不足を理由に Tier C で穴埋めしない。

## 必須調査 URL（本文の前に、番号順で取得）

**1→18 の順**に WebFetch 等で取得する。**この表を踏まえず WebSearch だけで本文を書かない。** 404 やパス変更時は同一サイト内で changelog / release notes / docs に辿る。**13〜15（X）**はログイン壁等でツールが空でもよいので、**同じ URL をブラウザで開いて**目視する（スキル内の手順だけで追えるようにする）。

| # | URL | 見る内容 |
| --- | --- | --- |
| 1 | `https://cursor.com/changelog` | Cursor 製品更新 |
| 2 | `https://www.anthropic.com/news` | Anthropic 公式ニュース |
| 3 | `https://docs.anthropic.com/en/release-notes/overview` | Claude / API リリースノート |
| 4 | `https://docs.anthropic.com/en/docs/claude-code/overview` | Claude Code ドキュメント（What's new 等） |
| 5 | `https://github.com/anthropics/claude-code/releases` | Claude Code CLI Releases |
| 6 | `https://platform.openai.com/docs/changelog` | OpenAI Platform 変更 |
| 7 | `https://developers.openai.com/` | OpenAI 開発者向けトップ（Codex 等） |
| 8 | `https://github.com/openai/codex/releases` | Codex CLI Releases |
| 9 | `https://ai.google.dev/gemini-api/docs/release-notes` | Gemini API リリースノート |
| 10 | `https://ai.google.dev/gemini-api/docs` | Gemini API ドキュメント |
| 11 | `https://github.com/modelcontextprotocol/specification/releases` | MCP 仕様 Releases |
| 12 | `https://modelcontextprotocol.io` | MCP 公式ドキュメント |
| 13 | `https://x.com/search?q=Claude%20Code&f=live` | X 最新投稿（Claude Code 周辺） |
| 14 | `https://x.com/search?q=OpenAI%20Codex&f=live` | X 最新投稿（Codex 周辺） |
| 15 | `https://x.com/search?q=Cursor%20MCP&f=live` | X 最新投稿（Cursor・MCP 周辺） |
| 16 | `https://zenn.dev/` | Zenn（開発・AI 系をトレンド導線から抽出可） |
| 17 | `https://qiita.com/trend` | Qiita トレンド |
| 18 | `https://b.hatena.ne.jp/hotentry/all` | はてなブックマーク総合（開発・AI 系を抽出） |

### URL と本文見出し `###` の対応

| 必須 URL（#） | 本文の `###` |
| --- | --- |
| 1 | `### Cursor` |
| 2〜5 | `### Anthropic` |
| 6〜8 | `### OpenAI` |
| 9〜10 | `### Gemini` |
| 11〜12 | `### MCP` |
| 13〜15 | `### Xトレンド`（3 本とも同じ節。重複話題は 1 件にまとめる） |
| 16 | `### Zennトレンド` |
| 17 | `### Qiitaトレンド` |
| 18 | `### はてなブックマーク` |

**Tier B**（下表）のうち、**特定ベンダの公式ドキュメント／API／製品**に紐づくものは上表の `###` へ。**ベンダ非依存**（言語・FW・汎用 CLI 等）は `### その他（開発実務・Tier B）` へ。

### 採用件数とソースのバランス

- 採用項目の **過半数** は、**(a)** 必須 URL **1〜12** を主ソースとする項目、または **(b)** **16〜18** のページ上で確認した技術記事を主ソースとする項目とする（Zenn / Qiita / はてなの各節では **その記事 URL を第一の `ソース:`** でよい）。
- **`### Xトレンド`**: 必須 **13〜15** で目にした話題を優先する。採用する各項目の **`ソース:` の第一は裏取り用の公式・GitHub・技術記事**とし（Goal の「X だけ」ルール）、X のポスト URL は補足として足してよい。
- 立法・連邦政策・選挙を主題とする記事は採用しない（`ソース:` にも載せない）。
- 「AI ニュース」「today AI」等の曖昧クエリだけで探索を始め、必須 URL を飛ばさない。

## Editorial tiers（採用の段）

| Tier | 内容 | 本文での扱い |
| --- | --- | --- |
| A | Claude Code、Codex、Gemini（CLI/IDE）、Cursor 等の公式更新（機能・料金・制限・セキュリティ・MCP・Skills/Commands 等） | `## エージェントツールの最新情報` 内の該当 `###`（上の対応表） |
| B | 言語・FW・ライブラリのリリース、CLI/SDK、モデル API の実務影響、再現手順つきテクニック、公式リファレンス更新 | ベンダに紐づく → 対応する `### Cursor` 等。紐づかない → `### その他（開発実務・Tier B）`。同一 `###` 内は **Tier A を先** |
| C | 立法・政策・企業ストーリー中心・消費者ガジェット・汎用「AI 業界」報道、コーディングエージェント利用者の手元ツールに繋がらない一般ニュース | **採用禁止** |

API 利用規約・リージョン・保存方針など **開発者要件への直接影響**は Tier B。該当 `###` にニュースが無いときは **`- 特になし`**。全体が静かな日は先頭タイトル行で率直に示す。

## 鮮度（Freshness / Recency）

**採用条件（すべて満たす）**

- 新しい出来事が **当日または直近 24 時間以内**（**JST** 基準。UTC 境界で切らない）。
- その新しさを **日付つき**で説明できる。
- 再共有・再浮上・まとめ直し・感想のみではない。
- 各項目に **`ソース: URL`** がある。

**原則除外**

- 既知話題を別メディアが当日まとめ直しただけ、過去発表の比較・解説の焼き直し、X で過去ニュースが再バズっただけ、「最近注目」だが新イベントがないもの。

**24 時間を少し超える場合**

- その間に **続報・正式発表・価格変更・障害復旧・提供開始**など、新展開が確認できるときのみ。

`### Zennトレンド` / `### Qiitaトレンド` / `### はてなブックマーク` も **上記と同じ鮮度条件**。トレンドだから緩めない。

## Trend sections gate（Zenn / Qiita / はてなの 3 節）

必須 URL **16〜18 を実際に取得した内容**に基づく。

**必須**

- **17（Qiita）**で、反応・順位が明らかな実務系記事のうち鮮度条件を満たすものが **1 件でもある**とき、`### Qiitaトレンド` を **`- 特になし` にしてはならない**。**1〜3 件**要約し、`ソース:` の第一は **その記事 URL**。
- **16 / 18**でも同様に、鮮度条件を満たす実務記事が一覧に見えるときは、**`### Zennトレンド` / `### はてなブックマーク`** も `特になし` にしない（各 **1〜3 件**）。

**除外**

- 鮮度・内容が条件に合わない記事（いいねが多いだけでは採用しない）。
- 再掲まとめ・感想のみ・炎上・非技術は採用しない。

**ソース**: 採用記事の canonical URL を `ソース:` の主とする。公式が無いことを理由に `特になし` に戻さない。

## Workflow

1. 必須 URL **1→18** を順に取得し、新着の有無と日付をメモする（**13〜15** で X 側のエージェント系トレンドを拾う）。
2. 追加で X を掘る場合も、**13〜15 と同種のキーワード**（MCP、skills、subagents、Gemini CLI 等）に寄せ、候補を **最低 5 件** メモしてから公式・リポジトリ・技術記事で裏取りする（大手一般メディアだけで組み立てない）。
3. 追加探索は **検索クエリの例**に沿う。`policy` / `legislation` / `Congress` / `White House` 中心のクエリは使わない。
4. 各候補について公開日・更新日・発生日を確認し、「何が新しいか」を一文で言えるようにする。
5. **Tier C** を除外し、**鮮度**を満たすものだけ残す。重複は一次情報（公式・GitHub Release）を優先。
6. **固定見出し**（Output format）に振り分ける。同一 `###` 内は **Tier A → Tier B**。採用件数は通過分に従い、不足を無理に埋めない（**ただし** Trend sections gate を満たすのに `特になし` にしない）。
7. 各箇条書きは **要約（日付＋要点）** の直後に **`ソース: URL`**。推測は書かない。

### 調査時に優先するトピック（頭の順序）

1. Claude Code、Codex、Gemini（CLI/IDE）、Cursor の新機能・モデル・制限・料金・提供開始/終了・セキュリティ
2. MCP、Skills、Commands、rules、permissions の公式変更と検証投稿
3. 公式ドキュメント・API で呼び方・制限・非推奨が変わる更新
4. エージェント間の差分で **実装選択**に効く発表
5. 実利用に効くアップデート・障害・仕様変更

上記は **見出しの並び**（Output format）とは別。項目は常に該当する `###` の下だけに書く。

### 検索クエリの例（偏り防止）

エージェント・ドキュメント・実務を混ぜる。例（日付は実行時に置換可）:

- `Cursor changelog`, `site:cursor.com changelog`
- `Claude Code release`, `site:github.com anthropics claude-code`
- `OpenAI Codex CLI`, `site:developers.openai.com`
- `Gemini API release notes`, `site:ai.google.dev`
- `Model Context Protocol release`, `site:github.com modelcontextprotocol`
- `site:zenn.dev` / `site:qiita.com` + `Claude Code` / `Cursor` / `Codex` / `MCP`

「AI news today」だけで終わらない。

## Output format

### 先頭

1. **1 行目**: タイトル用の短い要約（平文・約 20 字）。その日いちばん実務に効く一行を優先。薄い日は「公式新着なし」等でよい。
2. 空行
3. 本文（Markdown）

### 本文

- 下記の **`##` / `###` をこの順序・この文言のまますべて出力**（省略・統合・並び替え禁止）。
- 各 `###` の直下には **箇条書きを 1 つ以上**。新情報が無いときは **`- 特になし`** のみ（空にしない）。**Trend sections gate** により、Zenn / Qiita / はてなで条件を満たす記事があるのに `特になし` にしない。`### Xトレンド` は必須 **13〜15** を踏まえたうえで、裏取り済みの採用だけを書く（無ければ `特になし`）。
- 採用がある箇条書きは **1 行目に要約（具体日付＋新しさ）**、必要なら続けて短い補足、その **直後**に **`ソース: URL`**。
- 独立した `## ソース` セクションは作らない。調査 URL の列挙も不要（`特になし` で足りる）。

### 固定見出し（毎回フルセット）

```md
## エージェントツールの最新情報

### Cursor
- 特になし

### Anthropic
- YYYY-MM-DD: 要約1行。開発者への実務影響。
  ソース: https://...

### OpenAI
- 特になし

### Gemini
- 特になし

### MCP
- 特になし

## AI開発トピックス

### Xトレンド
- 特になし

### Zennトレンド
- 特になし

### Qiitaトレンド
- 特になし

### はてなブックマーク
- 特になし

### その他（開発実務・Tier B）
- 特になし
```

採用がある `###` では `- 特になし` の代わりに、鮮度通過分の箇条書きを並べる。複数件は `-` を複数行。

## Constraints

- 日本語。事実ベース。日付は具体的に。
- トレンドの話題性と、本文の根拠 URL を混同しない。
- 必須調査 URL を省略しない。
- 立法・政策・州議会ネタで本文を構成しない。
