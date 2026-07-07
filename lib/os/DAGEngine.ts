export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface DAGTask {
  id: string;
  name: string;
  dependsOn?: string[]; // Array of task IDs that must complete before this runs
  status: TaskStatus;
  execute: () => Promise<any>;
  result?: any;
  error?: string;
}

export class DAGEngine {
  private tasks: Map<string, DAGTask> = new Map();
  private onStatusChange?: (taskId: string, status: TaskStatus, task: DAGTask) => void;

  constructor(tasks: DAGTask[], onStatusChange?: (taskId: string, status: TaskStatus, task: DAGTask) => void) {
    tasks.forEach(task => this.tasks.set(task.id, task));
    this.onStatusChange = onStatusChange;
  }

  // Get tasks that have no pending dependencies
  private getExecutableTasks(): DAGTask[] {
    const executable: DAGTask[] = [];
    
    for (const [_, task] of this.tasks) {
      if (task.status !== 'pending') continue;

      let canRun = true;
      if (task.dependsOn && task.dependsOn.length > 0) {
        for (const depId of task.dependsOn) {
          const depTask = this.tasks.get(depId);
          if (!depTask || depTask.status !== 'completed') {
            canRun = false;
            break;
          }
        }
      }

      if (canRun) executable.push(task);
    }
    return executable;
  }

  private updateStatus(taskId: string, status: TaskStatus, data?: Partial<DAGTask>) {
    const task = this.tasks.get(taskId);
    if (!task) return;
    
    Object.assign(task, { status, ...data });
    if (this.onStatusChange) {
      this.onStatusChange(taskId, status, task);
    }
  }

  public async run() {
    return new Promise<void>((resolve, reject) => {
      const checkAndRun = async () => {
        let allCompletedOrFailed = true;
        let anyFailed = false;

        for (const [_, task] of this.tasks) {
          if (task.status === 'pending' || task.status === 'running') {
            allCompletedOrFailed = false;
          }
          if (task.status === 'failed') {
            anyFailed = true;
          }
        }

        if (allCompletedOrFailed) {
          if (anyFailed) reject(new Error("DAG Engine completed with failures"));
          else resolve();
          return;
        }

        const executable = this.getExecutableTasks();
        
        for (const task of executable) {
          this.updateStatus(task.id, 'running');
          
          task.execute()
            .then(result => {
              this.updateStatus(task.id, 'completed', { result });
              checkAndRun(); // Trigger next tick
            })
            .catch(error => {
              this.updateStatus(task.id, 'failed', { error: error.message || String(error) });
              checkAndRun(); // Continue with independent branches or fail
            });
        }
      };

      checkAndRun();
    });
  }

  public getTasks(): DAGTask[] {
    return Array.from(this.tasks.values());
  }
}
