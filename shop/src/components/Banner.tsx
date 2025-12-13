"use client";

import { useState, useEffect } from "react";

const banners = [
  {
    id: 1,
    title: "NEW COLLECTION",
    subtitle: "2024 S/S",
    description: "봄을 닮은 새로운 컬렉션을 만나보세요",
    bg: "bg-gradient-to-r from-rose-100 to-pink-100",
    textColor: "text-gray-800"
  },
  {
    id: 2,
    title: "SPECIAL SALE",
    subtitle: "UP TO 30% OFF",
    description: "시즌 오프 특별 할인",
    bg: "bg-gradient-to-r from-gray-900 to-gray-700",
    textColor: "text-white"
  }
];

export default function Banner() {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrent((prev) => (prev + 1) % banners.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  const banner = banners[current];

  return (
    <div className={`relative h-[400px] md:h-[500px] ${banner.bg} transition-all duration-500`}>
      <div className="absolute inset-0 flex items-center justify-center">
        <div className={`text-center ${banner.textColor}`}>
          <p className="text-sm tracking-[0.3em] mb-2">{banner.subtitle}</p>
          <h1 className="text-4xl md:text-6xl font-light tracking-widest mb-4">
            {banner.title}
          </h1>
          <p className="text-sm md:text-base opacity-80 mb-8">
            {banner.description}
          </p>
          <button className={`px-8 py-3 border ${banner.textColor === 'text-white' ? 'border-white hover:bg-white hover:text-gray-900' : 'border-gray-800 hover:bg-gray-800 hover:text-white'} text-sm tracking-wide transition-colors`}>
            SHOP NOW
          </button>
        </div>
      </div>

      {/* Indicators */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex space-x-2">
        {banners.map((_, idx) => (
          <button
            key={idx}
            onClick={() => setCurrent(idx)}
            className={`w-2 h-2 rounded-full transition-colors ${
              idx === current ? "bg-gray-800" : "bg-gray-400"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
