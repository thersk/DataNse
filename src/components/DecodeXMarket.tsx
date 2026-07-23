import React, { useState, useEffect } from "react";
import { DayScrapeResult, ParticipantRecord } from "../types";
import { 
  TrendingUp, 
  TrendingDown, 
  HelpCircle, 
  Info, 
  Flame, 
  ShieldAlert, 
  BarChart3, 
  Clock, 
  History, 
  Save, 
  Download, 
  Trash2, 
  CheckCircle2, 
  Calendar, 
  Play, 
  FileSpreadsheet, 
  Activity,
  BookOpen
} from "lucide-react";

interface DecodeXMarketProps {
  results: DayScrapeResult[];
  selectedDateStr: string;
  setSelectedDateStr: (date: string) => void;
  triggerScrape: (date: string) => Promise<boolean>;
  isLoading: boolean;
  onOpenUploader?: () => void;
}

interface SavedBiasRecord {
  id: string;
  targetDate: string;
  timestamp: string;
  marketBias: string;
  type: "auto" | "manual";
  notes?: string;
  outcome?: "pending" | "correct" | "incorrect" | "rangebound";
  participants: {
    client: { added: number; chg: number; stance: string; sentiment: string };
    dii: { added: number; chg: number; stance: string; sentiment: string };
    fii: { added: number; chg: number; stance: string; sentiment: string };
    pro: { added: number; chg: number; stance: string; sentiment: string };
  };
}

