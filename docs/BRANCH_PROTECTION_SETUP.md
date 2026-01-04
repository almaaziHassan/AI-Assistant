# Branch Protection Setup (Local Enforcement)

## ⚠️ Constraint: Private Repository Limits
GitHub Branch Protection rules are **not available** for private repositories on free accounts. 

**Solution:** We have implemented **Local Branch Protection** using **Husky**.

## 🛡️ How It Works

We installed a git hook that runs every time you try to commit:
- **Location:** `.husky/pre-commit`
- **Logic:** Checks the current branch name.
- **Action:** If the branch is `main`, the commit is BLOCKED.

## ✅ Verification

Try to commit directly to main (this should FAIL):

```bash
git checkout main
echo "test" >> README.md
git add README.md
git commit -m "test protection"
# Output:
# � Error: Direct commits to 'main' are disabled.
# Please create a feature branch...
```

To work correctly, use feature branches:

```bash
git checkout -b feature/my-new-feature
git add README.md
git commit -m "feat: Add new feature"
# ✅ Success!
```

## 📋 Collaborative Rules

Since we can't enforce this on the server:
1. **Communicated Rule:** "Never force push to main."
2. **Pull Requests:** Still create Pull Requests for code review.
3. **CI/CD:** The GitHub Actions we set up will still run on every push and PR.

## ⚡ Setup for New Developers

When a new developer clones the repo, they just run:
```bash
npm install
```
The `prepare` script in `package.json` will automatically set up Husky protection for them.
