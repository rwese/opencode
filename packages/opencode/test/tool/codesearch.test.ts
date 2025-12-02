import { describe, test, expect } from "bun:test"
import { CodeSearchTool } from "../../src/tool/codesearch"

const ctx = {
  sessionID: "test",
  messageID: "",
  toolCallID: "",
  agent: "build",
  abort: AbortSignal.any([]),
  metadata: () => {},
}

describe("tool.codesearch", () => {
  test("should be defined", async () => {
    const tool = await CodeSearchTool.init()
    expect(tool).toBeDefined()
    expect(typeof tool.execute).toBe("function")
  })

  test("should have correct parameters", async () => {
    const tool = await CodeSearchTool.init()
    expect(tool.parameters).toBeDefined()
    expect(tool.parameters.shape.query).toBeDefined()
    expect(tool.parameters.shape.tokensNum).toBeDefined()
  })

  // Note: Full integration tests would require mocking the MCP API
  // For now, we test that the tool is properly configured
})
