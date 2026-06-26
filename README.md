# Frappe React UI

A shadcn-inspired CLI tool designed to search, install, and sync customizable React UI components, helper utilities, hooks, and types directly into your Frappe projects.

Instead of introducing heavy, precompiled node modules as upstream runtime dependencies, Frappe React UI clones source modules straight into your local workspace—giving you complete structural control, structural flexibility, and direct file ownership.

## Features

- **Selective & Single Syncing**: Pull down one component, helper file, or a full array of files simultaneously.
- **Intensive Clean Matcher**: Targets component folder names, individual path segments, or specific base filenames precisely while ignoring case variations, hyphens (`-`), or underscores (`_`).
- **Dynamic Context Mirroring**: Re-materializes matching assets in identical file paths inside your workspace, retaining clear organization across your asset structure.
- **Persistent Local Settings Config**: Automatically tracks your registry URL, local source layout root directory, and tracked workspace folders inside a local `frappe-ui.config.json` schema.
- **Automated Upstream Dependency Verification**: Evaluates your target component's requirement layout on every run, auto-installing missing npm libraries.
- **Tailwind CSS + TypeScript Ready**: Smoothly drops clean primitives straight into existing application scaffolds.

## Installation

```bash
npm install -g frappe-react-ui

```

or call the remote package dynamically with:

```bash
npx frappe-react-ui

```

## Usage

### Add Components

Add specific elements into your workspace. If no local configuration block is found, the CLI initializes an interactive wizard to prompt and track your baseline repository configurations.

```bash
npx frappe-react-ui add button

```

Add multiple items at the same time:

```bash
npx frappe-react-ui add button card input dialog

```

### Sync & Force Overwrite

Force synchronize, refresh, or overwrite modified local source assets directly from the remote origin baseline:

```bash
npx frappe-react-ui sync button

```

### Bulk Operations

Download or force overwrite every file inside the targeted tracking registry layouts:

```bash
npx frappe-react-ui add --all
npx frappe-react-ui sync --all

```

### Search Registry Assets

Quickly inspect and list matching remote directory nodes or specific components safely without pulling down or processing local code modifications:

```bash
npx frappe-react-ui search button

```

## Configuration Schema

When triggered for the first time, a `frappe-ui.config.json` configuration manifest is automatically initialized at your project's root level to maintain explicit workspace parameters:

```json
{
  "repoUrl": "[https://github.com/navariltd/frappe_react_ui_components.git](https://github.com/navariltd/frappe_react_ui_components.git)",
  "root": "src",
  "syncFolders": ["components", "hooks", "lib", "types"]
}
```

### Parameters

- `repoUrl`: The origin registry Git repository containing your core UI asset layout.
- `root`: Your localized client development workspace layout folder (e.g., `src`, `frontend`, `frontend/src`, or `app`).
- `syncFolders`: The whitelist arrays mapped within the repository's `src/` directory to limit and isolate searches against.

## Output Target Structure

Assets are selectively populated within your local directory matrix reflecting their tracked repository layout configurations:

```txt
[project-root]/
├── frappe-ui.config.json
└── [src]/
    ├── components/
    │   └── ui/
    │       ├── button.tsx
    │       └── card.tsx
    ├── hooks/
    │   └── use-toast.ts
    ├── lib/
    │   └── utils.ts
    └── types/
        └── index.ts

```

## Global Command Overrides

Dynamically point to alternative configurations or alternative target repositories on-the-fly without changing your configuration file using explicit flags:

```bash
npx frappe-react-ui add button --root frontend --repo [https://github.com/your-org/custom-registry.git](https://github.com/your-org/custom-registry.git)

```
