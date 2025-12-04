import { expect, test } from "bun:test"
import { ConfigMarkdown } from "../../src/config/markdown"
import { tmpdir } from "../fixture/fixture"
import path from "path"

const template = `This is a @valid/path/to/a/file and it should also match at
the beginning of a line:

@another-valid/path/to/a/file

but this is not:

   - Adds a "Co-authored-by:" footer which clarifies which AI agent
     helped create this commit, using an appropriate \`noreply@...\`
     or \`noreply@anthropic.com\` email address.

We also need to deal with files followed by @commas, ones
with @file-extensions.md, even @multiple.extensions.bak,
hidden directorys like @.config/ or files like @.bashrc
and ones at the end of a sentence like @foo.md.

Also shouldn't forget @/absolute/paths.txt with and @/without/extensions,
as well as @~/home-files and @~/paths/under/home.txt.

If the reference is \`@quoted/in/backticks\` then it shouldn't match at all.`

const matches = ConfigMarkdown.files(template)

test("should extract exactly 12 file references", () => {
  expect(matches.length).toBe(12)
})

test("should extract valid/path/to/a/file", () => {
  expect(matches[0][1]).toBe("valid/path/to/a/file")
})

test("should extract another-valid/path/to/a/file", () => {
  expect(matches[1][1]).toBe("another-valid/path/to/a/file")
})

test("should extract paths ignoring comma after", () => {
  expect(matches[2][1]).toBe("commas")
})

test("should extract a path with a file extension and comma after", () => {
  expect(matches[3][1]).toBe("file-extensions.md")
})

test("should extract a path with multiple dots and comma after", () => {
  expect(matches[4][1]).toBe("multiple.extensions.bak")
})

test("should extract hidden directory", () => {
  expect(matches[5][1]).toBe(".config/")
})

test("should extract hidden file", () => {
  expect(matches[6][1]).toBe(".bashrc")
})

test("should extract a file ignoring period at end of sentence", () => {
  expect(matches[7][1]).toBe("foo.md")
})

test("should extract an absolute path with an extension", () => {
  expect(matches[8][1]).toBe("/absolute/paths.txt")
})

test("should extract an absolute path without an extension", () => {
  expect(matches[9][1]).toBe("/without/extensions")
})

test("should extract an absolute path in home directory", () => {
  expect(matches[10][1]).toBe("~/home-files")
})

test("should extract an absolute path under home directory", () => {
  expect(matches[11][1]).toBe("~/paths/under/home.txt")
})

test("should not match when preceded by backtick", () => {
  const backtickTest = "This `@should/not/match` should be ignored"
  const backtickMatches = ConfigMarkdown.files(backtickTest)
  expect(backtickMatches.length).toBe(0)
})

test("should not match email addresses", () => {
  const emailTest = "Contact user@example.com for help"
  const emailMatches = ConfigMarkdown.files(emailTest)
  expect(emailMatches.length).toBe(0)
})

// Shell command tests
test("shell() should extract shell commands from text", () => {
  const text = "Use !`echo hello` to print and !`date` for time"
  const matches = ConfigMarkdown.shell(text)
  expect(matches.length).toBe(2)
  expect(matches[0][1]).toBe("echo hello")
  expect(matches[1][1]).toBe("date")
})

test("shell() should return empty array when no shell commands", () => {
  const text = "No shell commands here"
  const matches = ConfigMarkdown.shell(text)
  expect(matches.length).toBe(0)
})

test("resolveShell() should execute and replace shell commands", async () => {
  const text = "Result: !`echo hello`"
  const result = await ConfigMarkdown.resolveShell(text)
  expect(result).toBe('Result: "hello"')
})

test("resolveShell() should handle multiple shell commands", async () => {
  const text = "First: !`echo one` Second: !`echo two`"
  const result = await ConfigMarkdown.resolveShell(text)
  expect(result).toBe('First: "one" Second: "two"')
})

