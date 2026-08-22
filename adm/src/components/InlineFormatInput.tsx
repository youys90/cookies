"use client";

// Word/Docs 스타일 · WYSIWYG 인라인 서식 도구
// - 관리자에게 마커 원문 절대 노출 X · contentEditable로 서식 결과 그대로 보임
// - B/I/U/S = 토글 (Word 표준) · 이미 적용된 상태에서 다시 누르면 해제
// - 색상/형광펜/크기/글꼴 = 대체 · 새 값 적용 시 같은 종류 기존 서식은 자동 제거
// - 저장 형식 (부모에게 전달): 마커 텍스트
//   - **text**              굵게
//   - [i]text[/i]           이탤릭
//   - [u]text[/u]           밑줄
//   - [s]text[/s]           취소선
//   - [c:#hex]text[/c]      글자색
//   - [bg:#hex]text[/bg]    형광펜(배경)
//   - [sz:14]text[/sz]      크기(px)
//   - [ff:serif]text[/ff]   글꼴

import { useRef, useState, useEffect, useCallback } from "react";

interface Props {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  multi?: boolean;
  rows?: number;
  className?: string;
}

const COLOR_PALETTE = [
  { name: "빨강", hex: "#c8434a" },
  { name: "주황", hex: "#e07a2d" },
  { name: "노랑", hex: "#c9a227" },
  { name: "초록", hex: "#3a8f52" },
  { name: "파랑", hex: "#2b6cb0" },
  { name: "보라", hex: "#7b3fa0" },
  { name: "검정", hex: "#1a1a1a" },
];
const HIGHLIGHT_PALETTE = [
  { name: "노랑 형광펜", hex: "#fff5a3" },
  { name: "초록 형광펜", hex: "#c4f5c0" },
  { name: "분홍 형광펜", hex: "#ffd1e0" },
  { name: "파랑 형광펜", hex: "#c4e5ff" },
  { name: "회색 형광펜", hex: "#e5e7eb" },
];
const SIZE_PRESETS = [
  { label: "작게", px: 12 },
  { label: "보통", px: 14 },
  { label: "크게", px: 18 },
  { label: "매우 크게", px: 24 },
  { label: "특대", px: 32 },
];
const FONT_PRESETS = [
  { label: "명조체", css: "'Noto Serif KR', 'Nanum Myeongjo', serif" },
  { label: "고딕체", css: "'Noto Sans KR', sans-serif" },
  { label: "손글씨", css: "'Nanum Pen Script', 'Gaegu', cursive" },
  { label: "고정폭", css: "'D2Coding', 'Menlo', monospace" },
];

