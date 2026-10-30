import React from 'react';
import * as Tooltip from '@radix-ui/react-tooltip';

interface TruncatedTextWithTooltipProps {
  text: string;
  subtext?: string;
  maxWidthClass?: string;
  className?: string;
  children?: React.ReactNode;
}

export const TruncatedTextWithTooltip: React.FC<TruncatedTextWithTooltipProps> = ({
  text,
  subtext,
  maxWidthClass = 'max-w-[180px] sm:max-w-[240px] xl:max-w-[340px]',
  className = '',
  children,
}) => {
  return (
    <Tooltip.Provider delayDuration={150}>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>
          <span className={`block truncate cursor-default ${maxWidthClass} ${className}`}>
            {children || text}
          </span>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content
            side="top"
            align="start"
            sideOffset={5}
            className="z-50 max-w-sm rounded-xl bg-slate-900 border border-slate-700/80 px-3 py-2 text-xs text-slate-100 shadow-2xl backdrop-blur-md animate-in fade-in-0 zoom-in-95"
          >
            <p className="font-semibold text-white leading-snug">{text}</p>
            {subtext && <p className="text-[11px] font-mono text-slate-400 mt-1">{subtext}</p>}
            <Tooltip.Arrow className="fill-slate-900 stroke-slate-700/80" />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
};
