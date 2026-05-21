import { vi, describe, it, expect, beforeEach } from 'vitest';
import { handleToolCall } from './main.js';
import type { CoreApiClient } from './clients/core-api.client.js';


const ALL_SCOPES = ['memory.write', 'codeflow.read'];


function makeClient(overrides: Partial<CoreApiClient> = {}): CoreApiClient {

  return {
    createMemoryEntry: vi.fn().mockResolvedValue({
      id: 'mem-1',
      type: 'handoff',
      title: 'Handoff — 2026-05-19',
      body: '',
    }),
    getArchitectureSnapshot: vi.fn().mockResolvedValue({
      node_count: 12,
      edge_count: 8,
      generated_at: '2026-05-19T10:00:00.000Z',
      nodes: [],
      edges: [],
    }),
    ...overrides,
  } as unknown as CoreApiClient;
}


describe('create_handoff — architecture snapshot attachment', () => {

  let client: CoreApiClient;

  beforeEach(() => {
    client = makeClient();
  });

  it('attaches architecture snapshot by default (attachArchitecture omitted)', async () => {

    const result = await handleToolCall(
      client,
      'create_handoff',
      { projectId: 'proj-1', summary: 'Session done' },
      ALL_SCOPES,
    );

    expect(result.isError).toBeUndefined();
    expect(client.getArchitectureSnapshot).toHaveBeenCalledWith('proj-1');

    const createCall = (client.createMemoryEntry as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as {
      body: string;
    };

    expect(createCall.body).toContain('## Architecture Snapshot');
    expect(createCall.body).toContain('## Summary');
    expect(createCall.body).toContain('Session done');
  });

  it('skips snapshot when attachArchitecture is false', async () => {

    const result = await handleToolCall(
      client,
      'create_handoff',
      { projectId: 'proj-1', summary: 'Session done', attachArchitecture: false },
      ALL_SCOPES,
    );

    expect(result.isError).toBeUndefined();
    expect(client.getArchitectureSnapshot).not.toHaveBeenCalled();

    const createCall = (client.createMemoryEntry as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as {
      body: string;
    };

    expect(createCall.body).not.toContain('## Architecture Snapshot');
    expect(createCall.body).toContain('## Summary');
  });

  it('creates handoff without snapshot when snapshot fetch fails (fallback, no crash)', async () => {

    client = makeClient({
      getArchitectureSnapshot: vi.fn().mockRejectedValue(new Error('Memgraph down')),
    });

    const result = await handleToolCall(
      client,
      'create_handoff',
      { projectId: 'proj-1', summary: 'Session done' },
      ALL_SCOPES,
    );

    expect(result.isError).toBeUndefined();

    const createCall = (client.createMemoryEntry as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as {
      body: string;
    };

    expect(createCall.body).not.toContain('## Architecture Snapshot');
    expect(createCall.body).toContain('## Summary');
  });

  it('includes next_steps in body when provided', async () => {

    await handleToolCall(
      client,
      'create_handoff',
      { projectId: 'proj-1', summary: 'Done', next_steps: ['Deploy', 'Test'] },
      ALL_SCOPES,
    );

    const createCall = (client.createMemoryEntry as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as {
      body: string;
    };

    expect(createCall.body).toContain('## Next Steps');
    expect(createCall.body).toContain('1. Deploy');
    expect(createCall.body).toContain('2. Test');
  });
});
