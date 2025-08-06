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
      
      // Ensure we're on main branch and pull latest changes before creating worktree
      console.log('🔧 GitManager: Ensuring main branch is up-to-date');
      await execAsync('git checkout main', { cwd: this.baseDirectory });
      await execAsync('git pull origin main', { cwd: this.baseDirectory });
      
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
      
      // Ensure we're on main branch and up-to-date before merging
      console.log('🔧 GitManager: Ensuring main branch is up-to-date before merge');
      await execAsync('git checkout main', {
        cwd: this.baseDirectory
      });
      await execAsync('git pull origin main', {
        cwd: this.baseDirectory
      });
      
      // Merge the PR
      console.log(`🔧 GitManager: Merging PR ${prNumber}`);
      await execAsync(`gh pr merge ${prNumber} --merge`, {
        cwd: this.baseDirectory
      });
      
      // Remove the worktree
      console.log('🔧 GitManager: Removing worktree');
      await this.removeWorktree(worktreePath);
      
      // Pull latest changes after merge to ensure we have the merged changes
      console.log('🔧 GitManager: Pulling latest changes after merge');
      await execAsync('git pull origin main', {
        cwd: this.baseDirectory
      });
      
      // Delete the local branch
      console.log(`🔧 GitManager: Deleting local branch ${branchName}`);
      await execAsync(`git branch -D "${branchName}"`, {
        cwd: this.baseDirectory
      });
      
      console.log('✅ GitManager: PR merged and cleanup completed');
      
    } catch (error) {
      console.error('❌ GitManager: Failed to merge PR and cleanup:', error);
      throw new Error(`Failed to merge PR and cleanup: ${(error as Error).message}`);
    }
  }

  async discoverExistingWorktrees(): Promise<Array<{ branchName: string, worktreePath: string }>> {
    const worktreesDir = path.join(this.baseDirectory, '.worktrees');
    
    try {
      console.log('🔍 GitManager: Discovering existing worktrees in:', worktreesDir);
      
      // Check if .worktrees directory exists
      await fs.access(worktreesDir);
      
      // Get list of worktree directories
      const entries = await fs.readdir(worktreesDir, { withFileTypes: true });
      const worktrees = [];
      
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const branchName = entry.name;
          const worktreePath = path.join(worktreesDir, branchName);
          
          // Verify it's actually a git worktree
          try {
            await execAsync('git rev-parse --git-dir', { cwd: worktreePath });
            worktrees.push({ branchName, worktreePath });
            console.log(`✅ GitManager: Found worktree - Branch: ${branchName}, Path: ${worktreePath}`);
          } catch {
            console.log(`⚠️ GitManager: Directory ${branchName} is not a valid git worktree, skipping`);
          }
        }
      }
      
      console.log(`🔍 GitManager: Discovered ${worktrees.length} existing worktrees`);
      return worktrees;
      
    } catch (error) {
      console.log('🔍 GitManager: No existing worktrees found or .worktrees directory does not exist');
      return [];
    }
  }

  async getWorktreeBranchStatus(worktreePath: string): Promise<{ hasChanges: boolean, commitCount: number }> {
    try {
      // Check for uncommitted changes
      const { stdout: statusOutput } = await execAsync('git status --porcelain', { cwd: worktreePath });
      const hasChanges = statusOutput.trim().length > 0;
      
      // Check how many commits ahead of main
      const { stdout: commitOutput } = await execAsync('git rev-list --count HEAD ^main', { cwd: worktreePath });
      const commitCount = parseInt(commitOutput.trim()) || 0;
      
      return { hasChanges, commitCount };
    } catch (error) {
      console.warn(`Failed to get branch status for ${worktreePath}:`, (error as Error).message);
      return { hasChanges: false, commitCount: 0 };
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