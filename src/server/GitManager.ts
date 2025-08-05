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
    
    console.log('🔧 GitManager: Creating worktree');
    console.log('🔧 GitManager: Base directory:', this.baseDirectory);
    console.log('🔧 GitManager: Branch name:', branchName);
    console.log('🔧 GitManager: Worktree path:', worktreePath);
    
    try {
      console.log('🔧 GitManager: Creating .worktrees directory');
      await fs.mkdir(path.dirname(worktreePath), { recursive: true });
      
      console.log('🔧 GitManager: Executing git worktree add command');
      const result = await execAsync(`git worktree add "${worktreePath}" -b "${branchName}" main`, {
        cwd: this.baseDirectory
      });
      
      console.log('✅ GitManager: Git worktree command succeeded');
      console.log('🔧 GitManager: Command output:', result.stdout);
      console.log('🔧 GitManager: Command stderr:', result.stderr);
      
      return worktreePath;
    } catch (error) {
      console.error('❌ GitManager: Failed to create worktree');
      console.error('❌ GitManager: Error:', error);
      console.error('❌ GitManager: Error message:', (error as any).message);
      console.error('❌ GitManager: Command stderr:', (error as any).stderr);
      console.error('❌ GitManager: Command stdout:', (error as any).stdout);
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

  async mergePRAndCleanup(pullRequestUrl: string, branchName: string, worktreePath: string): Promise<void> {
    try {
      // Extract PR number from URL
      const prNumber = this.extractPRNumber(pullRequestUrl);
      
      // Merge the PR
      await execAsync(`gh pr merge ${prNumber} --merge`, {
        cwd: this.baseDirectory
      });
      
      // Remove the worktree
      await this.removeWorktree(worktreePath);
      
      // Switch to main branch in base directory
      await execAsync('git checkout main', {
        cwd: this.baseDirectory
      });
      
      // Pull latest changes
      await execAsync('git pull origin main', {
        cwd: this.baseDirectory
      });
      
      // Delete the local branch
      await execAsync(`git branch -D "${branchName}"`, {
        cwd: this.baseDirectory
      });
      
    } catch (error) {
      throw new Error(`Failed to merge PR and cleanup: ${(error as Error).message}`);
    }
  }

  private extractPRNumber(pullRequestUrl: string): string {
    const match = pullRequestUrl.match(/\/pull\/(\d+)/);
    if (!match) {
      throw new Error(`Could not extract PR number from URL: ${pullRequestUrl}`);
    }
    return match[1];
  }
}