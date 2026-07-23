import React, { useState, useEffect } from "react";
import { 
  Calendar, 
  Database, 
  HelpCircle, 
  TrendingUp, 
  TrendingDown, 
  SlidersHorizontal, 
  FileUp, 
  AlertCircle, 
  Loader2, 
  Sparkles,
  RefreshCw,
  Info,
  Table,
  Clock,
  CheckCircle2,
  Mail,
  Phone,
  User,
  Menu,
  X,
  Home,
  Layers
} from "lucide-react";
import { DayScrapeResult, ParticipantRecord } from "./types";
import { 
  formatDateToInput, 
  formatDateToNSE, 
  getTradingDays, 
  getDefaultSelectedDateStr, 
  getISTDate, 
  isAfter1030PMIST 
} from "./utils/dateUtils";
import ParticipantTable from "./components/ParticipantTable";
import DashboardCharts from "./components/DashboardCharts";
import CsvUploader from "./components/CsvUploader";
import DecodeXMarket from "./components/DecodeXMarket";
import FiiDiiActivity from "./components/FiiDiiActivity";
import OptionChain from "./components/OptionChain";

export default function App() {
  // Default query date dynamically initialized to current IST trading date
  const [selectedDateStr, setSelectedDateStr] = useState<string>(() => getDefaultSelectedDateStr());
  const [selectedParticipant, setSelectedParticipant] = useState<string>("FII");
  
  // Auto-fetch settings and state
  const [isAutoFetchEnabled, setIsAutoFetchEnabled] = useState<boolean>(true);
  const [lastAutoCheckTime, setLastAutoCheckTime] = useState<string | null>(null);
  
  // Try to load cached scrape results initially so we always have data on screen
  const [scrapeResults, setScrapeResults] = useState<DayScrapeResult[] | null>(() => {
    try {
      const cached = localStorage.getItem("decodex_last_successful_scrape_results");
      return cached ? JSON.parse(cached) : null;
    } catch (e) {
      return null;
    }
  });
  
  const [isShowingCachedData, setIsShowingCachedData] = useState<boolean>(() => {
    return localStorage.getItem("decodex_last_successful_scrape_results") !== null;
  });
  
  const [cachedDataDate, setCachedDataDate] = useState<string | null>(() => {
    return localStorage.getItem("decodex_last_successful_date_str");
  });

  const [softWarning, setSoftWarning] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isUploaderOpen, setIsUploaderOpen] = useState<boolean>(false);
  const [mainNav, setMainNav] = useState<"home" | "option-chain">("home");
  const [isHamburgerOpen, setIsHamburgerOpen] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<"dashboard" | "decodex" | "fiidii">("dashboard");
  const [fiiDiiLoading, setFiiDiiLoading] = useState<boolean>(false);
  const [fiiDiiData, setFiiDiiData] = useState<any>(null);

  const fetchFiiDiiInApp = async (dateStr: string) => {
    setFiiDiiLoading(true);
    try {
      const res = await fetch(`/api/fii-dii-activity?date=${dateStr}`);
      const result = await res.json();
      if (result.status === "success" && result.data) {
        setFiiDiiData(result.data);
      } else {
        setFiiDiiData(null);
      }
    } catch (err) {
      console.error("Error fetching FII/DII activity in App header:", err);
      setFiiDiiData(null);
    } finally {
      setFiiDiiLoading(false);
    }
  };

  useEffect(() => {
    fetchFiiDiiInApp(selectedDateStr);
  }, [selectedDateStr]);
  
  // Calculate the 3 expected trading days based on the current selection (for display & manual links)
  const selectedDate = new Date(selectedDateStr);
  const targetTradingDays = getTradingDays(selectedDate, 3);

  // Trigger scrape API call
  const triggerScrape = async (dateStr: string): Promise<boolean> => {
    setIsLoading(true);
    setError(null);
    setSoftWarning(null);

    // Convert "YYYY-MM-DD" from input to "DD-MM-YYYY" for API
    const dateParts = dateStr.split("-");
    const nseFormattedDate = `${dateParts[2]}-${dateParts[1]}-${dateParts[0]}`;

    try {
      console.log(`[App] Triggering scrape for ${nseFormattedDate}`);
      const res = await fetch(`/api/scrape?date=${nseFormattedDate}`);
      
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `HTTP error ${res.status}: Failed to scrape data.`);
      }

      const data = await res.json() as DayScrapeResult[];
      
      // Check if we got back valid success rows
      const successCount = data.filter(d => d.status === "success").length;
      if (successCount === 0) {
        throw new Error("No trading data could be found for the selected dates. They might be weekend holidays or ahead of current date.");
      }

      // Merge incoming results with previous cached results if any, to guarantee 3 successful trading days
      let finalResults = data;
      if (successCount < 3) {
        try {
          const cached = localStorage.getItem("decodex_last_successful_scrape_results");
          if (cached) {
            const parsed = JSON.parse(cached) as DayScrapeResult[];
            const map = new Map<string, DayScrapeResult>();
            parsed.filter(r => r.status === "success").forEach(r => map.set(r.date, r));
            data.forEach(r => map.set(r.date, r)); // incoming data overrides
            finalResults = Array.from(map.values());
          }
        } catch (e) {
          console.warn("Error merging cached results:", e);
        }
      }

      setScrapeResults(finalResults);
      setIsShowingCachedData(false);
      localStorage.setItem("decodex_last_successful_scrape_results", JSON.stringify(finalResults));
      localStorage.setItem("decodex_last_successful_date_str", dateStr);
      setCachedDataDate(dateStr);
      
      // Record time of successful auto/manual check
      const istNow = getISTDate();
      setLastAutoCheckTime(istNow.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }) + " IST");

      return true;
    } catch (err: any) {
      console.error("[App Scrape Error]:", err);
      
      // Fallback: If we have cached results in local storage, load them and show warning
      const cached = localStorage.getItem("decodex_last_successful_scrape_results");
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          setScrapeResults(parsed);
          setIsShowingCachedData(true);
          const lastDate = localStorage.getItem("decodex_last_successful_date_str") || "previous trading day";
          
          const istNow = getISTDate();
          const isAfterCutoff = isAfter1030PMIST();
          const warningMsg = isAfterCutoff
            ? `Data for ${dateStr} is not yet published by NSE or it's a market holiday. Showing latest stored trading data (${lastDate}). Auto-fetch will retry periodically.`
            : `NSE releases daily F&O participant OI files after 10:30 PM IST. Displaying last stored trading day data (${lastDate}). Auto-fetch is enabled and will automatically grab today's report after 10:30 PM IST.`;

          setSoftWarning(warningMsg);
          return false;
        } catch (e) {
          setError(err.message || "An unexpected error occurred while communicating with the scraper backend.");
          return false;
        }
      } else {
        setError(err.message || "An unexpected error occurred while communicating with the scraper backend.");
        return false;
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Trigger scrape on mount or date change
  useEffect(() => {
    triggerScrape(selectedDateStr);
  }, [selectedDateStr]);

  // Automatic Background Poller: Checks after 10:30 PM IST every day
  useEffect(() => {
    if (!isAutoFetchEnabled) return;

    const checkAndAutoFetch = () => {
      const ist = getISTDate();
      const currentISTDateStr = getDefaultSelectedDateStr();
      const isAfterCutoff = isAfter1030PMIST();

      console.log(`[AutoFetch Check] IST Time: ${ist.toLocaleTimeString()} | Current Date: ${currentISTDateStr} | After 10:30 PM IST: ${isAfterCutoff}`);

      // If current IST date is weekday and we are after 10:30 PM IST
      if (isAfterCutoff) {
        // If current date in UI is not latest IST date, update it
        if (selectedDateStr !== currentISTDateStr) {
          console.log(`[AutoFetch] After 10:30 PM IST detected. Switching selected date to ${currentISTDateStr}`);
          setSelectedDateStr(currentISTDateStr);
          fetchFiiDiiInApp(currentISTDateStr);
        } else if (isShowingCachedData) {
          // If we are on today's date but showing cached/fallback data, re-trigger scrape to check if NSE uploaded it
          console.log(`[AutoFetch] Re-triggering scrape for ${selectedDateStr} after 10:30 PM IST`);
          triggerScrape(selectedDateStr);
          fetchFiiDiiInApp(selectedDateStr);
        } else {
          // Also refresh FII/DII data periodically after cutoff
          fetchFiiDiiInApp(selectedDateStr);
        }
      }
    };

    // Run check on mount and repeat every 60 seconds
    checkAndAutoFetch();
    const interval = setInterval(checkAndAutoFetch, 60000);
    return () => clearInterval(interval);
  }, [isAutoFetchEnabled, selectedDateStr, isShowingCachedData]);

  const handleManualUploadSuccess = (combinedResults: DayScrapeResult[]) => {
    setScrapeResults(combinedResults);
    setIsShowingCachedData(false);
    localStorage.setItem("decodex_last_successful_scrape_results", JSON.stringify(combinedResults));
    
    const newestDay = combinedResults.find(r => r.status === "success");
    if (newestDay) {
      // transform DD-MM-YYYY back to YYYY-MM-DD
      const parts = newestDay.date.split("-");
      if (parts.length === 3) {
        const formatted = `${parts[2]}-${parts[1]}-${parts[0]}`;
        localStorage.setItem("decodex_last_successful_date_str", formatted);
        setCachedDataDate(formatted);
      }
    }

    setIsLoading(false);
    setError(null);
    setSoftWarning(null);
    setIsUploaderOpen(false);
  };

  // Get index futures sentiment summary to display top-level metrics
  const getTopLevelSentiment = () => {
    if (!scrapeResults) return null;
    const successDays = scrapeResults.filter(r => r.status === "success");
    if (successDays.length === 0) return null;

    const newestDay = successDays[0];
    const oldestDay = successDays[successDays.length - 1];

    const newestFII = newestDay.data?.find(p => p.participant === "FII");
    const oldestFII = oldestDay.data?.find(p => p.participant === "FII");

    if (!newestFII || !oldestFII) return null;

    const newestNet = newestFII.futureIndexLong - newestFII.futureIndexShort;
    const oldestNet = oldestFII.futureIndexLong - oldestFII.futureIndexShort;
    const netChange = newestNet - oldestNet;

    return {
      newestNet,
      netChange,
      isBullish: newestNet >= 0,
      isBuildingLongs: netChange >= 0
    };
  };

  const getMarketBias = () => {
    if (!scrapeResults) return null;
    const successDays = scrapeResults.filter(r => r.status === "success");
    if (successDays.length < 3) return null;

    const d3 = successDays[0];
    const d2 = successDays[1];

    const getRecord = (day: any, participantKey: string) => {
      return day.data?.find((p: any) => p.participant === participantKey);
    };

    const getParticipantStats = (pKey: string) => {
      const r2 = getRecord(d2, pKey);
      const r3 = getRecord(d3, pKey);

      const fIdxNet2 = r2 ? r2.futureIndexLong - r2.futureIndexShort : 0;
      const fIdxNet3 = r3 ? r3.futureIndexLong - r3.futureIndexShort : 0;

      const callNet2 = r2 ? r2.optionIndexCallLong - r2.optionIndexCallShort : 0;
      const callNet3 = r3 ? r3.optionIndexCallLong - r3.optionIndexCallShort : 0;

      const putNet2 = r2 ? r2.optionIndexPutLong - r2.optionIndexPutShort : 0;
      const putNet3 = r3 ? r3.optionIndexPutLong - r3.optionIndexPutShort : 0;

      const todayAdded = fIdxNet3 + callNet3 - putNet3;
      const yesterdayAdded = fIdxNet2 + callNet2 - putNet2;
      const chgFromYday = todayAdded - yesterdayAdded;

      let interpretationColL = "";
      if (todayAdded >= 0 && chgFromYday >= 0) {
        interpretationColL = "Bullish";
      } else if (todayAdded >= 0 && chgFromYday < 0) {
        interpretationColL = "Bearish";
      } else if (todayAdded < 0 && chgFromYday < 0) {
        interpretationColL = "Bearish";
      } else {
        interpretationColL = "Bullish";
      }

      return { todayAdded, chgFromYday, interpretationColL };
    };

    const clientStats = getParticipantStats("Client");
    const fiiStats = getParticipantStats("FII");
    const proStats = getParticipantStats("Pro");

    if (!clientStats || !fiiStats || !proStats) return null;

    const clientSent = clientStats.interpretationColL;
    const fii_sent = fiiStats.interpretationColL;
    const pro_sent = proStats.interpretationColL;

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

    let badgeColor = "bg-slate-600 shadow-slate-100 text-white";
    if (marketBias === "Market Goes Up ⬆️") {
      badgeColor = "bg-emerald-600 shadow-emerald-100 text-white";
    } else if (marketBias === "Market Goes Down ⬇️") {
      badgeColor = "bg-rose-600 shadow-rose-100 text-white";
    } else if (marketBias === "Market May Go Up ⬆️") {
      badgeColor = "bg-teal-600 shadow-teal-100 text-white";
    } else if (marketBias === "Market May Go Down ⬇️") {
      badgeColor = "bg-amber-600 shadow-amber-100 text-white";
    }

    return {
      marketBias,
      badgeColor
    };
  };

  const sentiment = getTopLevelSentiment();
  const biasInfo = getMarketBias();

  const getFiiDiiValue = (shortName: string) => {
    if (!fiiDiiData || !fiiDiiData.FIIDIIData) return null;
    const item = fiiDiiData.FIIDIIData.find(
      (d: any) => d.ShortName?.toUpperCase().trim() === shortName.toUpperCase().trim()
    );
    return item ? item.Value : null;
  };

  const fiiCmValue = getFiiDiiValue("FII CM (Pr.)") ?? getFiiDiiValue("FII CM");
  const diiCmValue = getFiiDiiValue("DII CM (Pr.)") ?? getFiiDiiValue("DII CM");
  const fiiIdxFutValue = getFiiDiiValue("FII Idx Fut") ?? getFiiDiiValue("FII IDX FUT");
  const fiiIdxOptValue = getFiiDiiValue("FII Idx Opt") ?? getFiiDiiValue("FII IDX OPT");

  const formatAppCurrency = (val: number | null) => {
    if (val === null) return "N/A";
    const isPos = val >= 0;
    const formatted = new Intl.NumberFormat("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(val);
    return `${isPos ? "+" : ""}${formatted} Cr`;
  };

  return (
    <div id="app-root" className="min-h-screen bg-gray-50/50 text-gray-800 font-sans antialiased flex flex-col selection:bg-indigo-100 selection:text-indigo-900">
      
      {/* Premium Header Nav */}
      <header id="main-header" className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-gray-100 px-4 sm:px-6 py-3.5">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Hamburger Menu Button */}
            <button
              id="hamburger-menu-btn"
              onClick={() => setIsHamburgerOpen(!isHamburgerOpen)}
              className="p-2 text-gray-600 hover:text-gray-900 bg-gray-50 hover:bg-gray-100 border border-gray-200/80 rounded-xl transition-all cursor-pointer"
              title="Toggle Navigation Menu"
            >
              {isHamburgerOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>

            <div 
              onClick={() => { setMainNav("home"); setIsHamburgerOpen(false); }}
              className="flex items-center gap-2.5 cursor-pointer"
            >
              <div className="h-9 w-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-200">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-base font-bold font-display text-gray-900 tracking-tight">NSE F&O Analytics</h1>
                <p className="text-[10px] font-medium text-indigo-600 uppercase tracking-widest">
                  {mainNav === "home" ? "Participant-Wise Open Interest" : "Live Option Chain & Derivatives"}
                </p>
              </div>
            </div>

            {/* Desktop Navigation Links */}
            <nav className="hidden md:flex items-center gap-1.5 ml-6 pl-6 border-l border-gray-200">
              <button
                id="nav-home-btn"
                onClick={() => { setMainNav("home"); setIsHamburgerOpen(false); }}
                className={`flex items-center gap-2 text-xs font-bold px-3.5 py-2 rounded-xl transition-all cursor-pointer ${
                  mainNav === "home"
                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-100"
                    : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                }`}
              >
                <Home className="h-4 w-4" />
                Home
              </button>
              <button
                id="nav-option-chain-btn"
                onClick={() => { setMainNav("option-chain"); setIsHamburgerOpen(false); }}
                className={`flex items-center gap-2 text-xs font-bold px-3.5 py-2 rounded-xl transition-all cursor-pointer ${
                  mainNav === "option-chain"
                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-100"
                    : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                }`}
              >
                <Layers className="h-4 w-4" />
                Option Chain
              </button>
            </nav>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-emerald-50 border border-emerald-100 rounded-xl text-xs text-emerald-800 font-medium">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span>Auto-Fetch Active</span>
            </div>

            <button
              id="open-uploader-btn"
              onClick={() => setIsUploaderOpen(true)}
              className="flex items-center gap-2 text-xs font-semibold text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 hover:border-gray-300 px-3.5 py-2 rounded-xl transition-all shadow-xs cursor-pointer"
            >
              <FileUp className="h-4 w-4 text-gray-400" /> <span className="hidden sm:inline">Manual Upload Fallback</span>
            </button>
          </div>
        </div>

        {/* Hamburger Mobile/Expanded Dropdown Menu */}
        {isHamburgerOpen && (
          <div className="mt-3 pt-3 border-t border-gray-100 max-w-7xl mx-auto flex flex-col gap-1.5 animate-fade-in">
            <button
              id="hamburger-nav-home"
              onClick={() => { setMainNav("home"); setIsHamburgerOpen(false); }}
              className={`flex items-center justify-between p-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                mainNav === "home"
                  ? "bg-indigo-50 text-indigo-700 border border-indigo-100"
                  : "bg-gray-50 hover:bg-gray-100 text-gray-700"
              }`}
            >
              <div className="flex items-center gap-3">
                <Home className="h-4 w-4 text-indigo-600" />
                <span>Home (Participant OI & FII/DII Analytics)</span>
              </div>
              {mainNav === "home" && <span className="text-[10px] bg-indigo-600 text-white px-2 py-0.5 rounded-full font-semibold">Active</span>}
            </button>

            <button
              id="hamburger-nav-option-chain"
              onClick={() => { setMainNav("option-chain"); setIsHamburgerOpen(false); }}
              className={`flex items-center justify-between p-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                mainNav === "option-chain"
                  ? "bg-indigo-50 text-indigo-700 border border-indigo-100"
                  : "bg-gray-50 hover:bg-gray-100 text-gray-700"
              }`}
            >
              <div className="flex items-center gap-3">
                <Layers className="h-4 w-4 text-indigo-600" />
                <span>Option Chain (Live Derivatives Stream)</span>
              </div>
              {mainNav === "option-chain" && <span className="text-[10px] bg-indigo-600 text-white px-2 py-0.5 rounded-full font-semibold">Active</span>}
            </button>
          </div>
        )}
      </header>

      {/* Main Workspace Grid */}
      <main id="main-content" className="max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-6 flex-1">
        
        {mainNav === "option-chain" ? (
          <OptionChain />
        ) : (
          <>
            {/* Bento Grid Top bar: Date Picker + Quick explanation */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Calendar Picker Box */}
          <div className="bg-white border border-gray-100 p-5 rounded-2xl shadow-sm flex flex-col justify-between space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 bg-indigo-50 rounded-lg flex items-center justify-center text-indigo-600">
                  <Calendar className="h-4 w-4" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold font-display text-gray-950">Select Target Date</h2>
                  <p className="text-xs text-gray-400">Loads chosen day + preceding 2 trading days</p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <input
                id="target-date-picker"
                type="date"
                value={selectedDateStr}
                onChange={(e) => {
                  if (e.target.value) {
                    setSelectedDateStr(e.target.value);
                  }
                }}
                max="2026-12-31"
                min="2020-01-01"
                className="w-full bg-gray-50 border border-gray-200 hover:border-indigo-300 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl px-4 py-3 text-sm font-medium outline-none transition-all cursor-pointer text-gray-900 shadow-inner"
              />
              <button
                id="refresh-btn"
                onClick={() => triggerScrape(selectedDateStr)}
                disabled={isLoading}
                className="bg-indigo-50 hover:bg-indigo-100 text-indigo-600 p-3 rounded-xl border border-indigo-100 transition-colors cursor-pointer flex items-center gap-1 text-xs font-semibold"
                title="Force Re-scrape"
              >
                <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
              </button>
            </div>

            <div className="pt-1 flex items-center justify-between text-[11px] text-gray-500 bg-gray-50/80 p-2.5 rounded-xl border border-gray-100">
              <div className="flex items-center gap-1.5 text-emerald-700 font-medium">
                <Clock className="h-3.5 w-3.5 text-emerald-600" />
                <span>Auto-fetch checks daily after 10:30 PM IST</span>
              </div>
              <button
                onClick={() => {
                  const todayStr = getDefaultSelectedDateStr();
                  setSelectedDateStr(todayStr);
                  triggerScrape(todayStr);
                }}
                className="text-indigo-600 hover:text-indigo-800 font-semibold cursor-pointer underline decoration-indigo-200"
              >
                Fetch Today's
              </button>
            </div>
          </div>

          {/* Core Sentiment Box */}
          <div className="bg-white border border-gray-100 p-5 rounded-2xl shadow-sm flex flex-col justify-between space-y-3">
            <div className="flex items-center justify-between border-b border-gray-50 pb-2">
              <span className="text-xs font-bold text-gray-900 uppercase tracking-wider">FII Sentiment & Bias</span>
              <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full uppercase">Computed Metrics</span>
            </div>

            {biasInfo && (
              <div className="flex flex-col gap-1 bg-gray-50/50 p-2.5 rounded-xl border border-gray-100">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">System Market Bias</span>
                <div className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase text-center tracking-wide ${biasInfo.badgeColor}`}>
                  {biasInfo.marketBias}
                </div>
              </div>
            )}

            {sentiment ? (
              <div className="flex items-end justify-between pt-1">
                <div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">FII Index Futures</span>
                  <div className="text-xl font-black font-display text-gray-900 tracking-tight mt-0.5">
                    {sentiment.newestNet > 0 ? "+" : ""}
                    {new Intl.NumberFormat("en-IN").format(sentiment.newestNet)}
                  </div>
                  <p className="text-[10px] text-gray-500 mt-0.5">
                    Stance:{" "}
                    <span className={sentiment.isBullish ? "text-emerald-600 font-bold" : "text-rose-600 font-bold"}>
                      {sentiment.isBullish ? "Net LONG" : "Net SHORT"}
                    </span>
                  </p>
                </div>

                <div className="flex flex-col items-end">
                  <div className={`flex items-center text-[10px] font-bold font-mono px-2 py-1 rounded-lg ${
                    sentiment.isBuildingLongs ? "text-emerald-700 bg-emerald-50" : "text-rose-700 bg-rose-50"
                  }`}>
                    {sentiment.isBuildingLongs ? (
                      <>
                        <TrendingUp className="h-3.5 w-3.5 mr-1 shrink-0" /> Buying
                      </>
                    ) : (
                      <>
                        <TrendingDown className="h-3.5 w-3.5 mr-1 shrink-0" /> Selling
                      </>
                    )}
                  </div>
                  <span className="text-[9px] text-gray-400 mt-1">
                    {sentiment.netChange > 0 ? "+" : ""}
                    {new Intl.NumberFormat("en-IN").format(sentiment.netChange)} (3d swing)
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-400 mt-2">Loading sentiment data...</p>
            )}
          </div>

          {/* Quick guide card -> Derivatives Trend Intelligence Box */}
          <div id="derivatives-trend-intelligence-box" className="bg-white text-gray-800 p-4 sm:p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between relative overflow-hidden">
            {/* Background Accent glow */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-2xl -z-10 pointer-events-none" />
            
            <div className="space-y-2.5 sm:space-y-3">
              <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                <div>
                  <h3 className="font-bold font-display text-xs sm:text-sm text-gray-950 tracking-tight">Derivatives Trend Intelligence</h3>
                  <span className="text-[8px] sm:text-[9px] font-bold text-indigo-600 uppercase tracking-widest block mt-0.5">
                    {fiiDiiData?.Date ? `Session: ${new Date(fiiDiiData.Date).toLocaleDateString("en-US", { day: "numeric", month: "short" })}` : "Institutional Flows"}
                  </span>
                </div>
                <Info className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-indigo-600 shrink-0" />
              </div>

              {fiiDiiLoading ? (
                <div className="py-6 flex flex-col items-center justify-center space-y-1.5">
                  <RefreshCw className="h-4 w-4 text-indigo-500 animate-spin" />
                  <p className="text-[9px] sm:text-[10px] text-gray-400 font-bold">Querying segments...</p>
                </div>
              ) : fiiDiiData ? (
                <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
                  {[
                    { label: "FII CM (net flow)", value: fiiCmValue },
                    { label: "DII CM (Net Flow)", value: diiCmValue },
                    { label: "FII IDX FUT (Net Flow)", value: fiiIdxFutValue },
                    { label: "FII IDX OPT (net flow)", value: fiiIdxOptValue }
                  ].map((item, idx) => {
                    const isPos = item.value !== null && item.value >= 0;
                    return (
                      <div key={idx} className="bg-gray-50/70 border border-gray-100 px-1.5 py-1 sm:p-2 rounded-xl flex flex-col justify-between hover:border-gray-200/50 hover:bg-gray-50 transition-colors min-w-0">
                        <span className="text-[7.5px] sm:text-[9px] font-bold text-gray-400 uppercase tracking-tight truncate" title={item.label}>
                          {item.label}
                        </span>
                        <span className={`text-[9px] sm:text-[11px] font-bold font-mono mt-0.5 tracking-tighter sm:tracking-normal truncate ${
                          item.value === null ? "text-gray-400" : isPos ? "text-emerald-600" : "text-rose-600"
                        }`}>
                          {formatAppCurrency(item.value)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-[11px] sm:text-xs text-gray-400 leading-relaxed font-medium">
                  Select a session date or run a scrape to load real-time institutional flow data (FII CM, DII CM, Index Futures & Options) directly inside this intelligence panel.
                </p>
              )}
            </div>

            <p className="text-[8px] sm:text-[9px] text-gray-400 leading-normal border-t border-gray-100 pt-2 mt-3 font-medium">
              Daily F&O momentum is heavily guided by Cash Market (CM) liquidity and Index derivative shifts.
            </p>
          </div>

        </div>

        {/* LOADING SEQUENCER */}
        {isLoading && (
          <div id="loader-panel" className="bg-white border border-gray-100 rounded-2xl p-12 text-center shadow-sm flex flex-col items-center justify-center space-y-6">
            <div className="relative flex items-center justify-center">
              <Loader2 className="h-12 w-12 text-indigo-600 animate-spin" />
              <Database className="h-5 w-5 text-indigo-500 absolute" />
            </div>
            <div className="space-y-2">
              <h3 className="font-semibold text-gray-900 font-display text-base">Running Real-Time NSE Data Scraper</h3>
              <p className="text-xs text-gray-400 max-w-md mx-auto">
                Rotating active free residential proxies to safely bypass Akamai protection on NSE archives. This takes about 15-30 seconds to download and parse all 3 trading days. Please stand by...
              </p>
            </div>

            {/* Simulated/active visual status stepper */}
            <div className="flex items-center gap-2 text-xs font-semibold text-gray-400 font-mono">
              <span className="text-indigo-600">Proxy Display</span> ➜ <span>Scrape Day 1</span> ➜ <span>Scrape Day 2</span> ➜ <span>Scrape Day 3</span>
            </div>
          </div>
        )}

        {/* ERROR PANEL */}
        {error && !scrapeResults && (
          <div id="error-panel" className="bg-white border border-gray-100 rounded-2xl p-10 text-center shadow-sm flex flex-col items-center justify-center space-y-5">
            <div className="h-12 w-12 rounded-full bg-rose-50 flex items-center justify-center text-rose-600">
              <AlertCircle className="h-6 w-6" />
            </div>
            <div className="space-y-1.5">
              <h3 className="font-semibold text-gray-950 font-display text-sm">Automated Scraping Failed</h3>
              <p className="text-xs text-gray-500 max-w-lg mx-auto leading-relaxed">
                {error}
                <br />
                <span className="text-gray-400">
                  NSE frequently updates blocks or rate-limits cloud servers. Do not worry—our resilient backup allows you to download the files and upload them with 1 click.
                </span>
              </p>
            </div>
            <button
              id="error-open-uploader-btn"
              onClick={() => setIsUploaderOpen(true)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-5 py-2.5 rounded-xl transition-all shadow-md shadow-indigo-100"
            >
              Use Manual Upload Fallback
            </button>
          </div>
        )}

        {/* SCAPE RESULTS WORKSPACE */}
        {scrapeResults && !isLoading && (
          <div id="analytics-workspace" className="space-y-6 animate-fade-in">
            
            {/* Soft Warning Banner for Holiday / Closed Market / Cached Fallback */}
            {softWarning && (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-xs font-semibold text-amber-800 flex items-center justify-between gap-4 shadow-sm animate-fade-in">
                <div className="flex items-center gap-2.5">
                  <div className="h-6 w-6 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 shrink-0">
                    <Info className="h-4 w-4" />
                  </div>
                  <span>{softWarning}</span>
                </div>
                <button 
                  onClick={() => setSoftWarning(null)}
                  className="text-[10px] bg-amber-100 hover:bg-amber-200 text-amber-950 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer shrink-0"
                >
                  Dismiss
                </button>
              </div>
            )}
            
            {/* Premium Navigation Tabs */}
            <div className="flex flex-wrap items-center gap-2 bg-gray-100 p-1.5 rounded-2xl w-full max-w-xl">
              <button
                id="tab-dashboard"
                onClick={() => setActiveTab("dashboard")}
                className={`flex-1 flex items-center justify-center gap-2 text-xs font-bold py-2.5 px-4 rounded-xl transition-all whitespace-nowrap ${
                  activeTab === "dashboard"
                    ? "bg-white text-indigo-600 shadow-sm"
                    : "text-gray-500 hover:text-gray-900"
                }`}
              >
                <SlidersHorizontal className="h-4 w-4" />
                Dashboard Analytics
              </button>
              <button
                id="tab-decodex"
                onClick={() => setActiveTab("decodex")}
                className={`flex-1 flex items-center justify-center gap-2 text-xs font-bold py-2.5 px-4 rounded-xl transition-all whitespace-nowrap ${
                  activeTab === "decodex"
                    ? "bg-white text-indigo-600 shadow-sm"
                    : "text-gray-500 hover:text-gray-900"
                }`}
              >
                <Table className="h-4 w-4" />
                DecodeXMarket
              </button>
              <button
                id="tab-fiidii"
                onClick={() => setActiveTab("fiidii")}
                className={`flex-1 flex items-center justify-center gap-2 text-xs font-bold py-2.5 px-4 rounded-xl transition-all whitespace-nowrap ${
                  activeTab === "fiidii"
                    ? "bg-white text-indigo-600 shadow-sm"
                    : "text-gray-500 hover:text-gray-900"
                }`}
              >
                <TrendingUp className="h-4 w-4" />
                FII/DII Activity
              </button>
            </div>

            {activeTab === "dashboard" ? (
              <div className="space-y-6 animate-fade-in">
                {/* Participant selector ribbon */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white border border-gray-100 p-4 rounded-2xl shadow-sm">
                  <div className="flex items-center gap-2.5">
                    <SlidersHorizontal className="h-4 w-4 text-gray-400 shrink-0" />
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Select Market Category</span>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {["FII", "Pro", "Client", "DII", "TOTAL"].map((p) => (
                      <button
                        key={p}
                        id={`select-participant-${p.toLowerCase()}`}
                        onClick={() => setSelectedParticipant(p)}
                        className={`text-xs font-semibold px-4 py-2 rounded-xl transition-all ${
                          selectedParticipant === p
                            ? "bg-indigo-600 text-white shadow-md shadow-indigo-100"
                            : "bg-gray-50 text-gray-600 hover:bg-gray-100 hover:text-gray-900 border border-gray-100"
                        }`}
                      >
                        {p === "FII" ? "FII (Smart Money)" : p === "Pro" ? "Pro (Brokers)" : p === "Client" ? "Client (Retail)" : p === "DII" ? "DII (Domestic)" : "TOTAL MARKET"}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Comparison Charts */}
                <DashboardCharts results={scrapeResults} selectedParticipant={selectedParticipant} />

                {/* Comparison Table */}
                <ParticipantTable results={scrapeResults} selectedParticipant={selectedParticipant} />
              </div>
            ) : activeTab === "decodex" ? (
              <div className="space-y-8 animate-fade-in">
                <DecodeXMarket 
                  results={scrapeResults} 
                  selectedDateStr={selectedDateStr}
                  setSelectedDateStr={setSelectedDateStr}
                  triggerScrape={triggerScrape}
                  isLoading={isLoading}
                  onOpenUploader={() => setIsUploaderOpen(true)}
                />
              </div>
            ) : (
              <FiiDiiActivity />
            )}

          </div>
        )}
          </>
        )}

      </main>

      {/* FOOTER */}
      <footer id="main-footer" className="bg-white border-t border-gray-100 mt-12 py-8 px-6 sm:px-8 text-xs text-gray-500">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 border-b border-gray-100 pb-6">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-bold font-display shadow-sm">
                DX
              </div>
              <div>
                <h3 className="font-bold text-gray-900 text-sm font-display">NSE F&O Analytics & DecodeXMarket</h3>
                <p className="text-[11px] text-gray-400">Institutional Open Interest & Participant Derivatives Intelligence</p>
              </div>
            </div>

            {/* Founder & Contact Details */}
            <div className="flex flex-wrap items-center gap-3 text-xs bg-gray-50 border border-gray-200/80 p-2.5 rounded-xl">
              <div className="flex items-center gap-2 pr-3 border-r border-gray-200 text-gray-800 font-medium">
                <User className="h-3.5 w-3.5 text-indigo-600" />
                <span><strong className="font-semibold text-gray-950">Ravi Shankar Sharma</strong> <span className="text-gray-500 text-[11px]">(Founder)</span></span>
              </div>
              <a 
                href="https://wa.me/918271890090" 
                target="_blank" 
                rel="noreferrer"
                className="flex items-center gap-1.5 text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100/80 px-2.5 py-1 rounded-lg border border-emerald-200/60 font-medium transition-colors"
              >
                <Phone className="h-3.5 w-3.5 text-emerald-600" />
                <span>WhatsApp: <strong>8271890090</strong></span>
              </a>
              <a 
                href="mailto:rk867000@gmail.com"
                className="flex items-center gap-1.5 text-indigo-700 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100/80 px-2.5 py-1 rounded-lg border border-indigo-200/60 font-medium transition-colors"
              >
                <Mail className="h-3.5 w-3.5 text-indigo-600" />
                <span>Email: <strong>rk867000@gmail.com</strong></span>
              </a>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-[11px] text-gray-500 font-medium">
              <span className="flex items-center gap-1.5 bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-lg border border-emerald-100">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" /> NSE Pipeline Active
              </span>
              <span className="flex items-center gap-1.5 bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-lg border border-indigo-100">
                <Clock className="h-3 w-3 text-indigo-500" /> Daily Auto-Fetch: 10:30 PM IST
              </span>
            </div>
          </div>

          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 text-[11px] text-gray-400">
            <p className="leading-relaxed max-w-3xl">
              <strong className="text-gray-600 font-semibold">Disclaimer:</strong> This application parses official public data archives published by the National Stock Exchange of India (NSE). It is intended strictly for educational and analytical visualization purposes and does not constitute financial, investment, or SEBI-registered advisory services.
            </p>
            <p className="shrink-0 font-mono text-[10px]">
              © {new Date().getFullYear()} DecodeXMarket Analytics. All rights reserved.
            </p>
          </div>
        </div>
      </footer>

      {/* CSV UPLOADER BACKUP MODAL */}
      {isUploaderOpen && (
        <CsvUploader
          requiredTradingDays={targetTradingDays}
          onUploadSuccess={handleManualUploadSuccess}
          onClose={() => setIsUploaderOpen(false)}
        />
      )}

    </div>
  );
}
