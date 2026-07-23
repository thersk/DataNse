import React, { useState, useRef } from "react";
import { 
  Upload, 
  FileCheck, 
  AlertCircle, 
  Download, 
  HelpCircle, 
  FileText, 
  Calendar, 
  CheckCircle2, 
  Trash2, 
  Save, 
  Clipboard,
  Sparkles
} from "lucide-react";
import { DayScrapeResult, ParticipantRecord } from "../types";
import { formatDateToReadable, formatDateToInput, getNseDownloadLink } from "../utils/dateUtils";

interface CsvUploaderProps {
  requiredTradingDays: Date[];
  onUploadSuccess: (results: DayScrapeResult[]) => void;
  onClose: () => void;
}

interface DaySlotState {
  slotId: number; // 0 (Day 1 - Oldest), 1 (Day 2 - Middle), 2 (Day 3 - Latest)
  dateStr: string; // "YYYY-MM-DD"
  mode: "upload" | "paste";
  pastedText: string;
  data: ParticipantRecord[] | null;
  error: string | null;
}

/**
 * Universal Participant OI Data Parser
 * Supports CSV strings, Tab-delimited (TSV from Excel), or pasted text tables
 */
export function parseParticipantData(text: string): ParticipantRecord[] {
  if (!text || !text.trim()) {
    throw new Error("Input text is empty.");
  }

  const lines = text
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(l => l.length > 0);

  if (lines.length < 2) {
    throw new Error("Text contains less than 2 lines. At least header and participant rows are required.");
  }

  const splitLine = (line: string): string[] => {
    if (line.includes("\t")) {
      return line.split("\t").map(s => s.trim().replace(/^"|"$/g, ""));
    }
    if (line.includes(",")) {
      const result: string[] = [];
      let current = "";
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          result.push(current.trim().replace(/^"|"$/g, ""));
          current = "";
        } else {
          current += char;
        }
      }
      result.push(current.trim().replace(/^"|"$/g, ""));
      return result;
    }
    return line.split(/\s{2,}/).map(s => s.trim().replace(/^"|"$/g, ""));
  };

  const keyMapping: Record<string, keyof ParticipantRecord> = {
    "Client Type": "participant",
    "Future Index Long": "futureIndexLong",
    "Future Index Short": "futureIndexShort",
    "Future Stock Long": "futureStockLong",
    "Future Stock Short": "futureStockShort",
    "Option Index Call Long": "optionIndexCallLong",
    "Option Index Put Long": "optionIndexPutLong",
    "Option Index Call Short": "optionIndexCallShort",
    "Option Index Put Short": "optionIndexPutShort",
    "Option Stock Call Long": "optionStockCallLong",
    "Option Stock Put Long": "optionStockPutLong",
    "Option Stock Call Short": "optionStockCallShort",
    "Option Stock Put Short": "optionStockPutShort",
    "Total Long Contracts": "totalLongContracts",
    "Total Short Contracts": "totalShortContracts"
  };

  let headerRowIdx = -1;
  const headerIndices: Record<string, number> = {};

  lines.forEach((line, lineIdx) => {
    const cols = splitLine(line);
    let matchedCount = 0;
    cols.forEach((col, colIdx) => {
      const cleanCol = col.toLowerCase().replace(/[^a-z0-9]/g, "");
      Object.entries(keyMapping).forEach(([label, cleanKey]) => {
        const cleanLabel = label.toLowerCase().replace(/[^a-z0-9]/g, "");
        if (cleanCol === cleanLabel) {
          matchedCount++;
          if (headerRowIdx === -1) headerIndices[cleanKey] = colIdx;
        }
      });
    });
    if (matchedCount >= 3 && headerRowIdx === -1) {
      headerRowIdx = lineIdx;
    }
  });

  const records: ParticipantRecord[] = [];

  lines.forEach((line, lineIdx) => {
    if (lineIdx === headerRowIdx) return;
    const cols = splitLine(line);
    if (cols.length === 0) return;

    const firstCol = cols[0].trim();
    const pLower = firstCol.toLowerCase().replace(/[^a-z]/g, "");

    let matchedParticipant: string | null = null;
    if (pLower.includes("client")) matchedParticipant = "Client";
    else if (pLower === "dii" || pLower.includes("domestic")) matchedParticipant = "DII";
    else if (pLower === "fii" || pLower.includes("foreign")) matchedParticipant = "FII";
    else if (pLower === "pro" || pLower.includes("pro")) matchedParticipant = "Pro";
    else if (pLower.includes("total")) matchedParticipant = "TOTAL";

    if (!matchedParticipant) return;

    const parseNum = (valStr: string | undefined): number => {
      if (!valStr) return 0;
      const clean = valStr.replace(/[^0-9-]/g, "");
      const num = parseInt(clean, 10);
      return isNaN(num) ? 0 : num;
    };

    const rec: ParticipantRecord = {
      participant: matchedParticipant,
      futureIndexLong: 0,
      futureIndexShort: 0,
      futureStockLong: 0,
      futureStockShort: 0,
      optionIndexCallLong: 0,
      optionIndexPutLong: 0,
      optionIndexCallShort: 0,
      optionIndexPutShort: 0,
      optionStockCallLong: 0,
      optionStockPutLong: 0,
      optionStockCallShort: 0,
      optionStockPutShort: 0,
      totalLongContracts: 0,
      totalShortContracts: 0
    };

    if (Object.keys(headerIndices).length >= 5) {
      Object.entries(headerIndices).forEach(([cleanKey, colIdx]) => {
        if (cleanKey === "participant") return;
        (rec as any)[cleanKey] = parseNum(cols[colIdx]);
      });
    } else {
      rec.futureIndexLong = parseNum(cols[1]);
      rec.futureIndexShort = parseNum(cols[2]);
      rec.futureStockLong = parseNum(cols[3]);
      rec.futureStockShort = parseNum(cols[4]);
      rec.optionIndexCallLong = parseNum(cols[5]);
      rec.optionIndexPutLong = parseNum(cols[6]);
      rec.optionIndexCallShort = parseNum(cols[7]);
      rec.optionIndexPutShort = parseNum(cols[8]);
      rec.optionStockCallLong = parseNum(cols[9]);
      rec.optionStockPutLong = parseNum(cols[10]);
      rec.optionStockCallShort = parseNum(cols[11]);
      rec.optionStockPutShort = parseNum(cols[12]);
      rec.totalLongContracts = parseNum(cols[13]);
      rec.totalShortContracts = parseNum(cols[14]);
    }

    if (!rec.totalLongContracts) {
      rec.totalLongContracts = rec.futureIndexLong + rec.futureStockLong + rec.optionIndexCallLong + rec.optionIndexPutLong + rec.optionStockCallLong + rec.optionStockPutLong;
    }
    if (!rec.totalShortContracts) {
      rec.totalShortContracts = rec.futureIndexShort + rec.futureStockShort + rec.optionIndexCallShort + rec.optionIndexPutShort + rec.optionStockCallShort + rec.optionStockPutShort;
    }

    records.push(rec);
  });

  if (records.length === 0) {
    throw new Error("Could not parse participant rows (Client, DII, FII, Pro, TOTAL). Please check your data format.");
  }

  return records;
}

