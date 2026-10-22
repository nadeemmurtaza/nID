import { AgentAttestedCheckProvider } from './agent-attested-check.provider';

describe('AgentAttestedCheckProvider', () => {
  const provider = new AgentAttestedCheckProvider('agent_in_person_document', 'Agent in-person document inspection');

  it('start() is always pending — nothing to check until an agent submits', async () => {
    await expect(provider.start()).resolves.toEqual({ pending: true });
  });

  it('a PASSED decision from a named agent resolves directly to PASSED — no forced review', async () => {
    const result = await provider.handleCallback({
      decision: 'PASSED',
      agentId: 'key_abc123',
      notes: 'Original CNIC and passport both inspected, photos match.',
    });
    expect(result.status).toBe('PASSED');
    expect(result.verified).toBe(true);
    expect(result.raw).toMatchObject({ agentId: 'key_abc123', method: 'in_person_document_inspection' });
  });

  it('a FAILED decision from a named agent resolves directly to FAILED', async () => {
    const result = await provider.handleCallback({ decision: 'FAILED', agentId: 'key_abc123' });
    expect(result.status).toBe('FAILED');
    expect(result.verified).toBe(true);
  });

  it('refuses to persist a decision with no accountable agent', async () => {
    const result = await provider.handleCallback({ decision: 'PASSED' });
    expect(result.status).toBe('FAILED');
    expect(result.verified).toBe(false);
    expect(result.raw['reason']).toBe('missing_agent_id');
  });

  it('rejects a decision value that is neither PASSED nor FAILED', async () => {
    const result = await provider.handleCallback({ decision: 'MAYBE', agentId: 'key_abc123' });
    expect(result.status).toBe('FAILED');
    expect(result.verified).toBe(false);
    expect(result.raw['reason']).toBe('missing_or_invalid_decision');
  });
});