export default function DecodeXMarket({ 
  results, 
  selectedDateStr, 
  setSelectedDateStr, 
  triggerScrape, 
  isLoading,
  onOpenUploader
}: DecodeXMarketProps) {
  // Combine current results with cached results to ensure 3 days are available whenever possible
  const getMergedSuccessfulResults = () => {
    const map = new Map<string, DayScrapeResult>();
    
    // First add cached results from localStorage if present
    try {
      const cachedRaw = localStorage.getItem("decodex_last_successful_scrape_results");
      if (cachedRaw) {
        const parsed: DayScrapeResult[] = JSON.parse(cachedRaw);
        parsed.filter(r => r.status === "success").forEach(r => {
          map.set(r.date, r);
        });
      }
    } catch (e) {
      console.warn("Error reading cached results in DecodeXMarket:", e);
    }

    // Overlay current active results
    results.filter(r => r.status === "success").forEach(r => {
      map.set(r.date, r);
    });

    const merged = Array.from(map.values());
    // Sort chronological oldest first, newest last
    return merged.sort((a, b) => {
      const parseD = (str: string) => {
        const parts = str.split("-");
        if (parts.length === 3) {
          const monthMap: Record<string, string> = { Jan: "01", Feb: "02", Mar: "03", Apr: "04", May: "05", Jun: "06", Jul: "07", Aug: "08", Sep: "09", Oct: "10", Nov: "11", Dec: "12" };
          const m = monthMap[parts[1]] || parts[1];
          return new Date(`${parts[2]}-${m}-${parts[0]}`).getTime();
        }
        return 0;
      };
      return parseD(a.date) - parseD(b.date);
    });
  };

  const sortedResults = getMergedSuccessfulResults();

  // We only care about the latest 3 trading days
  const activeResults = sortedResults.slice(-3);
  const d1 = activeResults[0];
  const d2 = activeResults[1];
  const d3 = activeResults[2];

  const [activeSubTab, setActiveSubTab] = useState<"sheets" | "scheduler">("sheets");
  
  // Scheduler & Persistence states
  const [isAutoFetchEnabled, setIsAutoFetchEnabled] = useState<boolean>(() => {
    const val = localStorage.getItem("decodex_auto_fetch_enabled");
    return val === null ? true : val === "true"; // Default to true if not explicitly set
  });
  
  const [savedRecords, setSavedRecords] = useState<SavedBiasRecord[]>(() => {
    try {
      const raw = localStorage.getItem("decodex_bias_history");
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  });

  const [lastCheckTime, setLastCheckTime] = useState<string>(() => {
    return localStorage.getItem("decodex_last_check_time") || (d3 ? `Checked for ${d3.date}` : "Never Checked");
  });

  const [isAutoFetching, setIsAutoFetching] = useState<boolean>(false);
  const [autoFetchStatus, setAutoFetchStatus] = useState<string>("Active Monitoring");
  const [saveFeedback, setSaveFeedback] = useState<string | null>(null);

  if (sortedResults.length < 3) {
    return (
      <div className="p-8 sm:p-12 text-center bg-white border border-amber-100 rounded-2xl shadow-sm max-w-2xl mx-auto space-y-4">
        <div className="h-12 w-12 bg-amber-50 rounded-full flex items-center justify-center text-amber-500 mx-auto">
          <ShieldAlert className="h-6 w-6" />
        </div>
        <h3 className="text-base font-bold font-display text-gray-950">Preparing 3-Day DecodeXMarket Matrix</h3>
        <p className="text-xs text-gray-500 leading-relaxed max-w-md mx-auto">
          Decoding full market sentiment matrices requires <strong>3 consecutive trading days</strong> of F&O participant open interest data. Today's report may not yet be published by NSE (released daily after 10:30 PM IST).
        </p>
        <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            onClick={() => {
              // Trigger scrape for selected date (which will now fetch preceding 8 days until 3 are found)
              triggerScrape(selectedDateStr);
            }}
            disabled={isLoading}
            className="w-full sm:w-auto px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {isLoading ? "Fetching 3 Days Data..." : "Fetch Available 3 Trading Days"}
          </button>
          {onOpenUploader && (
            <button
              onClick={onOpenUploader}
              className="w-full sm:w-auto px-5 py-2.5 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 rounded-xl text-xs font-semibold shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              Resilient Manual Data Loader
            </button>
          )}
        </div>
      </div>
    );
  }

  const participants = [
    { key: "Client", title: "Client (Retail Traders)" },
    { key: "DII", title: "DII (Domestic Institutional Investors)" },
    { key: "FII", title: "FII (Foreign Institutional Investors - Smart Money)" },
    { key: "Pro", title: "PRO (Proprietary Traders / Brokers)" }
  ];

  const getRecord = (res: DayScrapeResult, pKey: string): ParticipantRecord | undefined => {
    return res.data?.find(
      (p) => p.participant.toLowerCase().trim() === pKey.toLowerCase().trim()
    );
  };

  const formatNum = (num: number) => {
    return new Intl.NumberFormat("en-IN").format(num);
  };

  const formatPercent = (num: number) => {
    if (isNaN(num) || !isFinite(num)) return "0.00%";
    const sign = num > 0 ? "+" : "";
    return `${sign}${num.toFixed(2)}%`;
  };

  // Helper to color numeric cell backgrounds based on positive or negative values
  const getCellBgClass = (val: number) => {
    if (val > 0) return "bg-emerald-50 text-emerald-950 border-emerald-100/50";
    if (val < 0) return "bg-rose-50 text-rose-950 border-rose-100/50";
    return "bg-white text-gray-400";
  };

  // Calculation of Consolidated stats for each participant (Spreadsheet replication)
  const getParticipantStats = (pKey: string) => {
    const r2 = getRecord(d2, pKey);
    const r3 = getRecord(d3, pKey);

    const fIdxNet2 = r2 ? r2.futureIndexLong - r2.futureIndexShort : 0;
    const fIdxNet3 = r3 ? r3.futureIndexLong - r3.futureIndexShort : 0;

    const callNet2 = r2 ? r2.optionIndexCallLong - r2.optionIndexCallShort : 0;
    const callNet3 = r3 ? r3.optionIndexCallLong - r3.optionIndexCallShort : 0;

    const putNet2 = r2 ? r2.optionIndexPutLong - r2.optionIndexPutShort : 0;
    const putNet3 = r3 ? r3.optionIndexPutLong - r3.optionIndexPutShort : 0;

    // Today Added (Total Position Open)
    const todayAdded = fIdxNet3 + callNet3 - putNet3;

    // Yesterday Added (Total Position Open Yesterday)
    const yesterdayAdded = fIdxNet2 + callNet2 - putNet2;

    // Chg From Y'Day
    const chgFromYday = todayAdded - yesterdayAdded;

    // Interpretation K and L
    let interpretationColK = "";
    let interpretationColL = "";
    
    if (todayAdded >= 0 && chgFromYday >= 0) {
      interpretationColK = "Added Long";
      interpretationColL = "Bullish";
    } else if (todayAdded >= 0 && chgFromYday < 0) {
      interpretationColK = "Unwounded Long Aggressively";
      interpretationColL = "Bearish";
    } else if (todayAdded < 0 && chgFromYday < 0) {
      interpretationColK = "Added Short";
      interpretationColL = "Bearish";
    } else { // todayAdded < 0 && chgFromYday >= 0
      interpretationColK = "Short Covering";
      interpretationColL = "Bullish";
    }

    return { todayAdded, chgFromYday, interpretationColK, interpretationColL };
  };

  const clientStats = getParticipantStats("Client");
  const diiStats = getParticipantStats("DII");
  const fiiStats = getParticipantStats("FII");
  const proStats = getParticipantStats("Pro");

  const participantsData = [
    { name: "CLIENT", ...clientStats },
    { name: "DII", ...diiStats },
    { name: "FII", ...fiiStats },
    { name: "PRO", ...proStats },
  ];

  // Calculate Market Bias based on the formula
  const clientSent = clientStats.interpretationColL; // M2
  const fii_sent = fiiStats.interpretationColL;       // M4
  const pro_sent = proStats.interpretationColL;       // M5

  const client_flip = clientSent === "Bullish" ? "Bearish" : (clientSent === "Bearish" ? "Bullish" : "Neutral");

  let marketBias = "Market Rangebound/Neutral ↔️";
  if (client_flip === "Bullish" && fii_sent === "Bullish" && pro_sent === "Bullish") {
    marketBias = "Market Goes Up ⬆️";
  } else if (client_flip === "Bearish" && fii_sent === "Bearish" && pro_sent === "Bearish") {
    marketBias = "Market Goes Down ⬇️";
  } else if (client_flip === "Bullish" && (fii_sent === "Bullish" || pro_sent === "Bullish")) {
    marketBias = "Market May Go Up ⬆️";
  } else if (client_flip === "Bearish" && (fii_sent === "Bearish" || pro_sent === "Bearish")) {
    marketBias = "Market May Go Down ⬇️";
  }

  let marketBiasBg = "bg-slate-600 shadow-slate-100";
  if (marketBias === "Market Goes Up ⬆️") {
    marketBiasBg = "bg-emerald-600 shadow-emerald-100";
  } else if (marketBias === "Market Goes Down ⬇️") {
    marketBiasBg = "bg-rose-600 shadow-rose-100";
  } else if (marketBias === "Market May Go Up ⬆️") {
    marketBiasBg = "bg-teal-600 shadow-teal-100";
  } else if (marketBias === "Market May Go Down ⬇️") {
    marketBiasBg = "bg-amber-600 shadow-amber-100";
  } else {
    marketBiasBg = "bg-slate-600 shadow-slate-100";
  }

  // Save current view state to history log helper
  const handleSaveCurrentToHistory = (type: "auto" | "manual" = "manual") => {
    if (!results || results.length < 3) return;
    
    const recordId = `record-${d3.date}`;
    const dateFormatted = d3.date;
    
    const record: SavedBiasRecord = {
      id: recordId,
      targetDate: dateFormatted,
      timestamp: new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }) + ", " + new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      marketBias,
      type,
      outcome: "pending",
      notes: "",
      participants: {
        client: { 
          added: clientStats.todayAdded, 
          chg: clientStats.chgFromYday, 
          stance: clientStats.interpretationColK, 
          sentiment: clientStats.interpretationColL 
        },
        dii: { 
          added: diiStats.todayAdded, 
          chg: diiStats.chgFromYday, 
          stance: diiStats.interpretationColK, 
          sentiment: diiStats.interpretationColL 
        },
        fii: { 
          added: fiiStats.todayAdded, 
          chg: fiiStats.chgFromYday, 
          stance: fiiStats.interpretationColK, 
          sentiment: fiiStats.interpretationColL 
        },
        pro: { 
          added: proStats.todayAdded, 
          chg: proStats.chgFromYday, 
          stance: proStats.interpretationColK, 
          sentiment: proStats.interpretationColL 
        }
      }
    };

    // Filter out duplicates of same date and append new one
    const updated = [record, ...savedRecords.filter(r => r.targetDate !== dateFormatted)];
    setSavedRecords(updated);
    localStorage.setItem("decodex_bias_history", JSON.stringify(updated));
    setSaveFeedback(`Successfully saved Next-Day Bias for ${dateFormatted} to your flow log journal!`);
    setTimeout(() => setSaveFeedback(null), 3000);
  };

  // Auto-populate flow journal if it is empty so it's never displayed empty
  useEffect(() => {
    if (d3) {
      const raw = localStorage.getItem("decodex_bias_history");
      const parsed = raw ? JSON.parse(raw) : [];
      if (parsed.length === 0) {
        const recordId = `record-${d3.date}`;
        const dateFormatted = d3.date;
        
        const record: SavedBiasRecord = {
          id: recordId,
          targetDate: dateFormatted,
          timestamp: new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }) + ", " + new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" }),
          marketBias,
          type: "auto",
          outcome: "pending",
          notes: "Automatically logged on initial load to keep your journal active.",
          participants: {
            client: { 
              added: clientStats.todayAdded, 
              chg: clientStats.chgFromYday, 
              stance: clientStats.interpretationColK, 
              sentiment: clientStats.interpretationColL 
            },
            dii: { 
              added: diiStats.todayAdded, 
              chg: diiStats.chgFromYday, 
              stance: diiStats.interpretationColK, 
              sentiment: diiStats.interpretationColL 
            },
            fii: { 
              added: fiiStats.todayAdded, 
              chg: fiiStats.chgFromYday, 
              stance: fiiStats.interpretationColK, 
              sentiment: fiiStats.interpretationColL 
            },
            pro: { 
              added: proStats.todayAdded, 
              chg: proStats.chgFromYday, 
              stance: proStats.interpretationColK, 
              sentiment: proStats.interpretationColL 
            }
          }
        };

        setSavedRecords([record]);
        localStorage.setItem("decodex_bias_history", JSON.stringify([record]));
      }
    }
  }, [d3, marketBias]);

  // Automated scheduling loop
  useEffect(() => {
    localStorage.setItem("decodex_auto_fetch_enabled", String(isAutoFetchEnabled));
  }, [isAutoFetchEnabled]);

  useEffect(() => {
    if (!isAutoFetchEnabled) {
      setAutoFetchStatus("Scheduler Off");
      return;
    }

    setAutoFetchStatus("Active Monitoring");
    
    // Periodically run checking interval (every 30 seconds)
    const interval = setInterval(async () => {
      const now = new Date();
      
      // Calculate current Indian Standard Time (IST) details
      let istHour = now.getHours();
      let istMinute = now.getMinutes();
      let istDay = now.getDay();
      let istDateStr = "";
      let istNseFormatted = "";

      try {
        const formatter = new Intl.DateTimeFormat("en-US", {
          timeZone: "Asia/Kolkata",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
          hour12: false
        });
        const parts = formatter.formatToParts(now);
        const year = parts.find(p => p.type === "year")?.value || "";
        const month = parts.find(p => p.type === "month")?.value || "";
        const day = parts.find(p => p.type === "day")?.value || "";
        const hour = parts.find(p => p.type === "hour")?.value || "";
        const minute = parts.find(p => p.type === "minute")?.value || "";

        istHour = parseInt(hour, 10);
        istMinute = parseInt(minute, 10);
        istDateStr = `${year}-${month}-${day}`;
        istNseFormatted = `${day}-${month}-${year}`;

        // Get day of week for the IST date
        const istDateObj = new Date(`${year}-${month}-${day}T12:00:00+05:30`);
        istDay = istDateObj.getDay();
      } catch (e) {
        console.warn("Intl format failed, falling back to local system time", e);
        const yyyy = now.getFullYear();
        const mm = String(now.getMonth() + 1).padStart(2, "0");
        const dd = String(now.getDate()).padStart(2, "0");
        istDateStr = `${yyyy}-${mm}-${dd}`;
        istNseFormatted = `${dd}-${mm}-${yyyy}`;
        istDay = now.getDay();
      }

      const isTradingDay = istDay >= 1 && istDay <= 5;
      
      const checkTimestamp = `${d3 ? d3.date : "Latest"} at ${now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`;
      setLastCheckTime(checkTimestamp);
      localStorage.setItem("decodex_last_check_time", checkTimestamp);

      // Past 22:30 IST (10:30 PM) is requested
      const isPastReleaseTime = istHour > 22 || (istHour === 22 && istMinute >= 30);

      if (isTradingDay && isPastReleaseTime) {
        const isTodayAlreadyLoaded = d3.date === istNseFormatted;

        if (!isTodayAlreadyLoaded && !isLoading && !isAutoFetching) {
          setAutoFetchStatus("New data detected! Fetching...");
          setIsAutoFetching(true);
          try {
            const wasSuccessful = await triggerScrape(istDateStr);
            if (wasSuccessful) {
              setAutoFetchStatus("Fetch succeeded! Saving bias...");
              setTimeout(() => {
                handleSaveCurrentToHistory("auto");
                setAutoFetchStatus("Active Monitoring");
                setIsAutoFetching(false);
              }, 1500);
            } else {
              // Failed or holiday/weekend fallback, keep existing data showing
              setAutoFetchStatus("Waiting for NSE release");
              setIsAutoFetching(false);
            }
          } catch (e) {
            console.error("[Scheduler Auto-Fetch Error]:", e);
            setAutoFetchStatus("Waiting for NSE release");
            setIsAutoFetching(false);
          }
        } else if (isTodayAlreadyLoaded) {
          setAutoFetchStatus(`Today's data (${istNseFormatted}) is loaded`);
        }
      } else {
        if (!isTradingDay) {
          setAutoFetchStatus("Monitoring (Weekend - NSE Closed)");
        } else {
          setAutoFetchStatus("Monitoring (Waiting for release at 10:30 PM IST)");
        }
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [isAutoFetchEnabled, d3.date, isLoading, isAutoFetching, savedRecords]);

  const handleDeleteLog = (id: string) => {
    const updated = savedRecords.filter(r => r.id !== id);
    setSavedRecords(updated);
    localStorage.setItem("decodex_bias_history", JSON.stringify(updated));
  };

  const handleUpdateOutcome = (id: string, outcome: string) => {
    const updated = savedRecords.map(r => {
      if (r.id === id) {
        return { ...r, outcome: outcome as any };
      }
      return r;
    });
    setSavedRecords(updated);
    localStorage.setItem("decodex_bias_history", JSON.stringify(updated));
  };

  const handleUpdateNotes = (id: string, notes: string) => {
    const updated = savedRecords.map(r => {
      if (r.id === id) {
        return { ...r, notes };
      }
      return r;
    });
    setSavedRecords(updated);
    localStorage.setItem("decodex_bias_history", JSON.stringify(updated));
  };

  const handleExportJournal = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(savedRecords, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `decodex_bias_journal_${new Date().toISOString().slice(0,10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className="space-y-8 animate-fade-in">
      
      {/* Upper Descriptive banner */}
      <div className="bg-gradient-to-r from-cyan-500/10 via-indigo-500/10 to-indigo-600/15 border border-indigo-100/80 rounded-2xl p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="bg-indigo-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider">Proprietary Algorithm</span>
            <h2 className="text-base font-bold font-display text-gray-950 tracking-tight">DecodeXMarket Intelligence Matrix</h2>
          </div>
          <p className="text-xs text-gray-500 leading-relaxed max-w-2xl">
            This module replicates high-value derivative spreadsheet models used by proprietary desks. It computes direct percentage shifts, derives total open options vectors, and triggers algorithmic sentiment outlook alerts based on multi-day Call and Put open interest changes.
          </p>
        </div>
        <div className="flex items-center gap-2 bg-white px-4 py-2.5 rounded-xl border border-gray-100 shadow-sm text-xs font-semibold text-gray-600">
          <BarChart3 className="h-4 w-4 text-indigo-500" />
          <span>Formulas Verified Active</span>
        </div>
      </div>

      {/* Save Success feedback alert */}
      {saveFeedback && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-5 py-4 rounded-xl text-xs font-semibold flex items-center gap-2.5 animate-bounce shadow-sm">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
          <span>{saveFeedback}</span>
        </div>
      )}

      {/* Tab Navigation for Workspace Matrix vs Auto-Scheduler History Journal */}
      <div className="flex border-b border-gray-100 pb-px gap-2">
        <button
          onClick={() => setActiveSubTab("sheets")}
          className={`flex items-center gap-2 pb-3 text-xs font-bold transition-all border-b-2 px-4 cursor-pointer ${
            activeSubTab === "sheets"
              ? "border-indigo-600 text-indigo-600"
              : "border-transparent text-gray-400 hover:text-gray-600"
          }`}
        >
          <FileSpreadsheet className="h-4 w-4" />
          <span>📊 Active Workspace Matrix</span>
        </button>
        <button
          onClick={() => setActiveSubTab("scheduler")}
          className={`flex items-center gap-2 pb-3 text-xs font-bold transition-all border-b-2 px-4 cursor-pointer ${
            activeSubTab === "scheduler"
              ? "border-indigo-600 text-indigo-600"
              : "border-transparent text-gray-400 hover:text-gray-600"
          }`}
        >
          <Clock className="h-4 w-4" />
          <span>⏱️ Auto-Fetch & Bias Journal</span>
        </button>
      </div>

      {activeSubTab === "scheduler" ? (
        <div className="space-y-6 animate-fade-in">
          
          {/* Top Panel: Settings, Status, Run Today */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Box 1: Automatic Scheduler Controller */}
            <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm flex flex-col justify-between space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="h-8 w-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600">
                    <Clock className="h-4 w-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-gray-900">Auto-Fetch Engine</h4>
                    <p className="text-[10px] text-gray-400">Triggers past 10:30 PM IST</p>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isAutoFetchEnabled}
                    onChange={(e) => setIsAutoFetchEnabled(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                </label>
              </div>

              <div className="space-y-1.5 border-t border-gray-50 pt-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-400">Scheduler Status:</span>
                  <span className={`font-mono font-bold flex items-center gap-1 ${isAutoFetchEnabled ? "text-emerald-600" : "text-gray-400"}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${isAutoFetchEnabled ? "bg-emerald-500 animate-pulse" : "bg-gray-300"}`} />
                    {autoFetchStatus}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[10px] text-gray-400">
                  <span>Last Ticker Check:</span>
                  <span className="font-mono font-semibold">{lastCheckTime}</span>
                </div>
              </div>
            </div>

            {/* Box 2: Automated Live Persistence Status */}
            <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm flex flex-col justify-between space-y-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h4 className="text-xs font-bold text-gray-900 flex items-center gap-1.5">
                    <Activity className="h-3.5 w-3.5 text-indigo-500" />
                    Always-On Display Cache
                  </h4>
                  <p className="text-[10px] text-gray-400 mt-0.5">Continuous persistence guarantee</p>
                </div>
                <span className="text-[10px] font-mono bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-md font-bold uppercase">
                  ACTIVE
                </span>
              </div>

              <div className="text-[11px] text-gray-500 leading-relaxed bg-gray-50/50 p-2.5 rounded-xl border border-gray-100">
                On weekends, NSE holidays, or before daily release, the app continuously displays the last computed trading day’s analytics so you never lose sight of your active bias.
              </div>
            </div>

            {/* Box 3: Trading Journal Metrics */}
            <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm flex flex-col justify-between space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-gray-900">Predictive Accuracy</h4>
                  <p className="text-[10px] text-gray-400">Tracking your computed biases</p>
                </div>
                <span className="h-8 w-8 bg-indigo-50 rounded-lg flex items-center justify-center text-indigo-600">
                  <BarChart3 className="h-4 w-4" />
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 border-t border-gray-50 pt-3">
                <div className="text-center bg-gray-50/50 p-2 rounded-xl">
                  <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Saved Reports</div>
                  <div className="text-lg font-black font-display text-gray-950 mt-0.5">{savedRecords.length}</div>
                </div>
                <div className="text-center bg-gray-50/50 p-2 rounded-xl">
                  <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Accuracy Rate</div>
                  <div className="text-lg font-black font-display text-emerald-600 mt-0.5">
                    {savedRecords.filter(r => r.outcome === "correct").length > 0
                      ? ((savedRecords.filter(r => r.outcome === "correct").length / Math.max(1, savedRecords.filter(r => r.outcome && r.outcome !== "pending").length)) * 100).toFixed(0) + "%"
                      : "—"}
                  </div>
                </div>
              </div>
            </div>

          </div>

          {/* Saved Bias Records Timeline Journal */}
          <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
            <div className="border-b border-gray-100 bg-gray-50/50 px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h3 className="text-sm font-bold font-display text-gray-950 flex items-center gap-1.5">
                  <History className="h-4 w-4 text-indigo-500" />
                  Next-Day Flow Interpretation Journal
                </h3>
                <p className="text-[10px] text-gray-500">
                  Review calculated stances, add manual verification logs, and analyze historical accuracy.
                </p>
              </div>

              {savedRecords.length > 0 && (
                <div className="flex items-center gap-2 self-start sm:self-auto">
                  <button
                    onClick={handleExportJournal}
                    className="text-[11px] font-bold text-gray-600 hover:text-indigo-600 hover:bg-gray-50 border border-gray-200 px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    <Download className="h-3.5 w-3.5" /> Export Logs
                  </button>
                  <button
                    onClick={() => {
                      if (confirm("Are you absolutely sure you want to clear your entire saved bias history? This is irreversible.")) {
                        setSavedRecords([]);
                        localStorage.removeItem("decodex_bias_history");
                      }
                    }}
                    className="text-[11px] font-bold text-rose-600 hover:text-rose-700 hover:bg-rose-50 border border-rose-100 px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Clear All
                  </button>
                </div>
              )}
            </div>

            {savedRecords.length === 0 ? (
              <div className="p-12 text-center max-w-lg mx-auto space-y-4">
                <div className="h-12 w-12 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-500 mx-auto">
                  <BookOpen className="h-6 w-6" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-gray-900">Your Flow Journal is Empty</h4>
                  <p className="text-xs text-gray-500 leading-relaxed">
                    No predictions or biases have been saved yet. You can automatically save trading days by enabling the <strong>Auto-Fetch Engine</strong>, clicking <strong>"Run & Auto-Save Today"</strong>, or by hitting the <strong>"Save to Flow Journal"</strong> button inside the <strong>Active Workspace Matrix</strong>.
                  </p>
                </div>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {savedRecords.map((record) => {
                  let badgeColor = "bg-slate-100 text-slate-700";
                  if (record.marketBias === "Market Goes Up ⬆️") badgeColor = "bg-emerald-500 text-white shadow-sm";
                  else if (record.marketBias === "Market Goes Down ⬇️") badgeColor = "bg-rose-500 text-white shadow-sm";
                  else if (record.marketBias === "Market May Go Up ⬆️") badgeColor = "bg-teal-500 text-white shadow-sm";
                  else if (record.marketBias === "Market May Go Down ⬇️") badgeColor = "bg-amber-500 text-white shadow-sm";

                  return (
                    <div key={record.id} className="p-6 space-y-4 hover:bg-gray-50/30 transition-colors">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center font-mono font-bold text-xs text-indigo-600">
                            {record.targetDate.split("-")[0]}
                          </div>
                          <div>
                            <h4 className="text-xs font-bold text-gray-900 flex items-center gap-2">
                              {record.targetDate}
                              <span className="text-[10px] font-medium text-gray-400 font-sans">
                                (Saved {record.timestamp})
                              </span>
                            </h4>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[10px] text-gray-400 font-medium">Method:</span>
                              <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.2 rounded-md ${record.type === "auto" ? "bg-indigo-50 text-indigo-600 border border-indigo-100" : "bg-gray-100 text-gray-600 border border-gray-200"}`}>
                                {record.type}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <div className={`px-3.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wide flex items-center gap-1.5 ${badgeColor}`}>
                            <span>{record.marketBias}</span>
                          </div>

                          <div className="flex items-center gap-1 border border-gray-200 rounded-lg p-1 bg-white">
                            <span className="text-[10px] text-gray-400 px-1.5 font-semibold">Outcome:</span>
                            <select
                              value={record.outcome || "pending"}
                              onChange={(e) => handleUpdateOutcome(record.id, e.target.value)}
                              className="text-[10px] font-bold bg-transparent outline-none cursor-pointer text-gray-700 pr-1"
                            >
                              <option value="pending">Pending ⏳</option>
                              <option value="correct">Correct ✅</option>
                              <option value="incorrect">Incorrect ❌</option>
                              <option value="rangebound">Rangebound ↔️</option>
                            </select>
                          </div>

                          <button
                            onClick={() => handleDeleteLog(record.id)}
                            className="p-1.5 border border-gray-200 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            title="Delete this record"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Participant stance breakdown row */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-gray-50/50 border border-gray-100/50 p-4 rounded-2xl">
                        {[
                          { pName: "CLIENT", data: record.participants.client },
                          { pName: "DII", data: record.participants.dii },
                          { pName: "FII", data: record.participants.fii },
                          { pName: "PRO", data: record.participants.pro }
                        ].map(({ pName, data }) => {
                          const isStanceBullish = data.sentiment === "Bullish";
                          return (
                            <div key={pName} className="space-y-1">
                              <span className="text-[9px] font-bold font-mono text-gray-400 tracking-wider">{pName}</span>
                              <div className="flex items-center gap-1.5">
                                <span className={`h-1.5 w-1.5 rounded-full ${isStanceBullish ? "bg-emerald-500" : "bg-rose-500"}`} />
                                <span className="text-xs font-semibold text-gray-900">{data.stance}</span>
                              </div>
                              <div className="text-[10px] text-gray-400">
                                {data.added > 0 ? "+" : ""}{formatNum(data.added)} net contract OI
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Note & Comment block */}
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">
                          Journal / Verification Notes
                        </label>
                        <textarea
                          placeholder="e.g. Nifty opened flat and went up 140 points. FII long added worked perfectly. Or manual trade execution thoughts..."
                          value={record.notes || ""}
                          onChange={(e) => handleUpdateNotes(record.id, e.target.value)}
                          className="w-full bg-gray-50/50 hover:bg-gray-50 focus:bg-white border border-gray-200 hover:border-indigo-200 focus:border-indigo-500 rounded-xl px-4 py-3 text-xs outline-none transition-all placeholder:text-gray-300 min-h-[60px]"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>
      ) : (
        <>
          {/* Consolidated Interpretation Matrix (Replicating Spreadsheet Row 1-5 Columns H to M) */}
          <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden" id="decodex-summary-panel">
            <div className="border-b border-gray-100 bg-gray-50/50 px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="space-y-1">
                <h3 className="text-sm font-bold font-display text-gray-950 flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-cyan-500 animate-pulse"></span>
                  Flow Interpretation Summary
                </h3>
                <p className="text-[11px] text-gray-500">
                  Live automated multi-day flow interpretation matrix computed directly from index future & option swings.
                </p>
              </div>
              <span className="text-[10px] font-mono font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-md uppercase tracking-wider">
                LIVE ANALYTICS MATRIX
              </span>
            </div>

            <div className="p-6 flex flex-col lg:flex-row gap-8 items-stretch">
              
              {/* Left Block: View Button and Dynamic Sentiment Indicator */}
              <div className="lg:w-1/3 flex flex-col justify-center items-center gap-3.5 bg-gray-50 border border-gray-100 p-6 rounded-2xl text-center">
                <div className="flex flex-col items-center gap-1.5">
                  <span className="text-[10px] font-mono font-bold text-gray-400 uppercase tracking-widest">
                    Market Bias
                  </span>
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100/80 text-xs font-bold font-mono shadow-xs">
                    <Calendar className="h-3.5 w-3.5 text-indigo-500" />
                    <span>Decoded Date: <strong className="text-gray-950 font-extrabold">{d3?.date}</strong></span>
                  </div>
                </div>
                
                <div className="flex flex-col sm:flex-row lg:flex-col items-center gap-3 w-full justify-center">
                  {/* VIEW Button */}
                  <div className="bg-blue-600 text-white font-extrabold text-sm py-2.5 px-6 rounded-xl shadow-sm uppercase tracking-wider flex items-center gap-2 min-w-[130px] justify-center">
                    <span>VIEW</span>
                  </div>

                  {/* Dynamic Market Direction Badge */}
                  <div className={`px-5 py-2.5 rounded-xl text-xs font-black text-white shadow-sm flex items-center gap-1.5 tracking-wide uppercase ${marketBiasBg}`}>
                    <span>{marketBias}</span>
                  </div>
                </div>



                {/* SAVE Button for Manual Entry */}
                <button
                  onClick={() => handleSaveCurrentToHistory("manual")}
                  className="mt-2 text-[11px] font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 hover:text-indigo-700 px-3.5 py-2 rounded-xl border border-indigo-100 flex items-center justify-center gap-1.5 transition-all w-full cursor-pointer shadow-sm"
                  title="Archive this calculated day stance to historical journal logs"
                >
                  <Save className="h-3.5 w-3.5" />
                  <span>Save to Flow Journal</span>
                </button>
              </div>

              {/* Right Block: Interpretation Spreadsheet Matrix (CLIENT, DII, FII, PRO) */}
              <div className="flex-1 overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[400px] sm:min-w-[500px] border border-gray-100 rounded-xl overflow-hidden">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      <th className="p-1.5 sm:p-3 text-[8px] sm:text-[10px] font-bold text-gray-400 uppercase font-mono tracking-wider">
                        Participant
                      </th>
                      <th className="p-1.5 sm:p-3 text-center text-[8px] sm:text-[10px] font-bold text-gray-400 uppercase font-mono tracking-wider">
                        Today Added
                      </th>
                      <th className="p-1.5 sm:p-3 text-center text-[8px] sm:text-[10px] font-bold text-gray-400 uppercase font-mono tracking-wider">
                        Chg From Y'Day
                      </th>
                      <th colSpan={2} className="p-1.5 sm:p-3 text-center text-[8px] sm:text-[10px] font-bold text-blue-600 uppercase font-mono tracking-wider bg-blue-50/50 border-l border-gray-100">
                        Interpretation
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-[10px] sm:text-xs font-sans">
                    {participantsData.map((p) => {
                      const isTodayPos = p.todayAdded >= 0;
                      const isChgPos = p.chgFromYday >= 0;
                      
                      const isBullishK = p.interpretationColK === "Added Long" || p.interpretationColK === "Short Covering";
                      const isBullishL = p.interpretationColL === "Bullish";

                      const styleK = isBullishK 
                        ? "bg-emerald-500 text-white font-bold sm:font-extrabold text-center px-1.5 py-1 sm:px-3 sm:py-1.5 rounded-lg border border-emerald-600/10 text-[9px] sm:text-xs truncate" 
                        : "bg-rose-600 text-white font-bold sm:font-extrabold text-center px-1.5 py-1 sm:px-3 sm:py-1.5 rounded-lg border border-rose-700/10 text-[9px] sm:text-xs truncate";
                      
                      const styleL = isBullishL
                        ? "bg-emerald-500 text-white font-bold sm:font-black text-center px-1.5 py-1 sm:px-3 sm:py-1.5 rounded-lg border border-emerald-600/10 uppercase tracking-wide sm:tracking-wider text-[9px] sm:text-xs truncate"
                        : "bg-rose-600 text-white font-bold sm:font-black text-center px-1.5 py-1 sm:px-3 sm:py-1.5 rounded-lg border border-rose-700/10 uppercase tracking-wide sm:tracking-wider text-[9px] sm:text-xs truncate";

                      return (
                        <tr key={p.name} className="hover:bg-gray-50/50">
                          <td className="p-1.5 sm:p-3 font-bold text-gray-950 font-mono tracking-tight text-[10px] sm:text-xs">
                            {p.name}
                          </td>
                          
                          <td className={`p-1.5 sm:p-3 text-center font-mono text-[10px] sm:text-xs font-semibold ${
                            isTodayPos ? "text-emerald-600" : "text-rose-600"
                          }`}>
                            {formatNum(p.todayAdded)}
                          </td>
                          
                          <td className={`p-1.5 sm:p-3 text-center font-mono text-[10px] sm:text-xs font-semibold ${
                            isChgPos ? "text-emerald-600" : "text-rose-600"
                          }`}>
                            {isChgPos ? "+" : ""}{formatNum(p.chgFromYday)}
                          </td>
                          
                          <td className="p-1.5 sm:p-3 border-l border-gray-100 w-[28%] min-w-[75px] sm:min-w-0">
                            <div className={styleK} title={p.interpretationColK}>
                              {p.interpretationColK}
                            </div>
                          </td>

                          <td className="p-1.5 sm:p-3 w-[18%] min-w-[60px] sm:min-w-0">
                            <div className={styleL} title={p.interpretationColL}>
                              {p.interpretationColL}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

            </div>
          </div>

          {/* Main spreadsheet loops */}
          <div className="grid grid-cols-1 gap-8">
            {participants.map((p) => {
              const r1 = getRecord(d1, p.key);
              const r2 = getRecord(d2, p.key);
              const r3 = getRecord(d3, p.key);

              const fIdxNet1 = r1 ? r1.futureIndexLong - r1.futureIndexShort : 0;
              const fIdxNet2 = r2 ? r2.futureIndexLong - r2.futureIndexShort : 0;
              const fIdxNet3 = r3 ? r3.futureIndexLong - r3.futureIndexShort : 0;
              const fIdxChange = fIdxNet2 !== 0 ? ((fIdxNet3 - fIdxNet2) / Math.abs(fIdxNet2)) * 100 : 0;

              const callNet1 = r1 ? r1.optionIndexCallLong - r1.optionIndexCallShort : 0;
              const callNet2 = r2 ? r2.optionIndexCallLong - r2.optionIndexCallShort : 0;
              const callNet3 = r3 ? r3.optionIndexCallLong - r3.optionIndexCallShort : 0;
              const callChange = callNet2 !== 0 ? ((callNet3 - callNet2) / Math.abs(callNet2)) * 100 : 0;

              const putNet1 = r1 ? r1.optionIndexPutLong - r1.optionIndexPutShort : 0;
              const putNet2 = r2 ? r2.optionIndexPutLong - r2.optionIndexPutShort : 0;
              const putNet3 = r3 ? r3.optionIndexPutLong - r3.optionIndexPutShort : 0;
              const putChange = putNet2 !== 0 ? ((putNet3 - putNet2) / Math.abs(putNet2)) * 100 : 0;

              const totalPositionOpen = fIdxNet3 + callNet3 - putNet3;

              const callNetDiff = callNet3 - callNet2;
              const putNetDiff = putNet3 - putNet2;

              let outlookTrend = "";
              let outlookColorClass = "text-gray-500 bg-gray-50 border-gray-100";
              if (callNetDiff < 0 && putNetDiff < 0) {
                outlookTrend = "Range-Bound";
                outlookColorClass = "text-slate-700 bg-slate-50 border-slate-200/60 font-semibold";
              } else if (callNetDiff > 0 && putNetDiff > 0) {
                outlookTrend = "Expecting High Volatility But Direction Not Confirm";
                outlookColorClass = "text-amber-700 bg-amber-50 border-amber-200/60 font-semibold";
              } else if (callNetDiff < 0 && putNetDiff > 0) {
                outlookTrend = "Bearish";
                outlookColorClass = "text-rose-700 bg-rose-50 border-rose-200/60 font-bold";
              } else if (callNetDiff > 0 && putNetDiff < 0) {
                outlookTrend = "Bullish";
                outlookColorClass = "text-emerald-700 bg-emerald-50 border-emerald-200/60 font-bold";
              }

              const isOverallBullish = fIdxNet3 >= 0;

              return (
                <div 
                  key={p.key} 
                  className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow flex flex-col"
                  id={`decodex-${p.key.toLowerCase()}-table`}
                >
                  
                  {/* Participant Section Cyan Banner */}
                  <div className="bg-cyan-400 py-2 sm:py-3 px-3 sm:px-6 border-b border-cyan-500/20 flex items-center justify-between flex-wrap gap-2">
                    <span className="text-[10px] sm:text-sm font-extrabold text-gray-950 uppercase tracking-wider font-display flex items-center gap-1.5 sm:gap-2">
                      <Flame className="h-3.5 w-3.5 sm:h-4.5 sm:w-4.5 text-gray-950 animate-pulse shrink-0" />
                      <span className="truncate max-w-[200px] sm:max-w-none" title={p.title}>{p.title}</span>
                    </span>
                    <span className="text-[8px] sm:text-[10px] font-mono font-bold text-gray-950 bg-white/40 px-1.5 py-0.5 rounded shrink-0">
                      F&O INDEX COMPONENT
                    </span>
                  </div>

                  {/* Table Body & Grid */}
                  <div className="flex flex-col lg:flex-row divide-y lg:divide-y-0 lg:divide-x divide-gray-100">
                    
                    {/* Main spreadsheet grid */}
                    <div className="flex-1 overflow-x-auto">
                      <table className="w-full text-left border-collapse min-w-[600px] sm:min-w-[700px]">
                        <thead>
                          <tr className="border-b border-gray-100">
                            <th className="p-1.5 sm:p-3 bg-gray-50/50 w-[20%] text-[8px] sm:text-[10px] font-bold text-gray-400 uppercase font-mono tracking-wider">
                              Metric Category
                            </th>
                            <th className="p-1.5 sm:p-3 bg-amber-500 text-white font-display text-[9px] sm:text-xs font-bold text-center border-r border-amber-600/10">
                              {d1.date}
                            </th>
                            <th className="p-1.5 sm:p-3 bg-amber-500 text-white font-display text-[9px] sm:text-xs font-bold text-center border-r border-amber-600/10">
                              {d2.date}
                            </th>
                            <th className="p-1.5 sm:p-3 bg-amber-500 text-white font-display text-[9px] sm:text-xs font-bold text-center border-r border-amber-600/10">
                              {d3.date} (Today)
                            </th>
                            <th className="p-1.5 sm:p-3 bg-gray-100 text-gray-600 text-[9px] sm:text-xs font-bold text-center border-r border-gray-200/50">
                              Today-Y'Day (Net)
                            </th>
                            <th className="p-1.5 sm:p-3 bg-amber-500 text-white font-display text-[9px] sm:text-xs font-bold text-center">
                              Total Position Open
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 text-[10px] sm:text-sm font-sans">
                          
                          {/* Row 1: Future Index */}
                          <tr className="hover:bg-gray-50/20">
                            <td className="p-2 sm:p-4 font-semibold text-gray-950 text-[10px] sm:text-xs tracking-tight bg-gray-50/20 border-r border-gray-100">
                              Future Index
                            </td>
                            <td className={`p-2 sm:p-4 text-center font-mono text-[10px] sm:text-xs border-r border-gray-100 ${getCellBgClass(fIdxNet1)}`}>
                              {formatNum(fIdxNet1)}
                            </td>
                            <td className={`p-2 sm:p-4 text-center font-mono text-[10px] sm:text-xs border-r border-gray-100 ${getCellBgClass(fIdxNet2)}`}>
                              {formatNum(fIdxNet2)}
                            </td>
                            <td className={`p-2 sm:p-4 text-center font-mono text-[10px] sm:text-xs border-r border-gray-100 ${getCellBgClass(fIdxNet3)}`}>
                              {formatNum(fIdxNet3)}
                            </td>
                            <td className={`p-2 sm:p-4 text-center font-mono font-bold text-[10px] sm:text-xs border-r border-gray-100 ${
                              fIdxChange > 0 ? "text-emerald-600" : fIdxChange < 0 ? "text-rose-600" : "text-gray-400"
                            }`}>
                              {formatPercent(fIdxChange)}
                            </td>
                            <td className="p-2 sm:p-4 bg-gray-50/30 text-center text-gray-300 font-mono text-[10px] sm:text-xs">
                              —
                            </td>
                          </tr>

                          {/* Row 2: Option Call */}
                          <tr className="hover:bg-gray-50/20">
                            <td className="p-2 sm:p-4 font-semibold text-gray-950 text-[10px] sm:text-xs tracking-tight bg-gray-50/20 border-r border-gray-100">
                              Option Call
                            </td>
                            <td className={`p-2 sm:p-4 text-center font-mono text-[10px] sm:text-xs border-r border-gray-100 ${getCellBgClass(callNet1)}`}>
                              {formatNum(callNet1)}
                            </td>
                            <td className={`p-2 sm:p-4 text-center font-mono text-[10px] sm:text-xs border-r border-gray-100 ${getCellBgClass(callNet2)}`}>
                              {formatNum(callNet2)}
                            </td>
                            <td className={`p-2 sm:p-4 text-center font-mono text-[10px] sm:text-xs border-r border-gray-100 ${getCellBgClass(callNet3)}`}>
                              {formatNum(callNet3)}
                            </td>
                            <td className={`p-2 sm:p-4 text-center font-mono font-bold text-[10px] sm:text-xs border-r border-gray-100 ${
                              callChange > 0 ? "text-emerald-600" : callChange < 0 ? "text-rose-600" : "text-gray-400"
                            }`}>
                              {formatPercent(callChange)}
                            </td>
                            <td className={`p-2 sm:p-4 text-center font-mono font-bold text-[11px] sm:text-sm ${getCellBgClass(totalPositionOpen)}`}>
                              {formatNum(totalPositionOpen)}
                            </td>
                          </tr>

                          {/* Row 3: Option Put */}
                          <tr className="hover:bg-gray-50/20">
                            <td className="p-2 sm:p-4 font-semibold text-gray-950 text-[10px] sm:text-xs tracking-tight bg-gray-50/20 border-r border-gray-100">
                              Option Put
                            </td>
                            <td className={`p-2 sm:p-4 text-center font-mono text-[10px] sm:text-xs border-r border-gray-100 ${getCellBgClass(putNet1)}`}>
                              {formatNum(putNet1)}
                            </td>
                            <td className={`p-2 sm:p-4 text-center font-mono text-[10px] sm:text-xs border-r border-gray-100 ${getCellBgClass(putNet2)}`}>
                              {formatNum(putNet2)}
                            </td>
                            <td className={`p-2 sm:p-4 text-center font-mono text-[10px] sm:text-xs border-r border-gray-100 ${getCellBgClass(putNet3)}`}>
                              {formatNum(putNet3)}
                            </td>
                            <td className={`p-2 sm:p-4 text-center font-mono font-bold text-[10px] sm:text-xs border-r border-gray-100 ${
                              putChange > 0 ? "text-emerald-600" : putChange < 0 ? "text-rose-600" : "text-gray-400"
                            }`}>
                              {formatPercent(putChange)}
                            </td>
                            <td className="p-2 sm:p-4 bg-gray-50/30 text-center text-gray-300 font-mono text-[10px] sm:text-xs">
                              —
                            </td>
                          </tr>

                          {/* Trend Indicator Row */}
                          <tr className="bg-gray-50/20 font-sans border-t border-gray-100">
                            <td className="p-1.5 sm:p-3 text-[8px] sm:text-[10px] font-bold text-gray-400 uppercase tracking-wider font-mono border-r border-gray-100 bg-gray-100/30">
                              AI Matrix Signal
                            </td>
                            <td colSpan={2} className="p-1.5 sm:p-3 text-[9px] sm:text-xs text-gray-400 font-medium italic">
                              Sentiment computed from Call vs Put Open Interest swings
                            </td>
                            <td colSpan={3} className="p-1.5 sm:p-3 text-center align-middle">
                              <div className={`inline-flex items-center justify-center gap-1 sm:gap-1.5 px-2.5 py-1 sm:px-4 sm:py-2 rounded-xl text-[9px] sm:text-xs border shadow-sm max-w-full ${outlookColorClass}`}>
                                {callNetDiff > 0 && putNetDiff < 0 && <TrendingUp className="h-3 w-3 sm:h-4 sm:w-4 shrink-0 text-emerald-600" />}
                                {callNetDiff < 0 && putNetDiff > 0 && <TrendingDown className="h-3 w-3 sm:h-4 sm:w-4 shrink-0 text-rose-600" />}
                                <span className="text-center">{outlookTrend || "Neutral / Indeterminate"}</span>
                              </div>
                            </td>
                          </tr>

                        </tbody>
                      </table>
                    </div>

                    {/* Big status block on the right */}
                    <div className="w-full lg:w-48 xl:w-56 shrink-0 flex items-stretch">
                      <div className={`w-full p-3 sm:p-6 flex flex-col items-center justify-center text-center transition-all ${
                        isOverallBullish 
                          ? "bg-emerald-500 text-white hover:bg-emerald-600" 
                          : "bg-rose-600 text-white hover:bg-rose-700"
                      }`}>
                        <span className="text-[8px] sm:text-[10px] font-bold uppercase tracking-widest text-white/80 font-mono">
                          Overall Stance
                        </span>
                        <div className="text-base sm:text-2xl font-black font-display tracking-wider mt-1 filter drop-shadow-sm">
                          {isOverallBullish ? "BULLISH" : "BEARISH"}
                        </div>
                        <div className="text-[8px] sm:text-[9px] text-white/70 font-sans mt-1.5 sm:mt-2 max-w-[130px]">
                          Based on index futures net open contracts for {d3.date}.
                        </div>
                      </div>
                    </div>

                  </div>

                </div>
              );
            })}
          </div>
        </>
      )}

    </div>
  );
}
