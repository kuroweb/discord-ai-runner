const HIGH_RISK_BASH_PATTERNS = [
  String.raw`\brm\s+-rf\b`,
  String.raw`\bsudo\b`,
  String.raw`\bgit\s+reset\s+--hard\b`,
  String.raw`\bcurl\b[\s\S]*\|\s*(?:sh|bash|zsh)\b`,
  String.raw`\bchmod\s+777\b`,
].map((pattern) => new RegExp(pattern, 'i'))

const HIGH_RISK_EDIT_REASON_PATTERN = new RegExp(
  [
    String.raw`\bdelete\b`,
    String.raw`\boverwrite\b`,
    String.raw`\brename\b`,
  ].join('|'),
  'i',
)

export function isHighRiskOperation(
  toolName: string,
  input: Record<string, unknown>,
): boolean {
  if (toolName === 'Bash') {
    const command = typeof input.command === 'string' ? input.command : ''
    return HIGH_RISK_BASH_PATTERNS.some((pattern) => pattern.test(command))
  }

  if (toolName === 'Edit') {
    const reason = typeof input.reason === 'string' ? input.reason : ''
    return (
      Boolean(input.grantRoot) || HIGH_RISK_EDIT_REASON_PATTERN.test(reason)
    )
  }

  return false
}
