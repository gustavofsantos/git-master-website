# GitMaster website

Product site for [gitmaster.dev](https://gitmaster.dev). Static HTML, CSS and JS in `public/`. No build step.

```sh
cd public && python3 -m http.server   # preview
```

Deployed to Cloudflare (Workers static assets) by `.github/workflows/deploy.yml` on every push to `main`. `install.sh` is copied in at deploy time from the latest `git-master` release. The docs live in `git-master` and deploy to docs.gitmaster.dev.

## Walkthroughs

The **Walkthroughs** section shows real screens of `gitmaster tui` and the `gitmaster` command line, step by step. They are recorded, not drawn: `tools/walkthroughs/record.py` runs each scenario on demo repositories in tmux and writes `public/assets/walkthroughs-data.js`; `public/assets/walkthroughs.js` plays them. See [`tools/walkthroughs/README.md`](tools/walkthroughs/README.md) to re-record after the app's screens change.
