import { afterEach, describe, expect, it } from "vitest";
import { ask, hintFor, type Question } from "~/ask";
import { typing } from "./helpers/input";
import { capture, setEnv } from "./helpers/output";

const undo: Array<() => void> = [];

afterEach(() => {
  while (undo.length > 0) undo.pop()?.();
});

function plain(): void {
  undo.push(setEnv("NO_COLOR", "1"));
}

const stripeKey: Question = {
  section: "stripe",
  title: "Stripe",
  note: "Test mode only.",
  key: "secretKey",
  spec: {
    describe: "Server side key.",
    where: "dashboard.stripe.com/test/apikeys",
    example: "sk_test_",
    required: true,
  },
};

describe("hintFor", () => {
  it("should show a short value as it is", () => {
    expect(hintFor("abc")).toBe("abc");
  });

  it("should cut a long value down", () => {
    expect(hintFor("sk_test_abcdefghijklmnop")).toBe("sk_test_a...");
  });

  it("should never show more than enough to recognise which value it is", () => {
    expect(hintFor("x".repeat(500))).toHaveLength(12);
  });

  it("should show a value at the boundary whole", () => {
    expect(hintFor("123456789012")).toBe("123456789012");
  });
});

describe("ask", () => {
  it("should keep what was typed, under the file spelling", async () => {
    plain();

    let answers = {};

    await capture(async () => {
      answers = await ask([stripeKey], typing("sk_test_abc"));
    });

    expect(answers).toEqual({ stripe: { "secret-key": "sk_test_abc" } });
  });

  it("should trim what was typed", async () => {
    plain();

    let answers = {};

    await capture(async () => {
      answers = await ask([stripeKey], typing("  sk_test_abc  "));
    });

    expect(answers).toEqual({ stripe: { "secret-key": "sk_test_abc" } });
  });

  it("should keep the current value when the answer is empty", async () => {
    plain();

    let answers = {};

    await capture(async () => {
      answers = await ask([{ ...stripeKey, current: "sk_test_kept" }], typing(""));
    });

    expect(answers).toEqual({ stripe: { "secret-key": "sk_test_kept" } });
  });

  it("should take an empty answer as an answer when there is nothing to keep", async () => {
    plain();

    let answers = {};

    await capture(async () => {
      answers = await ask([stripeKey], typing(""));
    });

    expect(answers).toEqual({ stripe: { "secret-key": "" } });
  });

  it("should print the section title and note once", async () => {
    plain();

    const printed = await capture(() =>
      ask([stripeKey, { ...stripeKey, key: "webhookSecret", spec: {} }], typing("a", "b")),
    );

    expect(printed.split("Stripe")).toHaveLength(2);
    expect(printed).toContain("Test mode only.");
  });

  it("should print a heading again for a different section", async () => {
    plain();

    const printed = await capture(() =>
      ask([stripeKey, { section: "client", key: "clientId", spec: {} }], typing("a", "b")),
    );

    expect(printed).toContain("Stripe");
    expect(printed).toContain("client");
  });

  it("should print what the value is for and where to get it", async () => {
    plain();

    const printed = await capture(() => ask([stripeKey], typing("a")));

    expect(printed).toContain("Server side key.");
    expect(printed).toContain("dashboard.stripe.com/test/apikeys");
  });

  it("should show the example beside a value nobody has answered", async () => {
    plain();

    const printed = await capture(() => ask([stripeKey], typing("a")));

    expect(printed).toContain("(sk_test_)");
  });

  it("should show a truncated hint beside a value that already has one", async () => {
    plain();

    const printed = await capture(() =>
      ask([{ ...stripeKey, current: "sk_test_abcdefghijk" }], typing("")),
    );

    expect(printed).toContain("[sk_test_a...]");
    expect(printed).not.toContain("sk_test_abcdefghijk");
  });

  it("should say what is lost by skipping an optional value", async () => {
    plain();

    const printed = await capture(() =>
      ask(
        [{ section: "stripe", key: "webhookSecret", spec: { without: "webhooks stay off" } }],
        typing(""),
      ),
    );

    expect(printed).toContain("Empty and webhooks stay off.");
  });

  it("should not offer to skip a required value", async () => {
    plain();

    const printed = await capture(() =>
      ask([{ ...stripeKey, spec: { ...stripeKey.spec, without: "nothing works" } }], typing("a")),
    );

    expect(printed).not.toContain("Empty and nothing works.");
  });

  it("should not echo a secret as it is typed", async () => {
    plain();

    const printed = await capture(() =>
      ask(
        [{ section: "stripe", key: "secretKey", spec: { secret: true } }],
        typing("sk_test_do_not_print_me"),
      ),
    );

    expect(printed).not.toContain("sk_test_do_not_print_me");
  });

  it("should still keep a secret that was typed", async () => {
    plain();

    let answers = {};

    await capture(async () => {
      answers = await ask(
        [{ section: "stripe", key: "secretKey", spec: { secret: true } }],
        typing("sk_test_abc"),
      );
    });

    expect(answers).toEqual({ stripe: { "secret-key": "sk_test_abc" } });
  });

  it("should ask for several values in one section", async () => {
    plain();

    let answers = {};

    await capture(async () => {
      answers = await ask(
        [stripeKey, { section: "stripe", key: "webhookSecret", spec: {} }],
        typing("a", "b"),
      );
    });

    expect(answers).toEqual({ stripe: { "secret-key": "a", "webhook-secret": "b" } });
  });
});
