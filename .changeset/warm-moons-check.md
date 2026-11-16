---
"@rapture-sh/envy": minor
---

Add `envy.check`, for the prerequisites a setup script needs before it asks anybody for
anything. Every check runs and the report lists all of them at once, with a version range,
an optional flag and a `fix` line saying what to do, so one pass tells somebody everything
their machine is missing.
