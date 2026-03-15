const toolingPolicyTemplate = `This repository may include local agent tools under {{agentToolsDir}}.
Check {{agentToolsDir}}/README.md before implementing equivalent ad-hoc tooling.
Use {{agentToolsDir}}/bin/<tool-name> as the entrypoint for local tools when appropriate.
Prefer existing tools over ad-hoc shell pipelines.`

export function renderToolingPolicy(agentToolsDir: string | undefined): string {
  if (!agentToolsDir) return ''
  return toolingPolicyTemplate.replace(/\{\{agentToolsDir\}\}/g, agentToolsDir)
}
