# GitMaster website

Product site for [gitmaster.dev](https://gitmaster.dev). Static HTML, CSS and JS in `public/`. No build step.

```sh
cd public && python3 -m http.server   # preview
```

Deployed to Cloudflare (Workers static assets) by `.github/workflows/deploy.yml` on every push to `main`. `install.sh` is copied in at deploy time from the latest `git-master` release. The docs live in `git-master` and deploy to docs.gitmaster.dev.
