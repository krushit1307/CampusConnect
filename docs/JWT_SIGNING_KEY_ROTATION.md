# JWT signing-key rotation

CampusConnect uses Supabase Auth as its token issuer. The frontend does not
sign user JWTs and the Edge Functions validate them through Supabase Auth.
Consequently, signing-key rotation must be configured in the Supabase project,
not implemented as a separate application JWT service.

With an asymmetric signing key, Supabase Auth issues user access tokens with a
`kid` header and publishes only the public key set at:

```text
https://<project-ref>.supabase.co/auth/v1/.well-known/jwks.json
```

Do not expose a private key, add it to a Vite environment variable, or create
a duplicate `/.well-known/jwks.json` endpoint in this frontend. It would not
be the key set used by the Supabase-issued sessions.

## Initial migration to RS256

1. In the Supabase Dashboard, open **Authentication > JWT Signing Keys**.
2. Select **Migrate JWT secret**. This keeps the existing HS256 secret trusted
   during the migration.
3. Create an RSA-2048 / `RS256` signing key as a standby key. Supabase can
   generate it, or an operator can generate a JWK with:

   ```bash
   supabase gen signing-key --algorithm RS256
   ```

   Import the complete private JWK only in Supabase. Never commit it; local
   `supabase/signing_keys.json` is intentionally ignored.

4. Wait at least 20 minutes before activation so JWKS caches can discover the
   standby public key.
5. Rotate the standby key into use. New access tokens now have `alg: RS256` and
   its `kid`; Supabase continues accepting the previous signing key, so existing
   sessions are not logged out.
6. Migrate clients from legacy `anon`/`service_role` JWT API keys to Supabase
   publishable/secret API keys. Only revoke the old HS256 key after every
   service has migrated and existing access tokens have expired.

## 30-day rotation procedure

Thirty days after each successful rotation, create the next RSA standby key.
Wait for cache propagation, rotate it into use, and leave the old key in the
previously-used state for 30 days. The JWKS endpoint will publish both public
keys throughout that overlap. After the overlap, revoke the old key.

The Supabase Dashboard is the source of truth for key state and private-key
custody. If automatic rotation is required, run this procedure from a trusted
scheduled operator service using a narrowly scoped Supabase management token.
Do not put that token, an RSA private key, or a rotation job in the frontend
repository. Record the active `kid`, rotation date, and revocation date in the
operator's secret-management/audit system.

## Verifying the deployment

Log in through CampusConnect and copy the resulting access token from a secure
development session. Then run:

```bash
SUPABASE_URL=https://<project-ref>.supabase.co JWT=<access-token> npm run auth:verify-jwks
```

The command fails unless the token header uses `RS256`, has a `kid`, and the
issuer's JWKS contains a matching public RSA verification key. It never sends
the token anywhere except the local process; the JWKS request itself contains
no authorization header.

For services that verify tokens directly, use a standards-compliant JWKS
client (for example, `jose`'s `createRemoteJWKSet`). Cache successful JWKS
responses in memory and refresh when an unknown `kid` is encountered. Keep an
explicit cache-bust path for emergency revocations and do not cache longer than
the provider's key-rotation policy.

## Local Supabase

The local CLI configuration already supports
`auth.signing_keys_path = "./signing_keys.json"` in `supabase/config.toml`.
Use a private, ignored key-ring file only for local testing. Production key
generation, activation, overlap, and revocation happen in the Supabase project
that issues the actual user sessions.

## References

- [Supabase JWT signing keys](https://supabase.com/docs/guides/auth/signing-keys)
- [Supabase JWT verification and JWKS](https://supabase.com/docs/guides/auth/jwts)
