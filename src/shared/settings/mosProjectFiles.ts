import { duplicateMosProject, validateMosProjects, type MosProject } from './mosProjects'

const projectFileFormat = 'lb-portal-mos-project'

export function exportMosProjectFile(project: MosProject): string {
  const validated = validateMosProjects({ version: 2, activeProjectId: project.id, projects: [project] }).projects[0]!
  return JSON.stringify({ format: projectFileFormat, version: 1, project: validated }, null, 2)
}

export function importMosProjectFile(contents: string, createId: () => string): MosProject {
  let value: unknown
  try { value = JSON.parse(contents) } catch { throw new Error('Invalid MOS project file.') }
  if (!isRecord(value) || value.format !== projectFileFormat || value.version !== 1) throw new Error('Unsupported MOS project file.')
  const source = validateMosProjects({ version: 2, activeProjectId: value.project?.id, projects: [value.project] }).projects[0]!
  return { ...duplicateMosProject(source, source.name, createId), mode: source.mode ?? 'csv' }
}

function isRecord(value: unknown): value is Record<string, any> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
