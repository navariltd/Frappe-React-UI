#!/usr/bin/env node

import { execa } from "execa";
import fs from "fs-extra";
import os from "os";
import path from "path";
import readline from "readline";

const DEFAULT_REPO =
  "https://github.com/navariltd/Frappe-React-UI-Components.git";

const TEMP_DIR = path.join(os.tmpdir(), "frappe-react-ui");

const log = {
  ok: (msg) => console.log(`✔ ${msg}`),
  info: (msg) => console.log(`ℹ ${msg}`),
  warn: (msg) => console.log(`⚠ ${msg}`),
};

const ask = (query) =>
  new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    rl.question(query, (ans) => {
      rl.close();
      resolve(ans);
    });
  });

async function confirm(msg) {
  const ans = await ask(`${msg} (y/n): `);
  return ["y", "yes"].includes((ans || "").trim().toLowerCase());
}

async function cloneRepo(repo) {
  log.info("Checking registry...");
  await fs.remove(TEMP_DIR);
  await execa("git", ["clone", "--depth", "1", repo, TEMP_DIR]);
  log.ok("Registry fetched");
}

async function getRemotePackageJson() {
  const pkgPath = path.join(TEMP_DIR, "package.json");
  if (!(await fs.pathExists(pkgPath))) return null;
  return fs.readJson(pkgPath);
}

function getInstalledDeps() {
  const pkgPath = path.join(process.cwd(), "package.json");
  if (!fs.existsSync(pkgPath)) return {};
  const pkg = fs.readJsonSync(pkgPath);
  return { ...pkg.dependencies, ...pkg.devDependencies };
}

async function ensureDependencies() {
  const remote = await getRemotePackageJson();
  const installed = getInstalledDeps();

  const remoteDeps = remote?.dependencies || {};
  const missing = Object.keys(remoteDeps).filter((d) => !installed?.[d]);

  if (missing.length === 0) {
    log.ok("Dependencies satisfied");
    return;
  }

  log.warn("Missing dependencies:");
  missing.forEach((d) => console.log(`  - ${d}`));

  const ok = await confirm("Install missing dependencies?");
  if (!ok) process.exit(1);

  log.info("Installing dependencies...");

  await execa("npm", ["install", ...missing], {
    stdio: "inherit",
  });

  log.ok("Dependencies installed");
}

async function selectRoot(options) {
  const cwd = process.cwd();

  if (options?.root) return path.resolve(cwd, options.root);

  const ans = await ask(
    "Select root (default: ./src, enter '.' for current): ",
  );

  if (!ans || ans.trim() === "src") {
    const src = path.join(cwd, "src");
    if (fs.existsSync(src)) return src;
    return cwd;
  }

  if (ans.trim() === "." || ans.trim() === "") return cwd;

  return path.resolve(cwd, ans);
}

async function copyFolder(src, dest, overwrite = false) {
  const srcPath = path.join(TEMP_DIR, "src", src);
  if (!(await fs.pathExists(srcPath))) return [];

  const created = [];
  const skipped = [];

  const walk = async (dir, base = "") => {
    const items = await fs.readdir(dir);

    for (const item of items) {
      const full = path.join(dir, item);
      const rel = path.join(base, item);
      const stat = await fs.stat(full);

      if (stat.isDirectory()) {
        await walk(full, rel);
      } else {
        const target = path.join(dest, rel);

        if ((await fs.pathExists(target)) && !overwrite) {
          skipped.push(rel);
          continue;
        }

        await fs.ensureDir(path.dirname(target));
        await fs.copy(full, target, { overwrite: true });
        created.push(rel);
      }
    }
  };

  await walk(srcPath);
  return { created, skipped };
}

async function installAll(repo, root, overwrite) {
  await cloneRepo(repo);

  const components = await copyFolder(
    "components",
    path.join(root, "components"),
    overwrite,
  );

  const lib = await copyFolder("lib", path.join(root, "lib"), overwrite);
  const hooks = await copyFolder("hooks", path.join(root, "hooks"), overwrite);

  await fs.remove(TEMP_DIR);

  return {
    created: [...components.created, ...lib.created, ...hooks.created],
    skipped: [...components.skipped, ...lib.skipped, ...hooks.skipped],
  };
}

function printSummary(result) {
  log.ok(`Created ${result.created.length} files:`);

  result.created.forEach((f) => console.log(`  - ${f}`));

  if (result.skipped.length) {
    log.info(`Skipped ${result.skipped.length} files:`);
    result.skipped.forEach((f) => console.log(`  - ${f}`));
  }
}

async function main() {
  const { Command } = await import("commander");
  const program = new Command();

  program
    .name("frappe-react-ui")
    .description("Shadcn-style CLI for Frappe React UI")
    .version("1.0.0");

  program
    .command("add")
    .option("--all")
    .option("--root <path>")
    .option("--repo <url>")
    .option("--overwrite")
    .action(async (options) => {
      const repo = options.repo || DEFAULT_REPO;

      const root = await selectRoot(options);

      await ensureDependencies();

      const ok = await confirm("Proceed with installing Frappe React UI?");
      if (!ok) {
        log.warn("Cancelled");
        return;
      }

      if (!options.all) {
        log.warn("Use --all to install full registry");
        return;
      }

      const result = await installAll(repo, root, options.overwrite);

      printSummary(result);
    });

  program.parse();
}

main();
