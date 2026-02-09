#!/usr/bin/env bun

const run = (cmd: string[]) =>
  Bun.spawnSync(cmd, { stdout: "pipe", stderr: "pipe" });

const text = (cmd: string[]) =>
  run(cmd).stdout.toString().trim();

function fail(msg: string): never {
  console.error(`ERROR: ${msg}`);
  process.exit(1);
}

// Fail on uncommitted changes
const diff = run(["git", "diff", "--quiet"]);
const diffCached = run(["git", "diff", "--cached", "--quiet"]);
if (diff.exitCode !== 0 || diffCached.exitCode !== 0) {
  fail("You have uncommitted changes. Commit or stash them first.");
}

// Fail on untracked files
const untracked = text(["git", "ls-files", "--others", "--exclude-standard"]);
if (untracked) {
  fail(`You have untracked files. Commit or remove them first.\n${untracked}`);
}

// Fail on unpushed commits
const local = text(["git", "rev-parse", "HEAD"]);
const remoteResult = run(["git", "rev-parse", "@{u}"]);
if (remoteResult.exitCode !== 0) {
  fail("No upstream branch configured. Push your branch first.");
}
const remote = remoteResult.stdout.toString().trim();

if (local !== remote) {
  fail(`You have unpushed commits. Push to origin first.\n  Local:  ${local}\n  Remote: ${remote}`);
}

console.log("All checks passed. Deploying to Railway...");
const deploy = Bun.spawnSync(["railway", "up", "--detach"], {
  stdout: "inherit",
  stderr: "inherit",
});
process.exit(deploy.exitCode);
