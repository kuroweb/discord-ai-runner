# openai-models-list

OpenAI Models API (`GET /v1/models`) を呼び出して、利用可能モデル一覧を標準出力に出す shell 製 CLI。

## Usage

`agent-tools/bin/openai-models-list`  
`agent-tools/bin/openai-models-list --prefix gpt-5`  
`agent-tools/bin/openai-models-list --json`

環境変数:

`OPENAI_API_KEY=...`

`OPENAI_API_KEY` が未設定の場合は、リポジトリルートの `.env` から同名キーを自動で読み込む。  
`--json` なしの通常出力では `jq` を利用する。
