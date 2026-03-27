export const GOOGLE_DRIVE_SHARE_DIR =
  '~/Google Drive/マイドライブ/agent_share'

const googleDrivePolicyTemplate = `Google Drive 連携用ディレクトリ:
{{googleDriveShareDir}}

Google Drive に関する読み書きや共有が必要な場合は、このディレクトリを使うこと。

コマンド例:
~~~bash
# Google Drive のファイル確認
ls -la "{{googleDriveShareDir}}"

# ファイルを Google Drive に保存
cp ./local-file.txt "{{googleDriveShareDir}}/"

# Google Drive からファイルを読み込み
cat "{{googleDriveShareDir}}/some-file.txt"
~~~
`

export function renderGoogleDrivePolicy(
  googleDriveShareDir: string = GOOGLE_DRIVE_SHARE_DIR,
): string {
  return googleDrivePolicyTemplate.replaceAll('{{googleDriveShareDir}}', googleDriveShareDir).trim()
}
