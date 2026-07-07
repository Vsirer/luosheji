export class Workspace {
  private static instance: Workspace;
  private memory: Map<string, any> = new Map();

  private constructor() {}

  public static getInstance(): Workspace {
    if (!Workspace.instance) {
      Workspace.instance = new Workspace();
    }
    return Workspace.instance;
  }

  // Save to Global Memory
  public async set(key: string, value: any): Promise<void> {
    this.memory.set(key, value);
    // In a full implementation, this would sync to MySQL or OSS
    try {
      localStorage.setItem(`xiaoluo_os_${key}`, JSON.stringify(value));
    } catch (e) {
      console.warn('Failed to save to localStorage:', e);
    }
  }

  // Retrieve from Global Memory
  public async get<T>(key: string): Promise<T | null> {
    if (this.memory.has(key)) {
      return this.memory.get(key) as T;
    }
    
    try {
      const stored = localStorage.getItem(`xiaoluo_os_${key}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        this.memory.set(key, parsed);
        return parsed;
      }
    } catch (e) {
      console.warn('Failed to read from localStorage:', e);
    }
    return null;
  }

  public async delete(key: string): Promise<void> {
    this.memory.delete(key);
    try {
      localStorage.removeItem(`xiaoluo_os_${key}`);
    } catch (e) {}
  }
}