test("resolveShell() should return original text when no shell commands", async () => {
  const text = "No commands here"
  const result = await ConfigMarkdown.resolveShell(text)
  expect(result).toBe("No commands here")
})

test("resolveShell() should not throw '$ is not defined' error", async () => {
  // This is a regression test for the missing Bun $ import
  const text = "Value: !`echo test`"
  const result = await ConfigMarkdown.resolveShell(text)
  expect(result).toBe('Value: "test"')
  expect(result).not.toContain("$ is not defined")
})

test("parse() should resolve shell commands in frontmatter", async () => {
  await using tmp = await tmpdir({
    init: async (dir) => {
      await Bun.write(
        path.join(dir, "test.md"),
        `---
model: !` +
          "`echo test-model`" +
          `
description: "Test command"
---
Template content`,
      )
    },
  })

  const result = await ConfigMarkdown.parse(path.join(tmp.path, "test.md"))
  expect(result.data.model).toBe("test-model")
  expect(result.data.description).toBe("Test command")
  expect(result.content.trim()).toBe("Template content")
})

test("parse() should resolve shell commands with env vars in frontmatter", async () => {
  const originalEnv = process.env["TEST_MODEL_VAR"]
  process.env["TEST_MODEL_VAR"] = "env-model"

  try {
    await using tmp = await tmpdir({
      init: async (dir) => {
        // Use printenv which works reliably across shells
        await Bun.write(
          path.join(dir, "test.md"),
          `---
model: !` +
            "`printenv TEST_MODEL_VAR`" +
            `
---
Content`,
        )
      },
    })

    const result = await ConfigMarkdown.parse(path.join(tmp.path, "test.md"))
    expect(result.data.model).toBe("env-model")
  } finally {
    if (originalEnv !== undefined) {
      process.env["TEST_MODEL_VAR"] = originalEnv
    } else {
      delete process.env["TEST_MODEL_VAR"]
    }
  }
})

test("parse() should NOT resolve shell commands in template body", async () => {
  await using tmp = await tmpdir({
    init: async (dir) => {
      await Bun.write(
        path.join(dir, "test.md"),
        `---
description: "Test"
---
The date is !` +
          "`echo today`" +
          ` and time is now`,
      )
    },
  })

  const result = await ConfigMarkdown.parse(path.join(tmp.path, "test.md"))
  // Shell commands in body should NOT be resolved during parse
  expect(result.content.trim()).toBe("The date is !`echo today` and time is now")
})

// Regression tests for shell command YAML quoting
test("parse() should quote shell output containing colons", async () => {
  await using tmp = await tmpdir({
    init: async (dir) => {
      await Bun.write(
        path.join(dir, "test.md"),
        `---
model: !` +
          "`echo 'anthropic/claude-3-5-sonnet'`" +
          `
---
Content`,
      )
    },
  })

  const result = await ConfigMarkdown.parse(path.join(tmp.path, "test.md"))
  expect(result.data.model).toBe("anthropic/claude-3-5-sonnet")
})

test("parse() should quote shell output containing hash symbols", async () => {
  await using tmp = await tmpdir({
    init: async (dir) => {
      await Bun.write(
        path.join(dir, "test.md"),
        `---
description: !` +
          "`echo 'value # with comment'`" +
          `
---
Content`,
      )
    },
  })

  const result = await ConfigMarkdown.parse(path.join(tmp.path, "test.md"))
  expect(result.data.description).toBe("value # with comment")
})

test("parse() should quote shell output containing single quotes", async () => {
  await using tmp = await tmpdir({
    init: async (dir) => {
      await Bun.write(
        path.join(dir, "test.md"),
        `---
text: !` +
          "`echo \"value with 'quotes'\"`" +
          `
---
Content`,
      )
    },
  })

  const result = await ConfigMarkdown.parse(path.join(tmp.path, "test.md"))
  expect(result.data.text).toBe("value with 'quotes'")
})

