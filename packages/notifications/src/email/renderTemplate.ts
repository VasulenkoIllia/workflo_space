export function renderTemplate(templateName: string, variables: Record<string, string>) {
  const entries = Object.entries(variables)
    .map(([key, value]) => `${key}: ${value}`)
    .join('\n')

  return `<pre>Template: ${templateName}\n${entries}</pre>`
}
