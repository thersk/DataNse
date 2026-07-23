import express from "express";
import path from "path";
import { exec } from "child_process";
import fs from "fs";
import { createServer as createViteServer } from "vite";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware for parsing JSON and text bodies
  app.use(express.json({ limit: "10mb" }));
  app.use(express.text({ limit: "10mb", type: "text/csv" }));

  // Ensure data directory exists
  if (!fs.existsSync("data")) {
    fs.mkdirSync("data", { recursive: true });
  }

  // --- API ROUTES FIRST ---

  // Endpoint to get FII/DII activity (removing stockedge references)
  app.get("/api/fii-dii-activity", (req, res) => {
    const { date } = req.query;
    console.log(`[API] FII/DII activity requested for date: ${date || "latest"}`);
    
    let cmd = "python3 scrape_stockedge.py";
    if (date && typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
      cmd += ` ${date}`;
    }
    
    exec(cmd, (error, stdout, stderr) => {
      if (stderr) {
        console.error(`[FII/DII Stderr]: ${stderr}`);
      }
      if (error) {
        console.error(`[FII/DII Error]:`, error);
        res.status(500).json({ 
          error: "Failed to retrieve FII/DII activity data.", 
          details: stderr || error.message 
        });
        return;
      }

      try {
        const parsed = JSON.parse(stdout);
        res.json(parsed);
      } catch (parseErr) {
        console.error(`[Parse Error] Failed to parse scraper stdout:`, parseErr);
        res.status(500).json({ 
          error: "Failed to parse FII/DII activity output.", 
          stdout: stdout 
        });
      }
    });
  });

  // Endpoint to run the Python scraper
  app.get("/api/scrape", (req, res) => {
    const { date } = req.query;
    if (!date || typeof date !== "string") {
      res.status(400).json({ error: "Missing required query parameter: date (DD-MM-YYYY)" });
      return;
    }

    console.log(`[API] Scrape requested for date: ${date}`);
    
    // Validate date format DD-MM-YYYY
    const dateRegex = /^\d{2}-\d{2}-\d{4}$/;
    if (!dateRegex.test(date)) {
      res.status(400).json({ error: "Invalid date format. Please use DD-MM-YYYY (e.g. 16-07-2026)" });
      return;
    }

    // Call Python scraper script
    exec(`python3 scrape_nse.py ${date}`, (error, stdout, stderr) => {
      if (stderr) {
        console.error(`[Scraper Stderr]: ${stderr}`);
      }
      if (error) {
        console.error(`[Scraper Error]:`, error);
        res.status(500).json({ 
          error: "Failed to scrape NSE data.", 
          details: stderr || error.message 
        });
        return;
      }

      try {
        const parsed = JSON.parse(stdout);
        res.json(parsed);
      } catch (parseErr) {
        console.error(`[Parse Error] Failed to parse Python stdout:`, parseErr);
        res.status(500).json({ 
          error: "Failed to parse scraped output.", 
          stdout: stdout 
        });
      }
    });
  });

  // Endpoint to get NSE Option Chain data via Python script
  app.get("/api/open-interest", (req, res) => {
    const symbol = (req.query.symbol as string || "NIFTY").toUpperCase();
    const expiry = req.query.expiry as string || "";
    console.log(`[API] NSE Option Chain requested for symbol: ${symbol}, expiry: ${expiry || "default"}`);

    let cmd = `python3 scrape_nse_option_chain.py --symbol ${symbol}`;
    if (expiry) {
      cmd += ` --expiry "${expiry}"`;
    }

    exec(cmd, (error, stdout, stderr) => {
      if (stderr) {
        console.error(`[NSE Option Chain Stderr]: ${stderr}`);
      }
      if (error) {
        console.error(`[NSE Option Chain Error]:`, error);
        res.status(500).json({ 
          error: "Failed to fetch NSE Option Chain data.", 
          details: stderr || error.message 
        });
        return;
      }

      try {
        const parsed = JSON.parse(stdout);
        res.json(parsed);
      } catch (parseErr) {
        console.error(`[Parse Error] Failed to parse Option Chain stdout:`, parseErr);
        res.status(500).json({ 
          error: "Failed to parse NSE Option Chain output.", 
          stdout: stdout 
        });
      }
    });
  });

  // Endpoint to upload raw NSE Option Chain JSON directly
  app.post("/api/option-chain-upload", (req, res) => {
    const { symbol, jsonContent } = req.body;
    
    if (!symbol || !jsonContent) {
      res.status(400).json({ error: "Missing required parameters: symbol or jsonContent" });
      return;
    }

    const cleanSymbol = symbol.trim().toLowerCase();
    const cache_path = path.join("data", `option_chain_${cleanSymbol}.json`);

    try {
      let parsedJson = jsonContent;
      if (typeof jsonContent === "string") {
        parsedJson = JSON.parse(jsonContent);
      }
      fs.writeFileSync(cache_path, JSON.stringify(parsedJson, null, 2), "utf-8");
      console.log(`[API] Successfully cached option chain JSON for ${cleanSymbol}`);
      res.json({ status: "success", message: `Option chain cached for ${cleanSymbol.toUpperCase()}` });
    } catch (e: any) {
      console.error(`[API Error] Failed to save option chain JSON:`, e);
      res.status(500).json({ error: "Failed to parse/save option chain JSON.", details: e.message });
    }
  });

  // Endpoint to upload and cache CSV content manually
  app.post("/api/cache-upload", (req, res) => {
    const { date, csvContent } = req.body;
    
    if (!date || !csvContent) {
      res.status(400).json({ error: "Missing required parameters: date (DD-MM-YYYY) or csvContent" });
      return;
    }

    console.log(`[API] Cache upload requested for date: ${date}`);

    // Parse date to clean ddmmyyyy string
    const parts = date.split("-");
    if (parts.length !== 3) {
      res.status(400).json({ error: "Invalid date format. Must be DD-MM-YYYY" });
      return;
    }

    const ddmmyyyy = parts[0] + parts[1] + parts[3]; // e.g. 16072026 or parts[2]
    // wait, if year is 4 digits, parts[2] is the year!
    const year = parts[2];
    const clean_ddmmyyyy = parts[0] + parts[1] + year; // DDMMYYYY
    
    const cache_path = path.join("data", `fao_participant_oi_${clean_ddmmyyyy}.csv`);

    try {
      fs.writeFileSync(cache_path, csvContent, "utf-8");
      console.log(`[API] Successfully cached manually uploaded CSV to ${cache_path}`);
      
      // Parse CSV immediately and return it
      exec(`python3 scrape_nse.py ${date}`, (error, stdout, stderr) => {
        if (error) {
          console.error(`[Scraper Parser Error]:`, error);
          res.status(500).json({ error: "Failed to parse cached CSV file." });
          return;
        }
        try {
          const parsed = JSON.parse(stdout);
          res.json({
            status: "success",
            message: "Successfully uploaded and cached file.",
            results: parsed
          });
        } catch (parseErr) {
          res.status(500).json({ error: "Failed to parse output." });
        }
      });
    } catch (e: any) {
      console.error(`[API Error] Failed to save CSV cache:`, e);
      res.status(500).json({ error: "Failed to save file to cache directory.", details: e.message });
    }
  });

  // --- VITE MIDDLEWARE SETUP ---

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    console.log("[Server] Vite middleware mounted in development mode.");
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
    console.log("[Server] Serving static assets from dist folder in production mode.");
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Server] running on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
});
