# Shared Edge Function Utilities

## verifyAuth(req, supabase)

Use `verifyAuth` in custom Edge Functions before executing protected logic.

Example:

```ts
import { verifyAuth } from "../shared/auth-middleware.ts";

const user = await verifyAuth(req, supabase);
```
