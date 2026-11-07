# Contributing to H1N1 · Infection Journey

Thanks for helping make this educational atlas clearer, faster and more accessible. The active app is in `apps/simulator`; the Next.js site, API and data packages are retained as historical source.

## Before you start

- For a small fix, open a pull request with a short description of the problem and the change.
- For a new feature, anatomical asset or change to the simulation rules, open an issue first so we can agree on scope, source material and how to validate it.
- Use an issue or pull request for project discussion. Do not include personal health information or make claims about a real person's symptoms or prognosis.

## Set up locally

Use Node.js 22 or newer and pnpm 12.6.0:

```sh
pnpm install
pnpm dev
```

Open `http://127.0.0.1:3000`. The root commands target the active simulator.

## Make a focused change

1. Branch from the current `main` and keep the pull request focused on one issue.
2. Keep simulation rules in `apps/simulator/src/engine`, rendering in `src/graphics` or `src/atlas`, and controls in React components. The five scales must share one simulated clock.
3. Preserve deterministic replay: use the seeded model, fixed one-hour steps and bounded populations. Events must change model parameters and leave an explanation in the log. Do not tie stages or symptoms to hard-coded day numbers.
4. Keep visible copy and accessible labels in English and Portuguese. English is the fallback; Portuguese follows a Portuguese primary browser language. Check both with `?lang=en` and `?lang=pt`.
5. Treat the scene as an educational illustration. Model indices and possible symptoms are not clinical measurements or individual predictions.
6. Include source, author, license and adaptation details for any new 3D asset or data. Do not add assets whose redistribution terms are unclear. Keep the existing Human Atlas, BodyParts3D and Human Reference Atlas notices.

## Check your work

```sh
pnpm typecheck
pnpm test
pnpm build
```

For visible changes, describe what you checked at desktop and mobile widths, including keyboard access and the relevant 3D scale. Add a screenshot or short recording when it helps reviewers understand the result. A failing check needs an explanation in the pull request.

## Pull request checklist

- [ ] The change has a clear purpose and a concise description.
- [ ] English and Portuguese copy and accessible labels were reviewed.
- [ ] Simulation changes retain deterministic replay and are covered by meaningful tests.
- [ ] New assets include compatible licenses and attribution.
- [ ] `pnpm typecheck`, `pnpm test` and `pnpm build` pass.

By submitting a contribution, you agree that your original contribution is available under this repository's [MIT License](LICENSE). Third-party assets keep their own terms, listed in [Anatomy assets](docs/ANATOMY_ASSETS.md) and the [model credits](apps/simulator/public/models/ATTRIBUTION.md). No contributor license agreement is required.
