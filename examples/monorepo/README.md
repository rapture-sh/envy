# monorepo

A section per app, and each app getting its own file.

```bash
pnpm example:monorepo
```

This is the shape envy exists for. Three apps and one shared service, each needing a
different subset of the same values, each with its own `.env`, plus a root one for compose.
The apps are empty directories: the point is the script, not the app.

What is worth looking at:

- **A name is written once.** `cfg.env("storage")` turns the section into
  `STORAGE_BUCKET`, `STORAGE_ACCESS_KEY_ID` and so on, so adding a value to the schema adds
  it to every file that asks for the section, with no second list to keep in step.
- **`env:` where the convention is wrong.** `web.analyticsToken` is written
  `NEXT_PUBLIC_ANALYTICS_TOKEN` because the framework requires that prefix to send it to the
  browser, and the convention would have produced `WEB_ANALYTICS_TOKEN`.
- **The secret is in exactly one file.** `api.paymentsKey` goes into
  `services/api/.env` and nowhere else. Separate files per app is what makes that possible
  to see at a glance.
- **It is required and marked `secret`**, so with a terminal it is asked for and the typing
  is masked, and with no terminal the run says what is missing and carries on.
