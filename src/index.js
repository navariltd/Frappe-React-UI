#!/usr/bin/env node

import chalk from "chalk";
import { Command } from "commander";
import { execa } from "execa";
import fs from "fs-extra";
import ora from "ora";
import os from "os";
import path from "path";
import readline from "readline";

const DEFAULT_REPO_URL =
  "https://github.com/navariltd/frappe_react_ui_components.git";
const DEFAULT_FOLDERS = ["components", "hooks", "lib", "types"];
const TEMP_DIR = path.join(os.tmpdir(), "frappe-react-ui");
const CONFIG_FILE = path.join(process.cwd(), "frappe-ui.config.json");

function askQuestion(query) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) =>
    rl.question(query, (ans) => {
      rl.close();
      resolve(ans);
    }),
  );
}

async function loadConfig(options) {
  let config = {
    repoUrl: DEFAULT_REPO_URL,
    remoteDir: "react-ui",
    root: "src",
    syncFolders: DEFAULT_FOLDERS,
  };
  const configExists = await fs.pathExists(CONFIG_FILE);

  if (configExists) {
    config = await fs.readJson(CONFIG_FILE);
    if (!config.syncFolders) {
      config.syncFolders = DEFAULT_FOLDERS;
    }
    if (config.remoteDir === undefined) {
      config.remoteDir = "react-ui";
    }
  } else {
    console.log(chalk.bold("\nFirst-time Setup: No configuration file found."));

    const inputUrl = await askQuestion(
      `${chalk.cyan("Enter registry URL")} ${chalk.dim(`(default: ${config.repoUrl})`)}: `,
    );
    config.repoUrl = inputUrl.trim() || config.repoUrl;

    const inputRemoteDir = await askQuestion(
      `${chalk.cyan("Enter remote subfolder containing package.json/src (leave empty for repo root)")} ${chalk.dim(`(default: ${config.remoteDir})`)}: `,
    );
    config.remoteDir =
      inputRemoteDir.trim() !== "" ? inputRemoteDir.trim() : config.remoteDir;

    const inputRoot = await askQuestion(
      `${chalk.cyan("Enter local project root folder")} ${chalk.dim(`(default: ${config.root})`)}: `,
    );
    config.root = inputRoot.trim() || config.root;

    await fs.writeJson(CONFIG_FILE, config, { spaces: 2 });
    console.log(chalk.green(`\n✔ Configuration saved to ${CONFIG_FILE}\n`));
  }

  if (options.repo) config.repoUrl = options.repo;
  if (options.remoteDir !== undefined) config.remoteDir = options.remoteDir;
  if (options.root) config.root = options.root;

  return config;
}

async function cloneRemoteRegistry(repoUrl) {
  const spinner = ora("Fetching remote registry...").start();
  try {
    await fs.remove(TEMP_DIR);
    await execa("git", ["clone", "--depth", "1", repoUrl, TEMP_DIR]);
    spinner.succeed("Remote registry fetched.");
  } catch (error) {
    spinner.fail("Failed to fetch remote registry.");
    console.error(chalk.red(error.message));
    process.exit(1);
  }
}

async function getRemoteDependencies(remoteDir) {
  const remotePkgPath = path.join(TEMP_DIR, remoteDir, "package.json");
  if (!(await fs.pathExists(remotePkgPath))) return [];

  const pkg = await fs.readJson(remotePkgPath);
  const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
  const exclude = ["execa", "fs-extra", "commander", "ora", "chalk"];

  return Object.keys(allDeps).filter((dep) => !exclude.includes(dep));
}

function getInstalledDeps() {
  const pkgPath = path.join(process.cwd(), "package.json");
  if (!fs.existsSync(pkgPath)) return {};
  const pkg = fs.readJsonSync(pkgPath);
  return { ...pkg.dependencies, ...pkg.devDependencies };
}