export default function CsvUploader({ requiredTradingDays, onUploadSuccess, onClose }: CsvUploaderProps) {
  // Sort trading days chronological oldest to newest (Day 1, Day 2, Day 3)
  const sortedDays = [...requiredTradingDays].sort((a, b) => a.getTime() - b.getTime());

  const [slots, setSlots] = useState<DaySlotState[]>([
    {
      slotId: 0,
      dateStr: formatDateToInput(sortedDays[0] || new Date()),
      mode: "upload",
      pastedText: "",
      data: null,
      error: null
    },
    {
      slotId: 1,
      dateStr: formatDateToInput(sortedDays[1] || new Date()),
      mode: "upload",
      pastedText: "",
      data: null,
      error: null
    },
    {
      slotId: 2,
      dateStr: formatDateToInput(sortedDays[2] || new Date()),
      mode: "upload",
      pastedText: "",
      data: null,
      error: null
    }
  ]);

  const [globalError, setGlobalError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRefs = [useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null)];

  // Helper to parse date from string "YYYY-MM-DD"
  const getDateObj = (dateStr: string) => {
    const parts = dateStr.split("-");
    if (parts.length === 3) {
      return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    }
    return new Date();
  };

  // Convert Date to "DD-MMM-YYYY" e.g. "22-Jul-2026"
  const formatToNseDate = (dateObj: Date) => {
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const dd = String(dateObj.getDate()).padStart(2, "0");
    const mmm = months[dateObj.getMonth()];
    const yyyy = dateObj.getFullYear();
    return `${dd}-${mmm}-${yyyy}`;
  };

  const handleUpdateSlot = (slotId: number, update: Partial<DaySlotState>) => {
    setSlots(prev => prev.map(s => s.slotId === slotId ? { ...s, ...update } : s));
  };

  const handleProcessText = (slotId: number, text: string) => {
    try {
      const records = parseParticipantData(text);
      handleUpdateSlot(slotId, {
        pastedText: text,
        data: records,
        error: null
      });
    } catch (err: any) {
      handleUpdateSlot(slotId, {
        data: null,
        error: err.message || "Failed to parse text format."
      });
    }
  };

  const handleFileUploadForSlot = (slotId: number, file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (!text) {
        handleUpdateSlot(slotId, { error: "File content is empty." });
        return;
      }
      handleProcessText(slotId, text);
    };
    reader.onerror = () => {
      handleUpdateSlot(slotId, { error: "Failed to read uploaded file." });
    };
    reader.readAsText(file);
  };

  const handleSaveAll = async () => {
    setGlobalError(null);
    const unparsedSlots = slots.filter(s => !s.data);
    if (unparsedSlots.length > 0) {
      setGlobalError(`Please upload or paste data for all 3 days. (${3 - unparsedSlots.length}/3 dates currently prepared)`);
      return;
    }

    setIsSubmitting(true);

    try {
      const finalResults: DayScrapeResult[] = slots.map(s => {
        const dObj = getDateObj(s.dateStr);
        const ddMonthYyyy = formatToNseDate(dObj);
        return {
          status: "success",
          date: ddMonthYyyy,
          data: s.data || [],
          cached: true
        };
      });

      // Save to server cache asynchronously
      for (const res of finalResults) {
        try {
          // Format date as DD-MM-YYYY for cache endpoint
          const parts = res.date.split("-");
          if (parts.length === 3) {
            const mMap: Record<string, string> = { Jan: "01", Feb: "02", Mar: "03", Apr: "04", May: "05", Jun: "06", Jul: "07", Aug: "08", Sep: "09", Oct: "10", Nov: "11", Dec: "12" };
            const mNum = mMap[parts[1]] || "01";
            const dateStrCache = `${parts[0]}-${mNum}-${parts[2]}`;
            
            // Build CSV representation for backend caching
            let csvLines = ["Participant Wise Open Interest\nas on " + res.date];
            csvLines.push("Client Type,Future Index Long,Future Index Short,Future Stock Long,Future Stock Short,Option Index Call Long,Option Index Put Long,Option Index Call Short,Option Index Put Short,Option Stock Call Long,Option Stock Put Long,Option Stock Call Short,Option Stock Put Short,Total Long Contracts,Total Short Contracts");
            res.data?.forEach(r => {
              csvLines.push(`${r.participant},${r.futureIndexLong},${r.futureIndexShort},${r.futureStockLong},${r.futureStockShort},${r.optionIndexCallLong},${r.optionIndexPutLong},${r.optionIndexCallShort},${r.optionIndexPutShort},${r.optionStockCallLong},${r.optionStockPutLong},${r.optionStockCallShort},${r.optionStockPutShort},${r.totalLongContracts},${r.totalShortContracts}`);
            });

            await fetch("/api/cache-upload", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ date: dateStrCache, csvContent: csvLines.join("\n") }),
            });
          }
        } catch (err) {
          console.warn("Could not save slot to server cache:", err);
        }
      }

      onUploadSuccess(finalResults);
    } catch (err: any) {
      setGlobalError(err.message || "Failed to save manual data.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const parsedCount = slots.filter(s => s.data !== null).length;

  return (
    <div id="resilient-loader-modal" className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-4xl rounded-2xl border border-gray-200 bg-white shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/80">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-100">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold font-display text-gray-950">Resilient Manual Data Loader</h3>
              <p className="text-xs text-gray-500">Upload CSV files or copy-paste text for 3 trading dates separately</p>
            </div>
          </div>
          <button 
            id="close-uploader-btn"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1.5 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-6 flex-1 overflow-y-auto space-y-6">
          
          {/* Explanation Banner */}
          <div className="flex gap-3 bg-indigo-50/70 border border-indigo-100 p-4 rounded-xl text-indigo-900">
            <HelpCircle className="h-5 w-5 text-indigo-600 shrink-0 mt-0.5" />
            <div className="text-xs leading-relaxed space-y-1">
              <span className="font-bold text-indigo-950 text-sm">Bypass NSE scraper blocks easily:</span>
              <p className="text-indigo-900">
                You can either click <strong>Download CSV</strong> to grab official files directly from NSE, then drag & drop or paste the table text below for each date. Your data is instantly validated and saved locally!
              </p>
            </div>
          </div>

          {/* 3 Day Slots */}
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold font-mono text-gray-400 uppercase tracking-wider">
                3 Trading Days Data Slots ({parsedCount}/3 Ready)
              </h4>
              <span className="text-xs text-gray-400">
                Sorted Chronologically (Day 1 → Day 2 → Day 3)
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {slots.map((slot, idx) => {
                const dayLabel = idx === 0 ? "Day 1 (Oldest)" : idx === 1 ? "Day 2 (Middle)" : "Day 3 (Latest)";
                const dObj = getDateObj(slot.dateStr);
                const nseDownloadUrl = getNseDownloadLink(dObj);
                const isReady = slot.data !== null;

                return (
                  <div 
                    key={slot.slotId}
                    className={`rounded-2xl border p-4 transition-all flex flex-col justify-between space-y-4 ${
                      isReady 
                        ? "border-emerald-200 bg-emerald-50/30 shadow-xs" 
                        : "border-gray-200 bg-white shadow-xs"
                    }`}
                  >
                    {/* Slot Header */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold font-mono text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">
                          {dayLabel}
                        </span>
                        {isReady ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                            <CheckCircle2 className="h-3 w-3" /> Ready
                          </span>
                        ) : (
                          <span className="text-[10px] font-medium text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                            Pending
                          </span>
                        )}
                      </div>

                      {/* Date Picker Input */}
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-gray-400 shrink-0" />
                        <input
                          type="date"
                          value={slot.dateStr}
                          onChange={(e) => handleUpdateSlot(slot.slotId, { dateStr: e.target.value })}
                          className="w-full text-xs font-semibold bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>

                      {/* Direct NSE Download Link */}
                      <a
                        href={nseDownloadUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center justify-center gap-1.5 w-full text-[11px] font-semibold text-indigo-600 hover:text-indigo-700 bg-indigo-50/80 hover:bg-indigo-100 px-3 py-1.5 rounded-lg border border-indigo-100 transition-colors"
                      >
                        <Download className="h-3.5 w-3.5" />
                        <span>Download NSE CSV ({formatDateToReadable(dObj)})</span>
                      </a>
                    </div>

                    {/* Mode Toggle (File vs Paste) */}
                    {!isReady ? (
                      <div className="space-y-3 flex-1 flex flex-col justify-between">
                        <div className="flex rounded-lg bg-gray-100 p-1 gap-1 text-[11px] font-semibold">
                          <button
                            type="button"
                            onClick={() => handleUpdateSlot(slot.slotId, { mode: "upload" })}
                            className={`flex-1 py-1 rounded-md transition-all ${
                              slot.mode === "upload" 
                                ? "bg-white text-gray-900 shadow-xs" 
                                : "text-gray-500 hover:text-gray-900"
                            }`}
                          >
                            Upload CSV
                          </button>
                          <button
                            type="button"
                            onClick={() => handleUpdateSlot(slot.slotId, { mode: "paste" })}
                            className={`flex-1 py-1 rounded-md transition-all ${
                              slot.mode === "paste" 
                                ? "bg-white text-gray-900 shadow-xs" 
                                : "text-gray-500 hover:text-gray-900"
                            }`}
                          >
                            Paste Text
                          </button>
                        </div>

                        {/* Mode A: File Upload */}
                        {slot.mode === "upload" ? (
                          <div 
                            onClick={() => fileInputRefs[slot.slotId].current?.click()}
                            className="border-2 border-dashed border-gray-200 hover:border-indigo-400 bg-gray-50/50 rounded-xl p-4 text-center cursor-pointer transition-all flex flex-col items-center justify-center min-h-[120px]"
                          >
                            <input
                              ref={fileInputRefs[slot.slotId]}
                              type="file"
                              accept=".csv,.txt"
                              className="hidden"
                              onChange={(e) => {
                                if (e.target.files && e.target.files[0]) {
                                  handleFileUploadForSlot(slot.slotId, e.target.files[0]);
                                }
                              }}
                            />
                            <Upload className="h-6 w-6 text-indigo-500 mb-1.5" />
                            <p className="text-xs font-semibold text-gray-800">Choose CSV File</p>
                            <p className="text-[10px] text-gray-400 mt-0.5">Click or drop file here</p>
                          </div>
                        ) : (
                          /* Mode B: Copy Paste Textarea */
                          <div className="space-y-2 flex-1 flex flex-col">
                            <textarea
                              rows={4}
                              value={slot.pastedText}
                              onChange={(e) => handleUpdateSlot(slot.slotId, { pastedText: e.target.value })}
                              placeholder={`Paste CSV or copied table text here...\n\nExample:\nClient Type, Future Index Long, Future Index Short...\nClient, 332822, 207908...\nFII, 112000, 131000...`}
                              className="w-full text-[10px] font-mono bg-gray-50 border border-gray-200 rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none flex-1"
                            />
                            <button
                              type="button"
                              onClick={() => handleProcessText(slot.slotId, slot.pastedText)}
                              className="w-full py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                            >
                              <Clipboard className="h-3.5 w-3.5" /> Parse Text Data
                            </button>
                          </div>
                        )}

                        {slot.error && (
                          <p className="text-[10px] font-medium text-red-600 bg-red-50 p-2 rounded-lg border border-red-100 flex items-start gap-1">
                            <AlertCircle className="h-3 w-3 shrink-0 mt-0.5" />
                            <span>{slot.error}</span>
                          </p>
                        )}
                      </div>
                    ) : (
                      /* Parsed Data Preview & Reset */
                      <div className="space-y-3 bg-white p-3 rounded-xl border border-emerald-100">
                        <div className="text-[11px] font-semibold text-emerald-900 flex items-center justify-between">
                          <span>✓ {slot.data?.length} Participants Parsed</span>
                          <button
                            type="button"
                            onClick={() => handleUpdateSlot(slot.slotId, { data: null, pastedText: "", error: null })}
                            className="text-gray-400 hover:text-red-600 p-1 transition-colors"
                            title="Clear data for this date"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>

                        {/* Mini Participant Breakdown */}
                        <div className="space-y-1 text-[10px] text-gray-600 border-t border-gray-100 pt-2 font-mono">
                          {slot.data?.filter(r => ["FII", "Client", "Pro"].includes(r.participant)).map(r => (
                            <div key={r.participant} className="flex items-center justify-between">
                              <span className="font-bold text-gray-800">{r.participant}:</span>
                              <span>L: {r.futureIndexLong.toLocaleString()} | S: {r.futureIndexShort.toLocaleString()}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {globalError && (
            <div className="flex gap-2 bg-red-50 border border-red-100 p-3.5 rounded-xl text-red-900 text-xs font-medium items-center">
              <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />
              <span>{globalError}</span>
            </div>
          )}

        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-4 bg-gray-50/50">
          <p className="text-xs text-gray-500">
            {parsedCount === 3 ? (
              <span className="text-emerald-700 font-bold flex items-center gap-1">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" /> All 3 days prepared! Ready to update dashboard.
              </span>
            ) : (
              <span>Provide data for all 3 days to unlock full DecodeXMarket matrix.</span>
            )}
          </p>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              id="cancel-uploader-btn"
              type="button"
              onClick={onClose}
              className="flex-1 sm:flex-none text-xs font-semibold text-gray-600 hover:text-gray-900 hover:bg-gray-100 px-4 py-2.5 rounded-xl border border-gray-200 bg-white transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              id="save-manual-data-btn"
              type="button"
              onClick={handleSaveAll}
              disabled={isSubmitting}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 px-6 py-2.5 rounded-xl shadow-md shadow-indigo-100 transition-all cursor-pointer"
            >
              <Save className="h-4 w-4" />
              <span>{isSubmitting ? "Saving & Updating..." : "Save & Apply Manual Data"}</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
