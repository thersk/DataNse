import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  TrendingUp, 
  TrendingDown, 
  RefreshCw, 
  Calendar, 
  ChevronDown, 
  ChevronUp, 
  Globe, 
  Activity, 
  Info,
  Layers,
  BarChart3,
  ListFilter,
  Clock
} from "lucide-react";
import { getDefaultSelectedDateStr, isAfter1030PMIST } from "../utils/dateUtils";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  Cell
} from "recharts";

interface ChildItem {
  Name: string;
  ShortName: string;
  Value: number;
  UnderlyingTypeCode: string | null;
  InstrumentTypeCode: string | null;
  ListingID: number;
  MarketSegmentType: number;
}

interface FiiDiiItem {
  Name: string;
  ShortName: string;
  Value: number;
  UnderlyingTypeCode: string | null;
  InstrumentTypeCode: string | null;
  FiiDiiType: string | null;
  TimeSpan: string | null;
  MarketSegmentType: number;
  ChildData: ChildItem[] | null;
}

interface ClosePriceItem {
  Symbol: string;
  C: number;
  CZ: number;
  CZG: number;
}

interface FiiDiiResponse {
  Date: string;
  FIIDIIData: FiiDiiItem[];
  ClosePrices: ClosePriceItem[];
}

export default function FiiDiiActivity() {
  // Dynamically initialize to current trading date
  const [selectedDate, setSelectedDate] = useState<string>(() => getDefaultSelectedDateStr());
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<FiiDiiResponse | null>(null);
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({});
  const [viewMode, setViewMode] = useState<"visual" | "table" | "both">("both");

  const fetchData = async (dateStr: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/fii-dii-activity?date=${dateStr}`);
      const result = await res.json();
      if (result.status === "success" && result.data) {
        setData(result.data);
        // If the API automatically fell back to an active trading day, update our picker date
        if (result.data.Date) {
          const apiDateOnly = result.data.Date.split("T")[0];
          if (apiDateOnly && apiDateOnly !== dateStr) {
            setSelectedDate(apiDateOnly);
          }
        }
      } else {
        setError(result.message || "Failed to load institutional activity data");
      }
    } catch (err: any) {
      console.error(err);
      setError("Network error. Could not connect to API server.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(selectedDate);

    // Automatic polling: Re-checks FII/DII activity every 60 seconds
    const interval = setInterval(() => {
      const isAfterCutoff = isAfter1030PMIST();
      const currentTradingDate = getDefaultSelectedDateStr();

      if (isAfterCutoff && selectedDate !== currentTradingDate) {
        setSelectedDate(currentTradingDate);
        fetchData(currentTradingDate);
      } else if (isAfterCutoff) {
        fetchData(selectedDate);
      }
    }, 60000);

    return () => clearInterval(interval);
  }, [selectedDate]);

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newDate = e.target.value;
    setSelectedDate(newDate);
    fetchData(newDate);
  };

  const handleRefresh = () => {
    fetchData(selectedDate);
  };

  const toggleExpand = (shortName: string) => {
    setExpandedItems(prev => ({
      ...prev,
      [shortName]: !prev[shortName]
    }));
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(val);
  };

  const formatSymbolVal = (val: number) => {
    return new Intl.NumberFormat("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(val);
  };

  const formatDateDisplay = (dateStr?: string) => {
    if (!dateStr) return "Latest Date";
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString("en-US", {
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric"
      });
    } catch {
      return dateStr;
    }
  };

  const mapSegmentName = (name: string, shortName: string) => {
    const normalizedShort = shortName?.toUpperCase().trim();
    if (normalizedShort === "FII CM (PR.)" || normalizedShort === "FII CM") {
      return { name: "FII CM (net flow)", shortName: "FII CM" };
    }
    if (normalizedShort === "DII CM (PR.)" || normalizedShort === "DII CM") {
      return { name: "DII CM (Net Flow)", shortName: "DII CM" };
    }
    if (normalizedShort === "FII IDX FUT" || normalizedShort === "FII INDEX FUTURES") {
      return { name: "FII IDX FUT (Net Flow)", shortName: "FII IDX FUT" };
    }
    if (normalizedShort === "FII IDX OPT" || normalizedShort === "FII INDEX OPTIONS") {
      return { name: "FII IDX OPT (net flow)", shortName: "FII IDX OPT" };
    }
    if (normalizedShort === "FII STK FUT" || normalizedShort === "FII STOCK FUTURES") {
      return { name: "FII STK FUT (Net Flow)", shortName: "FII STK FUT" };
    }
    if (normalizedShort === "FII STK OPT" || normalizedShort === "FII STOCK OPTIONS") {
      return { name: "FII STK OPT (Net Flow)", shortName: "FII STK OPT" };
    }

    // Fallbacks
    if (name === "FII Cash Market (Provisional)") return { name: "FII CM (net flow)", shortName: "FII CM" };
    if (name === "DII Cash Market (Provisional)") return { name: "DII CM (Net Flow)", shortName: "DII CM" };
    if (name === "FII Index Futures") return { name: "FII IDX FUT (Net Flow)", shortName: "FII IDX FUT" };
    if (name === "FII Index Options") return { name: "FII IDX OPT (net flow)", shortName: "FII IDX OPT" };
    if (name === "FII Stock Futures") return { name: "FII STK FUT (Net Flow)", shortName: "FII STK FUT" };
    if (name === "FII Stock Options") return { name: "FII STK OPT (Net Flow)", shortName: "FII STK OPT" };

    return { name, shortName };
  };

  // Prepare data for the Bar Chart
  const chartData = data?.FIIDIIData ? data.FIIDIIData.map(item => {
    const mapped = mapSegmentName(item.Name, item.ShortName);
    return {
      name: mapped.shortName,
      fullName: mapped.name,
      value: item.Value,
      isPositive: item.Value >= 0,
      type: item.FiiDiiType || (item.ShortName.includes("FII") ? "FII" : "DII")
    };
  }) : [];

  // Find the absolute maximum value in the list to normalize inline bar widths
  const maxAbsValue = data?.FIIDIIData 
    ? Math.max(...data.FIIDIIData.map(item => Math.abs(item.Value)), 1)
    : 1;

  // Custom tooltip for Recharts BarChart
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const dataPoint = payload[0].payload;
      const isPos = dataPoint.value >= 0;
      return (
        <div className="bg-slate-950/95 border border-slate-800 p-3.5 rounded-xl shadow-xl space-y-1">
          <p className="text-xs font-black text-slate-300">{dataPoint.fullName}</p>
          <div className="flex items-center gap-2">
            <span className={`text-xs font-black font-mono ${isPos ? "text-emerald-400" : "text-rose-400"}`}>
              {isPos ? "+" : ""}{formatCurrency(dataPoint.value)} Cr
            </span>
            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
              dataPoint.type === "FII" ? "bg-indigo-500/15 text-indigo-400" : "bg-teal-500/15 text-teal-400"
            }`}>
              {dataPoint.type}
            </span>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div id="fii-dii-activity-section" className="bg-slate-900 text-slate-100 rounded-3xl p-6 md:p-8 shadow-2xl border border-slate-800 space-y-6 animate-fade-in relative overflow-hidden">
      {/* Decorative Background Elements */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/5 rounded-full blur-3xl -z-10 pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl -z-10 pointer-events-none" />

      {/* Header section with Date Selection */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-2 bg-indigo-500/10 rounded-xl text-indigo-400 border border-indigo-500/15">
              <Globe className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-lg md:text-xl font-black tracking-tight bg-gradient-to-r from-white via-slate-200 to-indigo-400 bg-clip-text text-transparent">
                FII / DII Activity & Market Sentiment
              </h2>
              <div className="flex items-center gap-1.5 text-[10px] font-bold text-indigo-400 uppercase tracking-widest mt-0.5">
                <span>Real-time Segment Flows</span>
                <span className="h-1 w-1 bg-indigo-500 rounded-full" />
                <span>Rs. Crores</span>
              </div>
            </div>
          </div>
        </div>

        {/* Date Selector & Controls */}
        <div className="flex flex-wrap items-center gap-3">
          {/* View toggle */}
          <div className="bg-slate-800/50 p-1 rounded-xl border border-slate-700/50 flex items-center gap-1">
            <button
              onClick={() => setViewMode("both")}
              className={`px-3 py-1 text-[11px] font-black rounded-lg transition-colors ${
                viewMode === "both" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-white"
              }`}
            >
              Overview
            </button>
            <button
              onClick={() => setViewMode("visual")}
              className={`px-3 py-1 text-[11px] font-black rounded-lg transition-colors ${
                viewMode === "visual" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-white"
              }`}
            >
              Chart Only
            </button>
            <button
              onClick={() => setViewMode("table")}
              className={`px-3 py-1 text-[11px] font-black rounded-lg transition-colors ${
                viewMode === "table" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-white"
              }`}
            >
              Table Only
            </button>
          </div>

          <div className="flex items-center gap-2 bg-slate-800/60 border border-slate-700/50 px-3.5 py-1.5 rounded-xl">
            <Calendar className="h-4 w-4 text-indigo-400" />
            <input 
              id="fii-dii-datepicker"
              type="date"
              value={selectedDate}
              onChange={handleDateChange}
              max="2026-12-31"
              className="bg-transparent text-xs font-black text-slate-100 focus:outline-none cursor-pointer [color-scheme:dark]"
            />
          </div>

          <button
            id="btn-fiidii-refresh"
            onClick={handleRefresh}
            disabled={loading}
            className="p-2.5 bg-slate-800/60 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl border border-slate-700/50 transition-all flex items-center justify-center disabled:opacity-50 cursor-pointer"
            title="Refresh Market Feed"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center space-y-3">
          <RefreshCw className="h-8 w-8 text-indigo-500 animate-spin" />
          <p className="text-xs text-slate-400 font-bold">Querying FII / DII activity details for {selectedDate}...</p>
        </div>
      ) : error ? (
        <div className="p-8 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-center space-y-4">
          <p className="text-sm text-rose-400 font-bold">{error}</p>
          <button
            onClick={() => fetchData(selectedDate)}
            className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-black rounded-xl shadow-md transition-all uppercase tracking-wider"
          >
            Retry Query
          </button>
        </div>
      ) : data ? (
        <div className="space-y-6">
          {/* Top Info Banner if date fell back */}
          {data.Date && data.Date.split("T")[0] !== selectedDate && (
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 flex items-start gap-3">
              <span className="p-1.5 bg-amber-500/15 rounded-lg text-amber-400 border border-amber-500/20 shrink-0">
                <Info className="h-4 w-4" />
              </span>
              <div className="space-y-0.5">
                <h4 className="text-xs font-black text-slate-200">Non-Trading Day Selected</h4>
                <p className="text-[11px] text-slate-400 leading-relaxed font-medium">
                  The date {selectedDate} was a weekend or market holiday. Automatically displaying details from the closest prior active trading session on <strong className="text-slate-200">{formatDateDisplay(data.Date)}</strong>.
                </p>
              </div>
            </div>
          )}

          {/* Indices Ribbon */}
          {data.ClosePrices && data.ClosePrices.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {data.ClosePrices.map((item) => {
                const isPositive = item.CZG >= 0;
                return (
                  <div 
                    key={item.Symbol} 
                    className="bg-slate-800/30 border border-slate-800/80 p-4 rounded-2xl flex items-center justify-between shadow-sm relative overflow-hidden group hover:border-slate-700/60 transition-colors"
                  >
                    <div className="space-y-0.5">
                      <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{item.Symbol}</span>
                      <div className="text-base font-black tracking-tight text-white font-mono">
                        {formatSymbolVal(item.C)}
                      </div>
                    </div>

                    <div className="text-right space-y-0.5">
                      <div className={`text-xs font-black font-mono flex items-center gap-1 justify-end ${
                        isPositive ? "text-emerald-400" : "text-rose-400"
                      }`}>
                        {isPositive ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                        <span>{isPositive ? "+" : ""}{formatSymbolVal(item.CZ)}</span>
                      </div>
                      <div className={`text-[10px] font-bold font-mono px-2 py-0.5 rounded-md inline-block ${
                        isPositive ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"
                      }`}>
                        {isPositive ? "+" : ""}{item.CZG}%
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Dynamic Recharts Bar Chart - Divergent Bars representing net inflows */}
          {(viewMode === "visual" || viewMode === "both") && (
            <div className="bg-slate-800/30 border border-slate-800/80 rounded-2xl p-5 md:p-6 space-y-4">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-indigo-400" />
                <span className="text-xs font-black text-slate-300 uppercase tracking-wider">Institution Cash & Derivatives Net Activity (Cr)</span>
              </div>
              <div className="h-64 md:h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={chartData}
                    margin={{ top: 10, right: 10, left: 0, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={true} vertical={false} />
                    <XAxis 
                      dataKey="name" 
                      stroke="#64748b" 
                      fontSize={10} 
                      tickLine={false} 
                      axisLine={false}
                    />
                    <YAxis 
                      stroke="#64748b" 
                      fontSize={10} 
                      tickLine={false} 
                      axisLine={false}
                      tickFormatter={(value) => `${value}`}
                    />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(99, 102, 241, 0.04)' }} />
                    <ReferenceLine y={0} stroke="#475569" strokeWidth={1.5} />
                    <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                      {chartData.map((entry, idx) => (
                        <Cell 
                          key={`cell-${idx}`} 
                          fill={entry.value >= 0 ? "rgba(16, 185, 129, 0.85)" : "rgba(244, 63, 94, 0.85)"} 
                          stroke={entry.value >= 0 ? "#10b981" : "#f43f5e"}
                          strokeWidth={1}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Table List with Custom Visual Inline Flow Bars */}
          {(viewMode === "table" || viewMode === "both") && (
            <div className="border border-slate-800/80 rounded-2xl overflow-hidden bg-slate-900/50">
              <div className="bg-slate-800/40 px-5 py-3 border-b border-slate-800 grid grid-cols-12 items-center text-slate-400 text-xs font-bold gap-4">
                <span className="col-span-4 uppercase tracking-wider">Institution Activity Segment</span>
                <span className="col-span-5 uppercase tracking-wider text-center hidden md:block">Flow Magnitude & Position</span>
                <span className="col-span-8 md:col-span-3 uppercase tracking-wider text-right">Net Flow (Rs. Cr)</span>
              </div>

              <div className="divide-y divide-slate-800/60">
                {data.FIIDIIData.map((item, index) => {
                  const mapped = mapSegmentName(item.Name, item.ShortName);
                  const isPositive = item.Value >= 0;
                  const hasChildren = item.ChildData && item.ChildData.length > 0;
                  const isExpanded = !!expandedItems[item.ShortName];
                  
                  // Calculate percentage relative to maxAbsValue for horizontal bars
                  const relativePercentage = Math.min((Math.abs(item.Value) / maxAbsValue) * 100, 100);

                  return (
                    <div key={item.ShortName || index} className="group">
                      {/* Primary Row */}
                      <div 
                        className={`grid grid-cols-12 items-center px-5 py-4 transition-all duration-150 hover:bg-slate-800/30 gap-4 ${
                          hasChildren ? "cursor-pointer" : ""
                        }`}
                        onClick={() => hasChildren && toggleExpand(item.ShortName)}
                      >
                        {/* Name and segment label */}
                        <div className="col-span-7 md:col-span-4 flex items-center gap-3">
                          {hasChildren ? (
                            <div className="p-1 bg-slate-800 rounded-lg text-slate-400 group-hover:text-white transition-colors">
                              {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                            </div>
                          ) : (
                            <div className="p-1 bg-slate-800/40 rounded-lg text-slate-600">
                              <Layers className="h-3.5 w-3.5" />
                            </div>
                          )}
                          <div className="truncate">
                            <div className="text-sm font-black text-slate-100 group-hover:text-white transition-colors flex items-center gap-2 flex-wrap">
                              {mapped.name}
                              {item.FiiDiiType && (
                                <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded ${
                                  item.FiiDiiType === "FII" ? "bg-indigo-500/10 text-indigo-400" : "bg-teal-500/10 text-teal-400"
                                }`}>
                                  {item.FiiDiiType}
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">{mapped.shortName}</span>
                          </div>
                        </div>

                        {/* Visual bar column (hidden on small screens, shown on md+) */}
                        <div className="col-span-5 hidden md:block">
                          <div className="relative w-full h-7 bg-slate-950/40 rounded-lg overflow-hidden border border-slate-800/50 flex items-center">
                            {/* Center separator line */}
                            <div className="absolute left-1/2 top-0 bottom-0 w-px bg-slate-700/60 z-10" />

                            {/* Flow Bar */}
                            {isPositive ? (
                              // Buying: Render green bar to the right of the center line
                              <div 
                                className="absolute left-1/2 h-full bg-gradient-to-r from-emerald-500/20 to-emerald-500/45 border-l-2 border-emerald-500"
                                style={{ width: `${relativePercentage / 2}%` }}
                              />
                            ) : (
                              // Selling: Render red bar to the left of the center line
                              <div 
                                className="absolute right-1/2 h-full bg-gradient-to-l from-rose-500/20 to-rose-500/45 border-r-2 border-rose-500"
                                style={{ width: `${relativePercentage / 2}%` }}
                              />
                            )}

                            {/* Small magnitude hint indicator */}
                            <span className={`absolute text-[9px] font-mono font-bold px-2 z-20 ${
                              isPositive ? "right-2 text-emerald-400" : "left-2 text-rose-400"
                            }`}>
                              {isPositive ? "BUY" : "SELL"}
                            </span>
                          </div>
                        </div>

                        {/* Net Value display */}
                        <div className="col-span-5 md:col-span-3 text-right">
                          <div className={`text-base font-black font-mono tracking-tight ${
                            isPositive ? "text-emerald-400" : "text-rose-400"
                          }`}>
                            {isPositive ? "+" : ""}{formatCurrency(item.Value)}
                          </div>
                          {hasChildren && (
                            <span className="text-[9px] text-indigo-400 font-bold group-hover:underline uppercase tracking-wide">
                              {isExpanded ? "Hide Details" : "Expand Indices"}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Expandable Child/Underlying Breakdown */}
                      <AnimatePresence initial={false}>
                        {hasChildren && isExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden bg-slate-950/40 border-t border-slate-800/40"
                          >
                            <div className="px-5 md:px-12 py-3 space-y-3">
                              <div className="text-[10px] font-black text-indigo-400/80 uppercase tracking-widest flex items-center gap-1">
                                <Activity className="h-3 w-3" />
                                <span>Index-Level Segment Breakdown ({item.ShortName})</span>
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pt-1 pb-2">
                                {item.ChildData?.map((child) => {
                                  const childPos = child.Value >= 0;
                                  // Max absolute value inside children
                                  const childMax = Math.max(...(item.ChildData?.map(c => Math.abs(c.Value)) || [1]), 1);
                                  const childBarPct = Math.min((Math.abs(child.Value) / childMax) * 100, 100);

                                  return (
                                    <div 
                                      key={child.ListingID || child.ShortName}
                                      className="bg-slate-900/80 border border-slate-800/60 rounded-xl p-3 space-y-2 hover:border-slate-700/60 transition-colors"
                                    >
                                      <div className="flex items-center justify-between gap-2">
                                        <div>
                                          <div className="text-xs font-black text-slate-200">{child.ShortName}</div>
                                          <div className="text-[10px] text-slate-500 font-bold truncate max-w-[140px]">{child.Name}</div>
                                        </div>
                                        <div className={`text-xs font-black font-mono ${
                                          childPos ? "text-emerald-400" : "text-rose-400"
                                        }`}>
                                          {childPos ? "+" : ""}{formatCurrency(child.Value)}
                                        </div>
                                      </div>

                                      {/* Mini Horizontal progress indicator bar */}
                                      <div className="w-full h-1 bg-slate-950 rounded-full overflow-hidden relative">
                                        <div 
                                          className={`h-full rounded-full ${
                                            childPos ? "bg-emerald-500" : "bg-rose-500"
                                          }`}
                                          style={{ width: `${childBarPct}%` }}
                                        />
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Educational Note / Info Box */}
          <div className="bg-slate-800/20 border border-slate-800/80 rounded-2xl p-4 flex items-start gap-3">
            <span className="p-1.5 bg-indigo-500/10 rounded-lg text-indigo-400 border border-indigo-500/15 shrink-0 mt-0.5">
              <Info className="h-4 w-4" />
            </span>
            <div className="space-y-1">
              <h4 className="text-xs font-black text-slate-200 uppercase tracking-wide">FII / DII Institutional Flow Interpretation</h4>
              <p className="text-[11px] text-slate-400 leading-relaxed font-medium font-sans">
                Foreign Institutional Investors (FII) and Domestic Institutional Investors (DII) are the core liquidity aggregates in the Indian capital markets. 
                Sustained buying (positive flows) represents institutional accumulation, and selling (negative flows) signals distribution. 
                Synthesizing derivative flows (Index Futures & Options) with cash market segments provides key insights into institutional market positioning.
              </p>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
