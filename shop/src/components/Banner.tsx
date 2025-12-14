"use client";

import { useState, useEffect } from "react";
import { useLanguage } from "@/contexts/LanguageContext";

export default function Banner() {
  const { t } = useLanguage();
  const [current, setCurrent] = useState(0);

  const banners = [
    {
      id: 1,
      title: "NEW ARRIVAL",
      subtitle: "2025 COLLECTION",
      descriptionKey: "banner.newArrival",
      bg: "bg-gradient-to-r from-rose-100 to-pink-100",
      textColor: "text-gray-800"
    },
    {
      id: 2,
      title: "SPECIAL SALE",
      subtitle: "UP TO 30% OFF",
      descriptionKey: "banner.sale",
      bg: "bg-gradient-to-r from-gray-900 to-gray-700",
      textColor: "text-white"
    }
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrent((prev) => (prev + 1) % banners.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  const banner = banners[current];

  return (
    <div className={`relative h-[300px] md:h-[450px] ${banner.bg} transition-all duration-500`}>
      <div className="absolute inset-0 flex items-center justify-center px-4">
        <div className={`text-center ${banner.textColor}`}>
          <p className="text-xs md:text-sm tracking-[0.2em] md:tracking-[0.3em] mb-2">{banner.subtitle}</p>
          <h1 className="text-3xl md:text-5xl lg:text-6xl font-light tracking-wider md:tracking-widest mb-3 md:mb-4">
            {banner.title}
          </h1>
          <p className="text-sm md:text-base opacity-80 mb-6 md:mb-8">
            {t(banner.descriptionKey)}
          </p>
          <button className={`px-6 md:px-8 py-3 md:py-3 border ${banner.textColor === 'text-white' ? 'border-white hover:bg-white hover:text-gray-900' : 'border-gray-800 hover:bg-gray-800 hover:text-white'} text-sm tracking-wide transition-colors min-h-[44px]`}>
            SHOP NOW
          </button>
        </div>
      </div>

      {/* Indicators - 더 큰 터치 영역 */}
      <div className="absolute bottom-4 md:bottom-6 left-1/2 -translate-x-1/2 flex space-x-3">
        {banners.map((_, idx) => (
          <button
            key={idx}
            onClick={() => setCurrent(idx)}
            className={`w-2.5 h-2.5 md:w-2 md:h-2 rounded-full transition-colors p-2 -m-2 ${
              idx === current ? "bg-gray-800" : "bg-gray-400"
            }`}
            aria-label={`배너 ${idx + 1}`}
          />
        ))}
      </div>
    </div>
  );
}
