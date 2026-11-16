# Complete BirdShop palette repair

Nested public routes previously missed the editorial route marker, leaving service packages, purchase summaries and customer flows in the old forest/olive palette. The shared public header now scopes the black canvas, charcoal surfaces, ivory copy and burgundy controls across those routes, including a saved light preference. Staff light mode remains readable with a neutral ivory palette and burgundy controls.

The repair also removes legacy green CSS literals, inline staff styles and transactional email colors. Decorative forest backdrops are replaced with neutral surfaces; catalog artwork, the approved home artwork and the Santa moon/cloud layers remain intact. Existing token identifiers are retained for compatibility. No transaction, authorization or database behavior changes.

## Rendered evidence

The service screenshots use loopback-only QA fixtures with a $35 Standard package, and show the repaired package selector, detail panel and purchase summary. They contain no real orders or private customer data.

- [Desktop](service-1440-dark.png)
- [Mobile](service-390-dark.png)

## Verification

- Lint, TypeScript and production build passed.
- Rendered palette sweep: 22 public routes × two widths (390 and 1440px) × two saved themes. No green-dominant text, surfaces, borders, outlines or gradients; black body canvas; no horizontal overflow.
- Existing browser checks cover cart persistence, stock, referral sign-in and dashboards, review data and states, Santa motion, reduced motion and pause/resume.
- An initial new test selector used visible button text instead of its accessible label; the selector was corrected. All existing checks passed during that run.

Staff protected screens and transactional emails were inspected and updated in source. Actual customer sessions, real email sending and live payments were not exercised.
