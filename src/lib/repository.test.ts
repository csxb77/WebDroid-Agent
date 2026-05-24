import { describe, expect, it } from 'vitest'
import { readRepositoryStats } from './repository'

describe('repository helpers', () => {
  it('reads GitHub repository counters with safe fallbacks', () => {
    expect(
      readRepositoryStats({
        stargazers_count: 123,
        forks_count: 45,
        open_issues_count: 6,
      }),
    ).toEqual({
      stars: 123,
      forks: 45,
      openIssues: 6,
    })

    expect(readRepositoryStats(null)).toEqual({
      stars: 0,
      forks: 0,
      openIssues: 0,
    })
    expect(
      readRepositoryStats({
        stargazers_count: Number.NaN,
        forks_count: '45',
        open_issues_count: undefined,
      }),
    ).toEqual({
      stars: 0,
      forks: 0,
      openIssues: 0,
    })
  })
})
