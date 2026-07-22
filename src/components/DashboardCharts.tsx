import React, { useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { DayScrapeResult, ParticipantRecord } from "../types";

interface DashboardChartsProps {
  results: DayScrapeResult[];
  selectedParticipant: string;
}

export default function DashboardCharts({ results, selectedParticipant }: DashboardChartsProps) {
  const [chartType, setChartType] = useState<"futures" | "options">("futures");

  // Filter successfully loaded results and sort oldest-to-newest
  const sortedResults = [...results].filter(r => r.status === "success").reverse();

  if (sortedResults.length === 0) {
    return null;
  }

  // Find record for chosen participant across all success dates
  const getParticipantRec = (res: DayScrapeResult): ParticipantRecord | undefined => {
    return res.data?.find(
      (p) => p.participant.toLowerCase().trim() === selectedParticipant.toLowerCase().trim()
    );
  };

  // Build chart dataset
  // We want to group by METRIC and have series for each DATE
  const dates = sortedResults.map(r => r.date);

  const futuresMetrics = [
    {
      label: "Index Futures",
      getNet: (r: ParticipantRecord) => r.futureIndexLong - r.futureIndexShort,
    },
    {
      label: "Stock Futures",
      getNet: (r: ParticipantRecord) => r.futureStockLong - r.futureStockShort,
    },
  ];

  const optionsMetrics = [
    {
      label: "Index Calls",
      getNet: (r: ParticipantRecord) => r.optionIndexCallLong - r.optionIndexCallShort,
    },
    {
      label: "Index Puts",
      getNet: (r: ParticipantRecord) => r.optionIndexPutLong - r.optionIndexPutShort,
    },
    {
      label: "Stock Calls",
      getNet: (r: ParticipantRecord) => r.optionStockCallLong - r.optionStockCallShort,
    },
    {
      label: "Stock Puts",
      getNet: (r: ParticipantRecord) => r.optionStockPutLong - r.optionStockPutShort,
    },
  ];

  const currentMetrics = chartType === "futures" ? futuresMetrics : optionsMetrics;

  const chartData = currentMetrics.map((m) => {
    const dataPoint: any = { name: m.label };
    sortedResults.forEach((res, idx) => {
      const rec = getParticipantRec(res);
      const net = rec ? m.getNet(rec) : 0;
      dataPoint[res.date] = net;
    });
    return dataPoint;
  });

  // Custom tooltip formatter
  const formatValue = (value: number) => {
    return new Intl.NumberFormat("en-IN").format(value);
  };

  // Color palette for the 3 dates
  const barColors = ["#cbd5e1", "#818cf8", "#4f46e5"]; // Oldest to Newest (light slate, medium indigo, dark indigo)

  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm flex flex-col space-y-4">
      
      {/* Chart Headers & Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h3 className="font-semibold text-gray-950 font-display text-sm flex items-center gap-2">
            Net Position Trends: <span className="text-indigo-600 font-bold">{selectedParticipant}</span>
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">Clustered net contract counts over 3 trading days. Above 0 is bullish, below is bearish.</p>
        </div>

        <div className="flex items-center gap-1.5 bg-gray-100 p-1 rounded-xl">
          <button
            id="toggle-futures-btn"
            onClick={() => setChartType("futures")}
            className={`text-xs font-semibold px-3.5 py-1.5 rounded-lg transition-all ${
              chartType === "futures"
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-900"
            }`}
          >
            Futures (Index & Stock)
          </button>
          <button
            id="toggle-options-btn"
            onClick={() => setChartType("options")}
            className={`text-xs font-semibold px-3.5 py-1.5 rounded-lg transition-all ${
              chartType === "options"
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-900"
            }`}
          >
            Options (Index & Stock)
          </button>
        </div>
      </div>

      {/* Chart Canvas */}
      <div className="h-[280px] w-full mt-2 font-sans text-xs">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            margin={{ top: 10, right: 10, left: 10, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis 
              dataKey="name" 
              axisLine={false} 
              tickLine={false} 
              stroke="#94a3b8" 
              fontSize={11}
              fontWeight={500}
            />
            <YAxis 
              axisLine={false} 
              tickLine={false} 
              stroke="#94a3b8" 
              fontSize={10}
              tickFormatter={(v) => {
                if (Math.abs(v) >= 100000) return `${(v / 100000).toFixed(1)}L`; // Lakhs mapping
                return v;
              }}
            />
            <Tooltip
              formatter={(value: any) => [formatValue(Number(value)), "Net Position"]}
              contentStyle={{
                backgroundColor: "#0f172a",
                borderRadius: "12px",
                border: "none",
                color: "#f8fafc",
              }}
              labelStyle={{ fontWeight: "bold", marginBottom: "4px", color: "#94a3b8" }}
            />
            <Legend 
              verticalAlign="bottom" 
              height={36} 
              iconType="circle"
              iconSize={8}
              formatter={(value) => <span className="text-gray-600 font-medium text-xs">{value}</span>}
            />
            <ReferenceLine y={0} stroke="#94a3b8" strokeWidth={1} strokeDasharray="3 3" />
            
            {dates.map((date, idx) => (
              <Bar 
                key={date} 
                dataKey={date} 
                fill={barColors[idx % barColors.length]} 
                radius={[4, 4, 0, 0]} 
                maxBarSize={45}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

    </div>
  );
}
