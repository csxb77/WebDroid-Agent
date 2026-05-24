export type RepositoryStats = {
  stars: number
  forks: number
  openIssues: number
}

export const REPOSITORY_URL = 'https://github.com/yeahhe365/WebDroid-Agent'
export const REPOSITORY_API_URL = 'https://api.github.com/repos/yeahhe365/WebDroid-Agent'

export function readRepositoryStats(value: unknown): RepositoryStats {
  const record = isRecord(value) ? value : {}
  return {
    stars: readNumber(record.stargazers_count),
    forks: readNumber(record.forks_count),
    openIssues: readNumber(record.open_issues_count),
  }
}

function readNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
