import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Trash2 } from 'lucide-react';
import { db } from '@/lib/db';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught React error caught by ErrorBoundary:', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReload = () => {
    window.location.reload();
  };

  handleReset = async () => {
    try {
      await db.delete();
      window.location.reload();
    } catch (e) {
      console.error('Failed to reset DB', e);
      window.location.reload();
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#0B0E14] text-slate-100 flex items-center justify-center p-4">
          <div className="max-w-xl w-full p-8 rounded-3xl bg-slate-900/90 border border-rose-500/30 shadow-2xl backdrop-blur-xl">
            <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 mb-5">
              <AlertTriangle className="w-7 h-7" />
            </div>
            
            <h2 className="text-xl font-bold text-slate-100">
              Aplikace narazila na neočekávanou chybu
            </h2>
            <p className="text-sm text-slate-400 mt-2 leading-relaxed">
              Omlouváme se, při vykreslování došlo k chybě. Vaše data jsou bezpečně uložena v mezipaměti prohlížeče.
            </p>

            {this.state.error && (
              <div className="mt-4 p-4 rounded-xl bg-slate-950/80 border border-slate-800 text-xs font-mono text-rose-300 overflow-x-auto">
                <p className="font-bold">{this.state.error.name}: {this.state.error.message}</p>
                {this.state.error.stack && (
                  <pre className="mt-2 text-[10px] text-slate-500 whitespace-pre-wrap max-h-36 overflow-y-auto">
                    {this.state.error.stack}
                  </pre>
                )}
              </div>
            )}

            <div className="mt-6 flex flex-wrap gap-3">
              <button
                onClick={this.handleReload}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/25 transition-all"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Obnovit aplikaci</span>
              </button>
              <button
                onClick={this.handleReset}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-rose-950/60 hover:text-rose-300 text-slate-300 text-xs font-medium border border-slate-700/80 transition-all"
              >
                <Trash2 className="w-4 h-4" />
                <span>Vymazat mezipaměť a obnovit</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
