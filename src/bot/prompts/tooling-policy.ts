const toolingPolicyTemplate = `This repository may include local agent tools under {{agentToolsDir}}.
Check {{agentToolsDir}}/README.md before implementing equivalent ad-hoc tooling.
Use each tool's README.md and bin/<tool-name> entrypoint when appropriate.
Prefer existing tools over ad-hoc shell pipelines.`

export function renderToolingPolicy(agentToolsDir: string | undefined): string {
  if (!agentToolsDir) return ''
  return toolingPolicyTemplate.replace(/\{\{agentToolsDir\}\}/g, agentToolsDir)
}
