import type { CodegenConfig } from "@graphql-codegen/cli";

const config: CodegenConfig = {
  schema: "graphql/resolvers/index.ts",
  documents: [
    "src/routes/admin.users.tsx",
    "src/routes/notifications.tsx",
    "src/hooks/useCursorEventsQuery.ts",
  ],
  generates: {
    "./src/generated/graphql.ts": {
      plugins: ["typescript", "typescript-operations"],
      config: {
        skipTypename: false,
        withHooks: false,
        withHOC: false,
        withComponent: false,
      },
    },
  },
};

export default config;
