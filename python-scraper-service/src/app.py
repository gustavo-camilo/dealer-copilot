"""
Flask API for Python-based vehicle scraper
Compatible with existing Playwright service endpoints
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
from .scraper import VehicleScraper
import os

app = Flask(__name__)
CORS(app)

# Global scraper instance (reuse browser)
scraper = None

def get_scraper():
    """Get or create scraper instance"""
    global scraper
    if scraper is None:
        scraper = VehicleScraper()
    return scraper

@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({
        "status": "ok",
        "service": "python-scraper",
        "version": "1.0.0"
    })

@app.route('/scrape', methods=['POST'])
def scrape():
    """
    Scrape endpoint
    POST /scrape
    Body: { "url": "https://dealer.com" }
    """
    try:
        data = request.get_json()

        if not data or 'url' not in data:
            return jsonify({
                "success": False,
                "error": "Missing 'url' in request body"
            }), 400

        url = data['url']
        timeout_ms = None

        # Optional timeout override (milliseconds)
        if isinstance(data.get('timeout'), (int, float)):
            try:
                timeout_ms = max(5000, min(int(data['timeout']), 180000))  # clamp 5s-180s
            except Exception:
                timeout_ms = None

        # Get scraper and scrape
        s = get_scraper()
        result = s.scrape(url, timeout_ms=timeout_ms)

        return jsonify(result)

    except Exception as e:
        print(f"❌ API Error: {str(e)}")
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

@app.route('/close', methods=['POST'])
def close():
    """Close browser (cleanup endpoint)"""
    global scraper
    if scraper:
        scraper.close()
        scraper = None
    return jsonify({"status": "closed"})

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 3000))
    print(f"""
🐍 Python Scraper Service
   Running on port {port}
   Health check: http://localhost:{port}/health
   Scrape endpoint: POST http://localhost:{port}/scrape

✅ Ready to accept requests
""")
    app.run(host='0.0.0.0', port=port, debug=False)
