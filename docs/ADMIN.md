# First admin (production)

First signup is always a **member**. There is no first-user admin bootstrap.

After the owner account exists:

```bash
DATABASE_URL='postgresql://linkmate:…@…:5432/linkmate?sslmode=require' \
ADMIN_EMAIL='owner@example.com' \
node scripts/provision-admin.mjs
```

The user must already exist in Better Auth (`"user"`) and `app_users`.

Last remaining admin cannot be demoted (`Cannot remove the last administrator`).
