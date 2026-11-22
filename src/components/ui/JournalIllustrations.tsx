import React from 'react';

export const JournalBrandDoodle: React.FC<{className?: string}> = ({className = 'w-8 h-8'}) => (
  <svg viewBox="0 0 40 40" fill="none" className={className} aria-hidden="true">
    <rect x="6" y="5" width="28" height="30" rx="8" fill="#F2EAFF" stroke="#9D7CE8" strokeWidth="2" />
    <path d="M12.5 5V35" stroke="#D1BEF7" strokeWidth="2" />
    <rect x="16.5" y="12" width="12" height="5" rx="2.5" fill="#FCE8F1" stroke="#F073AC" strokeWidth="1.5" />
    <path d="M16.5 22H27.5M16.5 27H23.5" stroke="#7B5BE0" strokeWidth="2" strokeLinecap="round" />
    <circle cx="32" cy="9" r="3.8" fill="#FEF2C7" stroke="#E8B339" strokeWidth="1.5" />
  </svg>
);

export const HeroDeskDoodle: React.FC<{className?: string}> = ({className = 'w-44 h-28'}) => (
  <svg viewBox="0 0 200 120" fill="none" className={className} aria-hidden="true">
    {/* Pastel rounded backdrop */}
    <rect x="4" y="4" width="192" height="112" rx="20" fill="url(#heroCardGrad)" />
    <defs>
      <linearGradient id="heroCardGrad" x1="4" y1="4" x2="196" y2="116" gradientUnits="userSpaceOnUse">
        <stop stopColor="#EFE9FF" />
        <stop offset="0.55" stopColor="#F8ECFC" />
        <stop offset="1" stopColor="#E6F4FE" />
      </linearGradient>
    </defs>

    {/* Tiny leaf accents */}
    <path d="M18 96C15 88 21 80 28 84C26 91 22 96 18 96Z" fill="#77D4A6" opacity="0.85" />
    <path d="M169 25C174 18 184 18 186 24C181 29 174 29 169 25Z" fill="#63C89A" opacity="0.85" />

    {/* Open pastel journal */}
    <rect x="26" y="24" width="98" height="72" rx="12" fill="#FFFFFF" stroke="#D4C2F7" strokeWidth="2" />
    <path d="M75 24V96" stroke="#E5DAF9" strokeWidth="2" />
    {/* Yellow ribbon bookmark */}
    <path d="M98 24H106V40L102 36.5L98 40V24Z" fill="#FBBF24" />
    {/* Left page doodles */}
    <rect x="35" y="37" width="30" height="8" rx="4" fill="#FDE68A" />
    <rect x="35" y="51" width="28" height="5" rx="2.5" fill="#93C5FD" />
    <rect x="35" y="61" width="22" height="5" rx="2.5" fill="#DDD6FE" />
    <rect x="35" y="71" width="26" height="5" rx="2.5" fill="#FBCFE8" />
    {/* Right page checklist */}
    <circle cx="85" cy="48" r="3.5" fill="#6EE7B7" />
    <rect x="92" y="46" width="23" height="4" rx="2" fill="#DDD6FE" />
    <circle cx="85" cy="60" r="3.5" fill="#F9A8D4" />
    <rect x="92" y="58" width="20" height="4" rx="2" fill="#E9D5FF" />
    <circle cx="85" cy="72" r="3.5" fill="#93C5FD" />
    <rect x="92" y="70" width="24" height="4" rx="2" fill="#DDD6FE" />

    {/* Pastel green pen */}
    <g transform="rotate(-18 152 30)">
      <rect x="134" y="24" width="38" height="9" rx="4.5" fill="#6EE7B7" stroke="#34B882" strokeWidth="1.5" />
      <path d="M172 25.5L179 28.5L172 31.5V25.5Z" fill="#A7F3D0" />
    </g>

    {/* Coffee cup on saucer */}
    <circle cx="155" cy="72" r="22" fill="#FDE68A" opacity="0.55" />
    <circle cx="155" cy="72" r="15" fill="#FFFFFF" stroke="#FCD34D" strokeWidth="2" />
    <circle cx="155" cy="72" r="10" fill="#FBBF24" opacity="0.45" />
    <path d="M170 69C174 69 176 72 174 75C172 77 169 76 169 76" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round" />
  </svg>
);
