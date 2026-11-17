"""Simulate one Claude Code session in a repo: transcript JSONL + hook events into `gitmaster thread hook`."""
import json, os, subprocess, sys, uuid, datetime
repo, spec = sys.argv[1], json.load(open(sys.argv[2]))
sid = spec["session"]; home = os.environ["HOME"]
tp = f"{home}/.claude/projects/{repo.replace('/', '-')}/{sid}.jsonl"
os.makedirs(os.path.dirname(tp), exist_ok=True)
t0 = datetime.datetime.fromisoformat(spec["start"]); n = [0]
def ts():
    n[0] += 1; return (t0 + datetime.timedelta(seconds=7 * n[0])).strftime("%Y-%m-%dT%H:%M:%S.000Z")
def rec(kind, content):
    n_ = str(uuid.uuid4())
    line = {"type": kind, "uuid": n_, "sessionId": sid, "timestamp": ts(), "isSidechain": False, "cwd": repo,
            "message": {"role": kind, "content": content, **({"model": spec["model"]} if kind == "assistant" else {})}}
    with open(tp, "a") as f: f.write(json.dumps(line) + "\n")
def hook(ev, **kw):
    p = {"session_id": sid, "transcript_path": tp, "cwd": repo, "hook_event_name": ev, **kw}
    subprocess.run(["gitmaster", "thread", "hook", "--harness", "claude-code"], input=json.dumps(p).encode(), cwd=repo, check=True)
hook("SessionStart", source="startup", model=spec["model"])
for step in spec["steps"]:
    k = step[0]
    if k == "user": rec("user", step[1])
    elif k == "say": rec("assistant", [{"type": "text", "text": step[1]}])
    elif k == "edit":
        _, rel, old, new, note = step; path = f"{repo}/{rel}"; tid = "toolu_" + uuid.uuid4().hex[:20]
        inp = {"file_path": path, "old_string": old, "new_string": new}
        rec("assistant", [{"type": "text", "text": note}, {"type": "tool_use", "id": tid, "name": "Edit", "input": inp}])
        hook("PreToolUse", tool_name="Edit", tool_input=inp, tool_use_id=tid)
        s = open(path).read(); assert old in s, (rel, old); open(path, "w").write(s.replace(old, new, 1))
        hook("PostToolUse", tool_name="Edit", tool_input=inp, tool_response={"filePath": path, "success": True}, tool_use_id=tid)
        rec("user", [{"type": "tool_result", "tool_use_id": tid, "content": f"The file {path} has been updated.", "is_error": False}])
    elif k == "bash":
        _, cmd, out = step; tid = "toolu_" + uuid.uuid4().hex[:20]; inp = {"command": cmd}
        rec("assistant", [{"type": "tool_use", "id": tid, "name": "Bash", "input": inp}])
        hook("PreToolUse", tool_name="Bash", tool_input=inp, tool_use_id=tid)
        hook("PostToolUse", tool_name="Bash", tool_input=inp, tool_response={"stdout": out, "stderr": ""}, tool_use_id=tid)
        rec("user", [{"type": "tool_result", "tool_use_id": tid, "content": out, "is_error": False}])
    elif k == "stop": hook("Stop", stop_hook_active=False)
hook("SessionEnd", reason="prompt_input_exit")
