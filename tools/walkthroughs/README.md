# Walkthroughs recorder

Records the walkthroughs on the site (`public/assets/walkthroughs-data.js`) from the real
`gitmaster` binary: nothing on those screens is drawn by hand.

Each scenario builds demo repositories from scratch (`setup.sh`), drives `gitmaster tui` or a
shell inside tmux with real key presses, and captures the pane after each step
(`tmux capture-pane -e`). `ansi.py` turns the captured ANSI into HTML spans whose colors the
site themes. The agent steps call the real MCP server (`gitmaster mcp`) the way Claude Code
does, and the agent thread comes from Claude Code hook events replayed into
`gitmaster thread hook` (`session.py`, `fees-session.json`).

```sh
# needs tmux, git, python3 and a gitmaster build with the preview features
export GITMASTER_BIN_DIR=~/src/git-master/target/debug
python3 tools/walkthroughs/record.py public/assets/walkthroughs-data.js -v
```

- The demo home defaults to `/home/ana`, so the paths on screen read like a real machine. Set
  `DEMO_HOME` to use another folder. The script deletes and recreates it, and refuses a folder
  it did not create.
- `-v` prints every captured screen as plain text, to check the steps.
- The TUI draws Nerd Font icons; `ansi.py` maps them to plain characters so the site needs no
  icon font.
- Navigation uses the TUI's own search (`/`) where it can, so small layout changes do not
  break a recording. Re-record after a release that changes the screens, and read the `-v`
  output before committing.
