import { describe, test, expect } from "bun:test"
import { LspDiagnosticTool } from "../../src/tool/lsp-diagnostics"

const ctx = {
  sessionID: "test",
  messageID: "",
  toolCallID: "",
  agent: "build",
  abort: AbortSignal.any([]),
  metadata: () => {},
}

describe("tool.lsp_diagnostics", () => {
  test("should be defined", async () => {
    const tool = await LspDiagnosticTool.init()
    expect(tool).toBeDefined()
    expect(typeof tool.execute).toBe("function")
  })

  test("should have correct parameters", async () => {
    const tool = await LspDiagnosticTool.init()
    expect(tool.parameters).toBeDefined()
    expect(tool.parameters.shape.path).toBeDefined()
  })

  // Note: Full integration tests would require LSP server setup
  // For now, we test that the tool is properly configured
})
