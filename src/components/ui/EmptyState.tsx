import React from 'react';
import {PastelToken} from '../../types/models';
import {PASTEL_PALETTE} from '../../utils/theme';

interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  tone?: PastelToken;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  tone = 'lavender',
}) => {
  const palette = PASTEL_PALETTE[tone];
  return (
    <div className="flex flex-col items-center justify-center text-center py-12 px-6 rounded-2xl border border-dashed border-[#DFD5CE] dark:border-[#39334B] bg-white/70 dark:bg-[#1F1C29]/70">
      <div
        className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-3 border ${palette.bg} ${palette.border} ${palette.text}`}
      >
        {icon}
      </div>
      <h3 className="text-base font-bold text-[#2D2638] dark:text-[#F3EFFA]">{title}</h3>
      <p className="text-sm text-[#6E637E] dark:text-[#AFA6C2] max-w-md mt-1 leading-relaxed">
        {description}
      </p>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="mt-4 px-4 py-2 rounded-xl text-sm font-semibold bg-[#7F63D8] hover:bg-[#6D52C4] text-white transition-colors whitespace-nowrap"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
};
