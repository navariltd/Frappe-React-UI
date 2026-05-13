# Frappe React UI

A shadcn-inspired CLI for adding customizable React UI components directly into Frappe projects.

Instead of installing precompiled UI libraries, Frappe React UI copies component source files into your application, giving you full ownership and flexibility.

## Features

- Add individual components
- Install all components
- Copy source files directly into your project
- Tailwind CSS compatible
- Dependency auto-installation
- React + TypeScript ready
- Built for Frappe ecosystems

## Installation

```bash
npm install -g frappe-react-ui
```

or use directly with:

```bash
npx frappe-react-ui
```

## Usage

### Initialize

```bash
npx frappe-react-ui init
```

### Add a Component

```bash
npx frappe-react-ui add button
```

### Add Multiple Components

```bash
npx frappe-react-ui add button card dialog
```

### Add All Components

```bash
npx frappe-react-ui add --all
```

## Output Structure

Components are copied into:

```txt
components/
└── ui/
```

Example:

```txt
components/
└── ui/
    ├── button.tsx
    ├── card.tsx
    └── dialog.tsx
```

## Philosophy

Frappe React UI follows the same philosophy as shadcn/ui:

- You own the code
- Components are fully customizable
- No runtime UI dependency
- Source-first development approach

## Powered By

Components are dynamically fetched from the [Frappe React UI Components](https://github.com/navariltd/Frappe-React-UI-Components.git) registry repository.
