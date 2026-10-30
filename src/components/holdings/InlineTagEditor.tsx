import React, { useState } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { Tag, Plus, X, Check } from 'lucide-react';
import { usePortfolioStore } from '@/lib/stores/usePortfolioStore';

interface InlineTagEditorProps {
  holdingId: string;
  tags: string[];
}

export const InlineTagEditor: React.FC<InlineTagEditorProps> = ({ holdingId, tags }) => {
  const [open, setOpen] = useState(false);
  const [newTagInput, setNewTagInput] = useState('');
  const updateHoldingTags = usePortfolioStore((s) => s.updateHoldingTags);

  const handleAddTag = () => {
    const trimmed = newTagInput.trim();
    if (!trimmed || tags.includes(trimmed)) return;
    updateHoldingTags(holdingId, [...tags, trimmed]);
    setNewTagInput('');
  };

  const handleRemoveTag = (t: string) => {
    updateHoldingTags(holdingId, tags.filter((x) => x !== t));
  };

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          className="flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-mono text-slate-400 hover:text-slate-200 hover:bg-slate-800 border border-slate-800/80 transition-colors"
          title="Upravit štítky"
        >
          <Tag className="w-3 h-3 text-indigo-400" />
          <span>{tags.length > 0 ? tags[0] : 'Přidat štítek'}</span>
          {tags.length > 1 && (
            <span className="text-[10px] text-slate-500 font-bold">+{tags.length - 1}</span>
          )}
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={5}
          className="z-50 w-64 p-3 rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl backdrop-blur-xl animate-in fade-in"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-200">Štítky aktiva</span>
            <span className="text-[10px] text-slate-500">{tags.length} aktivní</span>
          </div>

          {/* Current tags */}
          <div className="flex flex-wrap gap-1.5 mb-3 max-h-32 overflow-y-auto">
            {tags.map((t) => (
              <span
                key={t}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-mono bg-indigo-500/10 text-indigo-300 border border-indigo-500/20"
              >
                <span>#{t}</span>
                <button
                  onClick={() => handleRemoveTag(t)}
                  className="hover:text-rose-400 ml-0.5"
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              </span>
            ))}
          </div>

          {/* Add input */}
          <div className="flex items-center gap-1.5">
            <input
              type="text"
              value={newTagInput}
              onChange={(e) => setNewTagInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddTag()}
              placeholder="Nový štítek..."
              className="flex-1 px-2 py-1 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
            />
            <button
              onClick={handleAddTag}
              className="p-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
};
