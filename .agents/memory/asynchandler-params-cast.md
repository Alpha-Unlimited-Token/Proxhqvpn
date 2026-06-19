---
name: asyncHandler loses Express route-param types
description: req.params values inside asyncHandler callbacks are typed as string|string[] — always cast to string explicitly.
---

## Rule

Inside `asyncHandler(async (req, res) => { ... })`, TypeScript infers `req.params` values as `string | string[]` instead of just `string`, because the `asyncHandler` utility uses the base `Request` type which loses route-specific parameter narrowing.

**Why:** `asyncHandler` is typed as `(handler: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler`. The `Request` type from `@types/express` has `params: ParamsDictionary` which is `{ [key: string]: string }`, but the TS compiler cannot narrow it to `string` only in this context without the route-level generic inference. This causes errors like: `Argument of type 'string | string[]' is not assignable to parameter of type 'string'.`

**How to apply:** Always cast route params explicitly:
```ts
const id = parseInt(req.params["id"] as string);
// or
const slug = String(req.params["slug"]);
```

This pattern applies to any route handler wrapped with `asyncHandler`. Direct `router.get()` callbacks without `asyncHandler` wrapping infer params correctly and do not need the cast.
