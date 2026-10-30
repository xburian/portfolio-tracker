import { BrokerId } from '@/types/portfolio';
import { FileSnapshot, IBrokerAdapter, IngestionResult } from '@/types/broker';
import { XtbAdapter } from './xtbParser';
import { DegiroAdapter } from './degiroParser';
import { IbkrAdapter } from './ibkrParser';
import { PortuAdapter } from './portuParser';
import { GenericCsvAdapter } from './genericCsvParser';

export class BrokerAdapterRegistry {
  private adapters: Map<BrokerId, IBrokerAdapter> = new Map();

  constructor() {
    this.register(new XtbAdapter());
    this.register(new DegiroAdapter());
    this.register(new IbkrAdapter());
    this.register(new PortuAdapter());
    this.register(new GenericCsvAdapter());
  }

  register(adapter: IBrokerAdapter): void {
    this.adapters.set(adapter.id, adapter);
  }

  get(id: BrokerId): IBrokerAdapter {
    const adapter = this.adapters.get(id);
    if (!adapter) throw new Error(`Broker adapter '${id}' not registered.`);
    return adapter;
  }

  async detectAndParse(file: FileSnapshot): Promise<IngestionResult> {
    // Try specialized adapters first (excluding generic CSV)
    for (const [id, adapter] of this.adapters.entries()) {
      if (id === 'GENERIC_CSV') continue;
      if (adapter.supportedExtensions.includes(file.fileExtension.toLowerCase())) {
        if (await adapter.canHandle(file)) {
          return await adapter.parse(file);
        }
      }
    }

    // Fallback to generic CSV if extension matches
    const generic = this.adapters.get('GENERIC_CSV');
    if (generic && generic.supportedExtensions.includes(file.fileExtension.toLowerCase())) {
      return await generic.parse(file);
    }

    throw new Error(`Nepodařilo se rozpoznat formát souboru ${file.fileName}. Podporovány jsou XTB (.xlsx), Degiro (.xlsx / .csv), IBKR (.csv) a Portu (.pdf / .csv).`);
  }
}

export const brokerRegistry = new BrokerAdapterRegistry();
