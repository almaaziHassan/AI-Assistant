# Branch Protection Setup Guide

## ⚠️ IMPORTANT: Enable Branch Protection

To maintain code quality and prevent broken builds, you MUST enable branch protection on GitHub.

## 📋 Step-by-Step Instructions

### 1. Go to Repository Settings

1. Navigate to your GitHub repository
2. Click on **Settings** (top right)
3. Click on **Branches** (left sidebar)

### 2. Add Branch Protection Rule

1. Click **Add rule** or **Add branch protection rule**
2. In "Branch name pattern", enter: `main`

### 3. Configure Protection Rules

Check the following boxes:

#### ✅ Required Settings:

- [x] **Require a pull request before merging**
  - [x] Require approvals: **1**
  - [x] Dismiss stale pull request approvals when new commits are pushed
  - [x] Require review from Code Owners (optional)

- [x] **Require status checks to pass before merging**
  - [x] Require branches to be up to date before merging
  - Add required status checks:
    - `Backend Tests`
    - `Frontend Tests`
    - `Code Quality Checks`

- [x] **Require conversation resolution before merging**

- [x] **Require signed commits** (optional but recommended)

- [x] **Require linear history** (recommended)

- [x] **Include administrators**
  - ⚠️ Important: Rules apply to everyone, including admins

#### ❌ Disabled Settings:

- [ ] **Allow force pushes** - KEEP THIS DISABLED
- [ ] **Allow deletions** - KEEP THIS DISABLED

### 4. Save Changes

Click **Create** or **Save changes** at the bottom

## ✅ Verification

After enabling protection, test it:

```bash
# This should now FAIL:
git checkout main
echo "test" >> README.md
git add README.md
git commit -m "test"
git push origin main
# Error: Protected branch - requires pull request

# This is the CORRECT way:
git checkout -b test/branch-protection
git push -u origin test/branch-protection
# Then create a PR on GitHub
```

## 📊 Expected Workflow After Protection

### Before (Unprotected):
```
Developer → Commit → Push to Main ❌ (No checks!)
```

### After (Protected):
```
Developer
  ↓
Create Branch
  ↓
Commit & Push
  ↓
Create Pull Request
  ↓
CI Runs ✅
  ↓
Code Review ✅
  ↓
Merge to Main ✅
```

## 🎯 Benefits

With branch protection enabled:

- ✅ No broken code in production
- ✅ All code is reviewed
- ✅ All tests pass before merge
- ✅ Prevents accidental force pushes
- ✅ Maintains clean git history
- ✅ Enforces team collaboration

## 🔧 Troubleshooting

### "I can't push to main!"
**Good!** This is expected. Create a feature branch instead:
```bash
git checkout -b feature/my-feature
git push -u origin feature/my-feature
```

### "CI checks are failing!"
Check the Actions tab on GitHub to see what failed.
Fix the issues and push again.

### "I need emergency access!"
Temporarily disable protection (not recommended), or
have another admin review and merge your emergency fix PR.

## 📝 Additional Resources

- [GitHub Branch Protection Docs](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/defining-the-mergeability-of-pull-requests/about-protected-branches)
- [Status Checks](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/collaborating-on-repositories-with-code-quality-features/about-status-checks)

## ⚡ Quick Setup Checklist

- [ ] Navigate to Settings → Branches
- [ ] Add rule for `main` branch
- [ ] Require pull request reviews (min 1 approval)
- [ ] Require status checks to pass
- [ ] Include administrators
- [ ] Disable force pushes
- [ ] Disable deletions
- [ ] Save changes
- [ ] Test by trying to push to main (should fail)
- [ ] Test by creating a PR (should work)

---

**Once enabled, your main branch is protected!** 🛡️

All code changes must go through pull requests with:
1. ✅ Passing CI checks
2. ✅ Code review approval
3. ✅ Up-to-date with main
