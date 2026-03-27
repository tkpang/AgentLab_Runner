import { execSync } from 'child_process';

/**
 * Resolve the full path of a command, using shell to ensure PATH is fully loaded.
 * Returns null if the command is not found.
 */
export default async function which(command: string): Promise<string | null> {
  try {
    const locator = process.platform === 'win32' ? 'where' : 'which';
    const result = execSync(`${locator} ${command}`, { encoding: 'utf-8', timeout: 5000 });
    const lines = String(result)
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    if (lines.length === 0) return null;
    return lines[0];
  } catch {
    return null;
  }
}
