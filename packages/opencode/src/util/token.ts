export namespace Token {
  // Characters per token ratios by category, derived from typical BPE tokenizer behavior on code

  // Digits tokenize poorly - often split into individual digits or small groups
  const DIGITS_RATIO = 1 / 1.9

  // Punctuation and symbols (brackets, operators, etc.) - most are single tokens,
  // though some pairs merge (e.g., ->, !=, ::)
  const PUNCTUATION_RATIO = 1 / 1.2

  // Whitespace - leading indentation often merges (4 spaces → 1 token),
  // but isolated spaces typically don't
  const WHITESPACE_RATIO = 1 / 2.5

  // Letters and other characters - keywords compress well, identifiers less so
  const DEFAULT_RATIO = 1 / 3.5

  // Adjustment multiplier for tuning estimates up (>1) or down (<1)
  // Set via OPENCODE_TOKEN_FACTOR environment variable
  const FACTOR = parseFloat(process.env.OPENCODE_TOKEN_FACTOR || "1.0") || 1.0

  // Default maximum tokens for tool outputs (configurable via env)
  // This prevents individual tool calls from consuming too much context
  const DEFAULT_TOOL_OUTPUT_LIMIT = parseInt(process.env.OPENCODE_TOOL_OUTPUT_TOKEN_LIMIT || "30000") || 30000

  export function estimate(input: string): number {
    const count = Array.from(input || "").reduce((acc, char) => {
      if (/\p{N}/u.test(char)) {
        return acc + DIGITS_RATIO
      }
      if (/\p{P}|\p{S}/u.test(char)) {
        return acc + PUNCTUATION_RATIO
      }
      if (/\s/.test(char)) {
        return acc + WHITESPACE_RATIO
      }
      return acc + DEFAULT_RATIO
    }, 0)
    return Math.trunc(count * FACTOR)
  }

  /**
   * Truncate text to fit within a token budget
   * @param input - The text to truncate
   * @param maxTokens - Maximum tokens allowed (defaults to DEFAULT_TOOL_OUTPUT_LIMIT)
   * @param suffix - Optional suffix to append when truncated (e.g., "...")
   * @returns Truncated text and metadata about truncation
   */
  export function truncate(
    input: string,
    maxTokens: number = DEFAULT_TOOL_OUTPUT_LIMIT,
    suffix = "\n\n[Output truncated to fit token budget]",
  ): { text: string; truncated: boolean; originalTokens: number; finalTokens: number } {
    const originalTokens = estimate(input)

    if (originalTokens <= maxTokens) {
      return {
        text: input,
        truncated: false,
        originalTokens,
        finalTokens: originalTokens,
      }
    }

    // Binary search for the right character count
    const suffixTokens = estimate(suffix)
    const targetTokens = maxTokens - suffixTokens

    // Iteratively refine character limit to hit token target
    const refineCharLimit = (currentLimit: number, iteration: number): number => {
      if (iteration >= 5) return currentLimit

      const truncatedText = input.substring(0, currentLimit)
      const tokens = estimate(truncatedText)

      if (tokens <= targetTokens) return currentLimit

      const ratio = targetTokens / tokens
      const newLimit = Math.floor(currentLimit * ratio * 0.95) // 0.95 for safety margin
      return refineCharLimit(newLimit, iteration + 1)
    }

    // Estimate characters needed (conservative)
    const initialCharLimit = Math.floor(targetTokens * 3.0) // Use conservative 3 chars/token
    const finalCharLimit = refineCharLimit(initialCharLimit, 0)
    const finalText = input.substring(0, finalCharLimit) + suffix

    return {
      text: finalText,
      truncated: true,
      originalTokens,
      finalTokens: estimate(finalText),
    }
  }

  /**
   * Truncate an array of lines to fit within a token budget
   * @param lines - Array of text lines
   * @param maxTokens - Maximum tokens allowed
   * @param headerLines - Number of lines to always keep from the start
   * @returns Truncated lines and metadata
   */
  export function truncateLines(
    lines: string[],
    maxTokens: number = DEFAULT_TOOL_OUTPUT_LIMIT,
    headerLines = 0,
  ): { lines: string[]; truncated: boolean; originalTokens: number; finalTokens: number; keptLines: number } {
    const header = lines.slice(0, headerLines)
    const content = lines.slice(headerLines)
    const headerTokens = estimate(header.join("\n"))

    // Process lines until we hit the token limit
    const processLines = (
      remainingLines: string[],
      currentTokens: number,
      accumulatedLines: string[],
    ): {
      lines: string[]
      tokens: number
      truncated: boolean
      remainingCount: number
    } => {
      if (remainingLines.length === 0) {
        return {
          lines: accumulatedLines,
          tokens: currentTokens,
          truncated: false,
          remainingCount: 0,
        }
      }

      const [nextLine, ...rest] = remainingLines
      const lineTokens = estimate(nextLine + "\n")

      if (currentTokens + lineTokens > maxTokens) {
        return {
          lines: accumulatedLines,
          tokens: currentTokens,
          truncated: true,
          remainingCount: remainingLines.length,
        }
      }

      return processLines(rest, currentTokens + lineTokens, [...accumulatedLines, nextLine])
    }

    const result = processLines(content, headerTokens, header)

    if (result.truncated) {
      const truncationMsg = `\n[Truncated ${result.remainingCount} lines to fit token budget]`
      return {
        lines: [...result.lines, truncationMsg],
        truncated: true,
        originalTokens: estimate(lines.join("\n")),
        finalTokens: result.tokens + estimate(truncationMsg),
        keptLines: result.lines.length,
      }
    }

    return {
      lines: result.lines,
      truncated: false,
      originalTokens: result.tokens,
      finalTokens: result.tokens,
      keptLines: result.lines.length,
    }
  }

  /**
   * Get the default tool output token limit
   */
  export function getToolOutputLimit(): number {
    return DEFAULT_TOOL_OUTPUT_LIMIT
  }
}
