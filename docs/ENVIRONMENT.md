# Link Mate production environment contract

Never commit real values. Never print secrets. Never put secrets in `VITE_*`.

## Required on AWS App Runner

| Name | Production value | Notes |
|---|---|---|
| `APP_ENV` | `production` | Fail-closed flags |
| `NODE_ENV` | `production` | |
| `PORT` | `8080` | App Runner |
| `HOST` | `0.0.0.0` | |
| `DATABASE_URL` | Secrets Manager | `postgresql://…?sslmode=require` RDS only. PGLite forbidden |
| `BETTER_AUTH_SECRET` | Secrets Manager | 32+ random bytes |
| `BETTER_AUTH_URL` | public https origin | App Runner URL first, then custom domain |
| `APP_URL` | public https origin | Same as `BETTER_AUTH_URL` |
| `AUTH_BROKER` | `off` | No Grok auth broker |
| `PAYMENTS_MODE` | `disabled` | Forced off in production anyway |
| `ENABLE_DEMO_NETWORK` | `false` | Forced off |
| `ENABLE_SAMPLE_DATA` | `false` | Forced off |
| `ENABLE_SIMULATE_JOINS` | `false` | Forced off |
| `ALLOW_BOOTSTRAP_ADMIN` | `false` | Forced off |
| `AWS_REGION` | `ap-south-1` | SES + SDK |

## Optional

| Name | When |
|---|---|
| `SES_FROM_EMAIL` | After the sender identity is verified |
| `GITHUB_SHA` / `LINKMATE_BUILD_COMMIT` | Image build arg for `/api/version` |

## Baked into the image (not secrets)

- `VITE_AUTH_ENABLED=true`
- `VITE_GROK_BROKER=false`

## Forbidden in production

- `DATABASE_URL` unset or non-Postgres
- Preview Grok OAuth client fallback
- `PAYMENTS_MODE=enabled` or `simulation`
- First-user admin bootstrap
- Demo / sample / simulate-join tools

## Domain cutover (later)

Change only:

1. `APP_URL`
2. `BETTER_AUTH_URL`
3. Secrets Manager JSON (same two keys)
4. ACM + App Runner custom domain
5. Restart / start-deployment

No code change required.
