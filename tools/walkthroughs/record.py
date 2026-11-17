"""Record the website walkthroughs from the real `gitmaster` binary.

Every scenario runs in tmux on demo repositories under $DEMO_HOME (default /home/ana, so the
paths on screen read like a person's machine), and each step is the pane as tmux shows it,
converted to HTML. Agent steps call the real MCP server (`gitmaster mcp`).

Usage: python3 record.py <out.js|out.json> [-v]
Needs: tmux, git, python3, and `gitmaster` on PATH (or GITMASTER_BIN_DIR).
"""
import json
import os
import shutil
import subprocess
import sys
import time

sys.path.insert(0, os.path.dirname(__file__))
import ansi  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
HOME = os.environ.get("DEMO_HOME", "/home/ana")
BIN = os.environ.get("GITMASTER_BIN_DIR") or os.path.dirname(shutil.which("gitmaster") or "")
if not os.path.isfile(os.path.join(BIN, "gitmaster")):
    raise SystemExit("gitmaster not found: put it on PATH or set GITMASTER_BIN_DIR")
ENV = dict(os.environ, HOME=HOME, PATH=f"{BIN}:/usr/local/bin:/usr/bin:/bin", COLORTERM="truecolor")
W, H = 100, 30
SHELL_W = 112
VERBOSE = "-v" in sys.argv


def sh(cmd, cwd=None, check=True):
    return subprocess.run(cmd, shell=True, cwd=cwd, env=ENV, check=check, capture_output=True, text=True).stdout


def tmux(*args):
    r = subprocess.run(["tmux", *args], capture_output=True, text=True)
    if r.returncode:
        raise SystemExit(f"tmux {args[:4]} failed: {r.stderr}")
    return r.stdout


class Pane:
    def __init__(self, cwd, cmd, width=W):
        subprocess.run(["tmux", "kill-server"], capture_output=True)
        time.sleep(0.5)
        tmux("-f", f"{HOME}/.tmux.conf", "new-session", "-d", "-s", "rec", "-x", str(width), "-y", str(H),
             "-e", f"HOME={HOME}", "-e", "COLORTERM=truecolor", "-e", f"PATH={ENV['PATH']}",
             "-e", "TERM=tmux-256color", "-c", cwd, cmd)
        time.sleep(2.5)

    def keys(self, *keys, wait=0.7):
        for k in keys:
            tmux("send-keys", "-t", "rec", k)
            time.sleep(wait)

    def type(self, text, wait=0.6):
        tmux("send-keys", "-t", "rec", "-l", text)
        time.sleep(wait)

    def find(self, text):
        self.keys("/", wait=0.3)
        self.type(text, 0.3)
        self.keys("Enter", wait=0.7)

    def run(self, command, wait=1.2):
        self.type(command, 0.2)
        self.keys("Enter", wait=wait)

    def shot(self, trim=False):
        dump = tmux("capture-pane", "-t", "rec", "-p", "-e")
        lines = ansi.screen_html(dump, H)
        if trim:
            while lines and not lines[-1].strip():
                lines.pop()
        if VERBOSE:
            print("\n".join(l.rstrip() for l in tmux("capture-pane", "-t", "rec", "-p").split("\n")).rstrip())
            print("-" * W)
        return lines


def mcp(repo, tool, args):
    """One MCP tool call, as an agent makes it, answered by `gitmaster mcp`."""
    msgs = [
        {"jsonrpc": "2.0", "id": 1, "method": "initialize", "params": {"protocolVersion": "2025-06-18", "capabilities": {}, "clientInfo": {"name": "claude-code", "version": "2"}}},
        {"jsonrpc": "2.0", "method": "notifications/initialized"},
        {"jsonrpc": "2.0", "id": 2, "method": "tools/call", "params": {"name": tool, "arguments": args}},
    ]
    out = subprocess.run(["gitmaster", "mcp", "--repo", repo], env=ENV, check=True, capture_output=True, text=True,
                         input="".join(json.dumps(m) + "\n" for m in msgs)).stdout
    answer = json.loads(out.strip().split("\n")[-1])["result"]
    return answer.get("structuredContent", answer)


def step(title, caption, screen, agent=None, kind="tui"):
    s = {"title": title, "caption": caption, "screen": screen, "kind": kind}
    if agent:
        s["agent"] = agent
    return s


# --------------------------------------------------------------------------- setup

