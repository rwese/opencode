import { $ } from "bun"
import { NamedError } from "@opencode-ai/util/error"
import matter from "gray-matter"
import { z } from "zod"

export namespace ConfigMarkdown {
  export const FILE_REGEX = /(?<![\w`])@(\.?[^\s`,.]*(?:\.[^\s`,.]+)*)/g
  export const SHELL_REGEX = /!`([^`]+)`/g

  export function files(template: string) {
    return Array.from(template.matchAll(FILE_REGEX))
  }

  export function shell(template: string) {
    return Array.from(template.matchAll(SHELL_REGEX))
  }

  export async function resolveShell(text: string) {
    const matches = shell(text)
    if (matches.length === 0) return text

    const results = await Promise.all(
      matches.map(async ([, cmd]) => {
        try {
          const output = await $`bash -c ${cmd}`.nothrow().text()
          return output.trim()
        } catch (error) {
          return `Error executing command: ${error instanceof Error ? error.message : String(error)}`
        }
      }),
    )

    let index = 0
    return text.replace(SHELL_REGEX, () => JSON.stringify(results[index++]))
  }

  export async function parse(filePath: string) {
    let template = await Bun.file(filePath).text()

    // Resolve shell commands in frontmatter only
    const frontmatterMatch = template.match(/^---\n([\s\S]*?)\n---/)
    if (frontmatterMatch) {
      const resolvedFrontmatter = await resolveShell(frontmatterMatch[1])
      template = template.replace(frontmatterMatch[0], `---\n${resolvedFrontmatter}\n---`)
    }

    try {
      const md = matter(template)
      return md
    } catch (err) {
      throw new FrontmatterError(
        {
          path: filePath,
          message: `Failed to parse YAML frontmatter: ${err instanceof Error ? err.message : String(err)}`,
        },
        { cause: err },
      )
    }
  }

  export const FrontmatterError = NamedError.create(
    "ConfigFrontmatterError",
    z.object({
      path: z.string(),
      message: z.string(),
    }),
  )
}
