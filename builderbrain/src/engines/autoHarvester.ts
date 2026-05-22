/**
 * Auto-Knowledge Harvester (Agentic RAG)
 * 
 * Expands the BuilderBrain knowledge base automatically when
 * queried about an unknown topic. Uses Brave Search to fetch
 * context and an LLM to digest it into a mini-book.
 */

import { routeChat, type ChatMessage } from './aiRouter.js';
import { saveDiscoveredBook } from './repoAnalyzer.js';
import { loadConfig } from '../config/manager.js';

export async function harvestKnowledge(topic: string): Promise<{ success: boolean; path?: string; message: string }> {
  const config = loadConfig();
  const apiKey = config.trend_radar?.brave_api_key;
  
  if (!apiKey) {
    return { success: false, message: 'Brave API key not configured in trend_radar config.' };
  }

  console.log(`[AutoHarvester] Harvesting knowledge for: ${topic}`);

  try {
    // 1. Search Brave
    const encodedQuery = encodeURIComponent(`${topic} documentation tutorial architecture`);
    const url = `https://api.search.brave.com/res/v1/web/search?q=${encodedQuery}&count=10`;
    
    const res = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'X-Subscription-Token': apiKey,
      }
    });

    if (!res.ok) {
      throw new Error(`Brave API error: ${res.status} ${res.statusText}`);
    }

    const data = await res.json() as any;
    const results = data.web?.results || [];
    
    if (results.length === 0) {
      return { success: false, message: 'No search results found.' };
    }

    // 2. Format Context
    const searchContext = results.map((r: any, i: number) => 
      `### Source ${i+1}: ${r.title}\nURL: ${r.url}\nSnippet: ${r.description}`
    ).join('\n\n');

    // 3. Digest via LLM
    console.log(`[AutoHarvester] Digesting ${results.length} search results...`);
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `You are an elite software architect building a "mini-book" for the BuilderBrain library.
Your task is to digest the provided search results about the topic "${topic}" and write a comprehensive, markdown-formatted mini-book.
Cover:
1. What it is and core concepts
2. Common architectural patterns
3. Brief code examples (if applicable based on the snippets)
4. Why/When to use it
Do not hallucinate outside the provided search snippets if possible.`
      },
      {
        role: 'user',
        content: `Search Results:\n\n${searchContext}`
      }
    ];

    const response = await routeChat(messages);

    // 4. Save to Library
    console.log(`[AutoHarvester] Saving mini-book...`);
    const finalContent = `# ${topic} - Auto-Harvested Knowledge\n\n> Source: Web Search via AutoHarvester\n> Date: ${new Date().toLocaleString()}\n\n${response.text}`;
    
    const savedPath = await saveDiscoveredBook(topic, finalContent);

    return { 
      success: true, 
      path: savedPath, 
      message: `Successfully harvested knowledge for '${topic}' and saved to ${savedPath}` 
    };

  } catch (error: any) {
    console.error(`[AutoHarvester] Failed: ${error.message}`);
    return { success: false, message: `Harvesting failed: ${error.message}` };
  }
}
