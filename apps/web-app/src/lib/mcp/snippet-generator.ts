export type McpClient =
  | 'claude-code'
  | 'zed'
  | 'vscode'
  | 'codex'
  | 'cursor'
  | 'cline'
  | 'continue'
  | 'windsurf'
  | 'jetbrains';
export type McpScope = 'user' | 'workspace';
export type McpTransport = 'http' | 'stdio';


export interface SnippetInput {
  client: McpClient;
  scope: McpScope;
  transport: McpTransport;
  url: string;
  token: string;
}


export interface SnippetOutput {
  filePath: string;
  format: 'json' | 'toml';
  content: string;
}


export function generateSnippet(input: SnippetInput): SnippetOutput {

  const { client, scope, transport, url, token } = input;

  if (client === 'claude-code') {

    return generateClaudeCodeSnippet(scope, transport, url, token);
  }

  if (client === 'zed') {

    return generateZedSnippet(transport, url, token);
  }

  if (client === 'vscode') {

    return generateVscodeSnippet(scope, url, token);
  }

  if (client === 'cursor') {

    return generateCursorSnippet(scope, url, token);
  }

  if (client === 'cline') {

    return generateClineSnippet(url, token);
  }

  if (client === 'continue') {

    return generateContinueSnippet(url, token);
  }

  if (client === 'windsurf') {

    return generateWindsurfSnippet(url, token);
  }

  if (client === 'jetbrains') {

    return generateJetbrainsSnippet(url, token);
  }

  return generateCodexSnippet(url, token);
}


function generateClaudeCodeSnippet(
  scope: McpScope,
  transport: McpTransport,
  url: string,
  token: string,
): SnippetOutput {

  const filePath = scope === 'user' ? '~/.claude.json' : '.mcp.json';

  if (transport === 'stdio') {

    const content = JSON.stringify(
      {
        mcpServers: {
          roadboard: {
            type: 'stdio',
            command: 'npx',
            args: ['-y', 'mcp-remote', url, '--header', `Authorization: Bearer ${token}`],
          },
        },
      },
      null,
      2,
    );

    return { filePath, format: 'json', content };
  }

  const content = JSON.stringify(
    {
      mcpServers: {
        roadboard: {
          type: 'http',
          url,
          headers: { Authorization: `Bearer ${token}` },
        },
      },
    },
    null,
    2,
  );

  return { filePath, format: 'json', content };
}


function generateZedSnippet(
  transport: McpTransport,
  url: string,
  token: string,
): SnippetOutput {

  const filePath = '~/.config/zed/settings.json';

  if (transport === 'stdio') {

    const content = JSON.stringify(
      {
        context_servers: {
          roadboard: {
            enabled: true,
            command: 'npx',
            args: ['-y', 'mcp-remote', url, '--header', `Authorization: Bearer ${token}`],
            env: {},
          },
        },
      },
      null,
      2,
    );

    return { filePath, format: 'json', content };
  }

  const content = JSON.stringify(
    {
      context_servers: {
        roadboard: {
          enabled: true,
          url,
          headers: { Authorization: `Bearer ${token}` },
        },
      },
    },
    null,
    2,
  );

  return { filePath, format: 'json', content };
}


function generateVscodeSnippet(
  scope: McpScope,
  url: string,
  token: string,
): SnippetOutput {

  const filePath =
    scope === 'user' ? '~/.config/Code/User/mcp.json' : '.vscode/mcp.json';

  const content = JSON.stringify(
    {
      mcpServers: {
        roadboard: {
          url,
          headers: { Authorization: `Bearer ${token}` },
        },
      },
    },
    null,
    2,
  );

  return { filePath, format: 'json', content };
}


function generateCodexSnippet(url: string, token: string): SnippetOutput {

  const filePath = '~/.codex/config.toml';

  const content = `[mcp_servers.roadboard]
url = "${url}"
bearer_token_env_var = "ROADBOARD_MCP_TOKEN"

# Esporta poi nello shell: \`export ROADBOARD_MCP_TOKEN=${token}\``;

  return { filePath, format: 'toml', content };
}


function generateCursorSnippet(scope: McpScope, url: string, token: string): SnippetOutput {

  const filePath = scope === 'user' ? '~/.cursor/mcp.json' : '.cursor/mcp.json';

  const content = JSON.stringify(
    {
      mcpServers: {
        roadboard: {
          url,
          headers: { Authorization: `Bearer ${token}` },
        },
      },
    },
    null,
    2,
  );

  return { filePath, format: 'json', content };
}


function generateClineSnippet(url: string, token: string): SnippetOutput {

  const filePath = '~/.vscode/cline_mcp_settings.json';

  const content = JSON.stringify(
    {
      mcpServers: {
        roadboard: {
          url,
          headers: { Authorization: `Bearer ${token}` },
        },
      },
    },
    null,
    2,
  );

  return { filePath, format: 'json', content };
}


function generateContinueSnippet(url: string, token: string): SnippetOutput {

  const filePath = '~/.continue/config.yaml';

  const content = `mcpServers:
  - name: roadboard
    transport:
      type: http
      url: "${url}"
      headers:
        Authorization: "Bearer ${token}"`;

  return { filePath, format: 'toml', content };
}


function generateWindsurfSnippet(url: string, token: string): SnippetOutput {

  const filePath = '~/.codeium/windsurf/mcp_config.json';

  const content = JSON.stringify(
    {
      mcpServers: {
        roadboard: {
          serverUrl: url,
          headers: { Authorization: `Bearer ${token}` },
        },
      },
    },
    null,
    2,
  );

  return { filePath, format: 'json', content };
}


function generateJetbrainsSnippet(url: string, token: string): SnippetOutput {

  const filePath = '~/.config/JetBrains/mcp.json';

  const content = JSON.stringify(
    {
      servers: {
        roadboard: {
          url,
          headers: { Authorization: `Bearer ${token}` },
        },
      },
    },
    null,
    2,
  );

  return { filePath, format: 'json', content };
}
