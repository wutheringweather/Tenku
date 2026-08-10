import { useState } from 'react';
import { site } from '@/config/site';

interface CaBadgeProps {
  className?: string;
  size?: 'sm' | 'md';
}

export function CaBadge({ className = '', size = 'md' }: CaBadgeProps) {
  const [copied, setCopied] = useState(false);

  if (!site.ca) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(site.ca);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const textSizes = size === 'sm' ? 'text-[10px]' : 'text-[11px]';
  const padding = size === 'sm' ? 'px-2.5 py-1.5' : 'px-3 py-1.5';

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={`panel pointer-events-auto flex items-center gap-1.5 ${padding} font-mono ${textSizes} text-ash/80 transition-all duration-300 hover:border-brass/40 hover:text-brass cursor-pointer ${className}`}
      title="Click to copy CA"
    >
      <span className="font-semibold text-brass shrink-0">CA :</span>
      <span className="text-bone tracking-wide truncate max-w-[150px] sm:max-w-none">
        {copied ? 'Copied!' : site.ca}
      </span>
    </button>
  );
}
