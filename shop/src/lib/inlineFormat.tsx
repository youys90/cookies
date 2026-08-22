// 인라인 서식 마크 파서 · 관리자 InlineFormatInput으로 저장된 텍스트를 shop에서 렌더
// 지원 마커:
// - **text**              굵게
// - [i]text[/i]           이탤릭
// - [u]text[/u]           밑줄
// - [s]text[/s]           취소선
// - [c:#hex]text[/c]      글자색
// - [bg:#hex]text[/bg]    형광펜(배경)
// - [sz:14]text[/sz]      크기(px)
// - [ff:serif]text[/ff]   글꼴
// - 조합/중첩 자유 · (예: **[c:#red]글자[/c]**)
// - 마커 미포함 텍스트는 그대로

import React from "react";

const HEX_RX = /^#[0-9a-fA-F]{3,8}$/;

// 하나의 텍스트 조각을 스캔해서 · 마커 발견 시 스타일 적용된 노드로 · 재귀
function parseSegment(text: string, keyPrefix: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  // 우선순위 · 색상/배경/크기/글꼴 (파라미터 있는 마커) → 굵게 → i/u/s (파라미터 없는 마커)
  const rx =
    /(\*\*[^*]+?\*\*|\[c:#[0-9a-fA-F]{3,8}\][\s\S]+?\[\/c\]|\[bg:#[0-9a-fA-F]{3,8}\][\s\S]+?\[\/bg\]|\[sz:\d{1,3}\][\s\S]+?\[\/sz\]|\[ff:[^\]]+\][\s\S]+?\[\/ff\]|\[i\][\s\S]+?\[\/i\]|\[u\][\s\S]+?\[\/u\]|\[s\][\s\S]+?\[\/s\])/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let idx = 0;
  while ((m = rx.exec(text)) !== null) {
    if (m.index > last) out.push(<React.Fragment key={`${keyPrefix}-t${idx}`}>{text.slice(last, m.index)}</React.Fragment>);
    const seg = m[0];
    if (seg.startsWith("**")) {
      const inner = seg.slice(2, -2);
      out.push(<b key={`${keyPrefix}-b${idx}`} className="font-bold">{parseSegment(inner, `${keyPrefix}-b${idx}`)}</b>);
    } else if (seg.startsWith("[c:")) {
      const cm = seg.match(/^\[c:(#[0-9a-fA-F]{3,8})\]([\s\S]+)\[\/c\]$/);
      if (cm && HEX_RX.test(cm[1])) {
        out.push(<span key={`${keyPrefix}-c${idx}`} style={{ color: cm[1] }}>{parseSegment(cm[2], `${keyPrefix}-c${idx}`)}</span>);
      } else {
        out.push(<React.Fragment key={`${keyPrefix}-raw${idx}`}>{seg}</React.Fragment>);
      }
    } else if (seg.startsWith("[bg:")) {
      const bm = seg.match(/^\[bg:(#[0-9a-fA-F]{3,8})\]([\s\S]+)\[\/bg\]$/);
      if (bm && HEX_RX.test(bm[1])) {
        out.push(<span key={`${keyPrefix}-bg${idx}`} style={{ backgroundColor: bm[1] }}>{parseSegment(bm[2], `${keyPrefix}-bg${idx}`)}</span>);
      } else {
        out.push(<React.Fragment key={`${keyPrefix}-raw${idx}`}>{seg}</React.Fragment>);
      }
    } else if (seg.startsWith("[sz:")) {
      const sm = seg.match(/^\[sz:(\d{1,3})\]([\s\S]+)\[\/sz\]$/);
      if (sm) {
        out.push(<span key={`${keyPrefix}-sz${idx}`} style={{ fontSize: `${sm[1]}px` }}>{parseSegment(sm[2], `${keyPrefix}-sz${idx}`)}</span>);
      } else {
        out.push(<React.Fragment key={`${keyPrefix}-raw${idx}`}>{seg}</React.Fragment>);
      }
    } else if (seg.startsWith("[ff:")) {
      const fm = seg.match(/^\[ff:([^\]]+)\]([\s\S]+)\[\/ff\]$/);
      if (fm) {
        out.push(<span key={`${keyPrefix}-ff${idx}`} style={{ fontFamily: fm[1] }}>{parseSegment(fm[2], `${keyPrefix}-ff${idx}`)}</span>);
      } else {
        out.push(<React.Fragment key={`${keyPrefix}-raw${idx}`}>{seg}</React.Fragment>);
      }
    } else if (seg.startsWith("[i]")) {
      const inner = seg.slice(3, -4);
      out.push(<i key={`${keyPrefix}-i${idx}`} className="italic">{parseSegment(inner, `${keyPrefix}-i${idx}`)}</i>);
    } else if (seg.startsWith("[u]")) {
      const inner = seg.slice(3, -4);
      out.push(<u key={`${keyPrefix}-u${idx}`} className="underline">{parseSegment(inner, `${keyPrefix}-u${idx}`)}</u>);
    } else if (seg.startsWith("[s]")) {
      const inner = seg.slice(3, -4);
      out.push(<s key={`${keyPrefix}-s${idx}`} className="line-through">{parseSegment(inner, `${keyPrefix}-s${idx}`)}</s>);
    }
    last = m.index + seg.length;
    idx++;
  }
  if (last < text.length) out.push(<React.Fragment key={`${keyPrefix}-tail`}>{text.slice(last)}</React.Fragment>);
  return out;
}

export function renderInlineFormat(text: string): React.ReactNode {
  if (!text) return null;
  // 줄바꿈 유지 · 각 줄을 개별 파싱 후 <br/>로 연결
  const lines = text.split(/\r?\n/);
  return (
    <>
      {lines.map((line, i) => (
        <React.Fragment key={`ln-${i}`}>
          {i > 0 && <br />}
          {parseSegment(line, `ln-${i}`)}
        </React.Fragment>
      ))}
    </>
  );
}
