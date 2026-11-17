"""Turn a `tmux capture-pane -e` dump into HTML lines: <span> runs with classes for the
16 ANSI colors (themed by the site's CSS) and the reverse-video cursor line."""
import html
import re

SGR = re.compile(r"\x1b\[([0-9;]*)m")

# Nerd Font glyphs (private use area) -> characters any monospace font has.
GLYPHS = {
    "": "⎇",  # branch
    "": "↑", "": "↓",
    "": "▸",  # folder
    "": "✉",  # threads on a file
    "": "▸",  # selected line
    "": "○",  # open thread
    "": "✓",  # handled / call done
    "": "◉",  # resolved
    "": "⚠",  # outdated
    "\U000f06a9": "✦",  # agent
    "": "✗", "": "◷",
    "": "›", "": "⌄",
}


def glyph(ch):
    if ch in GLYPHS:
        return GLYPHS[ch]
    o = ord(ch)
    if 0xE000 <= o <= 0xF8FF or 0xF0000 <= o <= 0xFFFFF:
        return "•"  # a file-type icon
    return ch


class State:
    def __init__(self):
        self.reset()

    def reset(self):
        self.fg = None
        self.bg = None
        self.bold = self.dim = self.italic = self.under = self.rev = False

    def apply(self, params):
        p = [int(x) if x else 0 for x in params.split(";")] if params else [0]
        i = 0
        while i < len(p):
            c = p[i]
            if c == 0:
                self.reset()
            elif c == 1:
                self.bold = True
            elif c == 2:
                self.dim = True
            elif c == 3:
                self.italic = True
            elif c == 4:
                self.under = True
            elif c == 7:
                self.rev = True
            elif c == 22:
                self.bold = self.dim = False
            elif c == 23:
                self.italic = False
            elif c == 24:
                self.under = False
            elif c == 27:
                self.rev = False
            elif 30 <= c <= 37:
                self.fg = c - 30
            elif 90 <= c <= 97:
                self.fg = c - 90 + 8
            elif c == 39:
                self.fg = None
            elif 40 <= c <= 47:
                self.bg = c - 40
            elif 100 <= c <= 107:
                self.bg = c - 100 + 8
            elif c == 49:
                self.bg = None
            elif c in (38, 48) and i + 1 < len(p):
                if p[i + 1] == 5 and i + 2 < len(p):
                    val = p[i + 2]
                    i += 2
                elif p[i + 1] == 2 and i + 4 < len(p):
                    val = "#%02x%02x%02x" % tuple(p[i + 2 : i + 5])
                    i += 4
                else:
                    val = None
                if c == 38:
                    self.fg = val
                else:
                    self.bg = val
            i += 1

    def classes(self):
        cls = []
        for name, v in (("f", self.fg), ("b", self.bg)):
            if isinstance(v, int) and v < 16:
                cls.append(f"{name}{v}")
        if self.bold:
            cls.append("bo")
        if self.dim:
            cls.append("dm")
        if self.italic:
            cls.append("it")
        if self.under:
            cls.append("un")
        if self.rev:
            cls.append("rv")
        return " ".join(cls)


def line_html(raw, st):
    out, pos = [], 0
    def emit(text):
        if not text:
            return
        text = "".join(glyph(c) for c in text)
        cls = st.classes()
        t = html.escape(text, quote=False)
        out.append(f'<span class="{cls}">{t}</span>' if cls else t)
    for m in SGR.finditer(raw):
        emit(raw[pos : m.start()])
        st.apply(m.group(1))
        pos = m.end()
    emit(raw[pos:])
    return "".join(out)


def screen_html(dump, rows=None):
    st = State()
    lines = dump.split("\n")
    if lines and lines[-1] == "":
        lines.pop()
    if rows:
        lines = lines[:rows]
    res = []
    for raw in lines:
        res.append(line_html(raw, st))
    return res
