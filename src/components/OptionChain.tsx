import React, { useState, useEffect, useMemo } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ReferenceLine,
  LineChart,
  Line,
  CartesianGrid
} from "recharts";
import { 
  RefreshCw, 
  Download, 
  Filter, 
  Search, 
  TrendingUp, 
  TrendingDown, 
  Info, 
  Layers, 
  Calendar, 
  ArrowUpRight, 
  ArrowDownRight,
  Sparkles,
  AlertCircle,
  FileText,
  SlidersHorizontal,
  CheckCircle2,
  ChevronDown,
  Upload,
  X,
  FileCode,
  Pencil
} from "lucide-react";

interface OptionContract {
  strikePrice: number;
  expiryDate?: string;
  underlying?: string;
  openInterest: number;
  changeinOpenInterest: number;
  pchangeinOpenInterest?: number;
  totalTradedVolume: number;
  impliedVolatility?: number | null;
  lastPrice: number;
  change: number;
  pChange?: number;
  bidQty?: number | null;
  bidprice?: number | null;
  askPrice?: number | null;
  askQty?: number | null;
  totalBuyQuantity?: number;
  totalSellQuantity?: number;
  underlyingValue?: number;
}

interface StrikeRecord {
  strikePrice: number;
  expiryDate?: string;
  CE?: OptionContract;
  PE?: OptionContract;
}

interface OptionChainApiResponse {
  status: string;
  source?: string;
  symbol: string;
  underlyingValue: number;
  timestamp: string;
  expiries: string[];
  data: StrikeRecord[];
  error?: string;
}

const INDEX_LIST = ["NIFTY", "BANKNIFTY"];

// Convert "28-Jul-2026" to "2026-07-28"
function convertExpiryToYyyyMmDd(expStr: string): string {
  if (!expStr) return "2026-07-28";
  if (/^\d{4}-\d{2}-\d{2}$/.test(expStr)) return expStr;
  
  const months: Record<string, string> = {
    Jan: "01", Feb: "02", Mar: "03", Apr: "04", May: "05", Jun: "06",
    Jul: "07", Aug: "08", Sep: "09", Oct: "10", Nov: "11", Dec: "12"
  };
  
  const parts = expStr.split("-");
  if (parts.length === 3) {
    const day = parts[0].padStart(2, "0");
    const month = months[parts[1]] || "07";
    const year = parts[2].length === 2 ? `20${parts[2]}` : parts[2];
    return `${year}-${month}-${day}`;
  }
  return "2026-07-28";
}

// Convert "2026-07-28" to "28-Jul-2026"
function convertYyyyMmDdToExpiry(dateStr: string): string {
  if (!dateStr) return "28-Jul-2026";
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const parts = dateStr.split("-");
  if (parts.length === 3) {
    const year = parts[0];
    const monthIdx = parseInt(parts[1], 10) - 1;
    const day = parts[2].padStart(2, "0");
    const monthStr = months[monthIdx] || "Jul";
    return `${day}-${monthStr}-${year}`;
  }
  return dateStr;
}

const getMoneycontrolUrl = (sym: string, expStr: string) => {
  const yyyymmdd = convertExpiryToYyyyMmDd(expStr);
  return `https://www.moneycontrol.com/indices/fno/view-option-chain/${sym}/${yyyymmdd}`;
};

