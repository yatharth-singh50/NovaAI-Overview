import customtkinter as ctk
import tkinter as tk
from tkinter import font as tkfont
import threading
import webbrowser
import re
import time

from agent import NovaAgent

# ── Appearance ──────────────────────────────────────────────────────────────
ctk.set_appearance_mode("dark")
ctk.set_default_color_theme("blue")

# ── Palette ──────────────────────────────────────────────────────────────────
# Deep neutral base inspired by premium AI products (Claude, ChatGPT Desktop)
VOID      = "#0a0a0f"   # Deepest background
ABYSS     = "#0f0f17"   # Window bg
DEPTH     = "#13131e"   # Sidebar bg
WELL      = "#17172a"   # Card / panel bg
SURFACE   = "#1e1e35"   # Input bg, raised elements
RAISED    = "#252542"   # Hover states, selected
BORDER    = "#2a2a50"   # Subtle borders
MUTED     = "#3d3d6b"   # Disabled, dividers
DIM       = "#6b6b99"   # Placeholder text, icons
SOFT      = "#9999bb"   # Secondary text
BODY      = "#c8c8e8"   # Primary body text
BRIGHT    = "#e8e8ff"   # Headings, emphasis
WHITE     = "#f0f0ff"   # Maximum contrast

# Accent system — violet / indigo inspired
ACCENT    = "#7c6af7"   # Primary CTA (purple-indigo)
ACCENT_HV = "#9580ff"   # Hover state
ACCENT_DIM= "#4a3f8f"   # Pressed / disabled accent
GLOW      = "#6655dd"   # Accent shadow / glow
NOVA_CLR  = "#a78bfa"   # Nova brand violet
NOVA_DIM  = "#7c5fc9"   # Nova secondary

# Semantic colors
LINK      = "#60a5fa"   # Hyperlinks (blue)
CODE_BG   = "#0d0d1a"   # Code block background
CODE_FG   = "#f8a966"   # Code inline text
SUCCESS   = "#6ee7b7"   # Success states
WARN      = "#fcd34d"   # Warning
ERROR     = "#f87171"   # Error

# User message colors
USER_BG   = "#1a1a3a"   # User bubble background
USER_BD   = "#2d2d5e"   # User bubble border


# ── Markdown → plain text helper ────────────────────────────────────────────
def strip_markdown_basic(text: str) -> str:
    """Strips basic markdown symbols for plain-text label display."""
    text = re.sub(r'\*\*(.*?)\*\*', r'\1', text)
    text = re.sub(r'\*(.*?)\*', r'\1', text)
    text = re.sub(r'`{3}.*?`{3}', '', text, flags=re.DOTALL)
    text = re.sub(r'`(.*?)`', r'\1', text)
    text = re.sub(r'^#{1,3}\s+', '', text, flags=re.MULTILINE)
    return text


def parse_for_links(text: str):
    """
    Parses text for markdown links [label](url).
    Returns a list of segments: each is either ('text', str) or ('link', label, url).
    """
    pattern = re.compile(r'\[([^\]]+)\]\((https?://[^\)]+)\)')
    segments = []
    last = 0
    for m in pattern.finditer(text):
        if m.start() > last:
            segments.append(('text', text[last:m.start()]))
        segments.append(('link', m.group(1), m.group(2)))
        last = m.end()
    if last < len(text):
        segments.append(('text', text[last:]))
    return segments


