import os
import re
import datetime
import requests
from bs4 import BeautifulSoup
from flask import Flask, jsonify, render_template, request

app = Flask(__name__)

FEED_URL = "https://docs.cloud.google.com/feeds/bigquery-release-notes.xml"

# In-memory cache for simplicity
cache = {
    "data": None,
    "last_fetched": None
}
CACHE_DURATION = datetime.timedelta(minutes=15)

def parse_xml_feed(xml_content):
    soup = BeautifulSoup(xml_content, "xml")
    entries = soup.find_all("entry")
    
    parsed_updates = []
    
    for entry in entries:
        date_str = entry.find("title").text.strip() if entry.find("title") else "Unknown Date"
        
        # Extract link
        link_el = entry.find("link", rel="alternate")
        link = link_el["href"] if link_el and link_el.has_attr("href") else ""
        if not link:
            link_el = entry.find("link")
            link = link_el["href"] if link_el and link_el.has_attr("href") else ""
            
        content_el = entry.find("content")
        if not content_el:
            continue
            
        html_content = content_el.text
        html_soup = BeautifulSoup(html_content, "html.parser")
        
        # A single entry can contain multiple sub-updates under <h3> headers.
        # We parse each <h3> as a separate update item.
        current_type = "Update"
        current_elements = []
        
        # Helper to push updates
        def push_current(u_type, elements):
            if not elements:
                return
            
            # Reconstruct HTML and clean text
            html_str = "".join(str(el) for el in elements)
            text_str = "".join(el.get_text() for el in elements).strip()
            text_str = re.sub(r'\s+', ' ', text_str)
            
            # Clean type and date to make a nice anchor
            clean_date = date_str.replace(",", "").replace(" ", "_")
            clean_type = u_type.lower().replace(" ", "_")
            # Create a simple hash to differentiate updates on the same day
            item_hash = abs(hash(html_str)) % 100000
            unique_id = f"{clean_date}_{clean_type}_{item_hash}"
            
            # Anchor link for Google Cloud documentation
            specific_link = link
            if link and "#" not in link:
                specific_link = f"{link}#{clean_date}"
                
            parsed_updates.append({
                "id": unique_id,
                "date": date_str,
                "type": u_type,
                "content_html": html_str,
                "content_text": text_str,
                "link": specific_link
            })

        # Loop through the children of html_soup to split by <h3>
        for child in html_soup.children:
            if child.name == "h3":
                push_current(current_type, current_elements)
                current_type = child.text.strip()
                current_elements = []
            elif child.name is not None:
                current_elements.append(child)
                
        # Push the remaining elements
        push_current(current_type, current_elements)
            
    return parsed_updates

def fetch_and_parse_notes(force_refresh=False):
    now = datetime.datetime.now()
    
    # Check if cache is valid
    if not force_refresh and cache["data"] is not None and cache["last_fetched"] is not None:
        if now - cache["last_fetched"] < CACHE_DURATION:
            return cache["data"], False
            
    # Fetch from source
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36"
    }
    
    response = requests.get(FEED_URL, headers=headers, timeout=15)
    response.raise_for_status()
    
    updates = parse_xml_feed(response.text)
    
    # Update cache
    cache["data"] = updates
    cache["last_fetched"] = now
    
    return updates, True

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/api/releases")
def get_releases():
    force_refresh = request.args.get("refresh", "false").lower() == "true"
    try:
        updates, fetched_new = fetch_and_parse_notes(force_refresh=force_refresh)
        return jsonify({
            "success": True,
            "refreshed": fetched_new,
            "last_fetched": cache["last_fetched"].isoformat() if cache["last_fetched"] else None,
            "count": len(updates),
            "data": updates
        })
    except Exception as e:
        # Fallback to cache if we hit an error (e.g. network down)
        if cache["data"] is not None:
            return jsonify({
                "success": True,
                "refreshed": False,
                "last_fetched": cache["last_fetched"].isoformat() if cache["last_fetched"] else None,
                "count": len(cache["data"]),
                "data": cache["data"],
                "warning": f"Failed to fetch live data ({str(e)}). Serving cached data."
            })
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=True)