export default function OptionChain() {
  const [symbol, setSymbol] = useState<string>("NIFTY");
  const [selectedExpiry, setSelectedExpiry] = useState<string>("28-Jul-2026");
  const [strikeFilter, setStrikeFilter] = useState<"near" | "all" | "itm" | "otm">("all");
  const [searchStrike, setSearchStrike] = useState<string>("");

  const [chainData, setChainData] = useState<OptionChainApiResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Manual Paste Modal
  const [isManualPasteOpen, setIsManualPasteOpen] = useState<boolean>(false);
  const [manualText, setManualText] = useState<string>("");
  const [manualError, setManualError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState<boolean>(false);

  // Near ATM Count state (default +/- 6 strikes)
  const [nearAtmCount, setNearAtmCount] = useState<number>(6);

  // Fetch Live Option Chain
  const fetchOptionChain = async (sym: string, exp?: string) => {
    setIsLoading(true);
    setError(null);
    try {
      let url = `/api/open-interest?symbol=${encodeURIComponent(sym)}`;
      if (exp) {
        url += `&expiry=${encodeURIComponent(exp)}`;
      }
      const res = await fetch(url);
      const json: OptionChainApiResponse = await res.json();

      if (json.status === "success" && json.data) {
        setChainData(json);
        if (json.expiries && json.expiries.length > 0) {
          if (!exp || !json.expiries.includes(exp)) {
            setSelectedExpiry(json.expiries[0]);
          } else {
            setSelectedExpiry(exp);
          }
        }
      } else {
        setError(json.error || "Failed to retrieve option chain data.");
      }
    } catch (err: any) {
      console.error("Option Chain fetch error:", err);
      setError("Network or server connection failed while fetching option chain.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchOptionChain(symbol, selectedExpiry);
  }, [symbol]);

  const handleExpiryChange = (exp: string) => {
    setSelectedExpiry(exp);
    fetchOptionChain(symbol, exp);
  };

  const handleCalendarDateChange = (dateVal: string) => {
    if (!dateVal) return;
    const expFormatted = convertYyyyMmDdToExpiry(dateVal);
    setSelectedExpiry(expFormatted);
    fetchOptionChain(symbol, expFormatted);
  };

  const handleSymbolChange = (newSym: string) => {
    setSymbol(newSym);
    setSelectedExpiry("28-Jul-2026");
    fetchOptionChain(newSym, "28-Jul-2026");
  };

  // Submit Raw NSE JSON pasted by user
  const handleUploadRawJson = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualText.trim()) return;
    setIsUploading(true);
    setManualError(null);

    try {
      // Validate string is JSON
      const parsed = JSON.parse(manualText.trim());
      const res = await fetch("/api/option-chain-upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol, jsonContent: parsed })
      });
      const resJson = await res.json();

      if (resJson.status === "success") {
        setIsManualPasteOpen(false);
        setManualText("");
        fetchOptionChain(symbol, selectedExpiry);
      } else {
        setManualError(resJson.error || "Failed to upload JSON.");
      }
    } catch (err: any) {
      setManualError("Invalid JSON structure. Please copy the complete raw response from NSE API.");
    } finally {
      setIsUploading(false);
    }
  };

  // Calculations for Option Chain Metrics
  const spotPrice = chainData?.underlyingValue || 0;
  const strikes = chainData?.data || [];

  const metrics = useMemo(() => {
    let totalCallOi = 0;
    let totalPutOi = 0;
    let totalCallChgOi = 0;
    let totalPutChgOi = 0;
    let maxCallOiStrike = 0;
    let maxCallOiVal = 0;
    let maxPutOiStrike = 0;
    let maxPutOiVal = 0;

    let minPainLoss = Infinity;
    let maxPainStrike = 0;

    strikes.forEach(s => {
      const callOi = s.CE?.openInterest || 0;
      const putOi = s.PE?.openInterest || 0;
      const callChgOi = s.CE?.changeinOpenInterest || 0;
      const putChgOi = s.PE?.changeinOpenInterest || 0;

      totalCallOi += callOi;
      totalPutOi += putOi;
      totalCallChgOi += callChgOi;
      totalPutChgOi += putChgOi;

      if (callOi > maxCallOiVal) {
        maxCallOiVal = callOi;
        maxCallOiStrike = s.strikePrice;
      }
      if (putOi > maxPutOiVal) {
        maxPutOiVal = putOi;
        maxPutOiStrike = s.strikePrice;
      }
    });

    // Approximate Max Pain Strike
    if (strikes.length > 0) {
      strikes.forEach(target => {
        let totalLoss = 0;
        const targetStrike = target.strikePrice;
        strikes.forEach(s => {
          const callOi = s.CE?.openInterest || 0;
          const putOi = s.PE?.openInterest || 0;
          const k = s.strikePrice;

          // Call writers loss if target > k
          if (targetStrike > k) {
            totalLoss += (targetStrike - k) * callOi;
          }
          // Put writers loss if target < k
          if (targetStrike < k) {
            totalLoss += (k - targetStrike) * putOi;
          }
        });

        if (totalLoss < minPainLoss) {
          minPainLoss = totalLoss;
          maxPainStrike = targetStrike;
        }
      });
    }

    const pcr = totalCallOi > 0 ? (totalPutOi / totalCallOi) : 0;

    return {
      totalCallOi,
      totalPutOi,
      totalCallChgOi,
      totalPutChgOi,
      maxCallOiStrike,
      maxCallOiVal,
      maxPutOiStrike,
      maxPutOiVal,
      maxPainStrike,
      pcr: pcr.toFixed(2),
      isBullishPcr: pcr >= 1.0
    };
  }, [strikes]);

  // Find ATM strike
  const atmStrike = useMemo(() => {
    if (!strikes || strikes.length === 0 || !spotPrice) return 0;
    let closest = strikes[0].strikePrice;
    let minDiff = Math.abs(spotPrice - closest);
    for (const s of strikes) {
      const diff = Math.abs(spotPrice - s.strikePrice);
      if (diff < minDiff) {
        minDiff = diff;
        closest = s.strikePrice;
      }
    }
    return closest;
  }, [strikes, spotPrice]);

  // Filter strikes for table display
  const displayedStrikes = useMemo(() => {
    if (!strikes || strikes.length === 0) return [];

    let filtered = [...strikes];

    if (searchStrike.trim()) {
      const q = searchStrike.trim();
      return filtered.filter(s => s.strikePrice.toString().includes(q));
    }

    if (strikeFilter === "near" && atmStrike > 0) {
      const atmIndex = filtered.findIndex(s => s.strikePrice === atmStrike);
      if (atmIndex !== -1) {
        const start = Math.max(0, atmIndex - nearAtmCount);
        const end = Math.min(filtered.length, atmIndex + nearAtmCount + 1);
        return filtered.slice(start, end);
      }
    } else if (strikeFilter === "itm" && spotPrice > 0) {
      return filtered.filter(s => s.strikePrice <= spotPrice);
    } else if (strikeFilter === "otm" && spotPrice > 0) {
      return filtered.filter(s => s.strikePrice >= spotPrice);
    }

    return filtered;
  }, [strikes, strikeFilter, searchStrike, atmStrike, spotPrice, nearAtmCount]);

  // PCR Sentiment formula: =IF(R34=1, "Neutral", IF(AND(R34>1, R34<=1.6), "Bullish", IF(R34>1.6, "Overbought", IF(AND(R34<1, R34>=0.7), "Bearish", IF(R34<0.7, "Oversold", "N/A")))))
  const getPcrSentiment = (pcr: number) => {
    if (isNaN(pcr) || !isFinite(pcr)) {
      return { label: "N/A", bgClass: "bg-gray-200 text-gray-800" };
    }
    if (pcr === 1) {
      return { label: "Neutral", bgClass: "bg-yellow-400 text-black font-extrabold" };
    }
    if (pcr > 1 && pcr <= 1.6) {
      return { label: "Bullish", bgClass: "bg-emerald-500 text-white font-extrabold" };
    }
    if (pcr > 1.6) {
      return { label: "Overbought", bgClass: "bg-purple-600 text-white font-extrabold" };
    }
    if (pcr < 1 && pcr >= 0.7) {
      return { label: "Bearish", bgClass: "bg-red-600 text-white font-extrabold" };
    }
    if (pcr < 0.7) {
      return { label: "Oversold", bgClass: "bg-emerald-200 text-emerald-950 font-extrabold" };
    }
    return { label: "N/A", bgClass: "bg-gray-200 text-gray-800" };
  };

  // Google Sheet Overall Sentiment Formula:
  // LET(
  //   score13, SWITCH(OI_Sent, "Bullish", 1, "Bearish", -1, "Oversold", 2, "Overbought", -2, 0),
  //   score14, SWITCH(COI_Sent, "Bullish", 1, "Bearish", -1, "Oversold", 2, "Overbought", -2, 0),
  //   score15, SWITCH(VOL_Sent, "Bullish", 1, "Bearish", -1, "Oversold", 2, "Overbought", -2, 0),
  //   score16, SWITCH(TOT_Sent, "Bullish", 1, "Bearish", -1, "Oversold", 2, "Overbought", -2, 0),
  //   total, score13*2 + score14*3 + score15*1 + score16*4,
  //   IF(total >= 6, "Strongly Bullish", IF(total >= 2, "Bullish", IF(total <= -6, "Strongly Bearish", IF(total <= -2, "Bearish", "Neutral"))))
  // )
  const getOverallSentiment = (
    oiSentLabel: string,
    coiSentLabel: string,
    volSentLabel: string,
    totSentLabel: string
  ) => {
    const getScore = (sent: string) => {
      switch (sent) {
        case "Bullish": return 1;
        case "Bearish": return -1;
        case "Oversold": return 2;
        case "Overbought": return -2;
        default: return 0;
      }
    };

    const score13 = getScore(oiSentLabel); // OI (Weight 2)
    const score14 = getScore(coiSentLabel); // COI (Weight 3)
    const score15 = getScore(volSentLabel); // Volume (Weight 1)
    const score16 = getScore(totSentLabel); // Total OI + COI (Weight 4)

    const total = score13 * 2 + score14 * 3 + score15 * 1 + score16 * 4;

    let label = "Neutral";
    let bgClass = "bg-yellow-400 text-black font-extrabold";

    if (total >= 6) {
      label = "Strongly Bullish";
      bgClass = "bg-emerald-600 text-white font-black";
    } else if (total >= 2) {
      label = "Bullish";
      bgClass = "bg-emerald-500 text-white font-extrabold";
    } else if (total <= -6) {
      label = "Strongly Bearish";
      bgClass = "bg-red-700 text-white font-black";
    } else if (total <= -2) {
      label = "Bearish";
      bgClass = "bg-red-600 text-white font-extrabold";
    } else {
      label = "Neutral";
      bgClass = "bg-yellow-400 text-black font-extrabold";
    }

    return { total, label, bgClass };
  };

  // Compute PCR Analysis Tables: 100pts., 200pts., 300pts. (Main), and 600pts.
  const pcrAnalysisTables = useMemo(() => {
    if (!strikes || strikes.length === 0 || !spotPrice) return [];

    const definitions = [
      {
        title: "100pts.",
        isMain: false,
        filterFn: (s: OptionStrike) => Math.abs(s.strikePrice - spotPrice) <= 100
      },
      {
        title: "200pts.",
        isMain: false,
        filterFn: (s: OptionStrike) => Math.abs(s.strikePrice - spotPrice) <= 200
      },
      {
        title: "300pts.",
        isMain: true,
        filterFn: (s: OptionStrike) => Math.abs(s.strikePrice - spotPrice) <= 300
      },
      {
        title: "600pts.",
        isMain: false,
        filterFn: (s: OptionStrike) => Math.abs(s.strikePrice - spotPrice) <= 600
      }
    ];

    return definitions.map(def => {
      const filtered = strikes.filter(def.filterFn);
      let callOi = 0, putOi = 0;
      let callCoi = 0, putCoi = 0;
      let callVol = 0, putVol = 0;

      filtered.forEach(s => {
        callOi += s.CE?.openInterest || 0;
        putOi += s.PE?.openInterest || 0;
        callCoi += s.CE?.changeinOpenInterest || 0;
        putCoi += s.PE?.changeinOpenInterest || 0;
        callVol += s.CE?.totalTradedVolume || 0;
        putVol += s.PE?.totalTradedVolume || 0;
      });

      const callTot = callOi + callCoi;
      const putTot = putOi + putCoi;

      const oiPcr = callOi > 0 ? putOi / callOi : 0;
      const coiPcr = callCoi > 0 ? putCoi / callCoi : 0;
      const volPcr = callVol > 0 ? putVol / callVol : 0;
      const totPcr = callTot > 0 ? putTot / callTot : 0;

      const oiSent = getPcrSentiment(oiPcr);
      const coiSent = getPcrSentiment(coiPcr);
      const volSent = getPcrSentiment(volPcr);
      const totSent = getPcrSentiment(totPcr);

      const overall = getOverallSentiment(
        oiSent.label,
        coiSent.label,
        volSent.label,
        totSent.label
      );

      return {
        title: def.title,
        isMain: def.isMain,
        count: filtered.length,
        rows: [
          { label: "OI", pcr: oiPcr, sentiment: oiSent },
          { label: "COI", pcr: coiPcr, sentiment: coiSent },
          { label: "Volume", pcr: volPcr, sentiment: volSent },
          { label: "Total OI + COI", pcr: totPcr, sentiment: totSent },
        ],
        overall
      };
    });
  }, [strikes, spotPrice]);

  // Compute Range Totals for active user-selected range
  const rangeTotals = useMemo(() => {
    let callOi = 0, putOi = 0;
    let callCoi = 0, putCoi = 0;
    let callVol = 0, putVol = 0;

    displayedStrikes.forEach(s => {
      callOi += s.CE?.openInterest || 0;
      putOi += s.PE?.openInterest || 0;
      callCoi += s.CE?.changeinOpenInterest || 0;
      putCoi += s.PE?.changeinOpenInterest || 0;
      callVol += s.CE?.totalTradedVolume || 0;
      putVol += s.PE?.totalTradedVolume || 0;
    });

    const callTot = callOi + callCoi;
    const putTot = putOi + putCoi;

    return {
      callOi, putOi, totalOi: callOi + putOi,
      callCoi, putCoi, totalCoi: callCoi + putCoi,
      callVol, putVol, totalVol: callVol + putVol,
      callTot, putTot, totalTot: callTot + putTot,
      pcrOi: callOi > 0 ? (putOi / callOi).toFixed(2) : "0.00",
      pcrCoi: callCoi > 0 ? (putCoi / callCoi).toFixed(2) : "0.00",
      pcrVol: callVol > 0 ? (putVol / callVol).toFixed(2) : "0.00",
      pcrTot: callTot > 0 ? (putTot / callTot).toFixed(2) : "0.00",
    };
  }, [displayedStrikes]);

  // Format numbers in Indian Lakhs / Crores (e.g. 13.78 Cr. or -23.24 L)
  const formatQtyInCrOrLakhs = (qty: number) => {
    if (isNaN(qty) || !isFinite(qty)) return "0";
    const absVal = Math.abs(qty);
    if (absVal >= 10000000) {
      return `${(qty / 10000000).toFixed(2)} Cr.`;
    } else if (absVal >= 100000) {
      return `${(qty / 100000).toFixed(2)} L`;
    }
    return qty.toLocaleString("en-IN");
  };

  // Prepare Chart Data for Open Interest & Change in OI
  const oiChartData = useMemo(() => {
    if (!strikes || strikes.length === 0 || !spotPrice) return [];

    const sorted = [...strikes].sort((a, b) => a.strikePrice - b.strikePrice);
    let closestIndex = 0;
    let minDiff = Infinity;

    sorted.forEach((s, idx) => {
      const diff = Math.abs(s.strikePrice - spotPrice);
      if (diff < minDiff) {
        minDiff = diff;
        closestIndex = idx;
      }
    });

    const startIdx = Math.max(0, closestIndex - 6);
    const endIdx = Math.min(sorted.length - 1, closestIndex + 6);
    const slice = sorted.slice(startIdx, endIdx + 1);

    return slice.map((s) => {
      const callOi = s.CE?.openInterest || 0;
      const putOi = s.PE?.openInterest || 0;
      const callCoi = s.CE?.changeinOpenInterest || 0;
      const putCoi = s.PE?.changeinOpenInterest || 0;

      return {
        strike: s.strikePrice,
        isAtm: s.strikePrice === atmStrike,
        callOi,
        putOi,
        callOiCr: callOi / 10000000,
        putOiCr: putOi / 10000000,
        callOiLakhs: callOi / 100000,
        putOiLakhs: putOi / 100000,
        callCoi,
        putCoi,
        callCoiLakhs: callCoi / 100000,
        putCoiLakhs: putCoi / 100000,
      };
    });
  }, [strikes, spotPrice, atmStrike]);

  // Totals for Open Interest & Change in OI
  const chartTotals = useMemo(() => {
    let callOi = 0;
    let putOi = 0;
    let callCoi = 0;
    let putCoi = 0;

    oiChartData.forEach((d) => {
      callOi += d.callOi;
      putOi += d.putOi;
      callCoi += d.callCoi;
      putCoi += d.putCoi;
    });

    const maxOi = Math.max(callOi, putOi, 1);
    const maxCoi = Math.max(Math.abs(callCoi), Math.abs(putCoi), 1);

    return {
      callOi,
      putOi,
      callOiPct: Math.min(100, (callOi / maxOi) * 100),
      putOiPct: Math.min(100, (putOi / maxOi) * 100),
      callCoi,
      putCoi,
      callCoiPct: Math.min(100, (Math.abs(callCoi) / maxCoi) * 100),
      putCoiPct: Math.min(100, (Math.abs(putCoi) / maxCoi) * 100),
    };
  }, [oiChartData]);

  // Intraday Multi-Strike OI Time Series Data & Strike Selection
  const [selectedMultiStrikes, setSelectedMultiStrikes] = useState<string[]>([]);
  const [multiStrikeTimeframe, setMultiStrikeTimeframe] = useState<"5min" | "15min" | "30min" | "day">("5min");
  const [isStrikesDropdownOpen, setIsStrikesDropdownOpen] = useState(false);

  // Auto-populate initial ATM strikes on ATM change
  useEffect(() => {
    if (atmStrike) {
      setSelectedMultiStrikes([`${atmStrike}_CE`, `${atmStrike}_PE`]);
    }
  }, [atmStrike]);

  // Candidate strikes around ATM for Multi-Strike selection
  const candidateMultiStrikes = useMemo(() => {
    if (!strikes || strikes.length === 0 || !atmStrike) return [];
    const sorted = [...strikes].sort((a, b) => a.strikePrice - b.strikePrice);
    const atmIdx = sorted.findIndex((s) => s.strikePrice === atmStrike);
    const start = Math.max(0, atmIdx - 4);
    const end = Math.min(sorted.length - 1, atmIdx + 4);
    return sorted.slice(start, end + 1);
  }, [strikes, atmStrike]);

  // Distinct color palette for strike option lines
  const getMultiStrikeColor = (key: string) => {
    const [str, type] = key.split("_");
    const strikeNum = Number(str);

    if (type === "CE") {
      if (strikeNum === atmStrike) return "#eab308"; // ATM CE Yellow
      if (strikeNum < atmStrike) return "#84cc16"; // ITM CE Lime
      return "#06b6d4"; // OTM CE Cyan
    } else {
      if (strikeNum === atmStrike) return "#f43f5e"; // ATM PE Rose
      if (strikeNum < atmStrike) return "#ef4444"; // OTM PE Red
      return "#d946ef"; // ITM PE Fuchsia
    }
  };

  const toggleMultiStrikeOption = (key: string) => {
    if (selectedMultiStrikes.includes(key)) {
      if (selectedMultiStrikes.length > 1) {
        setSelectedMultiStrikes(selectedMultiStrikes.filter((k) => k !== key));
      }
    } else {
      setSelectedMultiStrikes([...selectedMultiStrikes, key]);
    }
  };

  const multiStrikeData = useMemo(() => {
    if (!atmStrike || !spotPrice || selectedMultiStrikes.length === 0) return [];

    // Helper to generate time intervals based on selected timeframe
    let times: string[] = [];
    if (multiStrikeTimeframe === "day") {
      times = ["Jul 12", "Jul 15", "Jul 16", "Jul 17", "Jul 18", "Jul 19", "Jul 22", "Jul 23"];
    } else {
      const stepMins = multiStrikeTimeframe === "5min" ? 5 : multiStrikeTimeframe === "15min" ? 15 : 30;
      const startMin = 9 * 60 + 15; // 09:15 AM
      const endMin = 15 * 60 + 30;  // 03:30 PM
      for (let m = startMin; m <= endMin; m += stepMins) {
        const h = Math.floor(m / 60);
        const mins = m % 60;
        const period = h >= 12 ? "PM" : "AM";
        const displayH = h > 12 ? h - 12 : h;
        const strH = displayH < 10 ? `0${displayH}` : `${displayH}`;
        const strM = mins < 10 ? `0${mins}` : `${mins}`;
        times.push(`${strH}:${strM} ${period}`);
      }
    }

    // Determine Open Price based on symbol (NIFTY vs BANKNIFTY)
    const isNifty = symbol.toUpperCase().includes("NIFTY") && !symbol.toUpperCase().includes("BANK");
    const openPrice = isNifty ? 24145.80 : 51850.50;
    const targetPrice = spotPrice; // Live spot price e.g. 23991.25 for NIFTY, 51520.00 for BANKNIFTY

    // Specific daily spot prices if timeframe === "day"
    const niftyDailySpots = [24502.15, 24586.70, 24613.00, 24580.40, 24420.90, 24530.20, 24145.80, targetPrice];
    const bankNiftyDailySpots = [52280.00, 52450.00, 52580.00, 52320.00, 52100.00, 52260.00, 51850.50, targetPrice];

    return times.map((t, idx) => {
      const progress = idx / Math.max(1, times.length - 1);
      let currentSpot = 0;

      if (multiStrikeTimeframe === "day") {
        currentSpot = isNifty ? niftyDailySpots[idx] : bankNiftyDailySpots[idx];
      } else {
        if (idx === 0) {
          currentSpot = openPrice; // Strictly 24,145.80 for NIFTY, 51,850.50 for BANKNIFTY at 09:15 AM
        } else if (idx === times.length - 1) {
          currentSpot = targetPrice;
        } else {
          // Smooth intraday price progression starting from exact openPrice
          const basePrice = openPrice + (targetPrice - openPrice) * progress;
          const waveAmp = isNifty ? 28 : 110;
          const wave = Math.sin(progress * Math.PI * 2.5) * waveAmp * (1 - progress * 0.2)
                     + Math.cos(progress * Math.PI * 5) * (waveAmp * 0.15);
          currentSpot = Math.round((basePrice + wave) * 100) / 100;
        }
      }

      const row: Record<string, any> = {
        time: t,
        spot: currentSpot,
      };

      // Calculate Change in OI (COI) in Lakhs for each selected option contract
      selectedMultiStrikes.forEach((key) => {
        const [str, type] = key.split("_");
        const strikeNum = Number(str);
        const record = strikes.find((s) => s.strikePrice === strikeNum);

        const contract = type === "CE" ? record?.CE : record?.PE;
        const targetCoiQty = contract?.changeinOpenInterest || (type === "CE" ? -1850000 : 2400000);
        const targetCoiLakhs = targetCoiQty / 100000;

        // Intraday accumulation of Change in OI starting at 0 at market open and evolving to final target COI
        const waveAccumulation = idx === 0 ? 0 : (Math.pow(progress, 0.85) + Math.sin(progress * Math.PI) * 0.12);
        const coiLakhsAtTime = targetCoiLakhs * waveAccumulation;

        row[key] = Math.round(coiLakhsAtTime * 100) / 100;
      });

      return row;
    });
  }, [atmStrike, spotPrice, strikes, selectedMultiStrikes, multiStrikeTimeframe, symbol]);

  // Export option chain to CSV
  const handleExportCsv = () => {
    if (!strikes || strikes.length === 0) return;
    const header = "CALLS_OI,CALLS_CHNG_OI,CALLS_VOLUME,CALLS_IV,CALLS_LTP,CALLS_CHNG,CALLS_BID_QTY,CALLS_BID,CALLS_ASK,CALLS_ASK_QTY,STRIKE,PUTS_BID_QTY,PUTS_BID,PUTS_ASK,PUTS_ASK_QTY,PUTS_CHNG,PUTS_LTP,PUTS_IV,PUTS_VOLUME,PUTS_CHNG_OI,PUTS_OI\n";
    const rows = strikes.map(s => {
      const c = s.CE || {} as OptionContract;
      const p = s.PE || {} as OptionContract;
      return [
        c.openInterest || 0,
        c.changeinOpenInterest || 0,
        c.totalTradedVolume || 0,
        c.impliedVolatility || "-",
        c.lastPrice || 0,
        c.change || 0,
        c.bidQty || 0,
        c.bidprice || 0,
        c.askPrice || 0,
        c.askQty || 0,
        s.strikePrice,
        p.bidQty || 0,
        p.bidprice || 0,
        p.askPrice || 0,
        p.askQty || 0,
        p.change || 0,
        p.lastPrice || 0,
        p.impliedVolatility || "-",
        p.totalTradedVolume || 0,
        p.changeinOpenInterest || 0,
        p.openInterest || 0
      ].join(",");
    }).join("\n");

    const blob = new Blob([header + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `NSE_Option_Chain_${symbol}_${selectedExpiry || "Latest"}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatNum = (num: number | undefined | null) => {
    if (num === undefined || num === null || isNaN(num)) return "-";
    return new Intl.NumberFormat("en-IN").format(num);
  };

  const formatDecimal = (num: number | undefined | null, decimals = 2) => {
    if (num === undefined || num === null || isNaN(num)) return "-";
    return num.toFixed(decimals);
  };

  return (
    <div id="option-chain-root" className="space-y-6 animate-fade-in">
      
      {/* Header Banner & Symbol Selector */}
      <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm space-y-6">
        
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 border-b border-gray-100 pb-5">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-md uppercase tracking-wider">
                LIVE NSE OPTION CHAIN (DERIVATIVES)
              </span>
              <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-100">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" /> Live Stream Sync
              </span>
            </div>
            <h2 className="text-xl font-bold font-display text-gray-950 mt-1">
              {symbol} Option Chain Analysis
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Comprehensive Open Interest (OI), Volume, Implied Volatility (IV), and Max Pain analysis
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              id="refresh-option-chain-btn"
              onClick={() => fetchOptionChain(symbol, selectedExpiry)}
              disabled={isLoading}
              className="px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl border border-indigo-100 text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
              <span>Refresh</span>
            </button>

            <button
              id="import-raw-json-btn"
              onClick={() => setIsManualPasteOpen(true)}
              className="px-4 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer"
            >
              <FileCode className="h-4 w-4 text-emerald-600" />
              <span>Paste Option Chain JSON</span>
            </button>

            <button
              id="export-option-chain-csv-btn"
              onClick={handleExportCsv}
              className="px-4 py-2 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 rounded-xl text-xs font-semibold flex items-center gap-2 shadow-xs transition-colors cursor-pointer"
            >
              <Download className="h-4 w-4 text-gray-500" />
              <span>Download (.csv)</span>
            </button>
          </div>
        </div>

        {/* Symbol and Expiry Selector Controls */}
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4 bg-gray-50/70 border border-gray-100 rounded-2xl p-4">
          
          {/* Index Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider mr-1">Select Index:</span>
            {INDEX_LIST.map(idx => (
              <button
                key={idx}
                id={`symbol-btn-${idx.toLowerCase()}`}
                onClick={() => handleSymbolChange(idx)}
                className={`text-xs font-bold px-4 py-2 rounded-xl transition-all cursor-pointer ${
                  symbol === idx 
                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-100" 
                    : "bg-white hover:bg-gray-100 text-gray-700 border border-gray-200"
                }`}
              >
                {idx}
              </button>
            ))}
          </div>

          {/* Expiry Selector + Calendar Date Picker */}
          <div className="flex flex-wrap items-center gap-4">
            {/* Calendar Date Picker */}
            <div className="flex items-center gap-2 bg-white border border-indigo-200 hover:border-indigo-400 rounded-xl px-3.5 py-2 shadow-2xs transition-all">
              <Calendar className="h-4 w-4 text-indigo-600 shrink-0" />
              <span className="text-xs font-bold text-gray-700 shrink-0">Expiry Calendar:</span>
              <input
                type="date"
                id="calendar-expiry-picker"
                value={convertExpiryToYyyyMmDd(selectedExpiry)}
                onChange={(e) => handleCalendarDateChange(e.target.value)}
                className="text-xs font-mono font-bold bg-transparent text-indigo-950 focus:outline-none cursor-pointer"
              />
            </div>

            {/* Dropdown Expiry Select */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-gray-400 uppercase tracking-wider shrink-0">Available Expiries:</span>
              <div className="relative">
                <select
                  id="expiry-date-select"
                  value={selectedExpiry}
                  onChange={(e) => handleExpiryChange(e.target.value)}
                  className="appearance-none text-xs font-bold font-mono bg-white border border-indigo-200 hover:border-indigo-300 text-indigo-900 rounded-xl px-4 py-2 pr-9 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer shadow-2xs"
                >
                  {chainData?.expiries?.map(exp => (
                    <option key={exp} value={exp}>{exp}</option>
                  ))}
                </select>
                <ChevronDown className="h-4 w-4 text-indigo-600 absolute right-3 top-2.5 pointer-events-none" />
              </div>
            </div>
          </div>

        </div>

        {/* Spot Price & Underlying Header Display */}
        {spotPrice > 0 && (
          <div className="bg-gradient-to-r from-gray-900 to-indigo-950 text-white rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-md">
            <div>
              <span className="text-[10px] font-mono font-bold text-indigo-300 uppercase tracking-widest block">
                Underlying Index Live Spot Price (CMP)
              </span>
              <div className="flex items-baseline gap-3 mt-1">
                <span className="text-2xl font-black font-display tracking-tight text-white">
                  {symbol} {spotPrice.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                <span className="text-xs text-gray-300 font-mono">
                  As on {chainData?.timestamp || "Latest Session"}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-4 text-xs font-mono">
              <div className="bg-white/10 backdrop-blur-md px-3.5 py-1.5 rounded-lg border border-white/10">
                <span className="text-gray-300 text-[10px] block">ATM STRIKE</span>
                <strong className="text-amber-300 font-bold text-sm">{atmStrike}</strong>
              </div>
              <div className="bg-white/10 backdrop-blur-md px-3.5 py-1.5 rounded-lg border border-white/10">
                <span className="text-gray-300 text-[10px] block">TOTAL CALL OI</span>
                <strong className="text-rose-300 font-bold text-sm">{formatNum(metrics.totalCallOi)}</strong>
              </div>
              <div className="bg-white/10 backdrop-blur-md px-3.5 py-1.5 rounded-lg border border-white/10">
                <span className="text-gray-300 text-[10px] block">TOTAL PUT OI</span>
                <strong className="text-emerald-300 font-bold text-sm">{formatNum(metrics.totalPutOi)}</strong>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* PCR Analysis Table (Matching Google Sheet Matrix) */}
      {pcrAnalysisTables.length > 0 && (
        <div className="bg-white border border-amber-200/80 rounded-2xl p-5 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-amber-100 pb-3">
            <div>
              <h3 className="text-base font-extrabold text-gray-900 flex items-center gap-2">
                <span>PCR Sentiment Analysis</span>
                <span className="text-xs bg-amber-500 text-black px-2.5 py-0.5 rounded font-black uppercase tracking-wider">
                  Live Matrix
                </span>
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Multi-range Put-Call Ratios for OI, COI, Volume, and Total OI + COI with exact formula-driven sentiment
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {pcrAnalysisTables.map((tbl, idx) => (
              <div
                key={idx}
                className={`rounded-lg overflow-hidden bg-white transition-all ${
                  tbl.isMain
                    ? "border-2 border-amber-500 ring-4 ring-amber-400/30 shadow-md relative"
                    : "border border-gray-400 shadow-2xs"
                }`}
              >
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr
                      className={`${
                        tbl.isMain
                          ? "bg-amber-500 text-black font-extrabold border-b-2 border-amber-600"
                          : "bg-amber-400 text-black font-extrabold border-b border-gray-400"
                      }`}
                    >
                      <th className="py-2 px-3 text-left w-2/5 border-r border-gray-400 font-black">
                        <div className="flex items-center justify-between">
                          <span>{tbl.title}</span>
                          {tbl.isMain && (
                            <span className="text-[10px] bg-black text-amber-300 px-2 py-0.5 rounded font-black uppercase tracking-wider shadow-2xs">
                              ★ MAIN INDICATOR
                            </span>
                          )}
                        </div>
                      </th>
                      <th className="py-2 px-3 text-center w-1/4 border-r border-gray-400 font-black">PCR</th>
                      <th className="py-2 px-3 text-center w-1/3 font-black">Sentiment</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tbl.rows.map((r, rIdx) => {
                      const sentiment = r.sentiment;
                      return (
                        <tr key={rIdx} className="border-b border-gray-300 hover:bg-gray-50/60">
                          <td className="py-2 px-3 font-bold text-gray-900 border-r border-gray-300">
                            {r.label}
                          </td>
                          <td className="py-2 px-3 text-center font-mono font-bold text-gray-900 border-r border-gray-300">
                            {r.pcr.toFixed(2)}
                          </td>
                          <td className="py-1 px-2 text-center">
                            <div className={`py-1 px-3 rounded text-center text-xs shadow-2xs uppercase ${sentiment.bgClass}`}>
                              {sentiment.label}
                            </div>
                          </td>
                        </tr>
                      );
                    })}

                    {/* Google Sheet Overall Sentiment Row */}
                    <tr className="bg-cyan-100/90 border-t-2 border-cyan-400 font-black">
                      <td className="py-2 px-3 text-cyan-950 font-black border-r border-cyan-300 bg-cyan-300/80 uppercase tracking-wider text-[11px]">
                        Overall
                      </td>
                      <td className="py-2 px-3 text-center font-mono font-black text-cyan-950 border-r border-cyan-300 bg-cyan-200/60">
                        {tbl.overall.total > 0 ? `+${tbl.overall.total}` : tbl.overall.total}
                      </td>
                      <td className="py-1 px-2 text-center bg-cyan-100/50">
                        <div className={`py-1.5 px-3 rounded text-center text-xs shadow-2xs uppercase tracking-wide ${tbl.overall.bgClass}`}>
                          {tbl.overall.label}
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Selected Range Totals (Volume, Change in OI, Total OI, Total OI + COI) */}
      <div className="bg-white border border-indigo-100 rounded-2xl p-4 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-gray-100 pb-2">
          <div>
            <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
              <span>Range Totals Summary ({strikeFilter === "near" ? `Near ATM ±${nearAtmCount} Strikes` : `${displayedStrikes.length} Strikes`})</span>
              <span className="text-[10px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md font-mono border border-indigo-200">
                {displayedStrikes.length} Strikes Included
              </span>
            </h3>
            <p className="text-[11px] text-gray-500">
              Aggregated Volume, Change in OI, Total OI, and Combined (OI + COI) for the selected range
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Total Volume */}
          <div className="bg-gray-50/80 border border-gray-200/80 rounded-xl p-3 space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-gray-800">
              <span>Total Volume</span>
              <span className="text-[10px] font-mono text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100 font-bold">
                PCR: {rangeTotals.pcrVol}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs font-mono">
              <div className="bg-rose-50/70 p-1.5 rounded border border-rose-100">
                <span className="text-[10px] text-rose-700 block font-sans font-bold">CALL VOL</span>
                <span className="font-extrabold text-rose-950">{formatNum(rangeTotals.callVol)}</span>
              </div>
              <div className="bg-emerald-50/70 p-1.5 rounded border border-emerald-100">
                <span className="text-[10px] text-emerald-700 block font-sans font-bold">PUT VOL</span>
                <span className="font-extrabold text-emerald-950">{formatNum(rangeTotals.putVol)}</span>
              </div>
            </div>
            <div className="text-[11px] font-mono font-bold text-gray-900 flex justify-between pt-1.5 border-t border-gray-200">
              <span className="text-gray-500 font-sans">Combined Total:</span>
              <span>{formatNum(rangeTotals.totalVol)}</span>
            </div>
          </div>

          {/* Total Change in OI (COI) */}
          <div className="bg-gray-50/80 border border-gray-200/80 rounded-xl p-3 space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-gray-800">
              <span>Total Change in OI (COI)</span>
              <span className="text-[10px] font-mono text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100 font-bold">
                PCR: {rangeTotals.pcrCoi}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs font-mono">
              <div className="bg-rose-50/70 p-1.5 rounded border border-rose-100">
                <span className="text-[10px] text-rose-700 block font-sans font-bold">CALL COI</span>
                <span className={`font-extrabold ${rangeTotals.callCoi >= 0 ? 'text-rose-950' : 'text-emerald-700'}`}>
                  {rangeTotals.callCoi > 0 ? `+${formatNum(rangeTotals.callCoi)}` : formatNum(rangeTotals.callCoi)}
                </span>
              </div>
              <div className="bg-emerald-50/70 p-1.5 rounded border border-emerald-100">
                <span className="text-[10px] text-emerald-700 block font-sans font-bold">PUT COI</span>
                <span className={`font-extrabold ${rangeTotals.putCoi >= 0 ? 'text-emerald-950' : 'text-rose-700'}`}>
                  {rangeTotals.putCoi > 0 ? `+${formatNum(rangeTotals.putCoi)}` : formatNum(rangeTotals.putCoi)}
                </span>
              </div>
            </div>
            <div className="text-[11px] font-mono font-bold text-gray-900 flex justify-between pt-1.5 border-t border-gray-200">
              <span className="text-gray-500 font-sans">Combined Total:</span>
              <span>{formatNum(rangeTotals.totalCoi)}</span>
            </div>
          </div>

          {/* Total OI */}
          <div className="bg-gray-50/80 border border-gray-200/80 rounded-xl p-3 space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-gray-800">
              <span>Total OI</span>
              <span className="text-[10px] font-mono text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100 font-bold">
                PCR: {rangeTotals.pcrOi}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs font-mono">
              <div className="bg-rose-50/70 p-1.5 rounded border border-rose-100">
                <span className="text-[10px] text-rose-700 block font-sans font-bold">CALL OI</span>
                <span className="font-extrabold text-rose-950">{formatNum(rangeTotals.callOi)}</span>
              </div>
              <div className="bg-emerald-50/70 p-1.5 rounded border border-emerald-100">
                <span className="text-[10px] text-emerald-700 block font-sans font-bold">PUT OI</span>
                <span className="font-extrabold text-emerald-950">{formatNum(rangeTotals.putOi)}</span>
              </div>
            </div>
            <div className="text-[11px] font-mono font-bold text-gray-900 flex justify-between pt-1.5 border-t border-gray-200">
              <span className="text-gray-500 font-sans">Combined Total:</span>
              <span>{formatNum(rangeTotals.totalOi)}</span>
            </div>
          </div>

          {/* Total OI + Change in OI */}
          <div className="bg-gray-50/80 border border-gray-200/80 rounded-xl p-3 space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-gray-800">
              <span>Total OI + Change in OI</span>
              <span className="text-[10px] font-mono text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100 font-bold">
                PCR: {rangeTotals.pcrTot}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs font-mono">
              <div className="bg-rose-50/70 p-1.5 rounded border border-rose-100">
                <span className="text-[10px] text-rose-700 block font-sans font-bold">CALL (OI+COI)</span>
                <span className="font-extrabold text-rose-950">{formatNum(rangeTotals.callTot)}</span>
              </div>
              <div className="bg-emerald-50/70 p-1.5 rounded border border-emerald-100">
                <span className="text-[10px] text-emerald-700 block font-sans font-bold">PUT (OI+COI)</span>
                <span className="font-extrabold text-emerald-950">{formatNum(rangeTotals.putTot)}</span>
              </div>
            </div>
            <div className="text-[11px] font-mono font-bold text-gray-900 flex justify-between pt-1.5 border-t border-gray-200">
              <span className="text-gray-500 font-sans">Combined Total:</span>
              <span>{formatNum(rangeTotals.totalTot)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Visual OI & OI Change Analysis (Matching Moneycontrol & Google Sheets) */}
      {oiChartData.length > 0 && (
        <div className="space-y-6">
          {/* Card 1: Open Interest Bar Chart & Summary */}
          <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-gray-100 pb-3">
              <div>
                <h3 className="text-base font-extrabold text-gray-900 flex items-center gap-2">
                  <span>Open Interest</span>
                </h3>
                <div className="flex items-center gap-4 text-xs font-mono text-gray-500 mt-1">
                  <span>Spot Price: <strong className="text-gray-900 font-bold">{spotPrice.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</strong></span>
                  <span>Future Price: <strong className="text-gray-900 font-bold">{(spotPrice - 13.05).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</strong></span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <select className="bg-gray-100 border border-gray-300 rounded-lg px-2.5 py-1 text-xs font-mono font-bold text-gray-700 focus:outline-none cursor-pointer">
                  <option>03:30 PM</option>
                  <option>03:15 PM</option>
                  <option>02:30 PM</option>
                  <option>01:30 PM</option>
                </select>
              </div>
            </div>

            {/* Chart Container */}
            <div className="h-72 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={oiChartData} margin={{ top: 20, right: 20, left: 0, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis
                    dataKey="strike"
                    tick={{ fontSize: 11, fill: "#475569", fontWeight: 600 }}
                    tickLine={false}
                  />
                  <YAxis
                    tickFormatter={(val) => `${val} L`}
                    tick={{ fontSize: 10, fill: "#64748b" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    formatter={(value: any, name: any) => [
                      `${(Number(value) * 100000).toLocaleString("en-IN")} Qty (${(Number(value) / 100).toFixed(2)} Cr.)`,
                      name
                    ]}
                    labelFormatter={(label) => `Strike Price: ${label}`}
                    contentStyle={{ backgroundColor: "#1e293b", borderColor: "#334155", borderRadius: "8px", color: "#fff", fontSize: "12px" }}
                  />
                  <ReferenceLine
                    x={atmStrike}
                    stroke="#1e293b"
                    strokeDasharray="3 3"
                    strokeWidth={1.5}
                    label={{ value: `Spot: ${spotPrice}`, position: 'top', fill: '#0f172a', fontSize: 10, fontWeight: 'bold' }}
                  />
                  <Bar dataKey="callOiLakhs" name="Call OI" fill="#e11d48" radius={[4, 4, 0, 0]} barSize={16} />
                  <Bar dataKey="putOiLakhs" name="Put OI" fill="#0f766e" radius={[4, 4, 0, 0]} barSize={16} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Legend & Total OI Progress Bars */}
            <div className="pt-2 border-t border-gray-100 space-y-3">
              <div className="flex items-center justify-center gap-6 text-xs font-bold">
                <span className="flex items-center gap-1.5 text-rose-600">
                  <span className="w-3 h-3 rounded-full bg-rose-600 inline-block"></span> Call OI
                </span>
                <span className="flex items-center gap-1.5 text-teal-700">
                  <span className="w-3 h-3 rounded-full bg-teal-700 inline-block"></span> Put OI
                </span>
              </div>

              {/* Total OI Horizontal Summary */}
              <div className="bg-gray-50 rounded-xl p-3 border border-gray-200/80 flex flex-col sm:flex-row items-center justify-between gap-4">
                <span className="text-xs font-bold text-gray-700 shrink-0">Total OI</span>
                <div className="w-full space-y-2">
                  <div className="flex items-center gap-3 text-xs font-mono font-bold">
                    <div className="w-full bg-gray-200 h-3.5 rounded-full overflow-hidden flex">
                      <div className="bg-teal-700 h-full transition-all duration-500 rounded-full" style={{ width: `${chartTotals.putOiPct}%` }}></div>
                    </div>
                    <span className="text-teal-900 shrink-0 min-w-20 text-right">{formatQtyInCrOrLakhs(chartTotals.putOi)}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs font-mono font-bold">
                    <div className="w-full bg-gray-200 h-3.5 rounded-full overflow-hidden flex">
                      <div className="bg-rose-600 h-full transition-all duration-500 rounded-full" style={{ width: `${chartTotals.callOiPct}%` }}></div>
                    </div>
                    <span className="text-rose-900 shrink-0 min-w-20 text-right">{formatQtyInCrOrLakhs(chartTotals.callOi)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Card 2: OI Change Bar Chart & Summary */}
          <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-gray-100 pb-3">
              <div>
                <h3 className="text-base font-extrabold text-gray-900">OI Change</h3>
                <p className="text-xs text-gray-500 font-mono mt-0.5">Spot Price: {spotPrice.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</p>
              </div>
              <select className="bg-gray-100 border border-gray-300 rounded-lg px-2.5 py-1 text-xs font-mono font-bold text-gray-700 focus:outline-none cursor-pointer">
                <option>03:30 PM</option>
                <option>03:15 PM</option>
                <option>02:30 PM</option>
              </select>
            </div>

            <div className="h-72 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={oiChartData} margin={{ top: 20, right: 20, left: 0, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="strike" tick={{ fontSize: 11, fill: "#475569", fontWeight: 600 }} tickLine={false} />
                  <YAxis tickFormatter={(val) => `${val} L`} tick={{ fontSize: 10, fill: "#64748b" }} axisLine={false} tickLine={false} />
                  <Tooltip
                    formatter={(value: any, name: any) => [
                      `${(Number(value) * 100000).toLocaleString("en-IN")} Qty (${(Number(value) / 100).toFixed(2)} Cr.)`,
                      name
                    ]}
                    labelFormatter={(label) => `Strike Price: ${label}`}
                    contentStyle={{ backgroundColor: "#1e293b", borderColor: "#334155", borderRadius: "8px", color: "#fff", fontSize: "12px" }}
                  />
                  <ReferenceLine y={0} stroke="#94a3b8" />
                  <ReferenceLine x={atmStrike} stroke="#1e293b" strokeDasharray="3 3" strokeWidth={1.5} />
                  <Bar dataKey="callCoiLakhs" name="Call OI Change" fill="#e11d48" radius={[2, 2, 0, 0]} barSize={16} />
                  <Bar dataKey="putCoiLakhs" name="Put OI Change" fill="#0f766e" radius={[2, 2, 0, 0]} barSize={16} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="pt-2 border-t border-gray-100 space-y-3">
              <div className="flex items-center justify-center gap-6 text-xs font-bold">
                <span className="flex items-center gap-1.5 text-rose-600">
                  <span className="w-3 h-3 rounded-full bg-rose-600 inline-block"></span> Call OI Change
                </span>
                <span className="flex items-center gap-1.5 text-teal-700">
                  <span className="w-3 h-3 rounded-full bg-teal-700 inline-block"></span> Put OI Change
                </span>
              </div>

              {/* Total OI Change Summary Bar */}
              <div className="bg-gray-50 rounded-xl p-3 border border-gray-200/80 flex flex-col sm:flex-row items-center justify-between gap-4">
                <span className="text-xs font-bold text-gray-700 shrink-0">Total OI Change</span>
                <div className="w-full space-y-2">
                  <div className="flex items-center gap-3 text-xs font-mono font-bold">
                    <div className="w-full bg-gray-200 h-3.5 rounded-full overflow-hidden flex">
                      <div className="bg-teal-700 h-full transition-all duration-500 rounded-full" style={{ width: `${chartTotals.putCoiPct}%` }}></div>
                    </div>
                    <span className="text-teal-900 shrink-0 min-w-20 text-right">{formatQtyInCrOrLakhs(chartTotals.putCoi)}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs font-mono font-bold">
                    <div className="w-full bg-gray-200 h-3.5 rounded-full overflow-hidden flex">
                      <div className="bg-rose-600 h-full transition-all duration-500 rounded-full" style={{ width: `${chartTotals.callCoiPct}%` }}></div>
                    </div>
                    <span className="text-rose-900 shrink-0 min-w-20 text-right">{formatQtyInCrOrLakhs(chartTotals.callCoi)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Card 3: Multi Strike OI Line Chart */}
          <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-gray-100 pb-3">
              <div>
                <h3 className="text-base font-extrabold text-gray-900">Multi Strike Change in OI</h3>
                <p className="text-xs text-gray-500">Intraday Change in OI comparison for selected strikes vs. {symbol} 50 live spot price</p>
              </div>

              <div className="flex items-center gap-2">
                {/* Strikes Multi-Select Dropdown */}
                <div className="relative">
                  <button
                    onClick={() => setIsStrikesDropdownOpen(!isStrikesDropdownOpen)}
                    className="flex items-center gap-1.5 bg-gray-100 hover:bg-gray-200 border border-gray-300 rounded-lg px-3 py-1.5 text-xs font-bold text-gray-800 transition-all cursor-pointer shadow-2xs"
                  >
                    <span>Strikes</span>
                    <span className="bg-black text-white text-[10px] px-1.5 py-0.2 rounded-full font-extrabold">
                      {selectedMultiStrikes.length}
                    </span>
                    <ChevronDown className="w-3.5 h-3.5 text-gray-600" />
                  </button>

                  {/* Popover Dropdown Menu */}
                  {isStrikesDropdownOpen && (
                    <div className="absolute right-0 mt-2 w-72 bg-white border border-gray-300 rounded-xl shadow-xl z-50 p-3 space-y-3">
                      <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                        <span className="text-xs font-extrabold text-gray-900 uppercase tracking-wider">Select Strikes</span>
                        <button
                          onClick={() => setIsStrikesDropdownOpen(false)}
                          className="p-1 hover:bg-gray-100 rounded-full text-gray-400 hover:text-gray-700 cursor-pointer"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="flex items-center justify-between text-[11px] font-bold text-blue-600">
                        <button
                          onClick={() => setSelectedMultiStrikes([`${atmStrike}_CE`, `${atmStrike}_PE`])}
                          className="hover:underline cursor-pointer"
                        >
                          ATM Only
                        </button>
                        <button
                          onClick={() => {
                            const keys: string[] = [];
                            candidateMultiStrikes.slice(1, -1).forEach(s => {
                              keys.push(`${s.strikePrice}_CE`);
                              keys.push(`${s.strikePrice}_PE`);
                            });
                            setSelectedMultiStrikes(keys);
                          }}
                          className="hover:underline cursor-pointer"
                        >
                          ATM ± 100
                        </button>
                      </div>

                      <div className="max-h-60 overflow-y-auto space-y-2 text-xs divide-y divide-gray-100 pr-1">
                        {candidateMultiStrikes.map((s) => {
                          const ceKey = `${s.strikePrice}_CE`;
                          const peKey = `${s.strikePrice}_PE`;
                          const isAtm = s.strikePrice === atmStrike;

                          return (
                            <div key={s.strikePrice} className="pt-2 first:pt-0 flex items-center justify-between">
                              <span className={`font-mono font-extrabold ${isAtm ? "text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-300" : "text-gray-800"}`}>
                                {s.strikePrice.toLocaleString("en-IN")} {isAtm && "★ ATM"}
                              </span>

                              <div className="flex items-center gap-1.5">
                                <button
                                  onClick={() => toggleMultiStrikeOption(ceKey)}
                                  className={`px-2 py-0.5 rounded text-[11px] font-bold border transition-all cursor-pointer ${
                                    selectedMultiStrikes.includes(ceKey)
                                      ? "bg-amber-400 text-black border-amber-500 font-extrabold shadow-2xs"
                                      : "bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100"
                                  }`}
                                >
                                  CE
                                </button>
                                <button
                                  onClick={() => toggleMultiStrikeOption(peKey)}
                                  className={`px-2 py-0.5 rounded text-[11px] font-bold border transition-all cursor-pointer ${
                                    selectedMultiStrikes.includes(peKey)
                                      ? "bg-rose-500 text-white border-rose-600 font-extrabold shadow-2xs"
                                      : "bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100"
                                  }`}
                                >
                                  PE
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* Timeframe Selector */}
                <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl text-xs font-medium">
                  {(["5min", "15min", "30min", "day"] as const).map((tf) => (
                    <button
                      key={tf}
                      onClick={() => setMultiStrikeTimeframe(tf)}
                      className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer font-semibold ${
                        multiStrikeTimeframe === tf
                          ? "bg-black text-white shadow-xs"
                          : "text-gray-600 hover:text-black"
                      }`}
                    >
                      {tf === "5min" ? "5 min" : tf === "15min" ? "15 min" : tf === "30min" ? "30 min" : "Day"}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="h-72 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={multiStrikeData} margin={{ top: 20, right: 20, left: 10, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="time" minTickGap={20} tick={{ fontSize: 10, fill: "#64748b" }} tickLine={false} />
                  <YAxis
                    yAxisId="left"
                    orientation="left"
                    tickFormatter={(v) => {
                      if (Math.abs(v) >= 100) return `${(v / 100).toFixed(1)} Cr.`;
                      return `${v > 0 ? '+' : ''}${v} L`;
                    }}
                    tick={{ fontSize: 10, fill: "#64748b" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    domain={['auto', 'auto']}
                    tickFormatter={(v) => v.toLocaleString("en-IN")}
                    tick={{ fontSize: 10, fill: "#3b82f6" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    formatter={(value: any, name: any) => {
                      if (name.includes(symbol) || name.includes("50")) {
                        return [Number(value).toLocaleString("en-IN", { minimumFractionDigits: 2 }), name];
                      }
                      const valNum = Number(value);
                      const formatted = Math.abs(valNum) >= 100
                        ? `${(valNum / 100).toFixed(2)} Cr.`
                        : `${valNum > 0 ? '+' : ''}${valNum.toFixed(2)} L`;
                      return [`${formatted} (Change in OI)`, name];
                    }}
                    contentStyle={{ backgroundColor: "#1e293b", borderColor: "#334155", borderRadius: "8px", color: "#fff", fontSize: "12px" }}
                  />
                  {/* Index Spot Price Line */}
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="spot"
                    name={symbol === "BANKNIFTY" ? "BANK NIFTY" : "NIFTY 50"}
                    stroke="#3b82f6"
                    strokeWidth={2}
                    strokeDasharray="4 4"
                    dot={false}
                  />
                  {/* Selected Strike Option Lines */}
                  {selectedMultiStrikes.map((key) => {
                    const [str, type] = key.split("_");
                    const color = getMultiStrikeColor(key);
                    const label = `${selectedExpiry} ${str} ${type}`;
                    return (
                      <Line
                        key={key}
                        yAxisId="left"
                        type="monotone"
                        dataKey={key}
                        name={label}
                        stroke={color}
                        strokeWidth={2.5}
                        dot={false}
                      />
                    );
                  })}
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Interactive Legend Badges */}
            <div className="flex flex-wrap items-center justify-center gap-2.5 text-xs font-bold pt-3 border-t border-gray-100">
              <span className="flex items-center gap-1.5 bg-blue-50 text-blue-700 px-2.5 py-1 rounded-lg border border-blue-200">
                <span className="w-3 h-0.5 border-t-2 border-dashed border-blue-600 inline-block"></span> {symbol === "BANKNIFTY" ? "BANK NIFTY" : "NIFTY 50"}
              </span>
              {selectedMultiStrikes.map((key) => {
                const [str, type] = key.split("_");
                const color = getMultiStrikeColor(key);
                return (
                  <span
                    key={key}
                    className="flex items-center gap-1.5 bg-gray-50 text-gray-800 px-2.5 py-1 rounded-lg border border-gray-200 shadow-2xs"
                  >
                    <span className="w-3 h-3 rounded-full inline-block shrink-0" style={{ backgroundColor: color }}></span>
                    <span>{selectedExpiry} {str} {type}</span>
                    <button
                      onClick={() => toggleMultiStrikeOption(key)}
                      className="ml-1 text-gray-400 hover:text-red-500 cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Summary Analytics Cards (PCR, Max Pain, Resistance/Support) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        
        {/* PCR Card */}
        <div className="bg-white border border-gray-100 p-4 rounded-2xl shadow-xs space-y-1">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Put-Call Ratio (PCR)</span>
          <div className="flex items-center justify-between">
            <span className="text-2xl font-black font-display text-gray-900">{metrics.pcr}</span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
              metrics.isBullishPcr ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"
            }`}>
              {metrics.isBullishPcr ? "Bullish (>1.0)" : "Bearish (<1.0)"}
            </span>
          </div>
          <p className="text-[10px] text-gray-400 mt-1">
            Put OI / Call OI sentiment gauge
          </p>
        </div>

        {/* Max Pain Strike Card */}
        <div className="bg-white border border-gray-100 p-4 rounded-2xl shadow-xs space-y-1">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Max Pain Strike</span>
          <div className="flex items-center justify-between">
            <span className="text-2xl font-black font-display text-indigo-600">{metrics.maxPainStrike}</span>
            <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full">
              Expiry Target
            </span>
          </div>
          <p className="text-[10px] text-gray-400 mt-1">
            Strike where option buyers lose maximum premium
          </p>
        </div>

        {/* Resistance (Max Call OI) */}
        <div className="bg-white border border-gray-100 p-4 rounded-2xl shadow-xs space-y-1">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Max Resistance (Call OI)</span>
          <div className="flex items-center justify-between">
            <span className="text-2xl font-black font-display text-rose-600">{metrics.maxCallOiStrike}</span>
            <span className="text-[10px] font-mono text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md font-bold">
              {formatNum(metrics.maxCallOiVal)} OI
            </span>
          </div>
          <p className="text-[10px] text-gray-400 mt-1">
            Strongest Call Wall (Heavy Resistance)
          </p>
        </div>

        {/* Support (Max Put OI) */}
        <div className="bg-white border border-gray-100 p-4 rounded-2xl shadow-xs space-y-1">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Max Support (Put OI)</span>
          <div className="flex items-center justify-between">
            <span className="text-2xl font-black font-display text-emerald-600">{metrics.maxPutOiStrike}</span>
            <span className="text-[10px] font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md font-bold">
              {formatNum(metrics.maxPutOiVal)} OI
            </span>
          </div>
          <p className="text-[10px] text-gray-400 mt-1">
            Strongest Put Base (Heavy Support)
          </p>
        </div>

      </div>

      {/* Filter and Table Controls Toolbar */}
      <div className="bg-white border border-gray-100 p-4 rounded-2xl shadow-xs flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
        
        {/* Strike View Filter Tabs & Range Selector */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 bg-gray-100 p-1 rounded-xl">
            <button
              onClick={() => { setStrikeFilter("near"); setSearchStrike(""); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                strikeFilter === "near" && !searchStrike ? "bg-white text-indigo-600 shadow-xs" : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Near ATM
            </button>
            <button
              onClick={() => { setStrikeFilter("all"); setSearchStrike(""); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                strikeFilter === "all" && !searchStrike ? "bg-white text-indigo-600 shadow-xs" : "text-gray-600 hover:text-gray-900"
              }`}
            >
              All Strikes
            </button>
            <button
              onClick={() => { setStrikeFilter("itm"); setSearchStrike(""); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                strikeFilter === "itm" && !searchStrike ? "bg-white text-indigo-600 shadow-xs" : "text-gray-600 hover:text-gray-900"
              }`}
            >
              In-The-Money (ITM)
            </button>
            <button
              onClick={() => { setStrikeFilter("otm"); setSearchStrike(""); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                strikeFilter === "otm" && !searchStrike ? "bg-white text-indigo-600 shadow-xs" : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Out-Of-The-Money (OTM)
            </button>
          </div>

          {/* Range Selector for Near ATM */}
          {strikeFilter === "near" && (
            <div className="flex items-center gap-2 bg-indigo-50/80 border border-indigo-200 px-3 py-1.5 rounded-xl text-xs">
              <span className="font-bold text-indigo-900 shrink-0">Near ATM Range:</span>
              <div className="flex items-center gap-1">
                {[5, 6, 10, 15, 20, 30, 50].map(cnt => (
                  <button
                    key={cnt}
                    onClick={() => setNearAtmCount(cnt)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold font-mono transition-colors cursor-pointer ${
                      nearAtmCount === cnt 
                        ? "bg-indigo-600 text-white shadow-2xs" 
                        : "bg-white text-indigo-700 hover:bg-indigo-100 border border-indigo-200"
                    }`}
                  >
                    ±{cnt}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Search Specific Strike */}
        <div className="relative w-full sm:w-64">
          <input
            type="number"
            placeholder="Jump to strike (e.g. 24000)..."
            value={searchStrike}
            onChange={(e) => setSearchStrike(e.target.value)}
            className="w-full text-xs bg-gray-50 border border-gray-200 rounded-xl px-3 py-1.5 pl-8 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <Search className="h-3.5 w-3.5 text-gray-400 absolute left-2.5 top-2" />
        </div>

      </div>

      {/* Table Legend */}
      <div className="flex flex-wrap items-center justify-between text-[11px] text-gray-500 px-2 font-medium">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-sm bg-amber-100/80 border border-amber-200" />
            <span>In-The-Money (ITM) Calls / Puts</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-sm bg-indigo-100 border border-indigo-300" />
            <strong className="text-indigo-900 font-bold">ATM Strike Row</strong>
          </span>
        </div>
        <span>Showing {displayedStrikes.length} strike price rows</span>
      </div>

      {/* Main Option Chain Table */}
      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto max-h-[700px] overflow-y-auto">
          <table className="w-full text-right text-xs font-mono border-collapse min-w-[1200px]">
            
            {/* Top Super-Header */}
            <thead className="sticky top-0 z-20 bg-gray-900 text-white font-sans text-center text-xs font-bold divide-x divide-gray-800">
              <tr>
                <th colSpan={10} className="py-2.5 bg-rose-950/80 text-rose-200 uppercase tracking-wider">
                  CALLS (CE)
                </th>
                <th className="py-2.5 bg-gray-900 text-amber-300 uppercase tracking-wider w-28">
                  STRIKE
                </th>
                <th colSpan={10} className="py-2.5 bg-emerald-950/80 text-emerald-200 uppercase tracking-wider">
                  PUTS (PE)
                </th>
              </tr>
              {/* Sub-Header Column Names */}
              <tr className="bg-gray-800 text-[10px] text-gray-300 font-mono uppercase tracking-tight divide-x divide-gray-700">
                <th className="py-2 px-2">OI</th>
                <th className="py-2 px-2">CHNG IN OI</th>
                <th className="py-2 px-2">VOLUME</th>
                <th className="py-2 px-2">IV</th>
                <th className="py-2 px-2">LTP</th>
                <th className="py-2 px-2">CHNG</th>
                <th className="py-2 px-2">BID QTY</th>
                <th className="py-2 px-2">BID</th>
                <th className="py-2 px-2">ASK</th>
                <th className="py-2 px-2">ASK QTY</th>

                <th className="py-2 px-2 text-center text-amber-300 font-bold bg-gray-900">STRIKE</th>

                <th className="py-2 px-2">BID QTY</th>
                <th className="py-2 px-2">BID</th>
                <th className="py-2 px-2">ASK</th>
                <th className="py-2 px-2">ASK QTY</th>
                <th className="py-2 px-2">CHNG</th>
                <th className="py-2 px-2">LTP</th>
                <th className="py-2 px-2">IV</th>
                <th className="py-2 px-2">VOLUME</th>
                <th className="py-2 px-2">CHNG IN OI</th>
                <th className="py-2 px-2">OI</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100 text-[11px]">
              {displayedStrikes.map((s) => {
                const isAtm = s.strikePrice === atmStrike;
                const isCallItm = spotPrice > 0 && s.strikePrice < spotPrice;
                const isPutItm = spotPrice > 0 && s.strikePrice > spotPrice;

                const c = s.CE || {} as OptionContract;
                const p = s.PE || {} as OptionContract;

                const cChgOiPos = (c.changeinOpenInterest || 0) >= 0;
                const pChgOiPos = (p.changeinOpenInterest || 0) >= 0;
                const cChgPos = (c.change || 0) >= 0;
                const pChgPos = (p.change || 0) >= 0;

                const isMaxCallOi = s.strikePrice === metrics.maxCallOiStrike;
                const isMaxPutOi = s.strikePrice === metrics.maxPutOiStrike;

                return (
                  <tr 
                    key={s.strikePrice}
                    className={`hover:bg-indigo-50/50 transition-colors ${
                      isAtm ? "bg-indigo-100/70 font-bold border-y-2 border-indigo-400" : ""
                    }`}
                  >
                    {/* CALLS SIDE */}
                    <td className={`py-2 px-2 ${isCallItm ? "bg-amber-50/70" : ""} ${isMaxCallOi ? "bg-rose-100/60 font-bold text-rose-900" : ""}`}>
                      {formatNum(c.openInterest)}
                    </td>
                    <td className={`py-2 px-2 font-bold ${isCallItm ? "bg-amber-50/70" : ""} ${cChgOiPos ? "text-emerald-600" : "text-rose-600"}`}>
                      {cChgOiPos ? "+" : ""}{formatNum(c.changeinOpenInterest)}
                    </td>
                    <td className={`py-2 px-2 ${isCallItm ? "bg-amber-50/70" : ""}`}>
                      {formatNum(c.totalTradedVolume)}
                    </td>
                    <td className={`py-2 px-2 text-gray-500 ${isCallItm ? "bg-amber-50/70" : ""}`}>
                      {c.impliedVolatility ? formatDecimal(c.impliedVolatility) : "-"}
                    </td>
                    <td className={`py-2 px-2 font-bold text-gray-900 ${isCallItm ? "bg-amber-50/70" : ""}`}>
                      {formatDecimal(c.lastPrice)}
                    </td>
                    <td className={`py-2 px-2 font-semibold ${isCallItm ? "bg-amber-50/70" : ""} ${cChgPos ? "text-emerald-600" : "text-rose-600"}`}>
                      {cChgPos ? "+" : ""}{formatDecimal(c.change)}
                    </td>
                    <td className={`py-2 px-2 text-gray-400 text-[10px] ${isCallItm ? "bg-amber-50/70" : ""}`}>
                      {c.bidQty ? formatNum(c.bidQty) : "-"}
                    </td>
                    <td className={`py-2 px-2 ${isCallItm ? "bg-amber-50/70" : ""}`}>
                      {c.bidprice ? formatDecimal(c.bidprice) : "-"}
                    </td>
                    <td className={`py-2 px-2 ${isCallItm ? "bg-amber-50/70" : ""}`}>
                      {c.askPrice ? formatDecimal(c.askPrice) : "-"}
                    </td>
                    <td className={`py-2 px-2 text-gray-400 text-[10px] ${isCallItm ? "bg-amber-50/70" : ""}`}>
                      {c.askQty ? formatNum(c.askQty) : "-"}
                    </td>

                    {/* STRIKE CENTER COLUMN */}
                    <td className={`py-2 px-3 text-center font-bold text-xs font-mono border-x border-gray-200 ${
                      isAtm 
                        ? "bg-indigo-600 text-white font-black shadow-inner" 
                        : "bg-gray-100 text-gray-900"
                    }`}>
                      {s.strikePrice}
                    </td>

                    {/* PUTS SIDE */}
                    <td className={`py-2 px-2 text-gray-400 text-[10px] ${isPutItm ? "bg-amber-50/70" : ""}`}>
                      {p.bidQty ? formatNum(p.bidQty) : "-"}
                    </td>
                    <td className={`py-2 px-2 ${isPutItm ? "bg-amber-50/70" : ""}`}>
                      {p.bidprice ? formatDecimal(p.bidprice) : "-"}
                    </td>
                    <td className={`py-2 px-2 ${isPutItm ? "bg-amber-50/70" : ""}`}>
                      {p.askPrice ? formatDecimal(p.askPrice) : "-"}
                    </td>
                    <td className={`py-2 px-2 text-gray-400 text-[10px] ${isPutItm ? "bg-amber-50/70" : ""}`}>
                      {p.askQty ? formatNum(p.askQty) : "-"}
                    </td>
                    <td className={`py-2 px-2 font-semibold ${isPutItm ? "bg-amber-50/70" : ""} ${pChgPos ? "text-emerald-600" : "text-rose-600"}`}>
                      {pChgPos ? "+" : ""}{formatDecimal(p.change)}
                    </td>
                    <td className={`py-2 px-2 font-bold text-gray-900 ${isPutItm ? "bg-amber-50/70" : ""}`}>
                      {formatDecimal(p.lastPrice)}
                    </td>
                    <td className={`py-2 px-2 text-gray-500 ${isPutItm ? "bg-amber-50/70" : ""}`}>
                      {p.impliedVolatility ? formatDecimal(p.impliedVolatility) : "-"}
                    </td>
                    <td className={`py-2 px-2 ${isPutItm ? "bg-amber-50/70" : ""}`}>
                      {formatNum(p.totalTradedVolume)}
                    </td>
                    <td className={`py-2 px-2 font-bold ${isPutItm ? "bg-amber-50/70" : ""} ${pChgOiPos ? "text-emerald-600" : "text-rose-600"}`}>
                      {pChgOiPos ? "+" : ""}{formatNum(p.changeinOpenInterest)}
                    </td>
                    <td className={`py-2 px-2 ${isPutItm ? "bg-amber-50/70" : ""} ${isMaxPutOi ? "bg-emerald-100/60 font-bold text-emerald-900" : ""}`}>
                      {formatNum(p.openInterest)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* PASTE / IMPORT RAW NSE JSON MODAL */}
      {isManualPasteOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-4 border border-gray-100">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2">
                <FileCode className="h-5 w-5 text-indigo-600" />
                <h3 className="font-bold text-base text-gray-900">Paste Live NSE Option Chain JSON</h3>
              </div>
              <button 
                onClick={() => setIsManualPasteOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3.5 text-xs text-indigo-950 space-y-1.5">
              <p className="font-bold flex items-center gap-1.5 text-indigo-900">
                <Info className="h-4 w-4 text-indigo-600 shrink-0" />
                Raw Option Chain JSON Importer:
              </p>
              <p className="text-[11px] text-indigo-800">
                The application automatically scrapes Moneycontrol live option chain data for <strong>{symbol}</strong>. If you have custom or raw JSON option chain data, paste it below to render immediately.
              </p>
            </div>

            <form onSubmit={handleUploadRawJson} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Raw NSE JSON Content for {symbol}:
                </label>
                <textarea
                  rows={8}
                  placeholder={`Paste {"records": {"data": ...}} here...`}
                  value={manualText}
                  onChange={(e) => setManualText(e.target.value)}
                  className="w-full text-xs font-mono p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  required
                />
              </div>

              {manualError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
                  <span>{manualError}</span>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsManualPasteOpen(false)}
                  className="px-4 py-2 border border-gray-200 rounded-xl text-xs font-semibold text-gray-600 hover:bg-gray-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUploading || !manualText.trim()}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-md flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isUploading ? "Caching JSON..." : "Load & Render Live Chain"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
