import React, { useState } from 'react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import * as Dialog from '@radix-ui/react-dialog';
import { User, Users, Plus, Check, ChevronDown, Sparkles, Database, X, Trash2 } from 'lucide-react';
import { usePortfolioStore } from '@/lib/stores/usePortfolioStore';

export const ProfileSwitcher: React.FC = () => {
  const profiles = usePortfolioStore((s) => s.profiles);
  const activeProfileId = usePortfolioStore((s) => s.activeProfileId);
  const switchProfile = usePortfolioStore((s) => s.switchProfile);
  const createProfile = usePortfolioStore((s) => s.createProfile);
  const deleteProfile = usePortfolioStore((s) => s.deleteProfile);
  const compactDatabase = usePortfolioStore((s) => s.compactDatabase);

  const [modalOpen, setModalOpen] = useState(false);
  const [newProfileName, setNewProfileName] = useState('');
  const [newProfileColor, setNewProfileColor] = useState('#10B981');
  const [compactionMsg, setCompactionMsg] = useState<string | null>(null);

  const activeProfile = profiles.find((p) => p.id === activeProfileId) || profiles[0];
  const isConsolidated = activeProfileId === 'consolidated';

  const colorOptions = [
    { label: 'Indigo', hex: '#6366F1' },
    { label: 'Emerald', hex: '#10B981' },
    { label: 'Amber', hex: '#F59E0B' },
    { label: 'Rose', hex: '#F43F5E' },
    { label: 'Cyan', hex: '#06B6D4' },
    { label: 'Purple', hex: '#A855F7' },
  ];

  const handleCreate = async () => {
    if (!newProfileName.trim()) return;
    await createProfile(newProfileName.trim(), newProfileColor);
    setNewProfileName('');
    setModalOpen(false);
  };

  const handleCompact = async () => {
    try {
      const report = await compactDatabase();
      setCompactionMsg(`Zkompaktováno: ušetřeno ~${report.estimatedMemorySavedPercent} % paměti (${report.prunedLotsCount} vyčerpaných lotů odstraněno).`);
      setTimeout(() => setCompactionMsg(null), 4000);
    } catch (e: any) {
      setCompactionMsg(`Chyba kompaktace: ${e.message}`);
    }
  };

  return (
    <>
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <button className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl border border-slate-800 bg-slate-900/60 hover:bg-slate-800/80 hover:border-slate-700 transition-all text-xs">
            <div
              className="w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] text-white shrink-0 shadow-sm"
              style={{ backgroundColor: isConsolidated ? '#6366F1' : activeProfile?.avatarColor || '#6366F1' }}
            >
              {isConsolidated ? <Users className="w-3 h-3" /> : (activeProfile?.name || 'U').slice(0, 2).toUpperCase()}
            </div>
            <span className="font-semibold text-slate-200 hidden sm:inline max-w-[130px] truncate">
              {isConsolidated ? 'Konsolidovaný pohled' : activeProfile?.name}
            </span>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </button>
        </DropdownMenu.Trigger>

        <DropdownMenu.Portal>
          <DropdownMenu.Content
            align="end"
            sideOffset={8}
            className="z-50 w-64 rounded-2xl bg-slate-900 border border-slate-800 p-2 shadow-2xl backdrop-blur-xl animate-in fade-in-0 zoom-in-95"
          >
            <div className="px-2.5 py-1.5 text-[10px] font-mono uppercase tracking-wider text-slate-500">
              Přepnout portfolio / uživatele
            </div>

            {/* Profiles list */}
            <div className="flex flex-col gap-1">
              {profiles.map((p) => (
                <div key={p.id} className="flex items-center justify-between group rounded-xl hover:bg-slate-800/70">
                  <DropdownMenu.Item
                    onClick={() => switchProfile(p.id)}
                    className="flex-1 flex items-center justify-between px-2.5 py-2 text-xs cursor-pointer outline-none transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
                      <div
                        className="w-6 h-6 rounded-full flex items-center justify-center font-bold text-[11px] text-white shrink-0"
                        style={{ backgroundColor: p.avatarColor }}
                      >
                        {p.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="text-left">
                        <span className="font-medium text-slate-200 block truncate max-w-[140px]">{p.name}</span>
                        <span className="text-[10px] text-slate-500 font-mono">
                          {p.isDefault ? 'Výchozí profil' : 'Oddělený profil'}
                        </span>
                      </div>
                    </div>
                    {activeProfileId === p.id && <Check className="w-4 h-4 text-indigo-400 shrink-0" />}
                  </DropdownMenu.Item>

                  {!p.isDefault && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(`Opravdu chcete smazat profil "${p.name}" a všechny jeho pozice?`)) {
                          deleteProfile(p.id);
                        }
                      }}
                      className="p-1.5 mr-1.5 text-slate-500 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Smazat profil"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}

              {/* Consolidated view item */}
              <DropdownMenu.Item
                onClick={() => switchProfile('consolidated')}
                className="flex items-center justify-between px-2.5 py-2 rounded-xl text-xs cursor-pointer hover:bg-slate-800 outline-none transition-colors border-t border-slate-800/80 mt-1 pt-2"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-6 h-6 rounded-full bg-indigo-600 flex items-center justify-center text-white shrink-0 shadow-sm">
                    <Users className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <span className="font-semibold text-indigo-300 block">Všechny profily (Společně)</span>
                    <span className="text-[10px] text-slate-500 font-mono">Konsolidovaný rodinný přehled</span>
                  </div>
                </div>
                {isConsolidated && <Check className="w-4 h-4 text-indigo-400 shrink-0" />}
              </DropdownMenu.Item>
            </div>

            <DropdownMenu.Separator className="h-px bg-slate-800 my-2" />

            {/* Actions */}
            <DropdownMenu.Item
              onClick={() => setModalOpen(true)}
              className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-xs text-indigo-400 hover:text-indigo-300 hover:bg-indigo-950/30 cursor-pointer outline-none transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span className="font-medium">Přidat další profil</span>
            </DropdownMenu.Item>

            <DropdownMenu.Item
              onClick={handleCompact}
              className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-800 cursor-pointer outline-none transition-colors mt-0.5"
            >
              <Database className="w-3.5 h-3.5 text-slate-500" />
              <span>Zkompaktovat databázi</span>
            </DropdownMenu.Item>

            <DropdownMenu.Item
              onClick={async () => {
                if (confirm('Opravdu chcete vyčistit veškerá duplicitní data a znovu načíst přesná portfolia (7.7M – 9M Kč)?')) {
                  const loadSampleFiles = usePortfolioStore.getState().loadSampleFiles;
                  await loadSampleFiles();
                }
              }}
              className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-xs text-amber-400 hover:text-amber-300 hover:bg-amber-950/30 cursor-pointer outline-none transition-colors mt-0.5"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Reset & načíst přesná data (~8-9M)</span>
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>

      {/* Compaction Toast feedback */}
      {compactionMsg && (
        <div className="fixed bottom-5 right-5 z-50 p-3 rounded-xl bg-slate-900 border border-indigo-500/50 shadow-2xl text-xs text-indigo-200 flex items-center gap-2 animate-in fade-in">
          <Sparkles className="w-4 h-4 text-indigo-400" />
          <span>{compactionMsg}</span>
        </div>
      )}

      {/* Create Profile Modal */}
      <Dialog.Root open={modalOpen} onOpenChange={setModalOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm animate-in fade-in" />
          <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-sm p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <Dialog.Title className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <User className="w-4 h-4 text-indigo-400" />
                <span>Nový uživatelský profil</span>
              </Dialog.Title>
              <button onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-white p-1">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="my-4 flex flex-col gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Název profilu:</label>
                <input
                  type="text"
                  placeholder="např. Manželka, Děti, Firma s.r.o."
                  value={newProfileName}
                  onChange={(e) => setNewProfileName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100 focus:outline-none focus:border-indigo-500 font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Barva avatara:</label>
                <div className="flex items-center gap-2">
                  {colorOptions.map((c) => (
                    <button
                      key={c.hex}
                      type="button"
                      onClick={() => setNewProfileColor(c.hex)}
                      className={`w-7 h-7 rounded-full transition-transform ${
                        newProfileColor === c.hex ? 'scale-110 ring-2 ring-white' : 'opacity-80 hover:opacity-100'
                      }`}
                      style={{ backgroundColor: c.hex }}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                onClick={() => setModalOpen(false)}
                className="px-3 py-1.5 rounded-xl text-xs font-medium text-slate-400 hover:text-white"
              >
                Zrušit
              </button>
              <button
                onClick={handleCreate}
                disabled={!newProfileName.trim()}
                className="px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold shadow-md"
              >
                Vytvořit profil
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
};
