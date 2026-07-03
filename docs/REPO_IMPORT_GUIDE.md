# Repo Import Guide

## Option A — Push from local machine

1. Unzip the repository package.
2. Open terminal in the unzipped folder.
3. Run:

```bash
git init
git add .
git commit -m "Initial MatchPulse monorepo scaffold"
git branch -M main
git remote add origin <YOUR_GITHUB_REPO_URL>
git push -u origin main
```

## Option B — Upload through GitHub UI

1. Create an empty GitHub repo.
2. Upload the unzipped folder contents.
3. Keep the folder structure unchanged.

## First commands after clone

```bash
pnpm install
cp .env.example .env
pnpm dev
```

## Team rule

- Backend reads `docs/BACKEND_DEVELOPER_PROMPT.md` first.
- Frontend reads `docs/FRONTEND_DEVELOPER_PROMPT.md` first.
- Both follow `docs/API_CONTRACT.md`.
- No direct betting/wagering features.
