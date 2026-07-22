import React from "react";
import { ArrowUpRight, ArrowDownRight, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { DayScrapeResult, ParticipantRecord } from "../types";

interface ParticipantTableProps {
  results: DayScrapeResult[];
  selectedParticipant: string; // "Client" | "DII" | "FII" | "Pro" | "TOTAL"
}

interface PositionMetric {
  label: string;
  getLong: (rec: ParticipantRecord) => number;
  getShort: (rec: ParticipantRecord) => number;
  category: "Futures" | "Options";
}

export default function ParticipantTable({ results, selectedParticipant }: ParticipantTableProps) {
  // Sort results by date so they appear from oldest to newest (left to right) or vice-versa
  // Let's do chronological oldest on left, newest on right, and then a Change column!
  const sortedResults = [...results].filter(r => r.status === "success").reverse(); // Oldest first, newest last

  if (sortedResults.length === 0) {
    return (
      <div className="p-8 text-center bg-gray-50 border border-gray-100 rounded-2xl">
        <p className="text-sm text-gray-500">No trading day data available to display.</p>
      </div>
    );
  }

  const latestResult = sortedResults[sortedResults.length - 1];
  const previousResult = sortedResults.length > 1 ? sortedResults[sortedResults.length - 2] : null;

  const metrics: PositionMetric[] = [
    {
      label: "Index Futures",
      getLong: (r) => r.futureIndexLong,
      getShort: (r) => r.futureIndexShort,
      category: "Futures",
    },
    {
      label: "Stock Futures",
      getLong: (r) => r.futureStockLong,
      getShort: (r) => r.futureStockShort,
      category: "Futures",
    },
    {
      label: "Index Calls",
      getLong: (r) => r.optionIndexCallLong,
      getShort: (r) => r.optionIndexCallShort,
      category: "Options",
    },
    {
      label: "Index Puts",
      getLong: (r) => r.optionIndexPutLong,
      getShort: (r) => r.optionIndexPutShort,
      category: "Options",
    },
    {
      label: "Stock Calls",
      getLong: (r) => r.optionStockCallLong,
      getShort: (r) => r.optionStockCallShort,
      category: "Options",
    },
    {
      label: "Stock Puts",
      getLong: (r) => r.optionStockPutLong,
      getShort: (r) => r.optionStockPutShort,
      category: "Options",
    },
  ];

  const formatNum = (num: number) => {
    return new Intl.NumberFormat("en-IN").format(num);
  };

  const getParticipantRecord = (result: DayScrapeResult): ParticipantRecord | undefined => {
    return result.data?.find(
      (p) => p.participant.toLowerCase().trim() === selectedParticipant.toLowerCase().trim()
    );
  };

  return (
    <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
      <div className="px-3.5 py-2.5 sm:px-6 sm:py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
        <div className="flex items-center gap-1.5 sm:gap-2">
          <div className="h-2 w-2 sm:h-2.5 sm:w-2.5 rounded-full bg-indigo-500" />
          <h3 className="font-semibold text-gray-900 font-display text-xs sm:text-sm">
            Position Breakdown for <span className="text-indigo-600 font-bold">{selectedParticipant}</span>
          </h3>
        </div>
        <span className="text-[8px] sm:text-[10px] font-mono font-medium text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
          Value: No. of Contracts
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/30">
              <th className="p-2 sm:p-4 text-[9px] sm:text-xs font-semibold text-gray-400 uppercase tracking-wider font-display">Contract Metric</th>
              <th className="p-2 sm:p-4 text-[9px] sm:text-xs font-semibold text-gray-400 uppercase tracking-wider font-display text-center">Type</th>
              
              {/* Render column headers for each date */}
              {sortedResults.map((res) => (
                <th 
                  key={res.date} 
                  className="p-2 sm:p-4 text-[9px] sm:text-xs font-semibold text-gray-500 uppercase tracking-wider font-display text-right min-w-[90px] sm:min-w-[120px]"
                >
                  <div className="flex flex-col items-end">
                    <span>{res.date}</span>
                    <span className="text-[8px] sm:text-[9px] font-normal text-gray-400 font-sans tracking-normal capitalize">
                      {res.cached ? "Cached" : "Scraped"}
                    </span>
                  </div>
                </th>
              ))}

              <th className="p-2 sm:p-4 text-[9px] sm:text-xs font-semibold text-gray-500 uppercase tracking-wider font-display text-right min-w-[110px] sm:min-w-[140px]">
                Daily Net Change
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 text-[10px] sm:text-sm">
            {metrics.map((metric) => {
              // Calculate values for each date
              const values = sortedResults.map((res) => {
                const rec = getParticipantRecord(res);
                if (!rec) return { long: 0, short: 0, net: 0 };
                const long = metric.getLong(rec);
                const short = metric.getShort(rec);
                const net = long - short;
                return { long, short, net };
              });

              // Calculate Net Change between latest date and previous date
              const latestVal = values[values.length - 1];
              const prevVal = values.length > 1 ? values[values.length - 2] : { long: 0, short: 0, net: 0 };
              const netChange = latestVal.net - prevVal.net;

              return (
                <React.Fragment key={metric.label}>
                  {/* Long Row */}
                  <tr className="hover:bg-gray-50/20 group">
                    <td className="p-2 sm:p-4 font-medium text-gray-900 flex items-center gap-1 sm:gap-2">
                      <span className="w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full bg-emerald-400 shrink-0" />
                      <span className="truncate">{metric.label} Long</span>
                    </td>
                    <td className="p-2 sm:p-4 text-[9px] sm:text-xs text-gray-400 text-center font-mono">LONG</td>
                    {values.map((v, i) => (
                      <td key={i} className="p-2 sm:p-4 text-right font-mono text-gray-600">
                        {formatNum(v.long)}
                      </td>
                    ))}
                    <td className="p-2 sm:p-4 text-right font-mono text-[9px] sm:text-xs text-gray-400 group-hover:text-gray-500 transition-colors">
                      + {formatNum(latestVal.long - prevVal.long)}
                    </td>
                  </tr>

                  {/* Short Row */}
                  <tr className="hover:bg-gray-50/20 group">
                    <td className="p-2 sm:p-4 font-medium text-gray-900 flex items-center gap-1 sm:gap-2">
                      <span className="w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full bg-rose-400 shrink-0" />
                      <span className="truncate">{metric.label} Short</span>
                    </td>
                    <td className="p-2 sm:p-4 text-[9px] sm:text-xs text-gray-400 text-center font-mono">SHORT</td>
                    {values.map((v, i) => (
                      <td key={i} className="p-2 sm:p-4 text-right font-mono text-gray-600">
                        {formatNum(v.short)}
                      </td>
                    ))}
                    <td className="p-2 sm:p-4 text-right font-mono text-[9px] sm:text-xs text-gray-400 group-hover:text-gray-500 transition-colors">
                      + {formatNum(latestVal.short - prevVal.short)}
                    </td>
                  </tr>

                  {/* Net Position Row */}
                  <tr className="bg-gray-50/40 hover:bg-gray-50/80 font-semibold border-b border-gray-100">
                    <td className="p-2 sm:p-4 text-gray-950 font-semibold font-display flex items-center gap-1.5 sm:gap-2">
                      <div className="h-4 w-4 sm:h-5 sm:w-5 bg-indigo-50 text-indigo-600 rounded flex items-center justify-center text-[8px] sm:text-[10px] font-bold shadow-sm shrink-0">
                        Σ
                      </div>
                      <span className="truncate">Net {metric.label}</span>
                    </td>
                    <td className="p-2 sm:p-4 text-[9px] sm:text-xs text-gray-500 text-center font-mono font-bold">NET</td>
                    {values.map((v, i) => {
                      const isBullish = v.net >= 0;
                      return (
                        <td 
                          key={i} 
                          className={`p-2 sm:p-4 text-right font-mono ${
                            isBullish ? "text-emerald-600" : "text-rose-600"
                          }`}
                        >
                          {v.net > 0 ? "+" : ""}
                          {formatNum(v.net)}
                        </td>
                      );
                    })}
                    <td className="p-2 sm:p-4 text-right">
                      <div className="flex items-center justify-end gap-1 font-mono text-[9px] sm:text-xs">
                        {netChange > 0 ? (
                          <span className="flex items-center gap-0.5 text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full font-medium">
                            <TrendingUp className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                            +{formatNum(netChange)}
                          </span>
                        ) : netChange < 0 ? (
                          <span className="flex items-center gap-0.5 text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded-full font-medium">
                            <TrendingDown className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                            {formatNum(netChange)}
                          </span>
                        ) : (
                          <span className="flex items-center gap-0.5 text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded-full">
                            <Minus className="h-3 w-3 sm:h-3.5 sm:w-3.5" /> Unchanged
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
