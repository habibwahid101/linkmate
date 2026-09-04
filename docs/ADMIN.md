# First admin (production)

First signup is always a **member**, except the locked platform operator emails
(`hello.habibwahid@gmail.com` and `linkmateglobal@gmail.com`). Those accounts
always keep admin access. They cannot be demoted from **Admin → Users**.

After any other owner account exists:

```bash
DATABASE_URL='postgresql://linkmate:…@…:5432/linkmate?sslmode=require' \
ADMIN_EMAIL='owner@example.com' \
node scripts/provision-admin.mjs
```

The user must already exist in Better Auth (`"user"`) and `app_users`.

Last remaining admin cannot be demoted (`Cannot remove the last administrator`).

## Manual payments

Automated gateways stay disabled. Members pay by **bKash, Nagad, Bank, or Cash**, then submit a request.

1. Configure receiving accounts in **Admin → Settings → Payment methods**.
2. Review the queue in **Admin → Payments**.
3. Approve only after the money is confirmed. Approval issues IDs and runs commissions **once**.
4. Reject or mark Needs Review with a reason. Neither activates a package.

A submitted request is never an activation.
