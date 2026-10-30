import { Account, AssetClass, BrokerId, CurrencyCode, Holding, PositionLot, CashLedgerTransaction } from './portfolio';

export interface FileSnapshot {
  fileName: string;
  fileExtension: string;
  sizeBytes: number;
  data: ArrayBuffer | string;
}

export interface IngestionResult {
  account: {
    brokerId: BrokerId;
    accountNumber: string;
    accountName: string;
    baseCurrency: CurrencyCode;
    cashBalances: Record<CurrencyCode, number>;
  };
  holdings: Array<{
    rawTicker: string;
    name: string;
    isin?: string;
    assetClass: AssetClass;
    instrumentCurrency: CurrencyCode;
    reportedCurrentPrice?: number;
    reportedValue?: number;
  }>;
  lots: Array<{
    ticketId: string;
    holdingRawTicker: string;
    type: 'BUY' | 'SELL';
    quantity: number;
    openPrice: number;
    openDateUtc: string;
    instrumentCurrency: CurrencyCode;
    reportedCurrentPrice?: number;
    reportedNetProfit?: number;
  }>;
  cashOperations?: CashLedgerTransaction[];
  warnings: string[];
}

export interface IBrokerAdapter {
  readonly id: BrokerId;
  readonly displayName: string;
  readonly supportedExtensions: string[];

  canHandle(file: FileSnapshot): Promise<boolean>;
  parse(file: FileSnapshot): Promise<IngestionResult>;
}
