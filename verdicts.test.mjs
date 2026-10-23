// What each answer means for the sign-in. magpie rests an account on a 401
// that says nothing, so every path that answers one has to say whether the
// sign-in is what was refused. On 2026-10-23 the front door answered ten
// empty-bodied 401s in six seconds across five accounts and then served the
// same conversation again — nothing about those accounts had ended.
import { test, expect, afterAll, beforeAll, afterEach } from "bun:test"
import { homedir, tmpdir } from "node:os"
import { realpathSync } from "node:fs"

let _internal
beforeAll(async () => {
  if (![tmpdir(), realpathSync(tmpdir())].some((t) => homedir().startsWith(t))) throw new Error("run with HOME=$(mktemp -d) bun test")
  ;({ _internal } = await import("./index.mjs"))
})
const real = globalThis.fetch
afterAll(() => (globalThis.fetch = real))
afterEach(() => {
  globalThis.fetch = real
  _internal.renewing.clear()
  _internal.renewed.clear()
})

const site = { name: "WorkBuddy", id: "workbuddy" }

// an account whose tokens are all still good
const live = () => ({
  type: "oauth",
  access: "a-live",
  refresh: "r-live",
  expires: Date.now() + 3600e3,
  refreshExpiresAt: Date.now() + 86400e3,
})

// ---- explained: every refusal carries a verdict ----------------------------

test("a 401 with no body still says the sign-in was not what was refused", async () => {
  // the reporter's literal bytes: a 401, no body, from the front door
  const res = new Response("", { status: 401, statusText: "Unauthorized", headers: { "content-type": "application/json" } })
  const out = await _internal.explained(res)
  expect(out.status).toBe(401)
  // "kept": the account is not rested over a refusal it can't explain
  expect(out.headers.get("X-Magpie-Sign-In")).toBe("kept")
  // and the body says something, so magpie has a reason to show instead of
  // a bare "401 Unauthorized" (provider.apiError falls back on an empty body)
  const body = await out.text()
  expect(body.length).toBeGreaterThan(0)
  const err = JSON.parse(body).error
  expect(err.message).toMatch(/401/)
  expect(err.message).toMatch(/again/i)
})

test("a 401 that carries the vendor's words keeps them as they are", async () => {
  const said = JSON.stringify({ code: 40001, msg: "the token is not valid" })
  const res = new Response(said, { status: 401, statusText: "Unauthorized", headers: { "content-type": "application/json" } })
  const out = await _internal.explained(res)
  expect(out.headers.get("X-Magpie-Sign-In")).toBe("kept")
  expect(await out.text()).toBe(said)
})

test("a refusal magpie names keeps a kept verdict, as it always did", async () => {
  const res = new Response(
    JSON.stringify({ error: { message: "unapproved channel", code: 14017 } }),
    { status: 400, headers: { "content-type": "application/json" } },
  )
  const out = await _internal.explained(res)
  expect(out.headers.get("X-Magpie-Sign-In")).toBe("kept")
})

// ---- fresh / refreshed: a sign-in that has ended says so -------------------

test("an account whose refresh token ended and access token is stale says expired", async () => {
  const dead = { ...live(), expires: Date.now() - 1000, refreshExpiresAt: Date.now() - 1000 }
  let err
  try {
    await _internal.fresh(site, null, dead)
  } catch (e) {
    err = e
  }
  expect(err).toBeDefined()
  // without this magpie learns nothing and asks again on every request
  expect(err.signIn).toBe("expired")
})

test("an account whose tokens are still good is given back as it is", async () => {
  const a = live()
  expect(await _internal.fresh(site, null, a)).toBe(a)
})

// ---- every refusal path carries a verdict ----------------------------------

test("no path answers a 4xx or 5xx without saying what it means", async () => {
  const cases = [
    ["401 empty", new Response("", { status: 401, headers: { "content-type": "application/json" } })],
    ["401 with words", new Response(JSON.stringify({ msg: "nope" }), { status: 401, headers: { "content-type": "application/json" } })],
    ["429", new Response(JSON.stringify({ error: { message: "slow down" } }), { status: 429, headers: { "content-type": "application/json" } })],
    ["500 empty", new Response("", { status: 500, headers: { "content-type": "application/json" } })],
  ]
  for (const [what, res] of cases) {
    const out = await _internal.explained(res)
    expect([what, out.headers.get("X-Magpie-Sign-In")]).toEqual([what, "kept"])
  }
})
