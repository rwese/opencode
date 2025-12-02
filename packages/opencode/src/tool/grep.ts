import z from "zod"
import { Tool } from "./tool"
import { Ripgrep } from "../file/ripgrep"

import DESCRIPTION from "./grep.txt"
import { Instance } from "../project/instance"
import { Token } from "../util/token"

export const GrepTool = Tool.define("grep", {
  description: DESCRIPTION,
  parameters: z.object({
    pattern: z.string().describe("The regex pattern to search for in file contents"),
    path: z.string().optional().describe("The directory to search in. Defaults to the current working directory."),
    include: z.string().optional().describe('File pattern to include in the search (e.g. "*.js", "*.{ts,tsx}")'),
  }),
  async execute(params) {
    if (!params.pattern) {
      throw new Error("pattern is required")
    }

    const searchPath = params.path || Instance.directory

    const rgPath = await Ripgrep.filepath()
    const args = ["-nH", "--field-match-separator=|", "--regexp", params.pattern]
    if (params.include) {
      args.push("--glob", params.include)
    }
    args.push(searchPath)

    const proc = Bun.spawn([rgPath, ...args], {
      stdout: "pipe",
      stderr: "pipe",
    })

    const output = await new Response(proc.stdout).text()
    const errorOutput = await new Response(proc.stderr).text()
    const exitCode = await proc.exited

    if (exitCode === 1) {
      return {
        title: params.pattern,
        metadata: { matches: 0, truncated: false },
        output: "No files found",
      }
    }

    if (exitCode !== 0) {
      throw new Error(`ripgrep failed: ${errorOutput}`)
    }

    const lines = output.trim().split("\n")
    const matches = []

    for (const line of lines) {
      if (!line) continue

      const [filePath, lineNumStr, ...lineTextParts] = line.split("|")
      if (!filePath || !lineNumStr || lineTextParts.length === 0) continue

      const lineNum = parseInt(lineNumStr, 10)
      const lineText = lineTextParts.join("|")

      const file = Bun.file(filePath)
      const stats = await file.stat().catch(() => null)
      if (!stats) continue

      matches.push({
        path: filePath,
        modTime: stats.mtime.getTime(),
        lineNum,
        lineText,
      })
    }

    matches.sort((a, b) => b.modTime - a.modTime)

    if (matches.length === 0) {
      const output = "No files found"
      return {
        title: params.pattern,
        metadata: {
          matches: 0,
          truncated: false,
        },
        output,
      }
    }

    // Build output lines with file grouping
    const outputLines = [`Found ${matches.length} matches`]
    let currentFile = ""

    for (const match of matches) {
      if (currentFile !== match.path) {
        if (currentFile !== "") {
          outputLines.push("")
        }
        currentFile = match.path
        outputLines.push(`${match.path}:`)
      }
      outputLines.push(`  Line ${match.lineNum}: ${match.lineText}`)
    }

    // Apply token-aware truncation
    const truncationResult = Token.truncateLines(outputLines, Token.getToolOutputLimit(), 1) // Keep header line

    let finalOutput = truncationResult.lines.join("\n")

    if (truncationResult.truncated) {
      finalOutput += "\n\n(Results are truncated to fit token budget. Consider using a more specific path or pattern.)"
    }

    return {
      title: params.pattern,
      metadata: {
        matches: matches.length,
        truncated: truncationResult.truncated,
      },
      output: finalOutput,
    }
  },
})
