"use client";
// 카테고리 아이콘 선택 모달
// - 탭 1: 기본 아이콘 (25종 SVG 내장, 삭제 불가, 소분류로 그룹핑)
// - 탭 2: 내가 추가한 아이콘 (custom_icons 테이블, 파일 업로드/삭제 가능)

import { useEffect, useState } from "react";
import Image from "next/image";
import { supabase } from "@/lib/supabase";
import { BuiltinCategoryIcon, BUILTIN_ICON_PREFIX } from "@/lib/category-icons";

interface IconPickerProps {
  open: boolean;
  currentValue: string; // "builtin:key" or URL
  onClose: () => void;
  onSelect: (value: string) => void;
}

// 기본 아이콘 소분류 (사장님이 원하는 상품 성격별 그룹)
const BUILTIN_GROUPS: Array<{ label: string; keys: string[] }> = [
  { label: "액세서리", keys: ["ring", "necklace", "ribbon", "diamond", "sparkle"] },
  { label: "가방·의류", keys: ["bag", "shoe", "hat", "shirt", "glove"] },
  { label: "라이프스타일", keys: ["cup", "lamp", "note", "box", "gift"] },
  { label: "장식·감성", keys: ["heart", "star", "crown", "flower", "leaf"] },
  { label: "도구·기타", keys: ["key", "glass", "watch", "eye", "bell"] },
];

const BUCKET = "product-images";

type CustomIcon = { id: number; url: string; name: string | null };

