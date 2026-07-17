import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { describe, expect, it } from "vitest";
import type { CoreApiClient } from "./clients/core-api.client.js";
import {
  buildServer,
  getToolsForProfile,
  parseToolProfile,
} from "./main.js";


function makeClient(): CoreApiClient {

  return {} as CoreApiClient;
}


async function connect(profileTools: Set<string>) {

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const server = buildServer(
    makeClient(),
    ["project.admin"],
    undefined,
    profileTools,
  );
  const client = new Client({ name: "profile-test", version: "0.0.0" });

  await Promise.all([
    server.connect(serverTransport),
    client.connect(clientTransport),
  ]);

  return { client, server };
}


describe("MCP transport profiles", () => {

  it("lists workflow tools only and blocks direct calls outside the profile", async () => {
    const { client, server } = await connect(new Set(getToolsForProfile("workflow").map((tool) => tool.name)));

    try {
      const listed = await client.listTools();
      const names = listed.tools.map((tool) => tool.name);

      expect(names).toContain("create_task");
      expect(names).toContain("get_architecture_map");
      expect(names).toContain("link_task_to_node");
      expect(names).not.toContain("read_inbox");
      expect(names).toHaveLength(21);

      const result = await client.callTool({ name: "read_inbox", arguments: {} }) as {
        isError?: boolean;
        content: Array<{ type: string; text?: string }>;
      };

      expect(result.isError).toBe(true);
      expect(result.content[0]).toMatchObject({
        type: "text",
        text: expect.stringContaining("not available"),
      });
    } finally {
      await client.close();
      await server.close();
    }
  });

  it("lists all tools in full profile", async () => {
    const { client, server } = await connect(new Set(getToolsForProfile("full").map((tool) => tool.name)));

    try {
      const listed = await client.listTools();

      expect(listed.tools).toHaveLength(50);
    } finally {
      await client.close();
      await server.close();
    }
  });

  it("rejects invalid profiles before server startup", () => {
    expect(() => parseToolProfile("invalid")).toThrow("Invalid MCP_TOOL_PROFILE");
  });
});
