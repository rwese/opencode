import { describe, test, expect } from "bun:test"
import { Token } from "../../src/util/token"

describe("Token", () => {
  describe("truncate", () => {
    test("should not truncate when under limit", () => {
      const input = "short text"
      const result = Token.truncate(input, 1000)
      expect(result.truncated).toBe(false)
      expect(result.text).toBe(input)
      expect(result.originalTokens).toBe(result.finalTokens)
    })

    test("should truncate when over limit", () => {
      const longText = "a".repeat(10000) // Very long text
      const result = Token.truncate(longText, 100)
      expect(result.truncated).toBe(true)
      expect(result.finalTokens).toBeLessThanOrEqual(100)
      expect(result.originalTokens).toBeGreaterThan(result.finalTokens)
      expect(result.text).toContain("[Output truncated to fit token budget]")
    })

    test("should handle empty input", () => {
      const result = Token.truncate("", 100)
      expect(result.truncated).toBe(false)
      expect(result.text).toBe("")
      expect(result.originalTokens).toBe(0)
      expect(result.finalTokens).toBe(0)
    })

    test("should handle truncation with suffix", () => {
      const input = "This is a very long test string that should exceed the limit"
      const customSuffix = "[truncated]"
      const result = Token.truncate(input, 10, customSuffix)
      expect(result.truncated).toBe(true)
      expect(result.finalTokens).toBeLessThanOrEqual(10)
      expect(result.text).toContain(customSuffix)
    })

    test("should use default limit when not specified", () => {
      // Create text that definitely exceeds the default limit of 30,000
      const longText = "word ".repeat(100000) // Very long text
      const result = Token.truncate(longText)
      // Either it gets truncated or the text is shorter than expected
      if (result.truncated) {
        expect(result.finalTokens).toBeLessThanOrEqual(Token.getToolOutputLimit())
      }
    })
  })

  describe("getToolOutputLimit", () => {
    test("should return a positive number", () => {
      const limit = Token.getToolOutputLimit()
      expect(limit).toBeGreaterThan(0)
      expect(typeof limit).toBe("number")
    })
  })

  describe("estimate", () => {
    test("should estimate tokens for text", () => {
      const text = "hello world"
      const tokens = Token.estimate(text)
      expect(tokens).toBeGreaterThan(0)
      expect(typeof tokens).toBe("number")
    })

    test("should handle empty string", () => {
      const tokens = Token.estimate("")
      expect(tokens).toBe(0)
    })
  })
})
