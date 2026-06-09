import os
import json
import requests
from bs4 import BeautifulSoup
import datetime

# Motorist.sg petrol prices url
URL = "https://www.motorist.sg/petrol-prices"
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
}

def clean_price(val_str):
    val_str = val_str.strip()
    if not val_str or val_str == '-':
        return None
    # Remove S$ or $ signs
    val_str = val_str.replace('S$', '').replace('$', '')
    try:
        return float(val_str)
    except ValueError:
        return None

def main():
    print(f"Fetching petrol prices from {URL}...")
    try:
        response = requests.get(URL, headers=HEADERS, timeout=15)
        if response.status_code != 200:
            print(f"Error: Received status code {response.status_code}")
            return
        
        soup = BeautifulSoup(response.text, 'html.parser')
        table = soup.find('table', class_='fuel_comparison_table')
        
        if not table:
            print("Error: Could not find table with class 'fuel_comparison_table'")
            return
        
        rows = table.find_all('tr')
        if len(rows) < 7:
            print(f"Error: Table has unexpected number of rows ({len(rows)})")
            return
            
        # Map column index to brand
        brand_map = {
            1: "esso",
            2: "shell",
            3: "spc",
            4: "caltex",
            5: "sinopec"
        }
        
        # Map row index to grade key
        grade_map = {
            2: "ron92",
            3: "ron95",
            4: "ron98",
            5: "premium",
            6: "diesel"
        }
        
        # Initialize output dictionary
        prices_data = {
            "esso": {"name": "Esso", "ron92": None, "ron95": None, "ron98": None, "premium": None, "diesel": None},
            "shell": {"name": "Shell", "ron92": None, "ron95": None, "ron98": None, "premium": None, "diesel": None},
            "spc": {"name": "SPC", "ron92": None, "ron95": None, "ron98": None, "premium": None, "diesel": None},
            "caltex": {"name": "Caltex", "ron92": None, "ron95": None, "ron98": None, "premium": None, "diesel": None},
            "sinopec": {"name": "Sinopec", "ron92": None, "ron95": None, "ron98": None, "premium": None, "diesel": None}
        }
        
        for row_idx, grade_key in grade_map.items():
            if row_idx >= len(rows):
                break
                
            row = rows[row_idx]
            tds = row.find_all(['td', 'th'])
            
            # First element is grade name, rest are prices
            for col_idx, brand_key in brand_map.items():
                if col_idx < len(tds):
                    price_val = clean_price(tds[col_idx].text)
                    prices_data[brand_key][grade_key] = price_val

        # Get current time in SGT (SGT is UTC+8)
        sgt_timezone_offset = datetime.timezone(datetime.timedelta(hours=8))
        now_sgt = datetime.datetime.now(sgt_timezone_offset)
        last_updated_str = now_sgt.strftime("%d %b %Y, %I:%M %p SGT")

        output = {
            "metadata": {
                "lastUpdated": last_updated_str
            },
            "prices": prices_data
        }

        # Ensure directory exists
        os.makedirs("data", exist_ok=True)
        
        # Write to JSON
        output_path = "data/petrol_data.json"
        with open(output_path, "w") as f:
            json.dump(output, f, indent=2)
            
        print(f"Successfully scraped prices and saved to {output_path}!")
        print(json.dumps(output, indent=2))
        
    except Exception as e:
        print(f"Exception during scraping: {e}")

if __name__ == "__main__":
    main()
