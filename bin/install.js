#!/usr/bin/env node
// Installs the iphone-duo-porting skill into a Claude Code skills folder.
// Zero dependencies so `npx github:KushagraGitter/iphone-duo-porting-skill` runs fast.

"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");

const SKILL_NAME = "iphone-duo-porting";
const SOURCE = path.join(__dirname, "..", "skills", SKILL_NAME);

const HELP = `
Install the iPhone Duo porting skill for Claude Code.

Usage:
  npx github:KushagraGitter/iphone-duo-porting-skill [options]

Options:
  --project        Install into ./.claude/skills (this project only)
  --dir <path>     Install into a custom skills folder (for other agents)
  --force          Overwrite an existing install without asking
  --uninstall      Remove the skill from the target folder
  -h, --help       Show this help

Default target: ~/.claude/skills (available in every project)
`;

function parseArgs(argv) {
  const opts = { project: false, dir: null, force: false, uninstall: false, help: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--project" || a === "-p") opts.project = true;
    else if (a === "--force" || a === "-f") opts.force = true;
    else if (a === "--uninstall") opts.uninstall = true;
    else if (a === "--help" || a === "-h") opts.help = true;
    else if (a === "--dir" || a === "-d") {
      opts.dir = argv[++i];
      if (!opts.dir) fail("--dir needs a path, for example --dir ~/.codex/skills");
    } else if (a.startsWith("--dir=")) opts.dir = a.slice(6);
    else fail(`Unknown option: ${a}\nRun with --help to see the options.`);
  }
  if (opts.project && opts.dir) fail("Use either --project or --dir, not both.");
  return opts;
}

function fail(msg) {
  console.error(`✗ ${msg}`);
  process.exit(1);
}

function expandHome(p) {
  return p === "~" || p.startsWith("~/") ? path.join(os.homedir(), p.slice(1)) : p;
}

function targetRoot(opts) {
  if (opts.dir) return path.resolve(expandHome(opts.dir));
  if (opts.project) return path.resolve(process.cwd(), ".claude", "skills");
  return path.join(os.homedir(), ".claude", "skills");
}

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

function pretty(p) {
  const home = os.homedir();
  return p.startsWith(home) ? "~" + p.slice(home.length) : p;
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    console.log(HELP);
    return;
  }

  const root = targetRoot(opts);
  const dest = path.join(root, SKILL_NAME);

  if (opts.uninstall) {
    if (!fs.existsSync(dest)) {
      console.log(`Nothing to remove: ${pretty(dest)} doesn't exist.`);
      return;
    }
    fs.rmSync(dest, { recursive: true, force: true });
    console.log(`✓ Removed ${SKILL_NAME} from ${pretty(root)}`);
    return;
  }

  if (!fs.existsSync(path.join(SOURCE, "SKILL.md"))) {
    fail(`Skill files are missing from the package (${SOURCE}). Please report this issue.`);
  }

  if (fs.existsSync(dest)) {
    // Re-running the installer is how people update, so replace in place.
    if (!opts.force) console.log(`Updating existing install at ${pretty(dest)}`);
    fs.rmSync(dest, { recursive: true, force: true });
  }

  copyDir(SOURCE, dest);

  console.log(`✓ Installed ${SKILL_NAME} to ${pretty(dest)}`);
  console.log("");
  console.log("Try it in Claude Code:");
  console.log('  "Port this app to iPhone Duo"');
  console.log('  "Add a fold-to-scrub control using the hinge"');
  if (!opts.project && !opts.dir) {
    console.log("");
    console.log("Installed for every project. Use --project to install for this repo only.");
  }
}

main();
