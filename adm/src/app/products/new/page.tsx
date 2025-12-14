"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { supabase } from "@/lib/supabase";

const categoriesJa = ["アクセサリー", "ヘアアクセサリー", "冬物アイテム", "キーリング", "メガネ／サングラス", "ファッション雑貨", "その他（ETC）", "🔒 スタッフ専用"];
const categoriesKo = ["악세사리", "헤어", "겨울상품", "키링", "안경/선글라스", "패션잡화", "기타", "🔒 스태프 전용"];

export default function NewProductPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [formData, setFormData] = useState({
    nameJa: "",
    nameKo: "",
    price: "",
    originalPrice: "",
    categoryJa: categoriesJa[0],
    categoryKo: categoriesKo[0],
    descriptionJa: "",
    descriptionKo: "",
    stock: "",
  });

  // 잠금 상태: 자동 번역된 필드는 잠김
  const [locked, setLocked] = useState({
    nameJa: false,
    nameKo: false,
    descriptionJa: false,
    descriptionKo: false,
  });

  // 주 입력 언어 (먼저 입력한 쪽)
  const [primaryLang, setPrimaryLang] = useState<'ja' | 'ko' | null>(null);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const uploadImage = async (file: File): Promise<string | null> => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}.${fileExt}`;
    const filePath = `products/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('product-images')
      .upload(filePath, file);

    if (uploadError) {
      console.error('이미지 업로드 실패:', uploadError);
      return null;
    }

    const { data } = supabase.storage
      .from('product-images')
      .getPublicUrl(filePath);

    return data.publicUrl;
  };

  // Lingva API 번역 함수
  const translateText = async (text: string, from: string, to: string): Promise<string> => {
    if (!text.trim()) return "";
    try {
      const res = await fetch(`https://lingva.ml/api/v1/${from}/${to}/${encodeURIComponent(text)}`);
      const data = await res.json();
      return data.translation || text;
    } catch (error) {
      console.error('번역 실패:', error);
      return text;
    }
  };

  // 자동 번역 실행 (입력 시 자동 호출)
  const autoTranslate = async (field: 'name' | 'description', sourceLang: 'ja' | 'ko', value: string) => {
    if (!value.trim()) return;

    const from = sourceLang;
    const to = sourceLang === 'ja' ? 'ko' : 'ja';
    const targetField = field + (to === 'ja' ? 'Ja' : 'Ko') as keyof typeof formData;

    setTranslating(true);
    try {
      const translated = await translateText(value, from, to);
      setFormData(prev => ({ ...prev, [targetField]: translated }));
      setLocked(prev => ({ ...prev, [targetField]: true }));

      // 카테고리도 자동 매칭
      if (field === 'name') {
        if (sourceLang === 'ja') {
          const catIdx = categoriesJa.indexOf(formData.categoryJa);
          setFormData(prev => ({ ...prev, categoryKo: catIdx >= 0 ? categoriesKo[catIdx] : categoriesKo[0] }));
        } else {
          const catIdx = categoriesKo.indexOf(formData.categoryKo);
          setFormData(prev => ({ ...prev, categoryJa: catIdx >= 0 ? categoriesJa[catIdx] : categoriesJa[0] }));
        }
      }
    } catch (error) {
      console.error('자동 번역 실패:', error);
    }
    setTranslating(false);
  };

  // 필드 잠금 해제
  const unlockField = (field: keyof typeof locked) => {
    if (locked[field]) {
      if (confirm('자동 번역된 내용을 수정하시겠습니까?')) {
        setLocked(prev => ({ ...prev, [field]: false }));
      }
    }
  };

  // 입력 핸들러 (자동 번역 트리거)
  const handleInputChange = (field: 'nameJa' | 'nameKo' | 'descriptionJa' | 'descriptionKo', value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));

    // 주 언어 설정 (처음 입력한 쪽)
    if (!primaryLang && value.trim()) {
      const lang = field.endsWith('Ja') ? 'ja' : 'ko';
      setPrimaryLang(lang);
    }
  };

  // 입력 완료 시 자동 번역 (onBlur)
  const handleInputBlur = async (field: 'nameJa' | 'nameKo' | 'descriptionJa' | 'descriptionKo') => {
    const value = formData[field];
    if (!value.trim()) return;

    const isJa = field.endsWith('Ja');
    const baseField = field.replace(/Ja$|Ko$/, '') as 'name' | 'description';
    const targetField = baseField + (isJa ? 'Ko' : 'Ja') as keyof typeof formData;

    // 상대 필드가 비어있거나 잠겨있으면 자동 번역
    if (!formData[targetField] || locked[targetField as keyof typeof locked]) {
      await autoTranslate(baseField, isJa ? 'ja' : 'ko', value);
    }
  };

  // 번역 버튼 (수동 전체 번역)
  const manualTranslate = async () => {
    const hasJa = formData.nameJa.trim();
    const hasKo = formData.nameKo.trim();

    if (!hasJa && !hasKo) {
      alert('번역할 텍스트를 입력하세요');
      return;
    }

    // 일본어 기준으로 한국어 재번역
    if (hasJa) {
      setTranslating(true);
      try {
        const [nameKo, descKo] = await Promise.all([
          translateText(formData.nameJa, 'ja', 'ko'),
          formData.descriptionJa ? translateText(formData.descriptionJa, 'ja', 'ko') : '',
        ]);
        const catIdx = categoriesJa.indexOf(formData.categoryJa);
        setFormData(prev => ({
          ...prev,
          nameKo,
          descriptionKo: descKo,
          categoryKo: catIdx >= 0 ? categoriesKo[catIdx] : categoriesKo[0],
        }));
        setLocked(prev => ({ ...prev, nameKo: true, descriptionKo: true }));
      } catch (error) {
        alert('번역 중 오류가 발생했습니다');
      }
      setTranslating(false);
    }
  };

  // 번역 버튼 텍스트
  const getTranslateButtonText = () => {
    if (translating) return '번역 중...';
    if (formData.nameJa.trim()) return '🇯🇵 → 🇰🇷 재번역';
    if (formData.nameKo.trim()) return '🇰🇷 → 🇯🇵 재번역';
    return '번역';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploading(true);

    // 자동 번역: 한쪽만 입력된 경우 다른 쪽 자동 번역
    let finalData = { ...formData };

    // 일본어만 있고 한국어 없으면 → 한국어 자동 번역
    if (formData.nameJa && !formData.nameKo) {
      const [nameKo, descKo] = await Promise.all([
        translateText(formData.nameJa, 'ja', 'ko'),
        formData.descriptionJa ? translateText(formData.descriptionJa, 'ja', 'ko') : '',
      ]);
      const catIdx = categoriesJa.indexOf(formData.categoryJa);
      finalData = {
        ...finalData,
        nameKo,
        descriptionKo: descKo,
        categoryKo: catIdx >= 0 ? categoriesKo[catIdx] : categoriesKo[0],
      };
    }
    // 한국어만 있고 일본어 없으면 → 일본어 자동 번역
    else if (formData.nameKo && !formData.nameJa) {
      const [nameJa, descJa] = await Promise.all([
        translateText(formData.nameKo, 'ko', 'ja'),
        formData.descriptionKo ? translateText(formData.descriptionKo, 'ko', 'ja') : '',
      ]);
      const catIdx = categoriesKo.indexOf(formData.categoryKo);
      finalData = {
        ...finalData,
        nameJa,
        descriptionJa: descJa,
        categoryJa: catIdx >= 0 ? categoriesJa[catIdx] : categoriesJa[0],
      };
    }

    let imageUrl = '/images/default.jpg';

    if (imageFile) {
      const uploadedUrl = await uploadImage(imageFile);
      if (uploadedUrl) {
        imageUrl = uploadedUrl;
      } else {
        alert('이미지 업로드에 실패했습니다.');
        setUploading(false);
        return;
      }
    }

    const { error } = await supabase
      .from('products')
      .insert({
        name: finalData.nameJa || finalData.nameKo,
        name_ja: finalData.nameJa,
        name_ko: finalData.nameKo,
        price: Number(finalData.price),
        category: finalData.categoryJa || finalData.categoryKo,
        category_ja: finalData.categoryJa,
        category_ko: finalData.categoryKo,
        image: imageUrl,
        description: finalData.descriptionJa || finalData.descriptionKo,
        description_ja: finalData.descriptionJa,
        description_ko: finalData.descriptionKo,
      });

    setUploading(false);

    if (error) {
      alert('등록 실패: ' + error.message);
      return;
    }

    alert('상품이 등록되었습니다!');
    router.push('/products');
  };

  return (
    <div className="pb-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl md:text-2xl font-medium text-gray-900">상품 등록</h1>
        <p className="text-sm text-gray-500 mt-1">새로운 상품을 등록합니다 (일본어/한국어)</p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="max-w-2xl">
        <div className="bg-white rounded-xl shadow-sm p-4 md:p-6 space-y-5">

          {/* 이미지 업로드 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              상품 이미지 <span className="text-red-500">*</span>
            </label>
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center cursor-pointer hover:border-gray-400 transition-colors"
            >
              {imagePreview ? (
                <div className="relative w-full aspect-square max-w-[200px] mx-auto">
                  <Image
                    src={imagePreview}
                    alt="미리보기"
                    fill
                    className="object-cover rounded-lg"
                  />
                </div>
              ) : (
                <div className="py-8">
                  <svg className="w-12 h-12 text-gray-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <p className="text-sm text-gray-500">클릭하여 이미지 선택</p>
                  <p className="text-xs text-gray-400 mt-1">JPG, PNG (최대 5MB)</p>
                </div>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageChange}
              className="hidden"
            />
            {imagePreview && (
              <button
                type="button"
                onClick={() => {
                  setImagePreview(null);
                  setImageFile(null);
                }}
                className="mt-2 text-sm text-red-500 hover:text-red-600"
              >
                이미지 삭제
              </button>
            )}
          </div>

          {/* 번역 버튼 */}
          <div className="p-3 bg-gray-50 rounded-lg">
            <button
              type="button"
              onClick={manualTranslate}
              disabled={translating}
              className="w-full px-4 py-2.5 text-sm bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 disabled:bg-gray-400 transition-colors"
            >
              {getTranslateButtonText()}
            </button>
            <p className="text-xs text-gray-400 mt-2 text-center">
              입력 완료 후 포커스 빠지면 자동 번역됩니다
            </p>
          </div>

          {/* 상품명 - 일본어 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              상품명 (日本語) <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                required
                value={formData.nameJa}
                onChange={(e) => setFormData({ ...formData, nameJa: e.target.value })}
                className="flex-1 px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-base"
                placeholder="例: ゴールドチェーンネックレス"
              />
              <button
                type="button"
                onClick={() => formData.nameKo && autoTranslate('name', 'ko', formData.nameKo)}
                disabled={translating || !formData.nameKo}
                className="px-3 py-2 text-xs bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
                title="한국어에서 번역"
              >
                ← KR
              </button>
            </div>
          </div>

          {/* 상품명 - 한국어 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              상품명 (한국어)
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={formData.nameKo}
                onChange={(e) => setFormData({ ...formData, nameKo: e.target.value })}
                className="flex-1 px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-base"
                placeholder="예: 골드 체인 목걸이"
              />
              <button
                type="button"
                onClick={() => formData.nameJa && autoTranslate('name', 'ja', formData.nameJa)}
                disabled={translating || !formData.nameJa}
                className="px-3 py-2 text-xs bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
                title="일본어에서 번역"
              >
                ← JP
              </button>
            </div>
          </div>

          {/* 카테고리 - 일본어/한국어 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                카테고리 (日本語) <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.categoryJa}
                onChange={(e) => {
                  const idx = categoriesJa.indexOf(e.target.value);
                  setFormData({
                    ...formData,
                    categoryJa: e.target.value,
                    categoryKo: idx >= 0 ? categoriesKo[idx] : formData.categoryKo
                  });
                }}
                className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-base"
              >
                {categoriesJa.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                카테고리 (한국어)
              </label>
              <select
                value={formData.categoryKo}
                onChange={(e) => {
                  const idx = categoriesKo.indexOf(e.target.value);
                  setFormData({
                    ...formData,
                    categoryKo: e.target.value,
                    categoryJa: idx >= 0 ? categoriesJa[idx] : formData.categoryJa
                  });
                }}
                className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-base"
              >
                {categoriesKo.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
          </div>

          {/* 가격 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                판매가 (¥) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                required
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-base"
                placeholder="0"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                정가 (¥)
              </label>
              <input
                type="number"
                value={formData.originalPrice}
                onChange={(e) => setFormData({ ...formData, originalPrice: e.target.value })}
                className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-base"
                placeholder="0"
              />
            </div>
          </div>

          {/* 재고 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              재고 수량
            </label>
            <input
              type="number"
              value={formData.stock}
              onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
              className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-base"
              placeholder="0"
            />
          </div>

          {/* 설명 - 일본어 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              상품 설명 (日本語)
            </label>
            <div className="flex gap-2">
              <textarea
                rows={3}
                value={formData.descriptionJa}
                onChange={(e) => setFormData({ ...formData, descriptionJa: e.target.value })}
                className="flex-1 px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-base"
                placeholder="商品についての説明を入力してください"
              />
              <button
                type="button"
                onClick={() => formData.descriptionKo && autoTranslate('description', 'ko', formData.descriptionKo)}
                disabled={translating || !formData.descriptionKo}
                className="px-3 py-2 text-xs bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap self-start"
                title="한국어에서 번역"
              >
                ← KR
              </button>
            </div>
          </div>

          {/* 설명 - 한국어 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              상품 설명 (한국어)
            </label>
            <div className="flex gap-2">
              <textarea
                rows={3}
                value={formData.descriptionKo}
                onChange={(e) => setFormData({ ...formData, descriptionKo: e.target.value })}
                className="flex-1 px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-base"
                placeholder="상품에 대한 설명을 입력하세요"
              />
              <button
                type="button"
                onClick={() => formData.descriptionJa && autoTranslate('description', 'ja', formData.descriptionJa)}
                disabled={translating || !formData.descriptionJa}
                className="px-3 py-2 text-xs bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap self-start"
                title="일본어에서 번역"
              >
                ← JP
              </button>
            </div>
          </div>

          {/* Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 pt-4">
            <button
              type="submit"
              disabled={uploading}
              className="w-full sm:w-auto px-6 py-3 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-800 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {uploading ? '등록 중...' : '등록하기'}
            </button>
            <button
              type="button"
              onClick={() => router.back()}
              className="w-full sm:w-auto px-6 py-3 border border-gray-200 text-gray-600 text-sm rounded-lg hover:bg-gray-50 transition-colors"
            >
              취소
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
