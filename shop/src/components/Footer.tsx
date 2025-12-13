import Link from "next/link";

export default function Footer() {
  return (
    <footer className="bg-gray-50 border-t border-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="col-span-1 md:col-span-2">
            <h3 className="text-2xl font-light tracking-widest text-gray-900 mb-4">
              LUMIÈRE
            </h3>
            <p className="text-gray-500 text-sm leading-relaxed">
              프리미엄 주얼리 브랜드 루미에르.<br />
              당신의 특별한 순간을 빛나게 합니다.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="text-sm font-medium text-gray-900 mb-4 tracking-wide">QUICK LINKS</h4>
            <ul className="space-y-2">
              <li><Link href="/" className="text-gray-500 hover:text-gray-900 text-sm">Home</Link></li>
              <li><Link href="/?category=목걸이" className="text-gray-500 hover:text-gray-900 text-sm">Necklace</Link></li>
              <li><Link href="/?category=귀걸이" className="text-gray-500 hover:text-gray-900 text-sm">Earrings</Link></li>
              <li><Link href="/?category=반지" className="text-gray-500 hover:text-gray-900 text-sm">Rings</Link></li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="text-sm font-medium text-gray-900 mb-4 tracking-wide">CONTACT</h4>
            <ul className="space-y-2 text-sm text-gray-500">
              <li>Tel: 02-1234-5678</li>
              <li>Email: hello@lumiere.kr</li>
              <li>평일 10:00 - 18:00</li>
            </ul>
            {/* Social */}
            <div className="flex space-x-4 mt-4">
              <a href="#" className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073z"/>
                </svg>
              </a>
            </div>
          </div>
        </div>

        {/* Copyright */}
        <div className="border-t border-gray-200 mt-8 pt-8 text-center">
          <p className="text-gray-400 text-xs">
            © 2024 LUMIÈRE. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
