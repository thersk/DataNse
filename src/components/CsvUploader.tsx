import React, { useState, useRef } from "react";
import { Upload, FileCheck, AlertCircle, Download, HelpCircle } from "lucide-react";
import { DayScrapeResult, ParticipantRecord } from "../types";
import { formatDateToReadable, getDdmmyyyy, getNseDownloadLink } from "../utils/dateUtils";

interface CsvUploaderProps {
  requiredTradingDays: Date[];
  onUploadSuccess: (results: DayScrapeResult[]) => void;
  onClose: () => void;
}

export default function CsvUploader({ requiredTradingDays, onUploadSuccess, onClose }: CsvUploaderProps) {
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadedData, setUploadedData] = useState<Record<string, ParticipantRecord[]>>({});
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Helper to format date key matching ddmmyyyy e.g. "16072026"
  const getDayKey = (date: Date) => getDdmmyyyy(date);

  // Simple client-side CSV parser
  const parseCsv = (text: string): { data: ParticipantRecord[]; dateStr: string | null } => {
    const lines = text.split(/\r?\n/).map(line => line.trim()).filter(line => line.length > 0);
    if (lines.length < 2) {
      throw new Error("CSV file is too short or empty.");
    }

    // Try to extract date from the first row (e.g. "...as on Jul 16, 2026")
    const titleRow = lines[0];
    let dateStr: string | null = null;
    const dateMatch = titleRow.match(/as on ([A-Za-z]{3}\s+\d{1,2},\s+\d{4})/i);
    if (dateMatch) {
      dateStr = dateMatch[1];
    }

    // Parse records starting from line 3 (index 2)
    // Headers are in lines[1]
    const headers = lines[1].split(",").map(h => h.trim().replace(/^"|"$/g, ""));
    const records: ParticipantRecord[] = [];

    // Map header columns to keys
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

    const headerIndices: Record<string, number> = {};
    headers.forEach((h, idx) => {
      Object.entries(keyMapping).forEach(([mapLabel, cleanKey]) => {
        if (h.toLowerCase().replace(/\s+/g, "") === mapLabel.toLowerCase().replace(/\s+/g, "")) {
          headerIndices[cleanKey] = idx;
        }
      });
    });

    for (let i = 2; i < lines.length; i++) {
      const cols = lines[i].split(",").map(c => c.trim().replace(/^"|"$/g, ""));
      if (cols.length < headers.length || !cols[0]) continue;

      const participant = cols[0];
      if (participant.toLowerCase().includes("clienttype") || participant.toLowerCase() === "total") {
        // total row is welcome, let's keep it but normalize name
      }

      const rec: any = { participant };
      Object.entries(headerIndices).forEach(([cleanKey, colIdx]) => {
        if (cleanKey === "participant") return;
        const val = parseInt(cols[colIdx], 10);
        rec[cleanKey] = isNaN(val) ? 0 : val;
      });

      records.push(rec as ParticipantRecord);
    }

    if (records.length === 0) {
      throw new Error("No participant records could be parsed. Please verify CSV format.");
    }

    return { data: records, dateStr };
  };

  const handleFile = async (file: File) => {
    setError(null);
    if (!file.name.endsWith(".csv")) {
      setError("Please upload a .csv file.");
      return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const text = e.target?.result as string;
        const { data, dateStr } = parseCsv(text);
        
        if (!dateStr) {
          throw new Error("Could not determine the date from the CSV file title header.");
        }

        const parsedDate = new Date(dateStr);
        if (isNaN(parsedDate.getTime())) {
          throw new Error(`Invalid date found in CSV: ${dateStr}`);
        }

        // Match with required trading days
        const matchedDay = requiredTradingDays.find(d => {
          const d1 = getDdmmyyyy(d);
          const d2 = getDdmmyyyy(parsedDate);
          return d1 === d2;
        });

        if (!matchedDay) {
          setError(`Uploaded CSV is for ${formatDateToReadable(parsedDate)}, which is not one of the required 3 trading days for this query.`);
          return;
        }

        const key = getDayKey(matchedDay);
        const updated = { ...uploadedData, [key]: data };
        setUploadedData(updated);

        // Upload to server cache asynchronously
        try {
          const dayStr = `${String(matchedDay.getDate()).padStart(2, "0")}-${String(matchedDay.getMonth() + 1).padStart(2, "0")}-${matchedDay.getFullYear()}`;
          await fetch("/api/cache-upload", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ date: dayStr, csvContent: text }),
          });
        } catch (err) {
          console.error("Failed to upload cache to server:", err);
        }

        // Check if all are loaded
        const allKeys = requiredTradingDays.map(getDayKey);
        const isCompleted = allKeys.every(k => updated[k] || uploadedData[k]);
        if (isCompleted) {
          // Compile final ScraperResponse array
          const finalResult: DayScrapeResult[] = requiredTradingDays.map(d => {
            const dKey = getDayKey(d);
            const dData = updated[dKey];
            const ddMonthYyyy = d.toLocaleDateString("en-US", { day: "2-digit", month: "short", year: "numeric" }).replace(/\s+/g, "-");
            return {
              status: "success",
              date: ddMonthYyyy,
              data: dData,
              cached: true
            };
          });
          onUploadSuccess(finalResult);
        }

      } catch (err: any) {
        setError(err.message || "Failed to parse CSV file.");
      }
    };
    reader.onerror = () => {
      setError("Failed to read file.");
    };
    reader.readAsText(file);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const onButtonClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div id="csv-uploader-modal" className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl rounded-2xl border border-gray-200 bg-white shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
          <div>
            <h3 className="text-lg font-semibold font-display text-gray-900">Resilient Manual Data Loader</h3>
            <p className="text-xs text-gray-500 mt-0.5">NSE servers are heavily restricted. Bypass restrictions by downloading directly and uploading here.</p>
          </div>
          <button 
            id="close-uploader-btn"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-6 flex-1 overflow-y-auto space-y-6">
          
          {/* Explanation banner */}
          <div className="flex gap-3 bg-indigo-50 border border-indigo-100 p-4 rounded-xl text-indigo-900">
            <HelpCircle className="h-5 w-5 text-indigo-600 shrink-0 mt-0.5" />
            <div className="text-sm space-y-1">
              <span className="font-semibold text-indigo-950">Why is this necessary?</span>
              <p className="text-xs leading-relaxed text-indigo-900">
                The NSE (National Stock Exchange of India) uses strict Akamai Cloud Protection that blocks automated scraper servers (like ours hosted on Google Cloud). However, your <strong>own computer</strong> is on a regular residential/office internet connection and is never blocked!
              </p>
            </div>
          </div>

          {/* Stepper with download buttons */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Required Files ({requiredTradingDays.length})</h4>
            <div className="grid gap-3">
              {requiredTradingDays.map((day, idx) => {
                const key = getDayKey(day);
                const isLoaded = !!uploadedData[key];
                return (
                  <div 
                    key={key} 
                    className={`flex items-center justify-between p-3.5 rounded-xl border transition-all ${
                      isLoaded 
                        ? "border-emerald-200 bg-emerald-50/40 text-emerald-950" 
                        : "border-gray-100 bg-gray-50/50 text-gray-800"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-semibold ${
                        isLoaded ? "bg-emerald-500 text-white" : "bg-gray-200 text-gray-600"
                      }`}>
                        {idx + 1}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{formatDateToReadable(day)}</p>
                        <p className="text-xs text-gray-500">Participant Wise OI CSV</p>
                      </div>
                    </div>

                    {isLoaded ? (
                      <div className="flex items-center gap-1.5 text-xs text-emerald-700 font-medium bg-emerald-100/50 px-2.5 py-1 rounded-full">
                        <FileCheck className="h-4 w-4" /> Loaded & Parsed
                      </div>
                    ) : (
                      <a
                        id={`download-link-${key}`}
                        href={getNseDownloadLink(day)}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1.5 text-xs font-medium bg-white text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 px-3 py-2 rounded-lg border border-indigo-200 transition-colors shadow-sm"
                      >
                        <Download className="h-3.5 w-3.5" /> Download CSV
                      </a>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Drag & Drop Zone */}
          <div
            id="drag-drop-zone"
            onDragEnter={handleDrag}
            onDragOver={handleDrag}
            onDragLeave={handleDrag}
            onDrop={handleDrop}
            className={`relative flex flex-col items-center justify-center border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
              dragActive 
                ? "border-indigo-500 bg-indigo-50/30" 
                : "border-gray-200 hover:border-indigo-400 bg-gray-50/30"
            }`}
            onClick={onButtonClick}
          >
            <input
              ref={fileInputRef}
              type="file"
              id="csv-file-input"
              className="hidden"
              accept=".csv"
              onChange={handleFileInputChange}
            />
            
            <div className="h-12 w-12 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 mb-4 shadow-sm">
              <Upload className="h-6 w-6" />
            </div>

            <p className="text-sm font-medium text-gray-900">Drag & drop your downloaded NSE CSV file here</p>
            <p className="text-xs text-gray-500 mt-1">or click to browse from your device</p>
            <p className="text-[10px] text-gray-400 mt-3">Accepts only standard Participant wise Open Interest CSV files</p>
          </div>

          {error && (
            <div className="flex gap-2 bg-red-50 border border-red-100 p-3.5 rounded-xl text-red-900 text-xs">
              <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold">Upload Error:</span> {error}
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between bg-gray-50/30">
          <p className="text-xs text-gray-400">Each uploaded file is cached to improve experience for others.</p>
          <button
            id="cancel-uploader-btn"
            onClick={onClose}
            className="text-xs font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 px-4 py-2.5 rounded-lg transition-colors border border-gray-200 bg-white shadow-sm"
          >
            Cancel
          </button>
        </div>

      </div>
    </div>
  );
}
