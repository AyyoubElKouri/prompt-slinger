#  AGENTS.md

This file provides guidance to AI coding agents working in this repository.

## Core rules

- Prefer editing existing files. Create new files only when necessary for better structure.


## Architecture

```
src/
├── entrypoints/
│   ├── background.ts
│   ├── content.ts
│   └── popup/
│       ├── index.html
│       └── main.tsx
│
├── features/
│   └── <feature-name>/
│       ├── <feature>.background.ts
│       ├── <feature>.content.ts
│       ├── <feature>.ui.tsx
│       ├── README.md
│       └── index.ts
│
└── shared/
    ├── types/
    └── utils/
```


**Rules**

- **`entrypoints/`**: Thin wiring scripts only.
- **`features/`**: Business logic tagged with execution context (`.background`, `.content`, `.ui`, ... ).
- **`shared/`**: Context-agnostic types and logic.
