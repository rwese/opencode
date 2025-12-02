import z from "zod"
import { Tool } from "./tool"
import path from "path"
import { LSP } from "../lsp"
import DESCRIPTION from "./lsp-diagnostics.txt"
import { Instance } from "../project/instance"
import { Token } from "../util/token"

export const LspDiagnosticTool = Tool.define("lsp_diagnostics", {
  description: DESCRIPTION,
  parameters: z.object({
    path: z.string().describe("The path to the file to get diagnostics."),
  }),
  execute: async (args) => {
    const normalized = path.isAbsolute(args.path) ? args.path : path.join(Instance.directory, args.path)
    await LSP.touchFile(normalized, true)
    const diagnostics = await LSP.diagnostics()
    const file = diagnostics[normalized]
    const rawOutput = file?.length ? file.map(LSP.Diagnostic.pretty).join("\n") : "No errors found"
    const truncationResult = Token.truncate(rawOutput, Token.getToolOutputLimit())
    return {
      title: path.relative(Instance.worktree, normalized),
      metadata: {
        diagnostics,
        truncated: truncationResult.truncated,
        originalTokens: truncationResult.originalTokens,
        finalTokens: truncationResult.finalTokens,
      },
      output: truncationResult.text,
    }
  },
})