async function ensureDependencies(remoteDir) {
  const required = await getRemoteDependencies(remoteDir);
  const installed = getInstalledDeps();
  const missing = required.filter((d) => !installed?.[d]);

  if (missing.length === 0) return;

  console.log(
    chalk.cyan(
      `\nℹ Found ${missing.length} missing dependencies required by components.`,
    ),
  );
  const spinner = ora("Installing missing dependencies...").start();
  try {
    await execa("npm", ["install", ...missing, "--legacy-peer-deps"], {
      stdio: "ignore",
    });
    spinner.succeed("Dependencies installed successfully.");
  } catch (e) {
    spinner.fail("Failed to install dependencies automatically.");
    console.log(
      chalk.yellow("Try running: "),
      `npm install ${missing.join(" ")} --legacy-peer-deps`,
    );
    process.exit(1);
  }
}

function getRemoteSrcPath(remoteDir) {
  return path.join(TEMP_DIR, remoteDir, "src");
}

async function scanRemoteFiles(syncFolders, remoteDir) {
  const fileList = [];
  const baseSrcFolder = getRemoteSrcPath(remoteDir);

  for (const folder of syncFolders) {
    const remoteSrcFolder = path.join(baseSrcFolder, folder);
    if (!(await fs.pathExists(remoteSrcFolder))) continue;

    const items = await fs.readdir(remoteSrcFolder, { recursive: true });
    for (const item of items) {
      const fullPath = path.join(remoteSrcFolder, item);
      const stat = await fs.lstat(fullPath);
      if (!stat.isDirectory()) {
        fileList.push(path.join(folder, item));
      }
    }
  }

  return fileList;
}

async function processComponents(
  components,
  projectRoot,
  syncFolders,
  overwrite,
  remoteDir,
) {
  const remoteFiles = await scanRemoteFiles(syncFolders, remoteDir);
  const results = { installed: [], skipped: [] };
  const baseSrcFolder = getRemoteSrcPath(remoteDir);

  const cleanString = (str) => str.toLowerCase().replace(/[-_]/g, "");
  const normalizedComponents = components.map((c) => cleanString(c));

  const matches = remoteFiles.filter((file) => {
    if (components.length === 0) return true;

    const segments = file.split(path.sep);
    const fileNameWithExt = segments[segments.length - 1];
    const fileNameWithoutExt = path.parse(fileNameWithExt).name;

    const cleanSegments = segments.map((s) => cleanString(s));
    const cleanFileName = cleanString(fileNameWithoutExt);

    return normalizedComponents.some((comp) => {
      return cleanFileName === comp || cleanSegments.includes(comp);
    });
  });

  if (matches.length === 0 && components.length > 0) {
    console.log(
      chalk.yellow(
        `\n⚠ No components found matching: ${components.join(", ")}`,
      ),
    );
    return results;
  }

  for (const file of matches) {
    const sourceFile = path.join(baseSrcFolder, file);
    const targetFile = path.join(projectRoot, file);

    await fs.ensureDir(path.dirname(targetFile));
    const exists = await fs.pathExists(targetFile);

    if (exists && !overwrite) {
      results.skipped.push(file);
    } else {
      await fs.copy(sourceFile, targetFile, { overwrite: true });
      results.installed.push(file);
    }
  }

  return results;
}

