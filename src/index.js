#!/usr/bin/env node

import chalk from "chalk";
import { Command } from "commander";
import { execa } from "execa";
import fs from "fs-extra";
import ora from "ora";
import os from "os";
import path from "path";

const DEFAULT_REPO_URL =
  "https://github.com/navariltd/Frappe-React-UI-Components.git";
const TEMP_DIR = path.join(os.tmpdir(), "frappe-react-ui");

async function getRemoteDependencies(repoUrl) {
  const spinner = ora("Fetching remote registry configuration...").start();
  try {
    await fs.remove(TEMP_DIR);
    await execa("git", ["clone", "--depth", "1", repoUrl, TEMP_DIR]);

    const remotePkgPath = path.join(TEMP_DIR, "package.json");
    if (!(await fs.pathExists(remotePkgPath))) {
      spinner.fail("Remote package.json not found.");
      return [];
    }

    const pkg = await fs.readJson(remotePkgPath);
    const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
    const exclude = ["execa", "fs-extra", "commander", "ora", "chalk"];

    spinner.succeed("Registry configuration fetched.");
    return Object.keys(allDeps).filter((dep) => !exclude.includes(dep));
  } catch (error) {
    spinner.fail("Failed to fetch remote dependencies.");
    console.error(chalk.red(error.message));
    return [];
  }
}

function getInstalledDeps() {
  const pkgPath = path.join(process.cwd(), "package.json");
  if (!fs.existsSync(pkgPath)) return {};
  const pkg = fs.readJsonSync(pkgPath);
  return { ...pkg.dependencies, ...pkg.devDependencies };
}

async function ensureDependencies(repoUrl) {
  const required = await getRemoteDependencies(repoUrl);
  const installed = getInstalledDeps();
  const missing = required.filter((d) => !installed?.[d]);

  if (missing.length === 0) {
    console.log(chalk.green("✔ Dependencies already satisfied."));
    return;
  }

  console.log(chalk.cyan(`\nℹ Found ${missing.length} missing dependencies.`));

  const spinner = ora("Installing missing dependencies...").start();
  try {
    await execa("npm", ["install", ...missing], { stdio: "ignore" });
    spinner.succeed("Dependencies installed successfully.");
  } catch (e) {
    spinner.fail("Failed to install dependencies automatically.");
    console.log(
      chalk.yellow("Try running: "),
      `npm install ${missing.join(" ")}`,
    );
    process.exit(1);
  }
}

async function copyFolder(src, dest, label, overwrite) {
  const srcPath = path.join(TEMP_DIR, "src", src);
  const installedFiles = [];
  const skippedFiles = [];

  if (await fs.pathExists(srcPath)) {
    const files = await fs.readdir(srcPath, { recursive: true });

    for (const file of files) {
      const sourceFile = path.join(srcPath, file);
      const targetFile = path.join(dest, file);

      if (await fs.lstat(sourceFile).then((s) => s.isDirectory())) continue;

      const exists = await fs.pathExists(targetFile);
      if (exists && !overwrite) {
        skippedFiles.push(path.join("src", src, file));
      } else {
        await fs.copy(sourceFile, targetFile, { overwrite: true });
        installedFiles.push(path.join("src", src, file));
      }
    }
    return { installedFiles, skippedFiles };
  }
  return { installedFiles: [], skippedFiles: [] };
}

async function main() {
  const program = new Command();

  program
    .name("frappe-react-ui")
    .description("CLI for installing Frappe React UI components")
    .version("1.1.0");

  program
    .command("add")
    .option("--all", "Install all components")
    .option("--root <path>", "Project root directory", "src")
    .option("--repo <url>", "Registry repository URL", DEFAULT_REPO_URL)
    .option("--overwrite", "Overwrite existing files", false)
    .action(async (options) => {
      console.log(chalk.bold("\nFrappe UI Component Installer"));
      console.log(chalk.dim("-------------------------------"));

      await ensureDependencies(options.repo);

      const projectRoot = path.resolve(process.cwd(), options.root);
      const spinner = ora(chalk.cyan("Installing components...")).start();

      const results = { installed: [], skipped: [] };

      const folders = [
        { src: "components", dest: "components", label: "Components" },
        { src: "lib", dest: "lib", label: "Lib Utils" },
        { src: "hooks", dest: "hooks", label: "Hooks" },
      ];

      for (const folder of folders) {
        const { installedFiles, skippedFiles } = await copyFolder(
          folder.src,
          path.join(projectRoot, folder.dest),
          folder.label,
          options.overwrite,
        );
        results.installed.push(...installedFiles);
        results.skipped.push(...skippedFiles);
      }

      spinner.stop();

      if (results.installed.length > 0) {
        console.log(
          chalk.green(`✔ Created ${results.installed.length} files:`),
        );
        results.installed.forEach((f) => console.log(chalk.dim(`  - ${f}`)));
      }

      if (results.skipped.length > 0) {
        console.log(
          chalk.yellow(
            `\nℹ Skipped ${results.skipped.length} files: (Use --overwrite to force)`,
          ),
        );
        results.skipped.forEach((f) => console.log(chalk.dim(`  - ${f}`)));
      }

      await fs.remove(TEMP_DIR);
      console.log(chalk.bold.green("\nDone!"));
    });

  program.parse();
}

main();
