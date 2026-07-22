export interface ParticipantRecord {
  participant: string; // e.g. "Client", "DII", "FII", "Pro", "TOTAL"
  futureIndexLong: number;
  futureIndexShort: number;
  futureStockLong: number;
  futureStockShort: number;
  optionIndexCallLong: number;
  optionIndexPutLong: number;
  optionIndexCallShort: number;
  optionIndexPutShort: number;
  optionStockCallLong: number;
  optionStockPutLong: number;
  optionStockCallShort: number;
  optionStockPutShort: number;
  totalLongContracts: number;
  totalShortContracts: number;
}

export interface DayScrapeResult {
  status: "success" | "holiday" | "error";
  date: string; // e.g. "16-Jul-2026"
  data?: ParticipantRecord[];
  message?: string;
  cached?: boolean;
}

export type ScraperResponse = DayScrapeResult[];
