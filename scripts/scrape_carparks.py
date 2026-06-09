import os
import re
import json
import time
import requests

INDEX_URL = "https://www.sgcarmart.com/carpark/"
DETAIL_API_BASE = "https://www.sgcarmart.com/api/carpark/fetch-carpark-detail-data"
OUTPUT_FILE = "data/parking_rates.json"

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
}

def to_hhmm(h_str, ampm):
    h_val = float(h_str)
    h = int(h_val)
    # Extract minutes if float represents something like 6.30 or 10.30
    m = int(round((h_val - h) * 100))
    if ampm == 'pm' and h < 12:
        h += 12
    elif ampm == 'am' and h == 12:
        h = 0
    return f"{h:02d}:{m:02d}"

def extract_time_range(full_text):
    if not full_text:
        return None, None
    t = full_text.lower().strip()
    time_match = re.search(r'from\s+([0-9.]+)\s*(am|pm)\s+to\s+([0-9.]+)\s*(am|pm)', t)
    if time_match:
        h1, ampm1, h2, ampm2 = time_match.groups()
        try:
            return to_hhmm(h1, ampm1), to_hhmm(h2, ampm2)
        except Exception:
            pass
    return None, None

def smart_split_rates(text):
    if not text:
        return []
    parts = text.split(',')
    joined_parts = []
    temp = ""
    join_keywords = ["subsequent", "thereafter", "next", "second", "then"]
    for p in parts:
        p_clean = p.lower()
        if any(k in p_clean for k in join_keywords) and temp:
            temp = temp + "," + p
        else:
            if temp:
                joined_parts.append(temp)
            temp = p
    if temp:
        joined_parts.append(temp)
    return [jp.strip() for jp in joined_parts]

def get_motorcycle_rates(name):
    n = name.lower().strip()
    
    # 1. No parking locations (Closed for motorcycles)
    if any(k in n for k in ["orchard central", "paragon", "marina bay sands", "parkway parade"]):
        return {
            "weekday": [],
            "saturday": [],
            "sunday": []
        }
        
    # 2. Free parking locations
    if any(k in n for k in ["suntec city", "suntec singapore"]):
        free_session = [{"start": "00:00", "end": "23:59", "type": "flat", "first_rate": 0.0}]
        return {
            "weekday": free_session,
            "saturday": free_session,
            "sunday": free_session
        }
        
    # 3. Ngee Ann City
    if "ngee ann city" in n or "takashimaya" in n:
        weekday_sessions = [
            {"start": "00:00", "end": "12:00", "type": "hourly", "first_unit": 30, "first_rate": 1.31, "subseq_unit": 30, "subseq_rate": 1.31},
            {"start": "12:01", "end": "14:00", "type": "hourly", "first_unit": 30, "first_rate": 1.85, "subseq_unit": 30, "subseq_rate": 1.85},
            {"start": "14:01", "end": "17:00", "type": "hourly", "first_unit": 30, "first_rate": 1.31, "subseq_unit": 30, "subseq_rate": 1.31},
            {"start": "17:01", "end": "19:00", "type": "hourly", "first_unit": 30, "first_rate": 1.85, "subseq_unit": 30, "subseq_rate": 1.85},
            {"start": "19:01", "end": "23:59", "type": "flat", "first_rate": 4.36}
        ]
        weekend_sessions = [
            {"start": "00:00", "end": "12:00", "type": "hourly", "first_unit": 60, "first_rate": 2.62, "subseq_unit": 30, "subseq_rate": 1.64},
            {"start": "12:01", "end": "14:00", "type": "hourly", "first_unit": 60, "first_rate": 3.71, "subseq_unit": 30, "subseq_rate": 2.18},
            {"start": "14:01", "end": "17:00", "type": "hourly", "first_unit": 60, "first_rate": 2.62, "subseq_unit": 30, "subseq_rate": 1.64},
            {"start": "17:01", "end": "19:00", "type": "hourly", "first_unit": 60, "first_rate": 3.71, "subseq_unit": 30, "subseq_rate": 2.18},
            {"start": "19:01", "end": "23:59", "type": "flat", "first_rate": 4.36}
        ]
        return {
            "weekday": weekday_sessions,
            "saturday": weekend_sessions,
            "sunday": weekend_sessions
        }

    # 4. 313@somerset
    if "313@somerset" in n or "313 @ somerset" in n:
        somerset_session = [{"start": "00:00", "end": "23:59", "type": "hourly", "first_unit": 60, "first_rate": 1.64, "subseq_unit": 60, "subseq_rate": 1.64}]
        return {
            "weekday": somerset_session,
            "saturday": somerset_session,
            "sunday": somerset_session
        }

    # 5. Paya Lebar Quarter
    if "paya lebar quarter" in n or "plq" in n:
        plq_session = [{"start": "00:00", "end": "23:59", "type": "hourly", "first_unit": 60, "first_rate": 0.75, "subseq_unit": 30, "subseq_rate": 0.75}]
        return {
            "weekday": plq_session,
            "saturday": plq_session,
            "sunday": plq_session
        }

    # 6. Specific flat rates
    flat_rate = 1.30  # Default commercial rate (standard for CapitaLand, Frasers, Lendlease, Far East, etc.)
    
    if "compass one" in n:
        flat_rate = 1.40
    elif "jem" in n:
        flat_rate = 1.64
    elif "vivocity" in n:
        flat_rate = 1.20
    elif "waterway point" in n:
        flat_rate = 1.50
    elif "causeway point" in n:
        flat_rate = 1.50
    elif "singpost centre" in n:
        flat_rate = 1.40
    elif "great world" in n:
        flat_rate = 1.51
    elif "ion orchard" in n:
        flat_rate = 4.36
    elif "city square mall" in n:
        flat_rate = 2.18
    elif "imm" in n:
        flat_rate = 1.07
    elif "hdb" in n and "hub" not in n:
        flat_rate = 0.65
    elif "ura" in n:
        flat_rate = 0.65
        
    session = [{"start": "00:00", "end": "23:59", "type": "flat", "first_rate": flat_rate}]
    return {
        "weekday": session,
        "saturday": session,
        "sunday": session
    }

