## The Strategy: Be Truly Dual-Home, Not Just Mirroring

A **passive push mirror** won't cut it — you're right. But you don't have to fully abandon GitLab either. Here's what I'd recommend:

### Recommended Approach: **"GitLab-first, GitHub-active"**

| Aspect | GitLab (Primary) | GitHub (Active Secondary) |
|---|---|---|
| **Code & commits** | Main development, CI/CD | `git push --mirror` from GitLab |
| **Issues** | Primary issue tracker | **Enable GitHub Issues** on the mirror (redirect or accept both) |
| **PRs / MRs** | Merge requests as primary | **Accept PRs** — merge them and push back to GitLab |
| **Discussions** | Optional | **Enable GitHub Discussions** — this is where community grows |
| **CI** | GitLab CI | Set up **GitHub Actions** on the mirror too (parallel CI) |
| **Sponsorship** | (optional) | **Enable Sponsors button**, link to your Sponsors profile |
| **Releases** | Created on GitLab | Push tags to GitHub, create GitHub Releases |
| **README** | Links to GitHub mirror | Links back: "Primary development on GitLab" |

### How to set this up practically:

1. **GitLab → GitHub push mirror** (built-in GitLab feature, Settings > Repository > Mirroring). This syncs code + tags automatically.

2. **On GitHub, enable Issues + Discussions** (don't disable them). Yes, you'll have two issue trackers. Many successful projects do this — treat GitHub issues as a community entry point, and sync/respond. You can even auto-close GitHub issues with a note pointing to GitLab if you want.

3. **Set up GitHub Actions CI** on the mirror. It's free for public repos. This makes the GitHub repo feel "alive" — green checkmarks on commits, active status.

4. **Add `FUNDING.yml`** in `.github/` on the default branch pointing to your GitHub Sponsors profile. Add sponsor buttons.

5. **Point your domain / docs to both platforms** — have a "Community" page that lists both homes.

6. **Be transparent**: In your README say:
   > *"Primary development happens on GitLab. We mirror to GitHub for visibility and accept PRs there too. Sponsorships help sustain this project — consider sponsoring via GitHub Sponsors!"*