// ── 마커 ↔ HTML 변환 ─────────────────────────────────────
function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function markerToHtml(text: string): string {
  if (!text) return "";
  let s = escapeHtml(text);
  const rules: Array<[RegExp, (m: RegExpMatchArray) => string]> = [
    [/\[c:(#[0-9a-fA-F]{3,8})\]([\s\S]+?)\[\/c\]/g, (m) => `<span data-fmt="c" data-color="${m[1]}" style="color:${m[1]}">${m[2]}</span>`],
    [/\[bg:(#[0-9a-fA-F]{3,8})\]([\s\S]+?)\[\/bg\]/g, (m) => `<span data-fmt="bg" data-bg="${m[1]}" style="background-color:${m[1]}">${m[2]}</span>`],
    [/\[sz:(\d{1,3})\]([\s\S]+?)\[\/sz\]/g, (m) => `<span data-fmt="sz" data-size="${m[1]}" style="font-size:${m[1]}px">${m[2]}</span>`],
    [/\[ff:([^\]]+)\]([\s\S]+?)\[\/ff\]/g, (m) => `<span data-fmt="ff" data-font="${escapeHtml(m[1])}" style="font-family:${escapeHtml(m[1])}">${m[2]}</span>`],
    [/\[i\]([\s\S]+?)\[\/i\]/g, (m) => `<i>${m[1]}</i>`],
    [/\[u\]([\s\S]+?)\[\/u\]/g, (m) => `<u>${m[1]}</u>`],
    [/\[s\]([\s\S]+?)\[\/s\]/g, (m) => `<s>${m[1]}</s>`],
    [/\*\*([^*]+)\*\*/g, (m) => `<b>${m[1]}</b>`],
  ];
  for (let iter = 0; iter < 8; iter++) {
    let changed = false;
    for (const [rx, fn] of rules) {
      const next = s.replace(rx, (...args) => fn(args as unknown as RegExpMatchArray));
      if (next !== s) { s = next; changed = true; }
    }
    if (!changed) break;
  }
  s = s.replace(/\n/g, "<br>");
  return s;
}

function nodeToMarker(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent || "";
  if (node.nodeType !== Node.ELEMENT_NODE) return "";
  const el = node as HTMLElement;
  const tag = el.tagName;
  if (tag === "BR") return "\n";
  let inner = "";
  el.childNodes.forEach((child) => { inner += nodeToMarker(child); });
  if (!inner) return "";
  if (tag === "B" || tag === "STRONG") return `**${inner}**`;
  if (tag === "I" || tag === "EM") return `[i]${inner}[/i]`;
  if (tag === "U") return `[u]${inner}[/u]`;
  if (tag === "S" || tag === "STRIKE" || tag === "DEL") return `[s]${inner}[/s]`;
  if (tag === "SPAN") {
    const fmt = el.getAttribute("data-fmt");
    if (fmt === "c") {
      const c = el.getAttribute("data-color") || rgbToHex(el.style.color);
      if (c && /^#[0-9a-fA-F]{3,8}$/.test(c)) return `[c:${c}]${inner}[/c]`;
    }
    if (fmt === "bg") {
      const c = el.getAttribute("data-bg") || rgbToHex(el.style.backgroundColor);
      if (c && /^#[0-9a-fA-F]{3,8}$/.test(c)) return `[bg:${c}]${inner}[/bg]`;
    }
    if (fmt === "sz") {
      const px = el.getAttribute("data-size") || el.style.fontSize.match(/\d+/)?.[0];
      if (px) return `[sz:${px}]${inner}[/sz]`;
    }
    if (fmt === "ff") {
      const f = el.getAttribute("data-font") || el.style.fontFamily;
      if (f) return `[ff:${f}]${inner}[/ff]`;
    }
  }
  if (tag === "DIV" || tag === "P") {
    return (el.previousSibling ? "\n" : "") + inner;
  }
  return inner;
}

function rgbToHex(css: string): string {
  if (!css) return "";
  const m = css.match(/rgba?\((\d+)[,\s]+(\d+)[,\s]+(\d+)/);
  if (!m) return css.startsWith("#") ? css : "";
  const h = (n: number) => n.toString(16).padStart(2, "0");
  return "#" + h(+m[1]) + h(+m[2]) + h(+m[3]);
}

function domToMarker(root: HTMLElement): string {
  let out = "";
  root.childNodes.forEach((child) => { out += nodeToMarker(child); });
  return out;
}

// ── 서식 판정/제거 유틸 ─────────────────────────────────
// 노드의 조상 중 · 특정 tag 또는 data-fmt 를 가진 요소 반환 (root까지)
function getAncestorMatch(node: Node, root: HTMLElement, match: (el: HTMLElement) => boolean): HTMLElement | null {
  let cur: Node | null = node.nodeType === Node.TEXT_NODE ? node.parentNode : node;
  while (cur && cur !== root) {
    if (cur.nodeType === Node.ELEMENT_NODE && match(cur as HTMLElement)) return cur as HTMLElement;
    cur = cur.parentNode;
  }
  return null;
}

// 요소 벗기기 · 자식만 남기고 자신 제거
function unwrap(el: HTMLElement) {
  const parent = el.parentNode;
  if (!parent) return;
  while (el.firstChild) parent.insertBefore(el.firstChild, el);
  parent.removeChild(el);
}

// DocumentFragment 안에서 특정 태그명 요소들 모두 벗기기
function stripInnerByTag(frag: DocumentFragment, tagName: string) {
  const els = Array.from(frag.querySelectorAll(tagName));
  els.forEach((el) => unwrap(el as HTMLElement));
}

// DocumentFragment 안에서 특정 data-fmt 스팬 모두 벗기기
function stripInnerByFmt(frag: DocumentFragment, fmt: string) {
  const els = Array.from(frag.querySelectorAll(`span[data-fmt="${fmt}"]`));
  els.forEach((el) => unwrap(el as HTMLElement));
}

// ── 컴포넌트 ─────────────────────────────────────
export default function InlineFormatInput({ value, onChange, placeholder, multi, rows = 3, className = "" }: Props) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [openMenu, setOpenMenu] = useState<null | "color" | "highlight" | "size" | "font">(null);
  const [focused, setFocused] = useState(false);
  const lastEmitted = useRef<string>("");
  // 선택 상태 자동 백업 · 툴바 버튼 클릭 순간 브라우저가 선택 놓아도 복원 가능하도록
  const savedRangeRef = useRef<Range | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (lastEmitted.current === value) return;
    el.innerHTML = markerToHtml(value);
    lastEmitted.current = value;
  }, [value]);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (!t.closest?.("[data-tb-pop]")) setOpenMenu(null);
    };
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, []);

  // 편집기 안에 유효한 (비어있지 않은) 선택이 생기면 · 백업
  useEffect(() => {
    const onSelChange = () => {
      const sel = window.getSelection();
      const root = ref.current;
      if (!sel || sel.rangeCount === 0 || !root) return;
      const range = sel.getRangeAt(0);
      if (root.contains(range.commonAncestorContainer) && !range.collapsed) {
        savedRangeRef.current = range.cloneRange();
      }
    };
    document.addEventListener("selectionchange", onSelChange);
    return () => document.removeEventListener("selectionchange", onSelChange);
  }, []);

  const emit = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    // 빈 요소 정리
    el.querySelectorAll("b:empty, i:empty, u:empty, s:empty, span:empty").forEach((n) => n.remove());
    const marker = domToMarker(el);
    lastEmitted.current = marker;
    onChange(marker);
  }, [onChange]);

  // 선택 검증 · 이 에디터 안 · 비어있지 않음 · 현재 없으면 백업본 복원 시도
  const getValidSelection = (): { sel: Selection; range: Range; root: HTMLElement } | null => {
    const sel = window.getSelection();
    const root = ref.current;
    if (!sel || !root) return null;
    // 1) 현재 선택이 유효하면 그대로 사용
    if (sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      if (root.contains(range.commonAncestorContainer) && !range.collapsed) {
        return { sel, range, root };
      }
    }
    // 2) 툴바 버튼 클릭 시 브라우저가 선택을 놓았을 수 있으므로 · 백업본 복원
    const saved = savedRangeRef.current;
    if (saved && !saved.collapsed && root.contains(saved.commonAncestorContainer)) {
      sel.removeAllRanges();
      sel.addRange(saved);
      return { sel, range: saved, root };
    }
    alert("먼저 서식을 적용할 글자를 드래그로 선택해주세요.");
    return null;
  };

  // 선택이 이미 특정 tag로 감싸져 있는지 판정 (start와 end 모두 · 동일 조상 · 완전 포함)
  const selectionFullyIn = (range: Range, root: HTMLElement, matcher: (el: HTMLElement) => boolean): HTMLElement | null => {
    const startAnc = getAncestorMatch(range.startContainer, root, matcher);
    const endAnc = getAncestorMatch(range.endContainer, root, matcher);
    if (startAnc && startAnc === endAnc) return startAnc;
    return null;
  };

  // ── 토글 (B/I/U/S) ─────────────────
  // 이미 감싸져 있으면 · 감싼 태그 전체를 벗김 (예측 가능한 동작)
  // 아니면 감싸기 · 같은 태그 중첩 자동 제거
  const toggleTag = (tagName: string) => {
    const v = getValidSelection(); if (!v) return;
    const { sel, range, root } = v;
    const upper = tagName.toUpperCase();
    // 판정 · 선택이 이 태그로 감싸진 안에 있는지 (부분 선택도 감지)
    const existing = selectionFullyIn(range, root, (el) => el.tagName === upper);
    if (existing) {
      // 감싼 태그 통째로 벗김 · 자식만 남기고 자신 제거
      unwrap(existing);
      // 벗긴 후 · 안쪽에 같은 태그 중첩이 있으면 함께 정리
      root.querySelectorAll(tagName).forEach((el) => {
        // 이 태그 안에 부모 방향으로 같은 태그가 또 있으면 이중 · 벗기기
        let p = el.parentElement;
        while (p && p !== root) {
          if (p.tagName === upper) { unwrap(el as HTMLElement); break; }
          p = p.parentElement;
        }
      });
      sel.removeAllRanges();
      emit();
      return;
    }
    // 감싸기 · 안쪽 같은 태그는 스트립 (중첩 완전 방지)
    const contents = range.extractContents();
    stripInnerByTag(contents, tagName);
    const wrapper = document.createElement(tagName);
    wrapper.appendChild(contents);
    range.insertNode(wrapper);
    sel.removeAllRanges();
    const newRange = document.createRange();
    newRange.selectNodeContents(wrapper);
    sel.addRange(newRange);
    emit();
  };

  // ── 대체 (color/highlight/size/font) ─────────────────
  // 같은 fmt 안쪽 스팬은 벗기고 · 새 값으로 감쌈 · value === "" 이면 그냥 벗기기만 (해제)
  const replaceFmt = (fmt: "c" | "bg" | "sz" | "ff", value: string, styleProp: string, cssTransform?: (v: string) => string) => {
    const v = getValidSelection(); if (!v) return;
    const { sel, range } = v;
    const contents = range.extractContents();
    // 안쪽 같은 fmt 스팬 벗기기 (중첩 방지)
    stripInnerByFmt(contents, fmt);
    if (!value) {
      // 해제 · 벗긴 상태 그대로 삽입
      range.insertNode(contents);
      sel.removeAllRanges();
      emit();
      return;
    }
    const wrapper = document.createElement("span");
    wrapper.setAttribute("data-fmt", fmt);
    const attrKey = fmt === "c" ? "data-color" : fmt === "bg" ? "data-bg" : fmt === "sz" ? "data-size" : "data-font";
    wrapper.setAttribute(attrKey, value);
    const cssValue = cssTransform ? cssTransform(value) : value;
    (wrapper.style as unknown as Record<string, string>)[styleProp] = cssValue;
    wrapper.appendChild(contents);
    range.insertNode(wrapper);
    sel.removeAllRanges();
    const newRange = document.createRange();
    newRange.selectNodeContents(wrapper);
    sel.addRange(newRange);
    emit();
  };

  const wrapBold = () => toggleTag("b");
  const wrapItalic = () => toggleTag("i");
  const wrapUnderline = () => toggleTag("u");
  const wrapStrike = () => toggleTag("s");
  const wrapColor = (hex: string) => { replaceFmt("c", hex, "color"); setOpenMenu(null); };
  const clearColor = () => { replaceFmt("c", "", "color"); setOpenMenu(null); };
  const wrapHighlight = (hex: string) => { replaceFmt("bg", hex, "backgroundColor"); setOpenMenu(null); };
  const clearHighlight = () => { replaceFmt("bg", "", "backgroundColor"); setOpenMenu(null); };
  const wrapSize = (px: number) => { replaceFmt("sz", String(px), "fontSize", (v) => `${v}px`); setOpenMenu(null); };
  const clearSize = () => { replaceFmt("sz", "", "fontSize"); setOpenMenu(null); };
  const wrapFont = (css: string) => { replaceFmt("ff", css, "fontFamily"); setOpenMenu(null); };
  const clearFont = () => { replaceFmt("ff", "", "fontFamily"); setOpenMenu(null); };

  const clearFormat = () => {
    const v = getValidSelection(); if (!v) return;
    const { sel, range } = v;
    const contents = range.extractContents();
    const plain = document.createDocumentFragment();
    const walker = document.createTreeWalker(contents, NodeFilter.SHOW_TEXT);
    let node: Node | null = walker.nextNode();
    while (node) {
      plain.appendChild(document.createTextNode(node.textContent || ""));
      node = walker.nextNode();
    }
    range.insertNode(plain);
    sel.removeAllRanges();
    emit();
  };

  const onPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const text = e.clipboardData.getData("text/plain");
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    range.deleteContents();
    if (multi) {
      const lines = text.split("\n");
      lines.forEach((line, i) => {
        if (i > 0) range.insertNode(document.createElement("br"));
        if (line) range.insertNode(document.createTextNode(line));
      });
    } else {
      range.insertNode(document.createTextNode(text.replace(/\n/g, " ")));
    }
    range.collapse(false);
    sel.removeAllRanges();
    sel.addRange(range);
    emit();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!multi && e.key === "Enter") e.preventDefault();
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b") { e.preventDefault(); wrapBold(); }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "i") { e.preventDefault(); wrapItalic(); }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "u") { e.preventDefault(); wrapUnderline(); }
  };

  const showPlaceholder = !focused && !value;
  const minHeight = multi ? rows * 24 : 32;

  const Btn = ({ onClick, title, children }: { onClick: () => void; title: string; children: React.ReactNode }) => (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className="px-2 py-0.5 text-sm rounded hover:bg-white active:bg-gray-200"
      title={title}
    >
      {children}
    </button>
  );

  return (
    <div className={className}>
      {/* 툴바 · Word 스타일 */}
      <div className="flex items-center gap-0.5 px-1.5 py-1 bg-gray-100 border border-gray-200 border-b-0 rounded-t flex-wrap">
        {/* 글꼴 */}
        <div className="relative" data-tb-pop>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setOpenMenu(openMenu === "font" ? null : "font")}
            className="px-2 py-0.5 text-xs rounded hover:bg-white active:bg-gray-200 flex items-center gap-1"
            title="글꼴"
          >
            <span>글꼴</span>
            <span className="text-[8px]">▼</span>
          </button>
          {openMenu === "font" && (
            <div data-tb-pop className="absolute z-20 top-full left-0 mt-1 p-1 bg-white border border-gray-200 rounded-lg shadow-lg min-w-[130px]">
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={clearFont}
                className="w-full text-left px-2 py-1 text-xs rounded hover:bg-red-50 text-red-600 flex items-center gap-1.5 border-b border-gray-100 mb-0.5"
              >
                <span>↺</span>
                <span>기본으로 되돌리기</span>
              </button>
              {FONT_PRESETS.map((f) => (
                <button
                  key={f.label}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => wrapFont(f.css)}
                  className="w-full text-left px-2 py-1 text-xs rounded hover:bg-gray-100"
                  style={{ fontFamily: f.css }}
                >
                  {f.label}
                </button>
              ))}
            </div>
          )}
        </div>
        {/* 크기 */}
        <div className="relative" data-tb-pop>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setOpenMenu(openMenu === "size" ? null : "size")}
            className="px-2 py-0.5 text-xs rounded hover:bg-white active:bg-gray-200 flex items-center gap-1"
            title="글자 크기"
          >
            <span>크기</span>
            <span className="text-[8px]">▼</span>
          </button>
          {openMenu === "size" && (
            <div data-tb-pop className="absolute z-20 top-full left-0 mt-1 p-1 bg-white border border-gray-200 rounded-lg shadow-lg min-w-[140px]">
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={clearSize}
                className="w-full text-left px-2 py-1 text-xs rounded hover:bg-red-50 text-red-600 flex items-center gap-1.5 border-b border-gray-100 mb-0.5"
              >
                <span>↺</span>
                <span>기본으로 되돌리기</span>
              </button>
              {SIZE_PRESETS.map((s) => (
                <button
                  key={s.px}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => wrapSize(s.px)}
                  className="w-full text-left px-2 py-1 rounded hover:bg-gray-100 flex items-center justify-between"
                >
                  <span>{s.label}</span>
                  <span className="text-gray-400" style={{ fontSize: Math.min(s.px, 20) }}>{s.px}px</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="w-px h-4 bg-gray-300 mx-1" />
        {/* B/I/U/S · 토글 */}
        <Btn onClick={wrapBold} title="굵게 토글 (Ctrl+B)"><b className="font-black">B</b></Btn>
        <Btn onClick={wrapItalic} title="기울임 토글 (Ctrl+I)"><i className="italic">I</i></Btn>
        <Btn onClick={wrapUnderline} title="밑줄 토글 (Ctrl+U)"><u className="underline">U</u></Btn>
        <Btn onClick={wrapStrike} title="취소선 토글"><s className="line-through">S</s></Btn>
        <div className="w-px h-4 bg-gray-300 mx-1" />
        {/* 글자 색상 */}
        <div className="relative" data-tb-pop>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setOpenMenu(openMenu === "color" ? null : "color")}
            className="px-1.5 py-0.5 text-xs rounded hover:bg-white active:bg-gray-200 flex items-center gap-1"
            title="글자 색상"
          >
            <span className="inline-block w-3 h-3 rounded bg-gradient-to-br from-red-500 via-amber-400 to-blue-500" />
            <span>글자색</span>
            <span className="text-[8px]">▼</span>
          </button>
          {openMenu === "color" && (
            <div data-tb-pop className="absolute z-20 top-full left-0 mt-1 p-2 bg-white border border-gray-200 rounded-lg shadow-lg">
              <div className="flex items-center gap-1.5 mb-1.5">
                {COLOR_PALETTE.map((c) => (
                  <button
                    key={c.hex}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => wrapColor(c.hex)}
                    style={{ background: c.hex }}
                    className="w-6 h-6 rounded border border-gray-300 hover:scale-110 transition"
                    title={c.name}
                  />
                ))}
                <div className="w-px h-6 bg-gray-200 mx-0.5" />
                <label className="cursor-pointer" title="원하는 색상 고르기">
                  <div className="w-6 h-6 rounded border border-gray-300 flex items-center justify-center bg-white hover:scale-110 transition">
                    <span className="text-[10px]">＋</span>
                  </div>
                  <input type="color" onMouseDown={(e) => e.preventDefault()} onChange={(e) => wrapColor(e.target.value)} className="sr-only" />
                </label>
              </div>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={clearColor}
                className="w-full text-left px-2 py-1 text-xs rounded hover:bg-red-50 text-red-600 flex items-center gap-1.5 border-t border-gray-100 pt-1.5"
              >
                <span>↺</span>
                <span>글자색 없애기</span>
              </button>
            </div>
          )}
        </div>
        {/* 형광펜 */}
        <div className="relative" data-tb-pop>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setOpenMenu(openMenu === "highlight" ? null : "highlight")}
            className="px-1.5 py-0.5 text-xs rounded hover:bg-white active:bg-gray-200 flex items-center gap-1"
            title="형광펜 (배경색)"
          >
            <span className="inline-block w-3 h-3 rounded bg-yellow-200 border border-yellow-300" />
            <span>형광펜</span>
            <span className="text-[8px]">▼</span>
          </button>
          {openMenu === "highlight" && (
            <div data-tb-pop className="absolute z-20 top-full left-0 mt-1 p-2 bg-white border border-gray-200 rounded-lg shadow-lg">
              <div className="flex items-center gap-1.5 mb-1.5">
                {HIGHLIGHT_PALETTE.map((c) => (
                  <button
                    key={c.hex}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => wrapHighlight(c.hex)}
                    style={{ background: c.hex }}
                    className="w-6 h-6 rounded border border-gray-300 hover:scale-110 transition"
                    title={c.name}
                  />
                ))}
                <div className="w-px h-6 bg-gray-200 mx-0.5" />
                <label className="cursor-pointer" title="원하는 배경색 고르기">
                  <div className="w-6 h-6 rounded border border-gray-300 flex items-center justify-center bg-white hover:scale-110 transition">
                    <span className="text-[10px]">＋</span>
                  </div>
                  <input type="color" onMouseDown={(e) => e.preventDefault()} onChange={(e) => wrapHighlight(e.target.value)} className="sr-only" />
                </label>
              </div>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={clearHighlight}
                className="w-full text-left px-2 py-1 text-xs rounded hover:bg-red-50 text-red-600 flex items-center gap-1.5 border-t border-gray-100 pt-1.5"
              >
                <span>↺</span>
                <span>형광펜 없애기</span>
              </button>
            </div>
          )}
        </div>
        <div className="w-px h-4 bg-gray-300 mx-1" />
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={clearFormat}
          className="px-1.5 py-0.5 text-[11px] text-gray-600 rounded hover:bg-white active:bg-gray-200"
          title="선택한 글자의 모든 서식 지우기"
        >
          서식 전체 지우기
        </button>
        <span className="ml-auto text-[9px] text-gray-400">글자 선택 → 버튼 클릭 (같은 버튼 다시 누르면 해제)</span>
      </div>
      {/* 편집 영역 · WYSIWYG */}
      <div className="relative">
        {showPlaceholder && (
          <div className="absolute top-1.5 left-2.5 text-sm text-gray-400 pointer-events-none select-none">
            {placeholder}
          </div>
        )}
        <div
          ref={ref}
          contentEditable
          suppressContentEditableWarning
          onInput={emit}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onPaste={onPaste}
          onKeyDown={onKeyDown}
          style={{ minHeight, whiteSpace: multi ? "pre-wrap" : "nowrap", overflowY: multi ? "auto" : "hidden", overflowX: multi ? "hidden" : "auto" }}
          className="w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded-b focus:outline-none focus:ring-1 focus:ring-[var(--color-brand)]"
        />
      </div>
    </div>
  );
}
