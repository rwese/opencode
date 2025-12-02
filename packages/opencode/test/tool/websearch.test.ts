import { describe, test, expect } from "bun:test"
import { WebSearchTool } from "../../src/tool/websearch"

const ctx = {
  sessionID: "test",
  messageID: "",
  toolCallID: "",
  agent: "build",
  abort: AbortSignal.any([]),
  metadata: () => {},
}

describe("tool.websearch", () => {
  test("should be defined", async () => {
    const tool = await WebSearchTool.init()
    expect(tool).toBeDefined()
    expect(typeof tool.execute).toBe("function")
  })

  test("should have correct parameters", async () => {
    const tool = await WebSearchTool.init()
    expect(tool.parameters).toBeDefined()
    expect(tool.parameters.shape.query).toBeDefined()
    expect(tool.parameters.shape.numResults).toBeDefined()
    expect(tool.parameters.shape.livecrawl).toBeDefined()
    expect(tool.parameters.shape.type).toBeDefined()
    expect(tool.parameters.shape.contextMaxCharacters).toBeDefined()
  })

  // Note: Full integration tests would require mocking the MCP API
  // For now, we test that the tool is properly configured
})
