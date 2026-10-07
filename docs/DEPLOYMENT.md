# Deployment checklist

The source is prepared for the new `Nmenanno/Cyclone-Aero-Flight-Tracker` repository. No unrelated repository is used.

## 1. Supabase

1. Sign in at https://supabase.com/dashboard. Create a dedicated project for Cyclone Aero. Choose the organization and available plan; do not put this schema in an unrelated existing application.
2. In SQL Editor, run `supabase/migrations/202610070001_tracker.sql` and then `202610070002_storage.sql` once, in order.
3. Run `supabase/seed/first_flight.sql`. This imports the actual 62 tasks, seven display teams, eleven milestone references, four meeting dates and 21 readiness conditions. It is safe to rerun the seed; do not rerun schema migrations over an existing schema.
4. Under Authentication → URL Configuration set Site URL to `https://nmenanno.github.io/Cyclone-Aero-Flight-Tracker/`. Add that same exact URL and `http://127.0.0.1:5173/Cyclone-Aero-Flight-Tracker/` to redirect URLs. Enable email sign-in / magic links. The client uses PKCE, which must finish in the browser that requested the link.
5. Configure an email provider appropriate for team use. Supabase's default email delivery restrictions may prevent general team onboarding; test delivery before inviting the team.
6. Obtain the project URL and **publishable key** (or legacy anon key). Never use the service-role/secret key in frontend or GitHub variables beginning `VITE_`.
7. Add the URL and public key to local `.env` for verification. These values are intentionally public; database and storage authorization comes from the included policies.

## 2. First Director

Open the configured app and sign in once. The page registers your account but grants no editing rights. In the Supabase SQL Editor, use the verified account UUID displayed in the app:

```sql
update public.profiles
set is_admin = true, display_name = 'Your preferred display name'
where id = 'REPLACE_WITH_YOUR_VERIFIED_AUTH_USER_UUID';
```

Do not select an arbitrary first user. Refresh the app. Further memberships and Director roles are managed in Administration. A Director cannot change their own Director role through the UI.

## 3. GitHub Pages

1. Repository → Settings → Secrets and variables → Actions → Variables: create `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`.
2. Pages has been configured with **GitHub Actions** as its source.
3. Push to `main` or run **Validate and deploy flight tracker** under Actions.
4. The workflow runs tests and builds, but skips deployment when either database value is missing. A source preview must not be presented as the operational tracker.
5. Verify `https://nmenanno.github.io/Cyclone-Aero-Flight-Tracker/` only after the deployment job succeeds. Hash routes make links such as `/#/team/structures` and `/#/task/STR-007` refresh correctly on Pages.

## 4. Hosted acceptance test

Use separate authorized test accounts and clearly labeled disposable tasks, not source engineering tasks. Verify magic-link sign-in, cross-user persistence after reload, source data count, routine completion, two-predecessor blocking, evidence upload/private download, Director reviews, extension history, frozen meeting snapshots and mobile layout. Verify anonymous and cross-team writes fail through the Data API. Delete neither source tasks nor historical meetings to clean up tests; defer test tasks with a reason.

## Remaining external setup at handoff

Supabase sign-in/project access, project creation, schema/seed application, auth/email setup, first Director bootstrap, public repository variables, successful Pages deployment and live multi-user verification must be completed before production use. See `VERIFICATION.md` for the distinction between local verified behavior and hosted checks.

References: [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [Storage access control](https://supabase.com/docs/guides/storage/security/access-control), [Vite Pages deployment](https://vite.dev/guide/static-deploy.html).
