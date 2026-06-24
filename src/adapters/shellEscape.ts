/**
 * Escape a string for safe use as a shell argument.
 * Wraps the value in single quotes and escapes any single quotes inside,
 * so shell metacharacters (; | ` $ () \n etc.) are treated as literal text.
 */
export function escapeShellArg(value: string): string {
  return `'${value.replace(/'/g, "'\\''")}'`
}
