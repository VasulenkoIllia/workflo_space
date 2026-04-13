export interface GeneratePdfInput {
  type: string
  payload: Record<string, unknown>
}

export function generatePdf(_input: GeneratePdfInput): Promise<Buffer> {
  throw new Error('PDF templates are not implemented yet. Planned for Sprint 6.')
}