def parse_rate_text(text, start_time_default="08:00", end_time_default="17:59"):
    if not text:
        return None
    t = text.lower().strip()
    if not t or "closed" in t or "no parking" in t:
        return None
        
    first_unit = 60
    first_rate = 0.0
    subseq_unit = 30
    subseq_rate = 0.0
    
    # Try to extract time range, e.g. "from 6.01am to 6pm"
    start_time = start_time_default
    end_time = end_time_default
    
    time_match = re.search(r'from\s+([0-9.]+)\s*(am|pm)\s+to\s+([0-9.]+)\s*(am|pm)', t)
    if time_match:
        h1, ampm1, h2, ampm2 = time_match.groups()
        try:
            start_time = to_hhmm(h1, ampm1)
            end_time = to_hhmm(h2, ampm2)
        except Exception:
            pass
            
    # Check if flat rate per entry
    if "per entry" in t or "/entry" in t or "flat" in t:
        price_match = re.search(r'\$?([0-9.]+)\s*(?:/entry|per entry|flat)', t)
        if price_match:
            first_rate = float(price_match.group(1))
        else:
            price_match = re.search(r'\$?([0-9.]+)', t)
            if price_match:
                first_rate = float(price_match.group(1))
        return {
            "start": start_time,
            "end": end_time,
            "type": "flat",
            "first_rate": first_rate
        }

    # Hourly rate parsing
    first_match = re.search(r'\$?([0-9.]+)\s*for\s*1st\s*([0-9]+)?\s*(hr|mins|min|hour|hours)', t)
    if first_match:
        rate, unit_val, unit_type = first_match.groups()
        first_rate = float(rate)
        val = int(unit_val) if unit_val else 1
        if 'hr' in unit_type or 'hour' in unit_type:
            first_unit = val * 60
        else:
            first_unit = val
            
        # Subsequent pattern match
        subseq_match = re.search(r'\$?([0-9.]+)\s*for\s*(?:next\s*)?subsequent\s*([0-9]+)?\s*(hr|mins|min|hour|hours)', t)
        if subseq_match:
            s_rate, s_unit_val, s_unit_type = subseq_match.groups()
            subseq_rate = float(s_rate)
            s_val = int(s_unit_val) if s_unit_val else 1
            if 'hr' in s_unit_type or 'hour' in s_unit_type:
                subseq_unit = s_val * 60
            else:
                subseq_unit = s_val
        else:
            # Check for generic subseq like "$1.20 per 30min thereafter"
            subseq_match2 = re.search(r'\$?([0-9.]+)\s*(?:per|/)\s*([0-9]+)?\s*(?:min|mins|minutes|hr|hour)?\s*(?:thereafter|subsequently)', t)
            if subseq_match2:
                s_rate, s_unit_val = subseq_match2.groups()
                subseq_rate = float(s_rate)
                s_val = int(s_unit_val) if s_unit_val else 30
                subseq_unit = s_val
            else:
                subseq_rate = first_rate
                subseq_unit = first_unit
    else:
        # Match simple patterns like: $1.20/30min, $1.20 per 30 minutes
        simple_match = re.search(r'\$?([0-9.]+)\s*(?:/|per)\s*([0-9]+)\s*(?:min|mins|minutes)', t)
        if simple_match:
            rate, unit_val = simple_match.groups()
            first_rate = float(rate)
            first_unit = int(unit_val)
            subseq_rate = first_rate
            subseq_unit = first_unit
        else:
            # Simple hourly pattern: $1.50/hr, $1.50 per hour
            simple_hr = re.search(r'\$?([0-9.]+)\s*(?:/|per)\s*(?:hr|hour)', t)
            if simple_hr:
                first_rate = float(simple_hr.group(1))
                first_unit = 60
                subseq_rate = first_rate
                subseq_unit = 60
            else:
                # Per minute pattern: $0.036/min
                simple_min = re.search(r'\$?([0-9.]+)\s*(?:/|per)\s*(?:min|minute)', t)
                if simple_min:
                    first_rate = float(simple_min.group(1))
                    first_unit = 1
                    subseq_rate = first_rate
                    subseq_unit = 1
                else:
                    # Fallback first number
                    generic = re.search(r'\$?([0-9.]+)', t)
                    if generic:
                        first_rate = float(generic.group(1))
                        first_unit = 60
                        subseq_rate = first_rate
                        subseq_unit = 60
                    else:
                        return None
                        
    return {
        "start": start_time,
        "end": end_time,
        "type": "hourly",
        "first_unit": first_unit,
        "first_rate": first_rate,
        "subseq_unit": subseq_unit,
        "subseq_rate": subseq_rate
    }

