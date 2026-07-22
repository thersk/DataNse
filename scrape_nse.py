import urllib.request
import urllib.parse
import ssl
import csv
import json
import sys
import os
from datetime import datetime, timedelta

# Create data cache folder
os.makedirs("data", exist_ok=True)

def parse_date(date_str):
    # Accepts DD-MM-YYYY, returns datetime object
    try:
        return datetime.strptime(date_str, "%d-%m-%Y")
    except ValueError:
        try:
            return datetime.strptime(date_str, "%Y-%m-%d")
        except ValueError:
            return None

def get_free_proxies():
    url = "https://api.proxyscrape.com/v2/?request=displayproxies&protocol=http&timeout=3000&country=all&ssl=all&anonymity=all"
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=8) as r:
            text = r.read().decode('utf-8')
            return [line.strip() for line in text.split('\n') if line.strip()]
    except Exception as e:
        sys.stderr.write(f"Failed to fetch proxy list: {e}\n")
        return []

def parse_csv_content(content):
    lines = content.strip().split('\n')
    if len(lines) < 2:
        return None
    
    # Line 1 is title, Line 2 is headers, Line 3-7 are data rows
    reader = csv.reader(lines)
    rows = list(reader)
    
    if len(rows) < 2:
        return None
        
    headers = [h.strip() for h in rows[1]]
    data_rows = rows[2:]
    
    parsed_data = []
    
    # Map header names to clean keys
    key_mapping = {
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
    }
    
    # Fallback/dynamic headers index mapping in case column names change slightly
    header_indices = {}
    for i, h in enumerate(headers):
        for map_key, clean_key in key_mapping.items():
            if map_key.lower().replace(" ", "") in h.lower().replace(" ", ""):
                header_indices[clean_key] = i
                break
                
    for row in data_rows:
        if not row or len(row) < len(headers):
            continue
        
        participant = row[0].strip()
        if not participant or participant.lower() in ["", "clienttype"]:
            continue
            
        record = {"participant": participant}
        for clean_key, idx in header_indices.items():
            if clean_key == "participant":
                continue
            try:
                # Convert numbers (like 228686) to int
                val_str = row[idx].strip()
                record[clean_key] = int(val_str) if val_str else 0
            except ValueError:
                record[clean_key] = 0
                
        parsed_data.append(record)
        
    return parsed_data

def scrape_for_date(date_obj):
    ddmmyyyy = date_obj.strftime("%d%m%Y") # e.g. 16072026
    cache_path = os.path.join("data", f"fao_participant_oi_{ddmmyyyy}.csv")
    
    # Check cache first
    if os.path.exists(cache_path):
        try:
            with open(cache_path, "r", encoding="utf-8") as f:
                content = f.read()
                data = parse_csv_content(content)
                if data:
                    return {"status": "success", "date": date_obj.strftime("%d-%b-%Y"), "data": data, "cached": True}
        except Exception as e:
            sys.stderr.write(f"Failed to read cache for {ddmmyyyy}: {e}\n")

    # If not in cache, we need to fetch it
    target_url = f"https://archives.nseindia.com/content/nsccl/fao_participant_oi_{ddmmyyyy}.csv"
    sys.stderr.write(f"Scraping {target_url}...\n")
    
    ctx = ssl._create_unverified_context()
    
    direct_headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://www.nseindia.com/',
        'Cache-Control': 'no-cache'
    }

    # Try direct fetch first
    try:
        req = urllib.request.Request(target_url, headers=direct_headers)
        with urllib.request.urlopen(req, timeout=6, context=ctx) as r:
            if r.getcode() == 200:
                content = r.read().decode('utf-8', errors='ignore')
                if "Client Type" in content or "Participant" in content or len(content) > 100:
                    with open(cache_path, "w", encoding="utf-8") as f:
                        f.write(content)
                    data = parse_csv_content(content)
                    if data:
                        return {"status": "success", "date": date_obj.strftime("%d-%b-%Y"), "data": data, "cached": False}
    except urllib.error.HTTPError as he:
        if he.code == 404:
            sys.stderr.write(f"File 404 Not Found directly on NSE for {ddmmyyyy}. File not yet published or holiday.\n")
            return {"status": "holiday", "date": date_obj.strftime("%d-%b-%Y"), "message": "File not yet published by NSE or non-trading day."}
    except Exception as e:
        sys.stderr.write(f"Direct fetch failed ({e}), trying proxies...\n")

    proxies = get_free_proxies()
    if not proxies:
        proxies = [None]

    for proxy in proxies[:30]: # Try first 30 proxies
        if not proxy:
            continue
        try:
            proxy_support = urllib.request.ProxyHandler({'http': proxy, 'https': proxy})
            opener = urllib.request.build_opener(proxy_support)
            opener.addheaders = [(k, v) for k, v in direct_headers.items()]
            
            with opener.open(target_url, timeout=5) as r:
                code = r.getcode()
                if code == 200:
                    content = r.read().decode('utf-8', errors='ignore')
                    with open(cache_path, "w", encoding="utf-8") as f:
                        f.write(content)
                    data = parse_csv_content(content)
                    if data:
                        return {"status": "success", "date": date_obj.strftime("%d-%b-%Y"), "data": data, "cached": False}
        except urllib.error.HTTPError as he:
            if he.code == 404:
                sys.stderr.write(f"File 404 Not Found on NSE via proxy.\n")
                return {"status": "holiday", "date": date_obj.strftime("%d-%b-%Y"), "message": "File not yet published by NSE or non-trading day."}
        except Exception:
            continue
            
    return {"status": "error", "date": date_obj.strftime("%d-%b-%Y"), "message": "Data for this date is not available or not yet published by NSE."}

def get_trading_days(target_date_obj, count=3):
    # Returns the target date trading day + preceding count-1 trading days
    # Weekends (Sat, Sun) are skipped
    trading_days = []
    curr = target_date_obj
    
    # First, adjust target date if it's a weekend
    while curr.weekday() >= 5: # 5 is Saturday, 6 is Sunday
        curr -= timedelta(days=1)
        
    while len(trading_days) < count:
        if curr.weekday() < 5: # Monday to Friday
            trading_days.append(curr)
        curr -= timedelta(days=1)
        
    return trading_days

def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Usage: python3 scrape_nse.py <date_str_dd-mm-yyyy>"}))
        sys.exit(1)
        
    date_input = sys.argv[1]
    target_date = parse_date(date_input)
    if not target_date:
        print(json.dumps({"error": f"Invalid date format: {date_input}. Please use DD-MM-YYYY"}))
        sys.exit(1)
        
    # Get the 3 trading days
    trading_days = get_trading_days(target_date, 3)
    
    results = []
    for day in trading_days:
        res = scrape_for_date(day)
        results.append(res)
        
    print(json.dumps(results, indent=2))

if __name__ == "__main__":
    main()
