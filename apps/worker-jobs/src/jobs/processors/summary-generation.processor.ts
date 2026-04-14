import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { optionalEnv } from '@roadboard/config';

import { QUEUE_SUMMARY_GENERATION } from '../queue-names';


const CORE_API_URL = `http://${optionalEnv('CORE_API_HOST', 'localhost')}:${optionalEnv('CORE_API_PORT', '3001')}`;
const WORKER_TOKEN = optionalEnv('WORKER_MCP_TOKEN', '');


interface MemoryEntry {
  id: string;
  type: string;
  title: string;
  createdAt: string;
}

interface Task {
  status: string;
}


function buildSummaryBody(memory: MemoryEntry[], tasks: Task[]): string {

  const byStatus = tasks.reduce<Record<string, number>>((acc, t) => {
    acc[t.status] = (acc[t.status] ?? 0) + 1;
    return acc;
  }, {});

  const byType = memory.reduce<Record<string, MemoryEntry[]>>((acc, m) => {
    (acc[m.type] ??= []).push(m);
    return acc;
  }, {});

  const lines: string[] = [
    `## Task summary`,
    `Total: ${tasks.length} — ${Object.entries(byStatus).map(([k, v]) => `${k}: ${v}`).join(', ')}`,
    '',
    `## Memory by type (${memory.length} entries)`,
  ];

  const typeOrder = ['done', 'next', 'decision', 'architecture', 'issue', 'learning', 'handoff', 'operational_note', 'open_question'];
  const allTypes = [...new Set([...typeOrder, ...Object.keys(byType)])];

  for (const type of allTypes) {

    const entries = byType[type];

    if (!entries?.length) continue;

    lines.push('');
    lines.push(`### ${type} (${entries.length})`);

    for (const e of entries.slice(0, 10)) {
      lines.push(`- ${e.title}`);
    }

    if (entries.length > 10) {
      lines.push(`- … and ${entries.length - 10} more`);
    }
  }

  return lines.join('\n');
}


@Processor(QUEUE_SUMMARY_GENERATION)
export class SummaryGenerationProcessor extends WorkerHost {

  private readonly logger = new Logger(SummaryGenerationProcessor.name);


  async process(job: Job<{ projectId: string }>): Promise<void> {

    const { projectId } = job.data;
    this.logger.log(`[summary-generation] project=${projectId}`);

    if (!WORKER_TOKEN) {
      this.logger.warn('[summary-generation] WORKER_MCP_TOKEN not set, skipping');
      return;
    }

    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${WORKER_TOKEN}`,
    };

    const [tasksRes, memoryRes] = await Promise.all([
      fetch(`${CORE_API_URL}/tasks?projectId=${projectId}`, { headers }).catch(() => null),
      fetch(`${CORE_API_URL}/memory?projectId=${projectId}`, { headers }).catch(() => null),
    ]);

    if (!tasksRes?.ok || !memoryRes?.ok) {
      this.logger.warn(`[summary-generation] failed to fetch data for project ${projectId}`);
      return;
    }

    const tasks = (await tasksRes.json()) as Task[];
    const memory = (await memoryRes.json()) as MemoryEntry[];

    const body = buildSummaryBody(memory, tasks);

    const createRes = await fetch(`${CORE_API_URL}/memory`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        projectId,
        type: 'operational_note',
        title: `Auto-summary — ${new Date().toISOString().slice(0, 10)}`,
        body,
      }),
    }).catch(() => null);

    if (createRes?.ok) {
      this.logger.log(`[summary-generation] summary created for project ${projectId}`);
    } else {
      this.logger.warn(`[summary-generation] failed to create summary for project ${projectId}`);
    }
  }
}