def clean_postal(address):
    # Extract 6-digit postal code
    match = re.search(r'S\((\d{6})\)', address)
    if match:
        return match.group(1)
    match = re.search(r'\b\d{6}\b', address)
    if match:
        return match.group(0)
    return None

def main():
    print(f"Fetching carpark index from {INDEX_URL}...")
    try:
        r = requests.get(INDEX_URL, headers=HEADERS, timeout=15)
        if r.status_code != 200:
            print("Error fetching index page:", r.status_code)
            return
            
        match = re.search(r'<script id="__NEXT_DATA__" type="application/json">(.*?)</script>', r.text)
        if not match:
            print("Error: Could not extract __NEXT_DATA__")
            return
            
        next_data = json.loads(match.group(1))
        carparks = next_data.get("props", {}).get("pageProps", {}).get("carparksData", {}).get("data", [])
        
        if not carparks:
            print("Error: No carpark list found in index.")
            return
            
        print(f"Found {len(carparks)} carpark records. Starting details scrape...")
        
    except Exception as e:
        print("Exception during index fetch:", e)
        return

    scraped_data = []
    success_count = 0
    
    # We scrape all, but we limit to a safe request rate
    # E.g. delay of 0.05 seconds = 20 requests per second. It takes ~1 minute.
    start_time = time.time()
    
    for idx, cp in enumerate(carparks):
        cp_id = cp.get("id")
        if not cp_id:
            continue
            
        # Print progress
        if idx > 0 and idx % 50 == 0:
            elapsed = time.time() - start_time
            print(f"Scraped {idx}/{len(carparks)} carparks (Successful: {success_count}). Elapsed time: {elapsed:.1f}s")
            
        detail_url = f"{DETAIL_API_BASE}?id={cp_id}"
        try:
            res = requests.get(detail_url, headers=HEADERS, timeout=10)
            if res.status_code == 200:
                payload = res.json()
                detail = payload.get("data", {}).get("data")
                if detail:
                    # Clean and parse rates
                    address = detail.get("address", "")
                    postal = clean_postal(address)
                    
                    wd1 = detail.get("wd1")
                    wd2 = detail.get("wd2")
                    sat1 = detail.get("sat1")
                    sat2 = detail.get("sat2")
                    sun1 = detail.get("sun1")
                    sun2 = detail.get("sun2")
                    
                    # Parse rates to structured JSON
                    cp_name = detail.get("name") or ""
                    parsed_rates = {
                        "car": {
                            "weekday": [],
                            "saturday": [],
                            "sunday": []
                        },
                        "motorcycle": get_motorcycle_rates(cp_name)
                    }
                    
                    # Car rates parsing
                    if wd1:
                        s_def, e_def = extract_time_range(wd1)
                        for part in smart_split_rates(wd1):
                            p = parse_rate_text(part, s_def or "08:00", e_def or "17:59")
                            if p: parsed_rates["car"]["weekday"].append(p)
                    if wd2:
                        s_def, e_def = extract_time_range(wd2)
                        for part in smart_split_rates(wd2):
                            p = parse_rate_text(part, s_def or "18:00", e_def or "07:59")
                            if p: parsed_rates["car"]["weekday"].append(p)
                    
                    if sat1:
                        s_def, e_def = extract_time_range(sat1)
                        for part in smart_split_rates(sat1):
                            p = parse_rate_text(part, s_def or "08:00", e_def or "17:59")
                            if p: parsed_rates["car"]["saturday"].append(p)
                    if sat2:
                        s_def, e_def = extract_time_range(sat2)
                        for part in smart_split_rates(sat2):
                            p = parse_rate_text(part, s_def or "18:00", e_def or "07:59")
                            if p: parsed_rates["car"]["saturday"].append(p)
                    
                    if sun1:
                        s_def, e_def = extract_time_range(sun1)
                        for part in smart_split_rates(sun1):
                            p = parse_rate_text(part, s_def or "08:00", e_def or "17:59")
                            if p: parsed_rates["car"]["sunday"].append(p)
                    if sun2:
                        s_def, e_def = extract_time_range(sun2)
                        for part in smart_split_rates(sun2):
                            p = parse_rate_text(part, s_def or "18:00", e_def or "07:59")
                            if p: parsed_rates["car"]["sunday"].append(p)
                    
                    # check if restricted/closed
                    cp_remarks = detail.get("remarks") or ""
                    is_season_only = (
                        (wd1 and wd1.strip().lower() == "season parking only") or 
                        (wd1 and wd1.strip().lower() == "season only") or
                        "season parking only" in cp_name.lower()
                    )
                    
                    is_private = (
                        (wd1 and wd1.strip().lower() == "private car park") or
                        (wd1 and wd1.strip().lower() == "private carpark") or
                        (wd1 and wd1.strip().lower() == "private parking") or
                        "private carpark" in cp_remarks.lower() or
                        "private car park" in cp_remarks.lower() or
                        "private parking only" in cp_remarks.lower() or
                        "no public parking" in cp_remarks.lower() or
                        "not open to public" in cp_remarks.lower() or
                        "staff parking only" in cp_remarks.lower() or
                        "tenants only" in cp_remarks.lower() or
                        "for tenants only" in cp_remarks.lower() or
                        "staff only" in cp_remarks.lower()
                    )
                    
                    is_closed = (
                        (wd1 and wd1.strip().lower() == "carpark closed") or
                        (wd1 and wd1.strip().lower() == "car park closed") or
                        (wd1 and wd1.strip().lower() == "carpark is closed") or
                        (wd1 and wd1.strip().lower() == "closed") or
                        cp_remarks.strip().lower() == "closed" or
                        cp_remarks.strip().lower() == "carpark closed" or
                        cp_remarks.strip().lower() == "carpark is closed" or
                        "permanently closed" in cp_remarks.lower() or
                        "demolished" in cp_remarks.lower() or
                        "closed permanently" in cp_remarks.lower()
                    )
                    
                    exclude = False
                    is_permanently_closed = cp_remarks and (
                        "demolished" in cp_remarks.lower() or 
                        "permanently closed" in cp_remarks.lower() or 
                        "closed permanently" in cp_remarks.lower() or
                        cp_remarks.strip().lower() == "closed" or
                        cp_remarks.strip().lower() == "carpark closed" or
                        cp_remarks.strip().lower() == "carpark is closed" or
                        (wd1 and wd1.strip().lower() == "carpark closed") or
                        (wd1 and wd1.strip().lower() == "car park closed")
                    )
                    if is_permanently_closed:
                        exclude = True
                        
                    if exclude:
                        continue
                        
                    scraped_data.append({
                        "id": str(cp_id),
                        "name": detail.get("name"),
                        "road": detail.get("road"),
                        "address": address,
                        "postalCode": postal,
                        "location": {
                            "lat": detail.get("latitude"),
                            "lng": detail.get("longitude")
                        },
                        "textRates": {
                            "wd1": wd1,
                            "wd2": wd2,
                            "sat1": sat1,
                            "sat2": sat2,
                            "sun1": sun1,
                            "sun2": sun2,
                            "remarks": detail.get("remarks")
                        },
                        "rates": parsed_rates,
                        "isPrivate": is_private,
                        "isSeasonOnly": is_season_only,
                        "isClosedText": is_closed
                    })
                    success_count += 1
            # Delay to be polite
            time.sleep(0.05)
        except Exception as e:
            print(f"Error scraping ID {cp_id}: {e}")
            time.sleep(0.5)

    print(f"Scrape completed. Total successful: {success_count}/{len(carparks)}")
    
    # Save output
    os.makedirs(os.path.dirname(OUTPUT_FILE), exist_ok=True)
    try:
        with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
            json.dump(scraped_data, f, indent=2)
        print(f"Saved database to {OUTPUT_FILE}!")
        
        # Save as JS for local CORS-free loading
        js_file = OUTPUT_FILE.replace(".json", ".js")
        with open(js_file, "w", encoding="utf-8") as f:
            f.write("const PARKING_RATES_DATA = " + json.dumps(scraped_data, indent=2) + ";\n")
        print(f"Saved JS database to {js_file}!")
    except Exception as e:
        print(f"Error saving database: {e}")

if __name__ == "__main__":
    main()