async function main() {
  const program = new Command();

  program
    .name("frappe-react-ui")
    .description(
      "CLI for adding, searching, and syncing Frappe React UI components",
    )
    .version("2.2.1");

  program
    .command("add")
    .description("Add components from the registry into your project")
    .argument(
      "[components...]",
      "Specific components to add (leave blank or use --all for all)",
    )
    .option(
      "--all",
      "Install all components from the target synced registry folders",
    )
    .option("--root <path>", "Project root directory override")
    .option("--repo <url>", "Registry repository URL override")
    .option(
      "--remote-dir <path>",
      "Remote subdirectory override containing package.json/src",
    )
    .option("--overwrite", "Overwrite existing files directly", false)
    .action(async (components, options) => {
      console.log(chalk.bold("\nFrappe UI Component Installer"));
      console.log(chalk.dim("-------------------------------"));

      if (options.all) {
        components = [];
      }

      const config = await loadConfig(options);
      await cloneRemoteRegistry(config.repoUrl);
      await ensureDependencies(config.remoteDir);

      const projectRoot = path.resolve(process.cwd(), config.root);
      const spinner = ora(chalk.cyan("Processing component sync...")).start();

      const results = await processComponents(
        components,
        projectRoot,
        config.syncFolders,
        options.overwrite,
        config.remoteDir,
      );
      spinner.stop();

      if (results.installed.length > 0) {
        console.log(
          chalk.green(
            `\n✔ Synced ${results.installed.length} files into ${config.root}/:`,
          ),
        );
        results.installed.forEach((f) => console.log(chalk.dim(`  - ${f}`)));
      }

      if (results.skipped.length > 0) {
        console.log(
          chalk.yellow(
            `\nℹ Skipped ${results.skipped.length} files (Files exist. Use --overwrite or 'sync' command to force):`,
          ),
        );
        results.skipped.forEach((f) => console.log(chalk.dim(`  - ${f}`)));
      }

      await fs.remove(TEMP_DIR);
      console.log(chalk.bold.green("\nProcess complete!"));
    });

  program
    .command("sync")
    .description(
      "Sync and force overwrite existing components from the registry",
    )
    .argument(
      "[components...]",
      "Specific components to sync (leave blank or use --all for all)",
    )
    .option(
      "--all",
      "Sync and overwrite all components from the target synced registry folders",
    )
    .option("--root <path>", "Project root directory override")
    .option("--repo <url>", "Registry repository URL override")
    .option(
      "--remote-dir <path>",
      "Remote subdirectory override containing package.json/src",
    )
    .action(async (components, options) => {
      console.log(chalk.bold("\nFrappe UI Component Synchronizer"));
      console.log(chalk.dim("-------------------------------"));

      if (options.all) {
        components = [];
      }

      const config = await loadConfig(options);
      await cloneRemoteRegistry(config.repoUrl);
      await ensureDependencies(config.remoteDir);

      const projectRoot = path.resolve(process.cwd(), config.root);
      const spinner = ora(chalk.cyan("Syncing items...")).start();

      const results = await processComponents(
        components,
        projectRoot,
        config.syncFolders,
        true,
        config.remoteDir,
      );
      spinner.stop();

      if (results.installed.length > 0) {
        console.log(
          chalk.green(
            `\n✔ Successfully updated ${results.installed.length} files:`,
          ),
        );
        results.installed.forEach((f) => console.log(chalk.dim(`  - ${f}`)));
      }

      await fs.remove(TEMP_DIR);
      console.log(chalk.bold.green("\nSync complete!"));
    });

  program
    .command("search")
    .description(
      "Search files or directories available in the tracked remote registry folders",
    )
    .argument("<query>", "Search keyword matching folders or file properties")
    .option("--repo <url>", "Registry repository URL override")
    .option(
      "--remote-dir <path>",
      "Remote subdirectory override containing package.json/src",
    )
    .action(async (query, options) => {
      const config = await loadConfig(options);
      await cloneRemoteRegistry(config.repoUrl);

      const remoteFiles = await scanRemoteFiles(
        config.syncFolders,
        config.remoteDir,
      );
      const filtered = remoteFiles.filter((f) =>
        f.toLowerCase().includes(query.toLowerCase()),
      );

      console.log(chalk.bold(`\nSearch Results for: "${query}"`));
      console.log(chalk.dim("-------------------------------"));

      if (filtered.length === 0) {
        console.log(
          chalk.yellow(
            "No components found matching that criteria inside tracked folders.",
          ),
        );
      } else {
        filtered.forEach((f) => console.log(chalk.cyan(`  → ${f}`)));
      }

      await fs.remove(TEMP_DIR);
    });

  program.parse();
}

main();