def setup():
    subprocess.run(["tmux", "kill-server"], capture_output=True)
    sh(f"{HERE}/setup.sh {HOME}")
    with open(f"{HOME}/.tmux.conf", "w") as f:
        f.write('set -g default-terminal "tmux-256color"\nset -g status off\nset -g escape-time 0\n')
    with open(f"{HOME}/.bashrc", "w") as f:
        f.write("PS1='\\[\\e[34m\\]\\w\\[\\e[0m\\] $ '\n" + f"export HOME={HOME} PATH={ENV['PATH']}\n")
    ledger = f"{HOME}/src/ledger"
    sh("git checkout -qb agent/ledger-errors", ledger)
    sh(f"python3 {HERE}/session.py {ledger} {HERE}/fees-session.json", ledger)
    sh("git commit -qam 'Fees from config, rounded half up'", ledger)
    # What the agent changed and you have not read yet.
    path = f"{ledger}/src/ledger.rs"
    s = open(path).read()
    s = s.replace("    pub fn balance(", """    pub fn post(&mut self, entry: Entry) -> Balance {
        let acct = self.accounts.get_mut(&entry.account).unwrap();
        acct.apply(entry)
    }

    pub fn balance(""")
    open(path, "w").write(s)


# --------------------------------------------------------------------------- review loop

def review():
    repo = f"{HOME}/src/ledger"
    p = Pane(repo, f"PATH={ENV['PATH']} gitmaster tui; sleep 600")
    steps = []
    steps.append(step("Open the companion",
        "Run gitmaster tui in a pane next to your agent. Status shows what the agent changed and you have not read yet.",
        p.shot()))
    p.find("src/ledger.rs")
    p.keys("Tab")  # unfold the file
    steps.append(step("Read the change",
        "Unfold a file to read its hunks, colored by language. Tab folds and unfolds; the screen refreshes by itself while the agent works.",
        p.shot()))
    p.find("unwrap")
    p.keys("V", "Space")
    steps.append(step("Select the lines",
        "Select lines with V (or a drag) and press Space: the menu lists only what applies here, one key per action.",
        p.shot()))
    p.keys("c")
    p.type("Return an error here instead of unwrapping. A missing account must not panic.")
    steps.append(step("Comment like a reviewer",
        "c starts a review thread on the selected line. No pull request, no push, no CI: the comment stays on your machine.",
        p.shot()))
    p.keys("C-s", wait=1.2)
    steps.append(step("The agent's turn",
        "The thread sits under the line it is about, and Status lists it as waiting for the agent.",
        p.shot()))
    listed = mcp(repo, "review_comments_list", {"status": "open"})
    c = listed["comments"][0]
    steps.append(step("The agent reads your comment",
        "Your agent calls the MCP tool review_comments_list and gets the comment as data, anchored to the exact line.",
        p.shot(),
        agent={"call": 'review_comments_list(status="open")',
               "result": {"comments": [{k: c[k] for k in ("id", "path", "start_line", "status", "label", "body")}]}}))
    # The agent edits the code with its own tools.
    path = f"{repo}/src/ledger.rs"
    s = open(path).read().replace("""    pub fn post(&mut self, entry: Entry) -> Balance {
        let acct = self.accounts.get_mut(&entry.account).unwrap();
        acct.apply(entry)
""", """    pub fn post(&mut self, entry: Entry) -> Result<Balance, LedgerError> {
        let acct = self
            .accounts
            .get_mut(&entry.account)
            .ok_or(LedgerError::NoAccount(entry.account))?;
        Ok(acct.apply(entry))
""")
    open(path, "w").write(s)
    res = mcp(repo, "review_comment_resolve", {"id": c["id"], "summary": "post now returns Result<Balance, LedgerError>; a missing account is LedgerError::NoAccount instead of a panic."})
    time.sleep(1.5)
    steps.append(step("The agent fixes and answers",
        "It edits the code and calls review_comment_resolve. The companion refreshes on its own: the thread is back with you.",
        p.shot(),
        agent={"call": 'review_comment_resolve(id=1, summary="post now returns Result…")',
               "result": {"id": res["id"], "status": res["status"],
                          "change": {"changed": res["change"]["changed"], "before": res["change"]["before"],
                                     "after": res["change"]["after"][:2] + ["…"]}}}))
    p.find("Fees from config")  # the thread row is two rows above the commit
    p.keys("k", "k")
    p.keys("Enter", wait=1.2)
    steps.append(step("Observed, not self-reported",
        "Open the thread: GitMaster shows the lines Before you commented and After the agent answered, measured from its own snapshots, not from the agent's summary.",
        p.shot()))
    p.keys("Space", "R", wait=1.0)
    steps.append(step("You resolve",
        "Happy with it? Space R resolves the thread. Not happy? Reply and it goes back to the agent. You stay the one who approves.",
        p.shot()))
    p.keys("q", wait=1.0)
    p.find("src/ledger.rs")
    p.keys("Space", "S", wait=1.0)
    p.keys("Space", "C", wait=1.0)
    p.type("Return an error when posting to a missing account")
    steps.append(step("Commit what you accept",
        "Stage at the size you choose (file, hunk or line) and commit from the same pane with Space C.",
        p.shot()))
    p.keys("C-s", wait=1.5)
    steps.append(step("Done",
        "Committed. Nothing was pushed, nothing left your machine, and the conversation with the agent stays attached to the code.",
        p.shot()))
    return {"id": "review", "kicker": "Local code review", "title": "Review your agent's code before it ships",
            "summary": "Comment on the lines an agent wrote, let it fix them over MCP, and check what really changed.",
            "steps": steps}