test("parse() should quote shell output containing double quotes", async () => {
  await using tmp = await tmpdir({
    init: async (dir) => {
      await Bun.write(
        path.join(dir, "test.md"),
        `---
text: !` +
          "`echo 'value with \"quotes\"'`" +
          `
---
Content`,
      )
    },
  })

  const result = await ConfigMarkdown.parse(path.join(tmp.path, "test.md"))
  expect(result.data.text).toBe('value with "quotes"')
})

test("parse() should quote shell output containing brackets", async () => {
  await using tmp = await tmpdir({
    init: async (dir) => {
      await Bun.write(
        path.join(dir, "test.md"),
        `---
array: !` +
          "`echo '[item1, item2]'`" +
          `
---
Content`,
      )
    },
  })

  const result = await ConfigMarkdown.parse(path.join(tmp.path, "test.md"))
  expect(result.data.array).toBe("[item1, item2]")
})

test("parse() should quote shell output containing braces", async () => {
  await using tmp = await tmpdir({
    init: async (dir) => {
      await Bun.write(
        path.join(dir, "test.md"),
        `---
object: !` +
          "`echo '{key: value}'`" +
          `
---
Content`,
      )
    },
  })

  const result = await ConfigMarkdown.parse(path.join(tmp.path, "test.md"))
  expect(result.data.object).toBe("{key: value}")
})

test("parse() should handle empty shell output", async () => {
  await using tmp = await tmpdir({
    init: async (dir) => {
      await Bun.write(
        path.join(dir, "test.md"),
        `---
empty: !` +
          "`echo ''`" +
          `
description: "test"
---
Content`,
      )
    },
  })

  const result = await ConfigMarkdown.parse(path.join(tmp.path, "test.md"))
  expect(result.data.empty).toBe("")
  expect(result.data.description).toBe("test")
})

test("parse() should quote shell output with leading/trailing spaces", async () => {
  await using tmp = await tmpdir({
    init: async (dir) => {
      await Bun.write(
        path.join(dir, "test.md"),
        `---
spaced: !` +
          "`echo '  value  '`" +
          `
---
Content`,
      )
    },
  })

  const result = await ConfigMarkdown.parse(path.join(tmp.path, "test.md"))
  // Note: trim() is called in resolveShell, so this tests the current behavior
  expect(result.data.spaced).toBe("value")
})

test("parse() should handle multiple shell commands in frontmatter", async () => {
  await using tmp = await tmpdir({
    init: async (dir) => {
      await Bun.write(
        path.join(dir, "test.md"),
        `---
model: !` +
          "`echo 'provider/model'`" +
          `
version: !` +
          "`echo '1.0.0'`" +
          `
description: !` +
          "`echo 'Test: description'`" +
          `
---
Content`,
      )
    },
  })

  const result = await ConfigMarkdown.parse(path.join(tmp.path, "test.md"))
  expect(result.data.model).toBe("provider/model")
  expect(result.data.version).toBe("1.0.0")
  expect(result.data.description).toBe("Test: description")
})

test("parse() should handle complex real-world command file", async () => {
  const originalEnv = process.env["TEST_MODEL"]
  process.env["TEST_MODEL"] = "anthropic/claude-3-5-sonnet"

  try {
    await using tmp = await tmpdir({
      init: async (dir) => {
        await Bun.write(
          path.join(dir, "test.md"),
          `---
model: !` +
            "`printenv TEST_MODEL`" +
            `
description: "AI model: uses environment variable"
tags: !` +
            "`echo '[ai, testing]'`" +
            `
---
Template content with $ARGUMENTS`,
        )
      },
    })

    const result = await ConfigMarkdown.parse(path.join(tmp.path, "test.md"))
    expect(result.data.model).toBe("anthropic/claude-3-5-sonnet")
    expect(result.data.description).toBe("AI model: uses environment variable")
    expect(result.data.tags).toBe("[ai, testing]")
  } finally {
    if (originalEnv !== undefined) {
      process.env["TEST_MODEL"] = originalEnv
    } else {
      delete process.env["TEST_MODEL"]
    }
  }
})
