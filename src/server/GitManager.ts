import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs/promises';

const execAsync = promisify(exec);

export class GitManager {
  private baseDirectory: string;
  
  constructor() {
    this.baseDirectory = process.cwd();
  }

  async createWorktree(branchName: string): Promise<string> {
    const worktreePath = path.join(this.baseDirectory, '.worktrees', branchName);
    
    try {
      await fs.mkdir(path.dirname(worktreePath), { recursive: true });
      
      await execAsync(`git worktree add "${worktreePath}" -b "${branchName}" main`, {
        cwd: this.baseDirectory
      });
      
      return worktreePath;
    } catch (error) {
      throw new Error(`Failed to create worktree: ${(error as Error).message}`);
    }
  }

  async removeWorktree(worktreePath: string): Promise<void> {
    try {
      await execAsync(`git worktree remove "${worktreePath}" --force`, {
        cwd: this.baseDirectory
      });
    } catch (error) {
      console.warn(`Failed to remove worktree ${worktreePath}:`, (error as Error).message);
    }
  }

  async commitAndCreatePR(worktreePath: string, branchName: string, message: string): Promise<string> {
    try {
      await execAsync('git add .', { cwd: worktreePath });
      
      await execAsync(`git commit -m "${message.replace(/"/g, '\\"')}"`, {
        cwd: worktreePath
      });
      
      await execAsync(`git push origin "${branchName}"`, {
        cwd: worktreePath
      });
      
      const { stdout } = await execAsync(`gh pr create --title "${message.replace(/"/g, '\\"')}" --body "Auto-generated PR from botfarm developer" --head "${branchName}" --base main`, {
        cwd: worktreePath
      });
      
      const prUrl = stdout.trim();
      return prUrl;
    } catch (error) {
      throw new Error(`Failed to commit and create PR: ${(error as Error).message}`);
    }
  }

  async ensureGitRepo(): Promise<boolean> {
    try {
      await execAsync('git rev-parse --git-dir', { cwd: this.baseDirectory });
      return true;
    } catch {
      return false;
    }
  }

  async getCurrentBranch(): Promise<string> {
    try {
      const { stdout } = await execAsync('git branch --show-current', {
        cwd: this.baseDirectory
      });
      return stdout.trim();
    } catch (error) {
      throw new Error(`Failed to get current branch: ${(error as Error).message}`);
    }
  }
}