# --------------------------------------------------------------------------- why

def why():
    repo = f"{HOME}/src/ledger"
    p = Pane(repo, f"PATH={ENV['PATH']} gitmaster tui; sleep 600")
    steps = []
    p.find("Fees from config")
    steps.append(step("A line you did not write",
        "Weeks later, a reviewer asks why fees round half up. The commit is on the branch, but the reasoning was in an agent session.",
        p.shot()))
    p.keys("Enter", wait=1.2)
    p.find("rate_bps")
    steps.append(step("Open the commit",
        "Enter opens the commit on the Diff screen. Put the cursor on the line you are curious about.",
        p.shot()))
    p.keys("Space", "w", wait=1.5)
    steps.append(step("Ask where it came from",
        "Space w opens Origin: the commit that wrote the line, the Claude Code session behind it, and the edit that matches, with how strongly each is tied to the code.",
        p.shot()))
    p.find("claude-code")
    p.keys("Enter", wait=1.5)
    p.keys("z", "R", wait=1.0)
    steps.append(step("Read the session",
        "Enter opens the agent thread: the request, the decisions, every change with its patch, and the commands it ran.",
        p.shot()))
    found = mcp(repo, "threads_search", {"query": "truncation rounding"})
    hit = found["hits"][0] if found.get("hits") else {}
    p.keys("q", wait=0.8)
    steps.append(step("Your agent can ask too",
        "Threads are searchable over MCP. Before touching this code again, an agent calls threads_search and finds the earlier decision instead of undoing it.",
        p.shot(),
        agent={"call": 'threads_search(query="truncation rounding")',
               "result": {"hits": [{k: (hit[k].replace("\ue000", "[").replace("\ue001", "]") if k == "snippet" else hit[k]) for k in ("title", "turn", "snippet") if k in hit}]}}))
    return {"id": "why", "kicker": "Agent threads", "title": "Find out why a line is the way it is",
            "summary": "Every Claude Code session is recorded in .git, linked to the code it wrote, and searchable by you and your agent.",
            "steps": steps}


# --------------------------------------------------------------------------- workspaces

