import urllib.request
import json
import sys

def fetch_stockedge_data(date_str=None):
    url = "https://api.stockedge.com/Api/DailyDashboardApi/GetDailyFiiDiiActivities?lang=en"
    if date_str:
        url += f"&date={date_str}"
        
    req = urllib.request.Request(
        url, 
        headers={
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'application/json, text/plain, */*',
            'Referer': 'https://web.stockedge.com/',
            'Origin': 'https://web.stockedge.com'
        }
    )
    
    try:
        with urllib.request.urlopen(req, timeout=10) as response:
            if response.getcode() == 200:
                raw_data = response.read().decode('utf-8')
                data = json.loads(raw_data)
                return {
                    "status": "success",
                    "source": "Real-time API Feed",
                    "data": data
                }
    except Exception as e:
        sys.stderr.write(f"Error fetching data: {e}\n")
        return {
            "status": "error",
            "message": str(e),
            "source": "Real-time API Feed"
        }

if __name__ == "__main__":
    # Get date from command line argument if provided
    query_date = sys.argv[1] if len(sys.argv) > 1 else None
    result = fetch_stockedge_data(query_date)
    print(json.dumps(result, indent=2))