# ─────────────────────────────────────────────────────────────────────────────
#  Rich Text Message Card
#  A modern card that renders mixed plain-text + clickable hyperlinks inline
# ─────────────────────────────────────────────────────────────────────────────
class RichBubble(ctk.CTkFrame):
    def __init__(self, parent, sender: str, text: str, is_user: bool, **kwargs):
        bg = USER_BG if is_user else WELL
        super().__init__(parent, fg_color=bg, corner_radius=14, **kwargs)

        self.is_user = is_user
        self._full_text = text
        self._rendered_text = ""
        self._typewriter_after = None

        # ── Avatar row ────────────────────────────────────────────────────
        avatar_row = ctk.CTkFrame(self, fg_color="transparent")
        avatar_row.pack(fill="x", padx=14, pady=(12, 4))

        if is_user:
            avatar_glyph = "◉"
            avatar_bg = RAISED
            avatar_fg = SOFT
        else:
            avatar_glyph = "✦"
            avatar_bg = ACCENT_DIM
            avatar_fg = NOVA_CLR

        avatar = ctk.CTkLabel(
            avatar_row,
            text=avatar_glyph,
            font=ctk.CTkFont("Segoe UI", 12),
            text_color=avatar_fg,
            fg_color=avatar_bg,
            corner_radius=8,
            width=26,
            height=26,
        )
        avatar.pack(side="left", padx=(0, 8))

        sender_color = NOVA_CLR if not is_user else SOFT
        sender_lbl = ctk.CTkLabel(
            avatar_row,
            text=sender,
            font=ctk.CTkFont("Segoe UI", 12, weight="bold"),
            text_color=sender_color,
            anchor="w",
        )
        sender_lbl.pack(side="left")

        # ── Thin accent rule under avatar row ─────────────────────────────
        rule_color = ACCENT_DIM if not is_user else MUTED
        rule = ctk.CTkFrame(self, fg_color=rule_color, height=1)
        rule.pack(fill="x", padx=14, pady=(0, 8))

        # ── Content area — tk.Text for rich inline rendering ───────────────
        self.content_text = tk.Text(
            self,
            wrap="word",
            bg=bg,
            fg=BODY,
            font=("Segoe UI", 13),
            relief="flat",
            bd=0,
            highlightthickness=0,
            cursor="arrow",
            padx=0,
            pady=0,
            state="disabled",
            selectbackground=RAISED,
            selectforeground=BRIGHT,
            insertbackground=NOVA_CLR,
        )
        self.content_text.pack(fill="x", padx=14, pady=(0, 14))

        # ── Configure text tags ────────────────────────────────────────────
        self.content_text.tag_configure("bold",
            font=("Segoe UI", 13, "bold"), foreground=BRIGHT)
        self.content_text.tag_configure("code",
            font=("Cascadia Code", 12) if self._font_exists("Cascadia Code")
                 else ("Consolas", 12),
            background=CODE_BG, foreground=CODE_FG,
            relief="flat")
        self.content_text.tag_configure("heading1",
            font=("Segoe UI", 16, "bold"), foreground=BRIGHT,
            spacing1=6, spacing3=4)
        self.content_text.tag_configure("heading2",
            font=("Segoe UI", 14, "bold"), foreground=BRIGHT,
            spacing1=4, spacing3=3)
        self.content_text.tag_configure("heading3",
            font=("Segoe UI", 13, "bold"), foreground=NOVA_CLR,
            spacing1=3, spacing3=2)
        self.content_text.tag_configure("bullet",
            lmargin1=6, lmargin2=22, foreground=BODY)
        self.content_text.tag_configure("bullet_marker",
            foreground=NOVA_CLR, font=("Segoe UI", 11, "bold"))
        self.content_text.tag_configure("link",
            foreground=LINK, font=("Segoe UI", 13, "underline"))
        self.content_text.tag_configure("normal",
            foreground=BODY)
        self.content_text.tag_configure("cursor",
            foreground=NOVA_CLR, font=("Segoe UI", 14, "bold"))
        self.content_text.tag_configure("code_block",
            font=("Cascadia Code", 11) if self._font_exists("Cascadia Code")
                 else ("Consolas", 11),
            background=CODE_BG, foreground=BODY,
            lmargin1=12, lmargin2=12,
            spacing1=4, spacing3=4)

        self._cursor_visible = False
        self.content_text.bind("<Configure>", self._auto_resize)

        if text:
            self._render_full(text)

    @staticmethod
    def _font_exists(name: str) -> bool:
        try:
            tkfont.Font(family=name)
            return name in tkfont.families()
        except Exception:
            return False

    # ── Rendering ─────────────────────────────────────────────────────────
    def _render_full(self, text: str):
        """Renders markdown-lite formatted text into the tk.Text widget."""
        self.content_text.configure(state="normal")
        self.content_text.delete("1.0", "end")
        self._insert_formatted(text)
        self._auto_resize()
        self.content_text.configure(state="disabled")

    def _insert_formatted(self, text: str):
        """Inserts text with basic markdown formatting and link detection."""
        lines = text.split("\n")
        in_code_block = False
        code_block_lines = []

        for i, line in enumerate(lines):
            # Handle fenced code blocks
            if line.strip().startswith("```"):
                if not in_code_block:
                    in_code_block = True
                    code_block_lines = []
                    if i > 0:
                        self.content_text.insert("end", "\n")
                else:
                    in_code_block = False
                    block_text = "\n".join(code_block_lines)
                    self.content_text.insert("end", block_text, "code_block")
                    self.content_text.insert("end", "\n")
                continue

            if in_code_block:
                code_block_lines.append(line)
                continue

            if i > 0:
                self.content_text.insert("end", "\n")

            # H1
            m = re.match(r'^#\s+(.*)', line)
            if m:
                self.content_text.insert("end", m.group(1), "heading1")
                continue
            # H2
            m = re.match(r'^##\s+(.*)', line)
            if m:
                self.content_text.insert("end", m.group(1), "heading2")
                continue
            # H3
            m = re.match(r'^###\s+(.*)', line)
            if m:
                self.content_text.insert("end", m.group(1), "heading3")
                continue

            # Bullet points
            bullet_match = re.match(r'^(\s*[-•*]|\s*\d+\.)\s+(.*)', line)
            if bullet_match:
                self.content_text.insert("end", "  ›  ", "bullet_marker")
                self._insert_inline(bullet_match.group(2), indent=True)
                continue

            # Horizontal rule
            if re.match(r'^---+$', line.strip()):
                self.content_text.insert("end", "─" * 40, "bullet_marker")
                continue

            # Normal line
            self._insert_inline(line)

    def _insert_inline(self, text: str, indent: bool = False):
        """Handles inline bold, code, and markdown links within a line."""
        combined = re.compile(
            r'`([^`]+)`'
            r'|\*\*([^*]+)\*\*'
            r'|\*([^*]+)\*'
            r'|\[([^\]]+)\]\((https?://[^\)]+)\)'
        )
        last = 0
        tokens = []
        for m in combined.finditer(text):
            if m.start() > last:
                tokens.append(('normal', text[last:m.start()], None))
            if m.group(1) is not None:
                tokens.append(('code', m.group(1), None))
            elif m.group(2) is not None:
                tokens.append(('bold', m.group(2), None))
            elif m.group(3) is not None:
                tokens.append(('italic', m.group(3), None))
            elif m.group(4) is not None:
                tokens.append(('link', m.group(4), m.group(5)))
            last = m.end()
        if last < len(text):
            tokens.append(('normal', text[last:], None))

        base_tag = "bullet" if indent else "normal"

        for kind, content, url in tokens:
            if kind == 'link':
                start_idx = self.content_text.index("end-1c")
                self.content_text.insert("end", f"↗ {content}", "link")
                end_idx = self.content_text.index("end-1c")
                tag_name = f"link_{start_idx.replace('.', '_')}"
                self.content_text.tag_add(tag_name, start_idx, end_idx)
                self.content_text.tag_configure(tag_name,
                    foreground=LINK, font=("Segoe UI", 13, "underline"))
                self.content_text.tag_bind(tag_name, "<Button-1>",
                    lambda e, u=url: webbrowser.open(u))
                self.content_text.tag_bind(tag_name, "<Enter>",
                    lambda e: self.content_text.configure(cursor="hand2"))
                self.content_text.tag_bind(tag_name, "<Leave>",
                    lambda e: self.content_text.configure(cursor="arrow"))
            elif kind == 'italic':
                self.content_text.insert("end", content,
                    (base_tag, "italic") if self.content_text.tag_names().__contains__("italic")
                    else base_tag)
            else:
                tag = {'normal': base_tag, 'bold': 'bold', 'code': 'code'}.get(kind, base_tag)
                self.content_text.insert("end", content, tag)

    def _auto_resize(self, event=None):
        """Calculates exact required display lines, stripping artificial padding gaps."""
        self.content_text.update_idletasks()
        width = self.content_text.winfo_width()
        if width < 50:
            return
        display_lines = self.content_text.count("1.0", "end", "displaylines")
        lines = display_lines[0] if display_lines else int(
            self.content_text.index("end").split(".")[0])
        target_height = max(1, lines)
        if int(self.content_text.cget("height")) != target_height:
            self.content_text.configure(height=target_height)

    # ── Typewriter streaming ───────────────────────────────────────────────
    def stream_append(self, chunk: str):
        """Appends a chunk of text with typewriter effect. Call from main thread."""
        self._full_text += chunk
        self.content_text.configure(state="normal")
        try:
            self.content_text.delete("cursor_start", "cursor_end")
        except Exception:
            pass
        self.content_text.delete("1.0", "end")
        self._insert_formatted(self._full_text)
        self.content_text.mark_set("cursor_start", "end-1c")
        self.content_text.insert("end", "▋", "cursor")
        self.content_text.mark_set("cursor_end", "end-1c")
        self._auto_resize()
        self.content_text.configure(state="disabled")

    def finalize_stream(self):
        """Called when streaming is complete — removes cursor, does final render."""
        if self._typewriter_after:
            self.after_cancel(self._typewriter_after)
        self._render_full(self._full_text)