def workspaces():
    p = Pane(HOME, width=SHELL_W, cmd=f"bash --noprofile --rcfile {HOME}/.bashrc")
    p.run("clear")
    steps = []
    p.run("ls ~/src")
    p.run("ls -d ~/src/{checkout-api,payments,storefront} \\", wait=0.3)
    p.run("  | gitmaster workspace create checkout-v2 --branch feat/checkout-v2 --repos-from -", wait=2.5)
    steps.append(step("One change, three services",
        "Checkout v2 touches the API, payments and the storefront. One command makes a workspace with a feat/checkout-v2 branch in each, created where it does not exist yet.",
        p.shot(True), kind="shell"))
    p.run("clear")
    p.run("cd ~/workspaces/checkout-v2 && ls && gitmaster workspace status")
    steps.append(step("A workspace is a Git repository",
        "Each member is a submodule that is a worktree of the clone you already have. Nothing is cloned again, and a commit here is on the branch in your clone at once.",
        p.shot(True), kind="shell"))
    # The agent works across two services.
    ws = f"{HOME}/workspaces/checkout-v2"
    with open(f"{ws}/payments/src/capture.rs", "w") as f:
        f.write("pub fn capture(amount: i64, idempotency_key: &str) -> i64 {\n    amount\n}\n")
    with open(f"{ws}/checkout-api/src/routes.rs", "a") as f:
        f.write("\npub fn route_v2() -> &'static str {\n    \"/v2/checkout\"\n}\n")
    sh("git commit -qam 'Add the v2 checkout route'", f"{ws}/checkout-api")
    status = mcp(ws, "workspace_status", {})
    p.run("clear")
    p.run("gitmaster workspace status")
    members = status.get("members", status)
    steps.append(step("Your agent sees the whole system",
        "Run the agent at the workspace root. It edits several services at once, and both of you see where each one stands.",
        p.shot(True), kind="shell",
        agent={"call": "workspace_status()", "result": {"members": [
            {k: m.get(k) for k in ("member", "branch", "modified", "new_commits")} for m in members]} if isinstance(members, list) else status}))
    sh("git commit -qam 'Capture with an idempotency key'", f"{ws}/payments")
    p.run("clear")
    p.run("git status --short")
    p.run("git commit -qam 'checkout-v2: v2 route + idempotent capture' && git log --oneline", wait=1.5)
    steps.append(step("Record a combination that works",
        "Once the services work together, commit in the workspace. It records the exact commit of each member, so you can come back to a combination that worked.",
        p.shot(True), kind="shell"))
    p.run("clear")
    p.run("git -C ~/src/payments worktree list")
    p.run("gitmaster workspace list --format tsv")
    steps.append(step("Your clones stay yours",
        "Each member is a plain linked worktree of your clone. GitMaster writes nothing into your service repositories, and removing a workspace keeps every branch.",
        p.shot(True), kind="shell"))
    return {"id": "workspaces", "kicker": "Workspaces", "title": "Change several repositories as one",
            "summary": "Group a branch of each service into one workspace, for you and your agent, without cloning anything again.",
            "steps": steps}


# --------------------------------------------------------------------------- worktrees

def worktrees():
    p = Pane(f"{HOME}/src/ledger", width=SHELL_W, cmd=f"bash --noprofile --rcfile {HOME}/.bashrc")
    p.run("clear")
    steps = []
    p.run("gitmaster worktree add agent/fix-rounding", wait=1.5)
    p.run("gitmaster worktree add agent/docs-fees", wait=1.5)
    steps.append(step("A checkout per agent",
        "Give each agent its own branch in its own folder. worktree add creates the branch when needed and prints the path, ready for a script or a key binding.",
        p.shot(True), kind="shell"))
    p.run("gitmaster worktree list --format tsv")
    steps.append(step("See them all",
        "list prints one line per worktree, the main checkout first, as paths, branches, TSV or JSON.",
        p.shot(True), kind="shell"))
    p.run("clear")
    p.run('cd "$(gitmaster worktree path agent/fix-rounding)" && git status -sb')
    steps.append(step("Jump to a branch",
        "worktree path finds the folder of a branch, so cd, tmux or your editor can go straight there.",
        p.shot(True), kind="shell"))
    p.run("cd ~/src/ledger")
    p.run("gitmaster worktree remove agent/docs-fees", wait=1.5)
    p.run("gitmaster worktree list --format branches")
    steps.append(step("Clean up",
        "Remove a worktree when the agent is done. The branch and its commits stay.",
        p.shot(True), kind="shell"))
    return {"id": "worktrees", "kicker": "Worktrees", "title": "Run agents side by side",
            "summary": "One worktree per agent, created, listed and removed from the shell.",
            "steps": steps}


def main():
    out = sys.argv[1]
    setup()
    data = [review(), why(), workspaces(), worktrees()]
    for d, cols in zip(data, (W, W, SHELL_W, SHELL_W)):
        d["cols"] = cols
    subprocess.run(["tmux", "kill-server"], capture_output=True)
    payload = {"version": sh("gitmaster --version").split("\n")[0], "walkthroughs": data}
    text = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
    with open(out, "w") as f:
        if out.endswith(".js"):
            f.write("/* Generated by tools/walkthroughs/record.py from the real gitmaster binary. Do not edit. */\n")
            f.write(f"window.GM_WALKTHROUGHS = {text};\n")
        else:
            f.write(text)
    print("wrote", out)


if __name__ == "__main__":
    main()
