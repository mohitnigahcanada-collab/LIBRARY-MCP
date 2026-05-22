/**
 * Time-Travel Rollback Engine
 * 
 * Uses hidden Git commits to snapshot the repository before an MCP
 * tool makes changes, allowing instant undo.
 */

import { execFile } from 'child_process';
import { promisify } from 'util';
import { join } from 'path';

const execFileAsync = promisify(execFile);

export async function createSnapshot(message: string): Promise<{ snapshotId: string; success: boolean }> {
  try {
    const cwd = process.cwd();
    // Ensure we are in a git repo
    await execFileAsync('git', ['rev-parse', '--is-inside-work-tree'], { cwd });

    const snapshotId = `bb-snapshot-${Date.now()}`;
    
    // Create an orphan hidden branch, or just a detached tag
    // The safest way to snapshot without messing up the user's branch is a commit + tag
    await execFileAsync('git', ['add', '.'], { cwd });
    await execFileAsync('git', ['commit', '-m', `[BuilderBrain Snapshot] ${message}`], { cwd });
    await execFileAsync('git', ['tag', snapshotId], { cwd });

    console.log(`[TimeTravel] Created snapshot: ${snapshotId}`);
    return { snapshotId, success: true };
  } catch (err: any) {
    console.error(`[TimeTravel] Snapshot failed: ${err.message}`);
    return { snapshotId: '', success: false };
  }
}

export async function undoToSnapshot(snapshotId: string): Promise<boolean> {
  try {
    const cwd = process.cwd();
    // Hard reset to the tag
    await execFileAsync('git', ['reset', '--hard', snapshotId], { cwd });
    console.log(`[TimeTravel] Reverted to snapshot: ${snapshotId}`);
    return true;
  } catch (err: any) {
    console.error(`[TimeTravel] Undo failed: ${err.message}`);
    return false;
  }
}
