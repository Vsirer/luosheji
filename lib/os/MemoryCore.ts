import { EventBus, Memory } from './EventBus';

export class MemoryCoreService {
  private sessionMemory: Map<string, any> = new Map();
  private workingMemory: Map<string, any> = new Map();
  private knowledgeBase: Array<{ id: string; keywords: string[]; content: string }> = [];

  constructor() {
    this.initializeDefaultKnowledge();
  }

  private initializeDefaultKnowledge() {
    this.knowledgeBase = [
      { id: 'kb_brand_01', keywords: ['品牌', '奇迹影业', '基调', 'miracle'], content: '奇迹影业品牌指南: 核心基调为高精、电影质感、具有震撼力的未来主义工业风。常用高纯度霓虹色作为装饰，主体色彩倾向于深沉、低饱和度的科幻冷色系。' },
      { id: 'kb_video_01', keywords: ['构图', '画幅', '镜头', '16:9'], content: '电影级构图标准: 16:9 比例画面应保持黄金分割线的主体平衡，尽量引入中长焦镜头感、大景深及边缘暗角，以传达强烈的故事张力。' },
      { id: 'kb_safety_01', keywords: ['安全', '合规', '审核', '过滤'], content: '小逻OS内容安全指南: 严格过滤任何暴力、血腥及侵权视觉元素。生成内容必须接受多模态视觉反思审核(Visual Reflection Review)。' }
    ];
  }

  /**
   * Save content to a specific Memory tier
   */
  public save(tier: Memory['type'], key: string, value: any, description?: string) {
    const timestamp = Date.now();
    const memoryObj: Memory = {
      id: 'mem_' + Math.random().toString(36).substring(2, 7),
      type: tier,
      key,
      value,
      timestamp
    };

    if (tier === 'Session') {
      this.sessionMemory.set(key, value);
    } else if (tier === 'Working') {
      this.workingMemory.set(key, value);
    } else if (tier === 'LongTerm') {
      try {
        localStorage.setItem(`xiaoluo_os_longterm_${key}`, JSON.stringify(value));
      } catch (e) {
        console.warn('LongTerm Memory sync failed:', e);
      }
    } else if (tier === 'Knowledge') {
      this.knowledgeBase.push({
        id: 'kb_' + Math.random().toString(36).substring(2, 7),
        keywords: [key],
        content: String(value)
      });
    }

    // Publish memory storage event to EventBus
    EventBus.publish(
      'MEMORY_STORED', 
      'MemoryCore', 
      memoryObj, 
      `[记忆核心] 写入 [${tier}层记忆] ➔ 键: "${key}" | 描述: ${description || '系统缓存更新'}`
    );
  }

  /**
   * Retrieve content from a specific Memory tier (or fallback chain)
   */
  public get(tier: Memory['type'], key: string): any {
    if (tier === 'Session') {
      return this.sessionMemory.get(key) || null;
    }
    if (tier === 'Working') {
      return this.workingMemory.get(key) || null;
    }
    if (tier === 'LongTerm') {
      try {
        const item = localStorage.getItem(`xiaoluo_os_longterm_${key}`);
        return item ? JSON.parse(item) : null;
      } catch (e) {
        return null;
      }
    }
    return null;
  }

  /**
   * Query knowledge base using keywords (Local semantic match approximation)
   */
  public queryKnowledge(query: string): string[] {
    const matched: string[] = [];
    const normalized = query.toLowerCase();

    this.knowledgeBase.forEach(item => {
      const match = item.keywords.some(k => normalized.includes(k.toLowerCase())) || normalized.includes(item.id);
      if (match) {
        matched.push(item.content);
      }
    });

    if (matched.length > 0) {
      EventBus.publish(
        'MEMORY_STORED', 
        'MemoryCore', 
        { query, resultsCount: matched.length }, 
        `[记忆核心] 检索 [知识库(Knowledge)] ➔ 查询词: "${query}" | 命中 [${matched.length}] 条专业资产库记录`
      );
    }

    return matched;
  }

  /**
   * Clear working memory (e.g. on workflow complete)
   */
  public clearWorkingMemory() {
    this.workingMemory.clear();
  }
}

export const MemoryCore = new MemoryCoreService();
