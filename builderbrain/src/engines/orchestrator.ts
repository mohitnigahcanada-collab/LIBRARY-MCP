/**
 * Multi-Agent Orchestrator
 * 
 * Takes a complex task and breaks it into parallel sub-agent workflows.
 * Returns structured delegation instructions for the MCP client to spawn workers.
 */

import { v4 as uuidv4 } from 'uuid';

export interface SubAgentTask {
  agentRole: string;
  instructions: string;
  expectedOutput: string;
}

export interface OrchestrationPlan {
  sessionId: string;
  masterTask: string;
  subAgents: SubAgentTask[];
}

export function delegateTask(task: string, roles: string[]): OrchestrationPlan {
  const sessionId = uuidv4();
  
  const subAgents: SubAgentTask[] = roles.map(role => ({
    agentRole: role,
    instructions: `You are the ${role} sub-agent. Your goal is to complete your specific portion of the master task: "${task}". Please do not overlap with other agents. Report your completion back to the master orchestrator.`,
    expectedOutput: `A completed artifact or code module specifically for the ${role} domain.`
  }));

  return {
    sessionId,
    masterTask: task,
    subAgents
  };
}
