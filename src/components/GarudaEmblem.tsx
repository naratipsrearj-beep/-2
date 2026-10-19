import React from 'react';

interface GarudaEmblemProps {
  className?: string;
  width?: number | string;
  height?: number | string;
}

export const GarudaEmblem: React.FC<GarudaEmblemProps> = ({
  className = 'w-20 h-20 text-slate-900',
  width = 80,
  height = 80,
}) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 200 200"
      width={width}
      height={height}
      className={className}
      fill="currentColor"
      aria-label="ตราครุฑ"
    >
      {/* Royal Thai Garuda Emblem (พระครุฑพ่าห์) Vector Representation */}
      <g id="garuda-wings">
        {/* Left Wing Feathers */}
        <path d="M100 82 C85 65 65 48 38 40 C35 52 42 66 52 75 C40 70 30 76 25 88 C36 89 45 96 52 105 C38 103 26 112 20 125 C32 124 45 129 55 138 C42 142 32 153 28 165 C40 160 55 158 68 150 C78 144 88 135 94 122 C97 115 99 105 100 95 Z" />
        <path d="M50 48 C68 56 82 70 92 86 C82 80 68 70 50 62 Z" opacity="0.8" />
        <path d="M38 78 C54 84 72 96 82 110 C70 102 54 94 38 88 Z" opacity="0.8" />
        <path d="M32 114 C48 118 66 128 78 140 C66 132 50 126 32 122 Z" opacity="0.8" />
        
        {/* Right Wing Feathers */}
        <path d="M100 82 C115 65 135 48 162 40 C165 52 158 66 148 75 C160 70 170 76 175 88 C164 89 155 96 148 105 C162 103 174 112 180 125 C168 124 155 129 145 138 C158 142 168 153 172 165 C160 160 145 158 132 150 C122 144 112 135 106 122 C103 115 101 105 100 95 Z" />
        <path d="M150 48 C132 56 118 70 108 86 C118 80 132 70 150 62 Z" opacity="0.8" />
        <path d="M162 78 C146 84 128 96 118 110 C130 102 146 94 162 88 Z" opacity="0.8" />
        <path d="M168 114 C152 118 134 128 122 140 C134 132 150 126 168 122 Z" opacity="0.8" />
      </g>

      {/* Head, Crown (ชฎา), and Beak */}
      <g id="garuda-head">
        {/* Crown spire (ยอดชฎา) */}
        <polygon points="100,6 97,25 103,25" />
        <polygon points="100,18 95,35 105,35" />
        <path d="M92 36 L108 36 L106 48 L94 48 Z" />
        <path d="M89 48 L111 48 L113 58 L87 58 Z" />
        {/* Ear ornaments (กรรเจียกจร) */}
        <path d="M86 52 C78 50 74 42 76 34 C80 40 84 46 86 52 Z" />
        <path d="M114 52 C122 50 126 42 124 34 C120 40 116 46 114 52 Z" />
        {/* Face and Beak */}
        <circle cx="100" cy="65" r="12" />
        <path d="M100 66 Q100 78 94 77 Q100 82 106 77 Q100 78 100 66 Z" />
        {/* Eyes */}
        <circle cx="96" cy="63" r="1.8" fill="#fff" />
        <circle cx="104" cy="63" r="1.8" fill="#fff" />
      </g>

      {/* Torso, Chest, and Arms */}
      <g id="garuda-body">
        {/* Torso */}
        <path d="M92 78 C92 78 86 92 87 112 C91 116 109 116 113 112 C114 92 108 78 108 78 Z" />
        {/* Left Arm and Forearm */}
        <path d="M88 80 C80 82 66 90 62 102 C60 108 64 116 70 115 C76 114 84 98 88 94 Z" />
        {/* Right Arm and Forearm */}
        <path d="M112 80 C120 82 134 90 138 102 C140 108 136 116 130 115 C124 114 116 98 112 94 Z" />
        {/* Necklace / Ornaments */}
        <path d="M92 84 Q100 90 108 84 Q100 88 92 84 Z" fill="#fff" />
        <path d="M94 94 Q100 98 106 94 Q100 96 94 94 Z" fill="#fff" />
      </g>

      {/* Lower Body, Belt, Tail (หางครุฑ), Legs and Talons */}
      <g id="garuda-legs-tail">
        {/* Waist & Belt */}
        <rect x="88" y="110" width="24" height="6" rx="2" fill="#fff" />
        <rect x="90" y="112" width="20" height="3" />
        {/* Tail (Fan of feathers at the bottom) */}
        <path d="M100 116 C95 130 90 152 80 178 C88 174 95 170 100 166 C105 170 112 174 120 178 C110 152 105 130 100 116 Z" />
        <path d="M100 120 L96 170 L100 164 L104 170 Z" opacity="0.6" />
        {/* Thighs and Knees (กนกขากาง) */}
        <path d="M88 116 C80 124 72 136 75 148 C80 144 86 136 90 126 Z" />
        <path d="M112 116 C120 124 128 136 125 148 C120 144 114 136 110 126 Z" />
        {/* Talons (กรงเล็บ) */}
        <path d="M74 148 C70 154 68 162 65 170 C70 168 76 162 78 156 C80 162 84 168 88 172 C87 164 85 156 82 150 Z" />
        <path d="M126 148 C130 154 132 162 135 170 C130 168 124 162 122 156 C120 162 116 168 112 172 C113 164 115 156 118 150 Z" />
      </g>
    </svg>
  );
};
