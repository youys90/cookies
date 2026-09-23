"use client";

// 모바일 상품 이미지 · 3-slide carousel track (Samsung Gallery / iOS Photos 감성 지향)
// -------------------------------------------------------------------
// 아키텍처:
//   container (relative, overflow-hidden, touchAction: pan-y)
//     track  (absolute inset-0, width:300%, display:flex,
//             transform: translate3d(-33.3333% + dx px, 0, 0))
//       [ slide prev  | slide current | slide next ]   ← 각 w-1/3, h-full
//   → 이동은 track 하나만 · 인접 이미지가 자연스럽게 함께 들어옴 ("현재만 밀고 뒤는 빈 배경" 문제 해소)
//
// 성능:
//   - drag 중 값은 전부 ref (React state 재렌더 없음)
//   - touchMove 는 requestAnimationFrame 으로 스로틀 · DOM 직접 style.transform 갱신
//   - imgIdx 만 실제 state · snap 완료 시점에 한 번 setState → 재렌더 → useLayoutEffect 로 즉시 rest 위치 재설정
//   - useLayoutEffect 는 paint 전에 실행 · 새 imgIdx 반영과 track 리셋이 같은 프레임 → 순간 뒤집힘 없음
//
// 자연스러움:
//   - 1:1 손가락 추적 (rAF · transition none 중)
//   - release: distance (container width * SWIPE_DIST_RATIO) OR velocity (px/ms)
//   - snap: cubic-bezier(0.25, 0.46, 0.45, 0.94) 260ms · bounce 없음
//   - snap 중 재터치: 현재 실 위치 (getBoundingClientRect) 로부터 즉시 drag 재개
//   - wrap-around: 모듈러 인덱스 · advance 후 rest 리셋 시 이음새 없음
//
// 외부 상태 (사장님 arrow · thumbnail 클릭) 변경 시:
//   - useLayoutEffect 가 track 을 rest(-33.3333%) 로 원위치 · 새 prev/curr/next 자연 반영
//   - 이 케이스는 애니메이션 없이 즉시 반영 (P-01/P-02 와 동일 · 화살표 클릭은 「점프」)
//
// P-03 인라인 gallery 로직을 대체함. `product/[id]` 와 `real-photos/[productId]` 두 페이지 공용.

import Image from "next/image";
import { useEffect, useLayoutEffect, useRef } from "react";

interface Props {
  images: string[];
  imgIdx: number;
  onIdxChange: (idx: number) => void;
  alt: string;
  sizes?: string;
  objectFit?: "cover" | "contain";
  priority?: boolean;
  unoptimized?: boolean;
  className?: string;    // 외부에서 aspect-square 등 부여
  children?: React.ReactNode; // 배지, 화살표, counter, dots 오버레이 슬롯
}

// 상수 · 사장님 손 감각에 맞춘 튜닝값
const SWIPE_DIST_RATIO = 0.25;   // container 너비의 25% 이상 이동 시 advance
const FLICK_VELOCITY = 0.5;      // px/ms · 짧고 빠른 flick 감지
const DIRECTION_LOCK_MIN = 8;    // gesture 방향 lock 최소 이동량 (px)
const SNAP_DURATION_MS = 260;    // release 후 snap 애니 duration
const SNAP_EASING = "cubic-bezier(0.25, 0.46, 0.45, 0.94)"; // ease-out-quart 계열 · bounce 없음
const REST_TRANSFORM = "translate3d(-33.3333%, 0, 0)"; // curr slot 을 viewport 중앙에