# ─────────────────────────────────────────────────────────────────────────────
#  Thinking Indicator — premium animated version
# ─────────────────────────────────────────────────────────────────────────────
class ThinkingIndicator(ctk.CTkFrame):
    def __init__(self, parent, **kwargs):
        super().__init__(parent, fg_color=WELL, corner_radius=14, **kwargs)
        self._after_id = None
        self._dot_phase = 0

        outer = ctk.CTkFrame(self, fg_color="transparent")
        outer.pack(padx=16, pady=12)

        # Nova avatar
        avatar = ctk.CTkLabel(
            outer,
            text="✦",
            font=ctk.CTkFont("Segoe UI", 12),
            text_color=NOVA_CLR,
            fg_color=ACCENT_DIM,
            corner_radius=8,
            width=26,
            height=26,
        )
        avatar.pack(side="left", padx=(0, 10))

        self.lbl = ctk.CTkLabel(
            outer,
            text="Nova",
            font=ctk.CTkFont("Segoe UI", 12, weight="bold"),
            text_color=NOVA_CLR,
        )
        self.lbl.pack(side="left", padx=(0, 8))

        # Dot container
        self.dot_frame = ctk.CTkFrame(outer, fg_color="transparent")
        self.dot_frame.pack(side="left", pady=2)

        self._dots = []
        for _ in range(3):
            d = ctk.CTkLabel(
                self.dot_frame,
                text="●",
                font=ctk.CTkFont("Segoe UI", 9),
                text_color=MUTED,
                width=10,
            )
            d.pack(side="left", padx=1)
            self._dots.append(d)

        self._animate()

    def _animate(self):
        self._dot_phase = (self._dot_phase + 1) % 6
        colors = [MUTED, MUTED, MUTED]
        active = self._dot_phase % 3
        # Wave pulse through dots
        colors[active] = NOVA_CLR
        if (self._dot_phase % 3) > 0:
            colors[(active - 1) % 3] = NOVA_DIM
        for i, d in enumerate(self._dots):
            d.configure(text_color=colors[i])
        self._after_id = self.after(280, self._animate)

    def destroy(self):
        if self._after_id:
            self.after_cancel(self._after_id)
        super().destroy()


