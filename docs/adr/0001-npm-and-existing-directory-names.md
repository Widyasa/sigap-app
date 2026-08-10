# Keep npm and existing starter directory names

The PRD assumes `pnpm 9` and directories named `apps/mobile` / `apps/admin` with packages under `@sigap/*`. The current repo was bootstrapped from `with-react-native-web` using `npm`, with `apps/native`, `apps/web`, and `@repo/*` packages. Migrating package manager and renaming directories would add churn without changing the architecture, so we keep the existing tooling and names. New shared packages will use the `@repo/*` scope. The PRD carries an errata note mapping `apps/mobile` → `apps/native` and `apps/admin` → `apps/web`.
