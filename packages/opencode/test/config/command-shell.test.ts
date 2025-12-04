import { test, expect } from "bun:test"
import { Command } from "../../src/command"
import { Instance } from "../../src/project/instance"
import { tmpdir } from "../fixture/fixture"
import path from "path"
import fs from "fs/promises"

test("loads command with shell command in frontmatter", async () => {
  await using tmp = await tmpdir({
    init: async (dir) => {
      const commandDir = path.join(dir, ".opencode", "command")
      await fs.mkdir(commandDir, { recursive: true })

      await Bun.write(
        path.join(commandDir, "test.md"),
        `---
model: !` +
          "`echo test/model`" +
          `
description: "Test command"
---
Hello $ARGUMENTS with !` +
          "`echo world`",
      )
    },
  })

  await Instance.provide({
    directory: tmp.path,
    fn: async () => {
      const cmd = await Command.get("test")

      // Shell command in frontmatter should be resolved
      expect(cmd.model).toBe("test/model")
      expect(cmd.description).toBe("Test command")

      // Shell command in template body should NOT be resolved
      expect(cmd.template).toContain("!`echo world`")
    },
  })
})

test("loads command with env var shell command in frontmatter", async () => {
  const originalEnv = process.env["TEST_CMD_MODEL"]
  process.env["TEST_CMD_MODEL"] = "custom/model"

  try {
    await using tmp = await tmpdir({
      init: async (dir) => {
        const commandDir = path.join(dir, ".opencode", "command")
        await fs.mkdir(commandDir, { recursive: true })

        await Bun.write(
          path.join(commandDir, "envtest.md"),
          `---
model: !` +
            "`printenv TEST_CMD_MODEL`" +
            `
---
Template content`,
        )
      },
    })

    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const cmd = await Command.get("envtest")
        expect(cmd.model).toBe("custom/model")
      },
    })
  } finally {
    if (originalEnv !== undefined) {
      process.env["TEST_CMD_MODEL"] = originalEnv
    } else {
      delete process.env["TEST_CMD_MODEL"]
    }
  }
})
