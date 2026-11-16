# two-addresses

One service, reached from the host and from inside compose.

```bash
pnpm example:addresses
```

This is the duplication that bites hardest in a hand written setup script. The storage
service is `127.0.0.1:9090` to the app on your machine and `s3mock:9090` to anything inside
the compose network. Write that by hand and you end up with two tables of addresses that
drift apart silently, and the failure when they do looks like a networking problem rather
than a config one.

What is worth looking at:

- **envy has no opinion about services.** There is no service registry here: the addresses
  are a plain object with a `host` and an `internal` field, declared once at the top of the
  script. You can see both sides next to each other, in the file that writes them.
- **A profile is a variable.** `PORT_OFFSET=100 pnpm example:addresses` moves the host side
  out of the way of a stack that is already running:

  ```bash
  PORT_OFFSET=100 pnpm example:addresses
  ```

  The container side does not move, because inside the network nothing collided in the
  first place. No profile system, no inheritance, no merging: one number.
- **The seal key is only in `backend/.env`.** The backend is the only thing that needs it,
  and the file the host reads never gets it.
