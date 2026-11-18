# Hairlux Agent Portal

The website for Hairlux field sales and booking agents (planned address: `agent.hairlux.com.ng`). Agents use it to:

- apply and verify their email;
- wait for approval, then accept the agent terms;
- share their code, link or QR code;
- log leads and daily activity;
- follow their targets, results and customers;
- withdraw from their wallet to their bank account.

It is a static site with no build step and no framework, in the same style as the vendor site. Every page talks to the Hairlux API (`/auth/*`, `/agent/*`, `/public/agents/*`). The admin side is the **Field Agents** section of the admin site.

## Setup

1. In `assets/js/config.js`, set `API_BASE` to the API this copy should use: dev, staging or live.
2. Host the folder as it is, for example on Netlify, Vercel or S3 with CloudFront.
3. On the API, set `AGENT_URL` to this site's address. Agent emails and password-reset links use it.
4. On the API, `FRONTEND_URL` is the customer website. Agent links point to its `sign-up.html?ref=CODE`, which fills in the agent's code.

## Pages

| Page | What it does |
|---|---|
| `index.html` | Landing page with the current earning rules |
| `sign-up.html`, `verify-email.html` | Apply and verify the email |
| `log-in.html`, `forgot-password.html`, `reset-password.html` | Sign in and reset a password |
| `status.html` | Application under review, not approved or suspended; accept the agent terms (also when they change) |
| `dashboard.html` | Today against the targets, what today will earn, this week and month, bonus progress, wallet, quick activity log |
| `leads.html` | Leads the agent spoke to |
| `customers.html` | Customers credited to the agent, and whether their paid booking has counted |
| `results.html` | Results day by day, for a day, week or month |
| `wallet.html` | Balance, withdrawals and wallet history |
| `refer.html` | Agent ID, code, link and QR code |
| `profile.html` | Photo, details, bank account, terms |
| `notifications.html` | Messages from Hairlux |

Account pages work while the application is under review. Work pages send anyone who is not an active agent with the current terms accepted to `status.html`.