export default function IconPicker({ open, currentValue, onClose, onSelect }: IconPickerProps) {
  const [tab, setTab] = useState<"builtin" | "custom">("builtin");
  const [customIcons, setCustomIcons] = useState<CustomIcon[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) fetchCustom();
  }, [open]);

  const fetchCustom = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("custom_icons")
      .select("id, url, name")
      .order("id", { ascending: false });
    if (!error) setCustomIcons((data as CustomIcon[]) || []);
    setLoading(false);
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);

    if (file.size > 5 * 1024 * 1024) {
      setError("5MB 이하 이미지만 업로드 가능합니다.");
      return;
    }
    if (!file.type.startsWith("image/")) {
      setError("이미지 파일만 업로드 가능합니다.");
      return;
    }

    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "png";
      const key = `categories/custom_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(key, file, {
        upsert: true,
        contentType: file.type,
      });
      if (upErr) {
        setError("업로드 실패: " + upErr.message);
        return;
      }
      const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(key);
      const url = urlData.publicUrl;

      const { error: insErr } = await supabase.from("custom_icons").insert({
        url,
        name: file.name,
      });
      if (insErr) {
        setError("아이콘 등록 실패: " + insErr.message);
        return;
      }
      await fetchCustom();
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleDelete = async (icon: CustomIcon) => {
    if (!confirm(`"${icon.name || `#${icon.id}`}" 아이콘을 삭제하시겠습니까?\n이미 이 아이콘을 사용 중인 카테고리는 아이콘이 사라집니다.`)) return;
    const { error } = await supabase.from("custom_icons").delete().eq("id", icon.id);
    if (error) {
      alert("삭제 실패: " + error.message);
      return;
    }
    fetchCustom();
  };

  const pick = (value: string) => {
    onSelect(value);
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] bg-black/50 flex items-center justify-center px-4" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-lg font-medium">아이콘 선택</h3>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded hover:bg-gray-100">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M6 6l12 12M6 18L18 6" /></svg>
          </button>
        </div>

        {/* 탭 */}
        <div className="px-6 pt-3 border-b border-gray-100 flex gap-1">
          <button
            onClick={() => setTab("builtin")}
            className={`px-4 py-2 text-sm border-b-2 transition ${tab === "builtin" ? "border-gray-900 text-gray-900 font-medium" : "border-transparent text-gray-500 hover:text-gray-800"}`}
          >
            기본 아이콘
          </button>
          <button
            onClick={() => setTab("custom")}
            className={`px-4 py-2 text-sm border-b-2 transition ${tab === "custom" ? "border-gray-900 text-gray-900 font-medium" : "border-transparent text-gray-500 hover:text-gray-800"}`}
          >
            내가 추가한 아이콘 {customIcons.length > 0 && <span className="text-gray-400">({customIcons.length})</span>}
          </button>
        </div>

        {/* 컨텐츠 */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {tab === "builtin" ? (
            <div className="space-y-5">
              <p className="text-[11px] text-gray-500 leading-relaxed">
                기본 제공 아이콘 25종입니다. 항목별로 그룹화되어 있고, 클릭하여 선택할 수 있습니다.
              </p>
              {BUILTIN_GROUPS.map((group) => (
                <div key={group.label}>
                  <p className="text-xs font-medium text-gray-600 mb-2">{group.label}</p>
                  <div className="grid grid-cols-8 gap-2">
                    {group.keys.map((key) => {
                      const value = `${BUILTIN_ICON_PREFIX}${key}`;
                      const selected = currentValue === value;
                      return (
                        <button
                          key={key}
                          onClick={() => pick(value)}
                          className={`aspect-square rounded-lg border flex items-center justify-center transition ${
                            selected
                              ? "border-gray-900 bg-gray-100 text-gray-900 shadow-sm"
                              : "border-gray-200 text-gray-500 hover:border-gray-400 hover:text-gray-800"
                          }`}
                          title={key}
                        >
                          <BuiltinCategoryIcon name={key} className="w-6 h-6" />
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div>
              {/* 업로드 영역 */}
              <div className="mb-4">
                <label className="flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-gray-500 hover:bg-gray-50 transition">
                  <svg className="w-5 h-5 text-gray-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M12 4v16m8-8H4" />
                  </svg>
                  <span className="text-sm text-gray-700">
                    {uploading ? "업로드 중…" : "+ 아이콘 추가 (이미지 업로드)"}
                  </span>
                  <input type="file" accept="image/*" onChange={handleUpload} disabled={uploading} className="hidden" />
                </label>
                {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
                <p className="text-[10px] text-gray-400 mt-1.5">
                  · 원본 크기 무관 · 5MB 이하 · 노출 시 64×64로 자동 맞춤 · 필요시 삭제 가능
                </p>
              </div>

              {/* 커스텀 아이콘 목록 */}
              {loading ? (
                <p className="text-sm text-gray-400 text-center py-8">불러오는 중…</p>
              ) : customIcons.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-8">
                  아직 추가한 아이콘이 없습니다. 위의 <b>+ 아이콘 추가</b> 버튼을 눌러 이미지를 올려주세요.
                </p>
              ) : (
                <div className="grid grid-cols-6 gap-3">
                  {customIcons.map((icon) => {
                    const selected = currentValue === icon.url;
                    return (
                      <div key={icon.id} className="relative group">
                        <button
                          onClick={() => pick(icon.url)}
                          className={`aspect-square w-full rounded-lg border overflow-hidden flex items-center justify-center transition ${
                            selected
                              ? "border-gray-900 ring-2 ring-gray-900"
                              : "border-gray-200 hover:border-gray-400"
                          }`}
                          title={icon.name || `#${icon.id}`}
                        >
                          <Image src={icon.url} alt={icon.name || "custom"} width={64} height={64} className="object-cover w-full h-full" unoptimized />
                        </button>
                        <button
                          onClick={() => handleDelete(icon)}
                          className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-white border border-gray-300 rounded-full text-red-500 hover:bg-red-500 hover:text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition"
                          title="이 아이콘 삭제"
                        >
                          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 6l12 12M6 18L18 6" /></svg>
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* 푸터 */}
        <div className="px-6 py-3 border-t border-gray-100 flex items-center justify-between">
          <button
            onClick={() => { onSelect(""); onClose(); }}
            className="text-xs text-red-500 hover:text-red-700"
          >
            아이콘 제거
          </button>
          <button onClick={onClose} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