export default function ProductGalleryTrack({
  images,
  imgIdx,
  onIdxChange,
  alt,
  sizes,
  objectFit = "cover",
  priority,
  unoptimized,
  className,
  children,
}: Props) {
  const N = images.length;

  const containerRef = useRef<HTMLDivElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);

  // ── gesture state (모두 ref · 재렌더 없음) ──────────────────
  const touchStartXRef = useRef<number | null>(null);
  const touchStartYRef = useRef<number | null>(null);
  const touchStartTimeRef = useRef(0);
  const gestureDirRef = useRef<null | "h" | "v">(null);
  const initialDragOffsetRef = useRef(0); // 이 gesture 시작 시점의 dx (mid-snap 재터치 시 0 이 아님)
  const dragOffsetRef = useRef(0);        // 현재 track 의 dx (px)
  const isSnappingRef = useRef(false);
  const rafIdRef = useRef<number | null>(null);
  const pendingDxRef = useRef<number | null>(null);
  const snapTimerRef = useRef<number | null>(null);
  // useLayoutEffect 에서 첫 mount 초기화만 · 이후 imgIdx 변화 시 rest 로 원위치
  // touch/snap 진행 중이면 건드리지 X (아래 조건으로 방어)

  // 외부 imgIdx 변화 (arrow, thumbnail) OR snap-triggered onIdxChange 후 → track 을 rest 로
  // useLayoutEffect: React commit 후 · paint 전에 실행 → 새 slide 배치와 transform reset 이 같은 프레임 (뒤집힘 X)
  useLayoutEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    // 사용자가 손가락으로 drag 진행 중이면 건드리지 X (touchmove 로직이 관리)
    if (touchStartXRef.current !== null) return;
    track.style.transition = "none";
    track.style.transform = REST_TRANSFORM;
    track.style.willChange = "auto";
    dragOffsetRef.current = 0;
    isSnappingRef.current = false;
  }, [imgIdx]);

  // cleanup (unmount 시 rAF · timer 정리)
  useEffect(() => () => {
    if (rafIdRef.current != null) cancelAnimationFrame(rafIdRef.current);
    if (snapTimerRef.current != null) clearTimeout(snapTimerRef.current);
  }, []);

  const applyTransform = (dx: number) => {
    const track = trackRef.current;
    if (!track) return;
    track.style.transform = `translate3d(calc(-33.3333% + ${dx}px), 0, 0)`;
  };

  // snap 중 재터치 · 현재 실제 track 위치 (px 단위 dx) 계산
  const readCurrentDx = (): number => {
    const track = trackRef.current;
    const container = containerRef.current;
    if (!track || !container) return 0;
    const tr = track.getBoundingClientRect();
    const cr = container.getBoundingClientRect();
    // rest 시: track.left = container.left - container.width  (track width 3x · 중앙 slide 가 viewport)
    // 그러므로 currentDx = tr.left - (cr.left - cr.width) = tr.left - cr.left + cr.width
    return tr.left - cr.left + cr.width;
  };

  const cancelSnapTimer = () => {
    if (snapTimerRef.current != null) {
      clearTimeout(snapTimerRef.current);
      snapTimerRef.current = null;
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (N <= 1) return;
    const t = e.touches[0];
    const track = trackRef.current;
    if (!track) return;

    let startDx = 0;
    if (isSnappingRef.current) {
      // snap 진행 중 → 현재 실 위치에서 이어서 drag
      startDx = readCurrentDx();
      isSnappingRef.current = false;
      cancelSnapTimer();
      track.style.transition = "none";
      applyTransform(startDx);
    } else {
      startDx = 0;
      track.style.transition = "none";
    }

    initialDragOffsetRef.current = startDx;
    dragOffsetRef.current = startDx;
    touchStartXRef.current = t.clientX;
    touchStartYRef.current = t.clientY;
    touchStartTimeRef.current = Date.now();
    gestureDirRef.current = null;
    track.style.willChange = "transform";
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (N <= 1) return;
    if (touchStartXRef.current === null || touchStartYRef.current === null) return;
    const t = e.touches[0];
    const deltaX = t.clientX - touchStartXRef.current;
    const deltaY = t.clientY - touchStartYRef.current;

    if (gestureDirRef.current === null) {
      if (Math.abs(deltaX) < DIRECTION_LOCK_MIN && Math.abs(deltaY) < DIRECTION_LOCK_MIN) return;
      gestureDirRef.current = Math.abs(deltaX) > Math.abs(deltaY) ? "h" : "v";
    }
    if (gestureDirRef.current === "v") return; // 세로 스크롤은 브라우저에 위임

    const newDx = initialDragOffsetRef.current + deltaX;
    pendingDxRef.current = newDx;
    if (rafIdRef.current == null) {
      rafIdRef.current = requestAnimationFrame(() => {
        rafIdRef.current = null;
        const dx = pendingDxRef.current;
        if (dx == null) return;
        dragOffsetRef.current = dx;
        applyTransform(dx);
      });
    }
  };

  const finishGesture = () => {
    const track = trackRef.current;
    const container = containerRef.current;
    if (!track || !container) return;
    if (touchStartXRef.current === null) return;

    // 마지막 rAF pending 이 있으면 flush
    if (rafIdRef.current != null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
      if (pendingDxRef.current != null) {
        dragOffsetRef.current = pendingDxRef.current;
        applyTransform(pendingDxRef.current);
      }
    }

    const finalDx = dragOffsetRef.current;
    const gestureDelta = finalDx - initialDragOffsetRef.current;
    const elapsed = Math.max(1, Date.now() - touchStartTimeRef.current);
    const velocity = Math.abs(gestureDelta) / elapsed;
    const containerWidth = container.clientWidth || 1;
    const distThreshold = containerWidth * SWIPE_DIST_RATIO;

    const dir = gestureDirRef.current;

    touchStartXRef.current = null;
    touchStartYRef.current = null;
    gestureDirRef.current = null;

    if (dir === "v") {
      // 세로 스크롤 gesture · 이미지 이동 없이 그대로 (finalDx 는 0)
      return;
    }

    const absFinal = Math.abs(finalDx);
    const absGesture = Math.abs(gestureDelta);
    const shouldAdvance =
      absFinal >= distThreshold ||
      (velocity >= FLICK_VELOCITY && absGesture >= DIRECTION_LOCK_MIN);

    let targetDx = 0;
    let newIdx = imgIdx;
    if (shouldAdvance) {
      if (finalDx < 0) {
        targetDx = -containerWidth;
        newIdx = (imgIdx + 1) % N;
      } else {
        targetDx = containerWidth;
        newIdx = (imgIdx - 1 + N) % N;
      }
    }

    // snap animation · transition on
    isSnappingRef.current = true;
    track.style.transition = `transform ${SNAP_DURATION_MS}ms ${SNAP_EASING}`;
    applyTransform(targetDx);

    // snap 종료 후 커밋 · transitionend 는 종종 안 옴 · setTimeout 로 확정
    cancelSnapTimer();
    snapTimerRef.current = window.setTimeout(() => {
      snapTimerRef.current = null;
      if (!isSnappingRef.current) return; // 재터치로 취소됐으면 skip
      if (newIdx !== imgIdx) {
        // useLayoutEffect 가 rest 로 리셋 · 새 slides 렌더링과 동일 프레임 → 이음새 없음
        // (isSnappingRef 는 useLayoutEffect 안에서 false 로 리셋됨)
        onIdxChange(newIdx);
      } else {
        // idx 그대로 · useLayoutEffect 안 뜸 · 직접 리셋
        isSnappingRef.current = false;
        track.style.transition = "none";
        track.style.transform = REST_TRANSFORM;
        track.style.willChange = "auto";
        dragOffsetRef.current = 0;
      }
    }, SNAP_DURATION_MS + 20);
  };

  const prevIdx = N > 0 ? (imgIdx - 1 + N) % N : 0;
  const nextIdx = N > 0 ? (imgIdx + 1) % N : 0;
  const prevSrc = images[prevIdx];
  const currSrc = images[imgIdx];
  const nextSrc = images[nextIdx];

  const imgClass = objectFit === "cover" ? "object-cover" : "object-contain";

  return (
    <div
      ref={containerRef}
      className={className}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={finishGesture}
      onTouchCancel={finishGesture}
      style={{ touchAction: "pan-y" }}
    >
      {N > 0 && (
        <div
          ref={trackRef}
          className="absolute inset-0 flex"
          style={{
            width: "300%",
            // transform 은 useLayoutEffect 가 imperative 로 관리
            // (JSX 에 넣으면 재렌더 시 snap 진행 중이던 값을 덮어씀 · imgIdx-independent 재렌더 케이스 방어)
          }}
        >
          {/* prev slide */}
          <div className="relative flex-shrink-0 h-full" style={{ width: "33.3333%" }}>
            {prevSrc && (
              <Image
                src={prevSrc}
                alt={`${alt} · ${prevIdx + 1}`}
                fill
                className={imgClass}
                sizes={sizes}
                unoptimized={unoptimized}
              />
            )}
          </div>
          {/* current slide */}
          <div className="relative flex-shrink-0 h-full" style={{ width: "33.3333%" }}>
            {currSrc && (
              <Image
                src={currSrc}
                alt={alt}
                fill
                className={imgClass}
                sizes={sizes}
                priority={priority}
                unoptimized={unoptimized}
              />
            )}
          </div>
          {/* next slide */}
          <div className="relative flex-shrink-0 h-full" style={{ width: "33.3333%" }}>
            {nextSrc && (
              <Image
                src={nextSrc}
                alt={`${alt} · ${nextIdx + 1}`}
                fill
                className={imgClass}
                sizes={sizes}
                unoptimized={unoptimized}
              />
            )}
          </div>
        </div>
      )}
      {children}
    </div>
  );
}
