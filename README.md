# Dealer Co-Pilot

**Unified Inventory & Scraping System**

> **Note:** This project has undergone a major architecture unification (Nov 2025).
> Please refer to [SYSTEM_GUIDELINES.md](./SYSTEM_GUIDELINES.md) for the current architecture, development standards, and system overview.

## Quick Start

### Documentation
*   **[SYSTEM_GUIDELINES.md](./SYSTEM_GUIDELINES.md)**: The Single Source of Truth for the system. Read this first.
*   **[archive/](./archive/)**: Contains legacy documentation and analysis files.

### Key Features
*   **Unified Inventory**: Dealers and Competitors are treated as unified "Sources".
*   **Universal Upload**: Single entry point for all CSV data (`upload-universal-csv`).
*   **Source Registry**: Centralized management of all data sources.

### Development
*   **Supabase Functions**: Located in `supabase/functions/`.
*   **Migrations**: Located in `supabase/migrations/`.
*   **Frontend**: Located in `src/`.

---
*For legacy documentation, see the `archive/` directory.*
