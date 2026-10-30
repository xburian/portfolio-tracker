import React, { useState, useRef } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Upload, X, FileSpreadsheet, CheckCircle2, AlertCircle, Loader2, FileText, Sparkles, RotateCcw } from 'lucide-react';
import { usePortfolioStore } from '@/lib/stores/usePortfolioStore';

interface ImportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const ImportModal: React.FC<ImportModalProps> = ({ open, onOpenChange }) => {
  const [activeMode, setActiveMode] = useState<'files' | 'text'>('files');
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [pastedText, setPastedText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [importStatus, setImportStatus] = useState<Array<{ name: string; count: number; error?: string }>>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const importFilesBatch = usePortfolioStore((s) => s.importFilesBatch);
  const importRawText = usePortfolioStore((s) => s.importRawText);
  const loadSampleFiles = usePortfolioStore((s) => s.loadSampleFiles);
  const resetAndReloadSampleFiles = usePortfolioStore((s) => s.resetAndReloadSampleFiles);

  const handleFiles = (files: FileList | File[]) => {
    const list = Array.from(files).filter(f => 
      f.name.endsWith('.xlsx') || f.name.endsWith('.xls') || f.name.endsWith('.csv') || f.name.endsWith('.pdf')
    );
    setSelectedFiles(prev => [...prev, ...list]);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const handleStartImport = async () => {
    if (activeMode === 'files') {
      if (selectedFiles.length === 0) return;
      setIsProcessing(true);
      setImportStatus([]);

      try {
        const results = await importFilesBatch(selectedFiles);
        setImportStatus(results.map(r => ({ name: r.accountName, count: r.holdingsCount })));
        setSelectedFiles([]);
      } catch (e: any) {
        setImportStatus([{ name: 'Chyba importu', count: 0, error: e.message || String(e) }]);
      } finally {
        setIsProcessing(false);
      }
    } else {
      if (!pastedText.trim()) return;
      setIsProcessing(true);
      setImportStatus([]);

      try {
        const res = await importRawText(pastedText, 'vlozene_transakce.csv');
        setImportStatus([{ name: res.accountName, count: res.holdingsCount }]);
        setPastedText('');
      } catch (e: any) {
        setImportStatus([{ name: 'Chyba importu textu', count: 0, error: e.message || String(e) }]);
      } finally {
        setIsProcessing(false);
      }
    }
  };

  const handleLoadSamples = async () => {
    setIsProcessing(true);
    setImportStatus([]);
    try {
      const results = await loadSampleFiles();
      setImportStatus(results.map(r => ({ name: r.accountName, count: r.holdingsCount })));
    } catch (e: any) {
      setImportStatus([{ name: 'Chyba načtení', count: 0, error: e.message || String(e) }]);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleResetAndReload = async () => {
    if (
      !window.confirm(
        'Smazat všechny duplicity a čistě importovat 7 originálních výpisů (Portu 2x, Degiro, IBKR, XTB 3x)?\n\nDatabáze bude vyčištěna a data přepočtena přesně podle nahraných dokumentů (~9 mil. Kč).'
      )
    ) {
      return;
    }
    setIsProcessing(true);
    setImportStatus([]);
    try {
      const results = await resetAndReloadSampleFiles();
      setImportStatus(results.map(r => ({ name: r.accountName, count: r.holdingsCount })));
    } catch (e: any) {
      setImportStatus([{ name: 'Chyba resetu a načtení', count: 0, error: e.message || String(e) }]);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClose = () => {
    setSelectedFiles([]);
    setPastedText('');
    setImportStatus([]);
    onOpenChange(false);
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm animate-in fade-in" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-xl p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl animate-in fade-in zoom-in-95">
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                <Upload className="w-5 h-5" />
              </div>
              <div>
                <Dialog.Title className="text-base font-bold text-slate-100">
                  Nahrát výpis z brokera
                </Dialog.Title>
                <Dialog.Description className="text-xs text-slate-400">
                  Podporovány jsou soubory XTB (.xlsx), Degiro (.xlsx / .csv), IBKR (.csv) a Portu (.pdf / .csv)
                </Dialog.Description>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Quick Demo Pre-load Pill */}
          <div className="mt-4 p-3 rounded-2xl bg-indigo-950/30 border border-indigo-500/30 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Sparkles className="w-4 h-4 text-indigo-400 shrink-0" />
              <div className="text-xs">
                <p className="font-semibold text-indigo-200">Rychlé načtení vašich výpisů</p>
                <p className="text-[11px] text-slate-400">XTB (3x) + Degiro + IBKR + Portu (2x) jedním klikem</p>
              </div>
            </div>
            <button
              onClick={handleLoadSamples}
              disabled={isProcessing}
              className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold shadow-md transition-all shrink-0"
            >
              {isProcessing ? 'Načítám...' : 'Načíst 1-klikem'}
            </button>
          </div>

          {/* Smazat & čistě importovat */}
          <div className="mt-2.5 p-3 rounded-2xl bg-rose-950/20 border border-rose-500/20 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <RotateCcw className="w-4 h-4 text-rose-400 shrink-0" />
              <div className="text-xs">
                <p className="font-semibold text-rose-200">Smazat mezipaměť a čistě importovat</p>
                <p className="text-[11px] text-slate-400">Vyčistí duplicity a čistě načte 7 souborů (~9 mil. Kč)</p>
              </div>
            </div>
            <button
              onClick={handleResetAndReload}
              disabled={isProcessing}
              className="px-3 py-1.5 rounded-xl bg-rose-600/30 hover:bg-rose-600/40 border border-rose-500/40 text-rose-200 disabled:opacity-50 text-xs font-semibold shadow-md transition-all shrink-0 flex items-center gap-1.5"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${isProcessing ? 'animate-spin' : ''}`} />
              <span>Smazat & načíst</span>
            </button>
          </div>

          {/* Mode Switcher */}
          <div className="flex items-center gap-2 mt-4 p-1 rounded-xl bg-slate-950 border border-slate-800 text-xs">
            <button
              onClick={() => setActiveMode('files')}
              className={`flex-1 py-1.5 px-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-1.5 ${
                activeMode === 'files' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Nahrát soubory (.xlsx, .csv, .pdf)</span>
            </button>
            <button
              onClick={() => setActiveMode('text')}
              className={`flex-1 py-1.5 px-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-1.5 ${
                activeMode === 'text' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Vložit text ze schránky</span>
            </button>
          </div>

          {/* Mode 1: Drag & Drop Zone */}
          {activeMode === 'files' ? (
            <>
              <div
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`my-4 p-8 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-all ${
                  isDragging
                    ? 'border-indigo-500 bg-indigo-500/10 scale-[1.01]'
                    : 'border-slate-800 hover:border-slate-700 bg-slate-950/50'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".xlsx,.xls,.csv,.pdf"
                  className="hidden"
                  onChange={(e) => e.target.files && handleFiles(e.target.files)}
                />
                <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 mb-3">
                  <FileSpreadsheet className="w-6 h-6" />
                </div>
                <p className="text-sm font-semibold text-slate-200">
                  Přetáhněte sem soubory nebo klikněte pro výběr
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Můžete nahrát i více účtů najednou (např. XTB CZK + USD + EUR + Degiro)
                </p>
              </div>

              {/* Selected Files List */}
              {selectedFiles.length > 0 && (
                <div className="mb-4 flex flex-col gap-1.5 max-h-40 overflow-y-auto">
                  <span className="text-xs font-semibold text-slate-400">Připravené soubory ({selectedFiles.length}):</span>
                  {selectedFiles.map((file, idx) => (
                    <div
                      key={`${file.name}-${idx}`}
                      className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono"
                    >
                      <div className="flex items-center gap-2 truncate mr-2">
                        <FileSpreadsheet className="w-4 h-4 text-indigo-400 shrink-0" />
                        <span className="text-slate-200 truncate">{file.name}</span>
                      </div>
                      <span className="text-[10px] text-slate-500 shrink-0">
                        {(file.size / 1024).toFixed(1)} kB
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            /* Mode 2: Paste CSV Text */
            <div className="my-4">
              <label className="block text-xs font-medium text-slate-400 mb-1.5">
                Vložte řádky CSV nebo tabulky zkopírované ze souboru brokera:
              </label>
              <textarea
                value={pastedText}
                onChange={(e) => setPastedText(e.target.value)}
                placeholder="Date,Product,ISIN,Quantity,Price... nebo zkopírovaný text"
                rows={6}
                className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-xs font-mono focus:outline-none focus:border-indigo-500 resize-none"
              />
            </div>
          )}

          {/* Import Results */}
          {importStatus.length > 0 && (
            <div className="mb-4 flex flex-col gap-1.5 p-3 rounded-xl bg-slate-950 border border-slate-800">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-200">
                <span>Výsledek zpracování:</span>
              </div>
              {importStatus.map((s, idx) => (
                <div key={idx} className="text-xs font-mono ml-2">
                  {s.error ? (
                    <div className="flex items-center gap-1.5 text-rose-400">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>Chyba: {s.error}</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 text-emerald-400">
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                      <span>{s.name}: načteno {s.count} otevřených pozic</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
            <button
              onClick={handleClose}
              className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              Zavřít
            </button>
            <button
              onClick={handleStartImport}
              disabled={
                isProcessing ||
                (activeMode === 'files' && selectedFiles.length === 0) ||
                (activeMode === 'text' && !pastedText.trim())
              }
              className="flex items-center gap-2 px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-semibold shadow-lg shadow-indigo-600/25 transition-all"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Zpracovávám...</span>
                </>
              ) : (
                <span>Spustit import</span>
              )}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};