# ─────────────────────────────────────────────────────────────────────────────
#  Sidebar Toggle Button
# ─────────────────────────────────────────────────────────────────────────────
class SidebarToggle(ctk.CTkButton):
    def __init__(self, parent, sidebar_ref, **kwargs):
        self._sidebar_ref = sidebar_ref
        self._open = True
        super().__init__(
            parent,
            text="◀",
            width=28,
            height=28,
            corner_radius=8,
            fg_color="transparent",
            hover_color=RAISED,
            text_color=DIM,
            font=ctk.CTkFont("Segoe UI", 11),
            command=self._toggle,
            **kwargs,
        )

    def _toggle(self):
        if self._open:
            self._sidebar_ref.grid_remove()
            self.configure(text="▶")
            self._open = False
        else:
            self._sidebar_ref.grid()
            self.configure(text="◀")
            self._open = True


# ─────────────────────────────────────────────────────────────────────────────
#  Main App Window
# ─────────────────────────────────────────────────────────────────────────────
class NovaApp(ctk.CTk):
    def __init__(self):
        super().__init__()

        self.title("Nova · Personal AI")
        self.geometry("1060x740")
        self.minsize(720, 520)
        self.configure(fg_color=ABYSS)

        self.agent = NovaAgent()
        self._thinking_widget = None
        self._current_bubble = None
        self._stream_thread = None

        self._build_layout()
        self._post_greeting()

    # ── Layout construction ───────────────────────────────────────────────
    def _build_layout(self):
        self.grid_rowconfigure(0, weight=1)
        self.grid_columnconfigure(1, weight=1)

        # ── Sidebar ──────────────────────────────────────────────────────
        self.sidebar = ctk.CTkFrame(self, fg_color=DEPTH, corner_radius=0, width=240)
        self.sidebar.grid(row=0, column=0, sticky="nsew")
        self.sidebar.grid_propagate(False)
        self.sidebar.grid_rowconfigure(5, weight=1)
        self.sidebar.grid_columnconfigure(0, weight=1)

        # ── Logo block ────────────────────────────────────────────────────
        logo_frame = ctk.CTkFrame(self.sidebar, fg_color="transparent")
        logo_frame.grid(row=0, column=0, padx=20, pady=(28, 6), sticky="ew")

        logo_glyph = ctk.CTkLabel(
            logo_frame,
            text="✦",
            font=ctk.CTkFont("Segoe UI", 22, weight="bold"),
            text_color=NOVA_CLR,
            fg_color=ACCENT_DIM,
            corner_radius=10,
            width=38,
            height=38,
        )
        logo_glyph.pack(side="left", padx=(0, 10))

        logo_text_frame = ctk.CTkFrame(logo_frame, fg_color="transparent")
        logo_text_frame.pack(side="left")

        ctk.CTkLabel(
            logo_text_frame,
            text="Nova",
            font=ctk.CTkFont("Segoe UI", 17, weight="bold"),
            text_color=BRIGHT,
            anchor="w",
        ).pack(anchor="w")

        ctk.CTkLabel(
            logo_text_frame,
            text="Personal AI  ·  Always private",
            font=ctk.CTkFont("Segoe UI", 10),
            text_color=DIM,
            anchor="w",
        ).pack(anchor="w")

        # ── Divider ───────────────────────────────────────────────────────
        ctk.CTkFrame(self.sidebar, fg_color=BORDER, height=1).grid(
            row=1, column=0, sticky="ew", padx=16, pady=(12, 0))

        # ── New Chat button ────────────────────────────────────────────────
        new_chat_btn = ctk.CTkButton(
            self.sidebar,
            text="  ＋  New Chat",
            font=ctk.CTkFont("Segoe UI", 13, weight="bold"),
            fg_color=ACCENT,
            hover_color=ACCENT_HV,
            text_color=WHITE,
            corner_radius=10,
            height=40,
            command=self._new_chat,
        )
        new_chat_btn.grid(row=2, column=0, padx=14, pady=(16, 4), sticky="ew")

        # ── Divider ───────────────────────────────────────────────────────
        ctk.CTkFrame(self.sidebar, fg_color=BORDER, height=1).grid(
            row=3, column=0, sticky="ew", padx=16, pady=(16, 0))

        # ── Memory section ────────────────────────────────────────────────
        mem_header_frame = ctk.CTkFrame(self.sidebar, fg_color="transparent")
        mem_header_frame.grid(row=4, column=0, padx=14, pady=(16, 6), sticky="ew")

        ctk.CTkLabel(
            mem_header_frame,
            text="⊞",
            font=ctk.CTkFont("Segoe UI", 11),
            text_color=DIM,
        ).pack(side="left", padx=(0, 6))

        ctk.CTkLabel(
            mem_header_frame,
            text="SESSION MEMORY",
            font=ctk.CTkFont("Segoe UI", 10, weight="bold"),
            text_color=DIM,
        ).pack(side="left")

        self.memory_box = ctk.CTkTextbox(
            self.sidebar,
            font=ctk.CTkFont("Segoe UI", 11),
            fg_color=SURFACE,
            text_color=SOFT,
            border_width=1,
            border_color=BORDER,
            corner_radius=10,
            wrap="word",
            state="disabled",
        )
        self.memory_box.grid(row=5, column=0, padx=14, pady=(0, 10), sticky="nsew")

        self._no_memory_placeholder = ctk.CTkLabel(
            self.sidebar,
            text="Memory builds as you\nchat longer sessions.",
            font=ctk.CTkFont("Segoe UI", 11),
            text_color=DIM,
            justify="left",
        )
        self._no_memory_placeholder.grid(row=5, column=0, padx=20, pady=(0, 16), sticky="nw")

        # ── Bottom status bar ─────────────────────────────────────────────
        ctk.CTkFrame(self.sidebar, fg_color=BORDER, height=1).grid(
            row=6, column=0, sticky="ew", padx=16)

        status_bar = ctk.CTkFrame(self.sidebar, fg_color="transparent")
        status_bar.grid(row=7, column=0, padx=14, pady=(10, 16), sticky="ew")

        ctk.CTkLabel(
            status_bar,
            text="● Local",
            font=ctk.CTkFont("Segoe UI", 10),
            text_color=SUCCESS,
        ).pack(side="left")

        ctk.CTkLabel(
            status_bar,
            text=" · Secure",
            font=ctk.CTkFont("Segoe UI", 10),
            text_color=DIM,
        ).pack(side="left")

        # ── Main chat area ────────────────────────────────────────────────
        self.chat_area = ctk.CTkFrame(self, fg_color=ABYSS, corner_radius=0)
        self.chat_area.grid(row=0, column=1, sticky="nsew")
        self.chat_area.grid_rowconfigure(1, weight=1)
        self.chat_area.grid_columnconfigure(0, weight=1)

        # ── Top bar ───────────────────────────────────────────────────────
        top_bar = ctk.CTkFrame(self.chat_area, fg_color=DEPTH, corner_radius=0, height=52)
        top_bar.grid(row=0, column=0, sticky="ew")
        top_bar.grid_propagate(False)
        top_bar.grid_columnconfigure(1, weight=1)

        toggle_btn = SidebarToggle(top_bar, self.sidebar)
        toggle_btn.grid(row=0, column=0, padx=(12, 4), pady=12)

        ctk.CTkLabel(
            top_bar,
            text="Nova",
            font=ctk.CTkFont("Segoe UI", 13, weight="bold"),
            text_color=BRIGHT,
        ).grid(row=0, column=1, padx=8, sticky="w")

        ctk.CTkLabel(
            top_bar,
            text="◉ Online",
            font=ctk.CTkFont("Segoe UI", 10),
            text_color=SUCCESS,
        ).grid(row=0, column=2, padx=(0, 16), sticky="e")

        ctk.CTkFrame(self.chat_area, fg_color=BORDER, height=1).grid(
            row=0, column=0, sticky="ews", pady=(51, 0))

        # ── Scrollable messages ───────────────────────────────────────────
        self.messages_frame = ctk.CTkScrollableFrame(
            self.chat_area,
            fg_color=ABYSS,
            corner_radius=0,
            scrollbar_button_color=RAISED,
            scrollbar_button_hover_color=MUTED,
        )
        self.messages_frame.grid(row=1, column=0, sticky="nsew", padx=0, pady=0)
        self.messages_frame.grid_columnconfigure(0, weight=1)

        # ── Input dock ────────────────────────────────────────────────────
        self.input_dock = ctk.CTkFrame(
            self.chat_area,
            fg_color=ABYSS,
            corner_radius=0,
            height=90,
        )
        self.input_dock.grid(row=2, column=0, sticky="ew")
        self.input_dock.grid_propagate(False)
        self.input_dock.grid_columnconfigure(0, weight=1)

        # Floating input container (gives it a card-like raised appearance)
        input_container = ctk.CTkFrame(
            self.input_dock,
            fg_color=SURFACE,
            corner_radius=16,
            border_width=1,
            border_color=BORDER,
        )
        input_container.grid(row=0, column=0, columnspan=2, padx=20, pady=16, sticky="ew")
        input_container.grid_columnconfigure(0, weight=1)

        self.entry = ctk.CTkEntry(
            input_container,
            placeholder_text="Message Nova…",
            height=44,
            corner_radius=12,
            fg_color="transparent",
            text_color=BODY,
            placeholder_text_color=DIM,
            border_width=0,
            font=ctk.CTkFont("Segoe UI", 13),
        )
        self.entry.grid(row=0, column=0, padx=(12, 6), pady=8, sticky="ew")
        self.entry.bind("<Return>", lambda e: self._send())
        self.entry.bind("<Shift-Return>", lambda e: None)

        self.send_btn = ctk.CTkButton(
            input_container,
            text="↑",
            width=40,
            height=40,
            corner_radius=10,
            font=ctk.CTkFont("Arial", 18, weight="bold"),
            fg_color=ACCENT,
            hover_color=ACCENT_HV,
            text_color=WHITE,
            command=self._send,
        )
        self.send_btn.grid(row=0, column=1, padx=(0, 8), pady=8)

    # ── Message rendering ─────────────────────────────────────────────────
    def _add_bubble(self, sender: str, text: str, is_user: bool) -> RichBubble:
        row = self.messages_frame.grid_size()[1]

        # Modern layout: user right-aligned, assistant full-width with max-width
        if is_user:
            pad_left = 120
            pad_right = 20
            sticky = "ew"
        else:
            pad_left = 20
            pad_right = 60
            sticky = "ew"

        bubble = RichBubble(
            self.messages_frame,
            sender=sender,
            text=text,
            is_user=is_user,
        )
        bubble.grid(
            row=row, column=0,
            sticky=sticky,
            padx=(pad_left, pad_right),
            pady=(4, 4),
        )
        self._scroll_to_bottom()
        return bubble

    def _scroll_to_bottom(self):
        self.messages_frame._parent_canvas.yview_moveto(1.0)

    def _show_thinking(self):
        row = self.messages_frame.grid_size()[1]
        self._thinking_widget = ThinkingIndicator(self.messages_frame)
        self._thinking_widget.grid(
            row=row, column=0,
            sticky="w",
            padx=(20, 120),
            pady=(4, 4),
        )
        self._scroll_to_bottom()

    def _hide_thinking(self):
        if self._thinking_widget:
            self._thinking_widget.destroy()
            self._thinking_widget = None

    # ── Sending & streaming ───────────────────────────────────────────────
    def _send(self):
        text = self.entry.get().strip()
        if not text or self.send_btn.cget("state") == "disabled":
            return
        self.entry.delete(0, "end")
        self._add_bubble("You", text, is_user=True)
        self._set_input_state(False)
        self._show_thinking()
        threading.Thread(target=self._stream_response, args=(text,), daemon=True).start()

    def _stream_response(self, prompt: str):
        """Runs in worker thread. Streams chunks to the main thread via after()."""
        try:
            generator = self.agent.chat_stream(prompt)

            first_chunk = None
            for chunk in generator:
                first_chunk = chunk
                break

            self.after(0, self._hide_thinking)

            bubble_holder = [None]

            def _init_bubble():
                bubble_holder[0] = self._add_bubble("Nova", "", is_user=False)

            self.after(0, _init_bubble)
            time.sleep(0.05)

            if first_chunk:
                self.after(0, lambda c=first_chunk: bubble_holder[0] and bubble_holder[0].stream_append(c))

            for chunk in generator:
                if chunk:
                    c = chunk
                    self.after(0, lambda ch=c: bubble_holder[0] and bubble_holder[0].stream_append(ch))

            time.sleep(0.1)
            self.after(0, lambda: bubble_holder[0] and bubble_holder[0].finalize_stream())
            self.after(0, self._update_memory_panel)

        except Exception as e:
            error_msg = str(e)
            self.after(0, lambda msg=error_msg: self._add_bubble(
                "Nova", f"⚠ Error: {msg}", is_user=False))
        finally:
            self.after(0, lambda: self._set_input_state(True))
            self.after(200, self._scroll_to_bottom)

    def _set_input_state(self, enabled: bool):
        state = "normal" if enabled else "disabled"
        self.send_btn.configure(state=state)
        self.entry.configure(state=state)
        if enabled:
            self.entry.focus_set()

    # ── Memory panel ──────────────────────────────────────────────────────
    def _update_memory_panel(self):
        summary = self.agent.get_session_summary()
        if summary:
            self._no_memory_placeholder.grid_remove()
            self.memory_box.configure(state="normal")
            self.memory_box.delete("1.0", "end")
            self.memory_box.insert("end", summary)
            self.memory_box.configure(state="disabled")
        else:
            self._no_memory_placeholder.grid()

    # ── New chat ──────────────────────────────────────────────────────────
    def _new_chat(self):
        self.agent.reset()
        for widget in self.messages_frame.winfo_children():
            widget.destroy()
        self._update_memory_panel()
        self._post_greeting()

    # ── Initial greeting ──────────────────────────────────────────────────
    def _post_greeting(self):
        greeting = (
            "System online. I'm **Nova** — your local AI assistant.\n\n"
            "I can browse the web for current information, read articles, "
            "and remember everything we discuss in this session.\n\n"
            "What would you like to know?"
        )
        self._add_bubble("Nova", greeting, is_user=False)


# ─────────────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    app = NovaApp()
    app.mainloop()