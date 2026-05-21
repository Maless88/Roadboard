import { describe, it, expect } from 'vitest';
import { generateSnippet } from './snippet-generator';


const url = 'http://localhost:3005/mcp';
const token = 'test-token-123';


describe('generateSnippet', () => {

  it('claude-code user scope → ~/.claude.json JSON', () => {

    const result = generateSnippet({ client: 'claude-code', scope: 'user', transport: 'http', url, token });

    expect(result.filePath).toBe('~/.claude.json');
    expect(result.format).toBe('json');

    const parsed = JSON.parse(result.content);
    expect(parsed.mcpServers.roadboard.type).toBe('http');
    expect(parsed.mcpServers.roadboard.url).toBe(url);
    expect(parsed.mcpServers.roadboard.headers.Authorization).toBe(`Bearer ${token}`);
  });

  it('claude-code workspace scope → .mcp.json JSON', () => {

    const result = generateSnippet({ client: 'claude-code', scope: 'workspace', transport: 'http', url, token });

    expect(result.filePath).toBe('.mcp.json');
    expect(result.format).toBe('json');
  });

  it('zed user scope → ~/.config/zed/settings.json JSON', () => {

    const result = generateSnippet({ client: 'zed', scope: 'user', transport: 'http', url, token });

    expect(result.filePath).toBe('~/.config/zed/settings.json');
    expect(result.format).toBe('json');

    const parsed = JSON.parse(result.content);
    expect(parsed.context_servers.roadboard.enabled).toBe(true);
    expect(parsed.context_servers.roadboard.url).toBe(url);
  });

  it('vscode user scope → ~/.config/Code/User/mcp.json JSON', () => {

    const result = generateSnippet({ client: 'vscode', scope: 'user', transport: 'http', url, token });

    expect(result.filePath).toBe('~/.config/Code/User/mcp.json');
    expect(result.format).toBe('json');

    const parsed = JSON.parse(result.content);
    expect(parsed.mcpServers.roadboard.url).toBe(url);
  });

  it('vscode workspace scope → .vscode/mcp.json JSON', () => {

    const result = generateSnippet({ client: 'vscode', scope: 'workspace', transport: 'http', url, token });

    expect(result.filePath).toBe('.vscode/mcp.json');
    expect(result.format).toBe('json');
  });

  it('codex user scope → ~/.codex/config.toml TOML', () => {

    const result = generateSnippet({ client: 'codex', scope: 'user', transport: 'http', url, token });

    expect(result.filePath).toBe('~/.codex/config.toml');
    expect(result.format).toBe('toml');
    expect(result.content).toContain('bearer_token_env_var = "ROADBOARD_MCP_TOKEN"');
    expect(result.content).toContain(`url = "${url}"`);
    expect(result.content).toContain(token);
  });

  it('zed stdio transport → uses mcp-remote command', () => {

    const result = generateSnippet({ client: 'zed', scope: 'user', transport: 'stdio', url, token });

    const parsed = JSON.parse(result.content);
    expect(parsed.context_servers.roadboard.command).toBe('npx');
    expect(parsed.context_servers.roadboard.args).toContain('mcp-remote');
  });

  it('claude-code stdio transport → uses stdio type with mcp-remote', () => {

    const result = generateSnippet({ client: 'claude-code', scope: 'user', transport: 'stdio', url, token });

    const parsed = JSON.parse(result.content);
    expect(parsed.mcpServers.roadboard.type).toBe('stdio');
    expect(parsed.mcpServers.roadboard.command).toBe('npx');
  });

  it('cursor user scope → ~/.cursor/mcp.json JSON', () => {

    const result = generateSnippet({ client: 'cursor', scope: 'user', transport: 'http', url, token });

    expect(result.filePath).toBe('~/.cursor/mcp.json');
    expect(result.format).toBe('json');

    const parsed = JSON.parse(result.content);
    expect(parsed.mcpServers.roadboard.url).toBe(url);
    expect(parsed.mcpServers.roadboard.headers.Authorization).toBe(`Bearer ${token}`);
  });

  it('cursor workspace scope → .cursor/mcp.json JSON', () => {

    const result = generateSnippet({ client: 'cursor', scope: 'workspace', transport: 'http', url, token });

    expect(result.filePath).toBe('.cursor/mcp.json');
  });

  it('cline → ~/.vscode/cline_mcp_settings.json JSON', () => {

    const result = generateSnippet({ client: 'cline', scope: 'user', transport: 'http', url, token });

    expect(result.filePath).toBe('~/.vscode/cline_mcp_settings.json');
    expect(result.format).toBe('json');

    const parsed = JSON.parse(result.content);
    expect(parsed.mcpServers.roadboard.url).toBe(url);
  });

  it('continue → ~/.continue/config.yaml with http transport', () => {

    const result = generateSnippet({ client: 'continue', scope: 'user', transport: 'http', url, token });

    expect(result.filePath).toBe('~/.continue/config.yaml');
    expect(result.content).toContain('type: http');
    expect(result.content).toContain(url);
    expect(result.content).toContain(`Bearer ${token}`);
  });

  it('windsurf → ~/.codeium/windsurf/mcp_config.json JSON', () => {

    const result = generateSnippet({ client: 'windsurf', scope: 'user', transport: 'http', url, token });

    expect(result.filePath).toBe('~/.codeium/windsurf/mcp_config.json');
    expect(result.format).toBe('json');

    const parsed = JSON.parse(result.content);
    expect(parsed.mcpServers.roadboard.serverUrl).toBe(url);
    expect(parsed.mcpServers.roadboard.headers.Authorization).toBe(`Bearer ${token}`);
  });

  it('jetbrains → ~/.config/JetBrains/mcp.json JSON', () => {

    const result = generateSnippet({ client: 'jetbrains', scope: 'user', transport: 'http', url, token });

    expect(result.filePath).toBe('~/.config/JetBrains/mcp.json');
    expect(result.format).toBe('json');

    const parsed = JSON.parse(result.content);
    expect(parsed.servers.roadboard.url).toBe(url);
    expect(parsed.servers.roadboard.headers.Authorization).toBe(`Bearer ${token}`);
  });
});
