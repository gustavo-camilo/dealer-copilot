"""
Python-based scraper using undetected-chromedriver for better bot bypass
4-Tier Extraction System:
- Tier 1: API Interception (Shopify, JSON APIs)
- Tier 2: Structured Data (JSON-LD, Schema.org)
- Tier 3: Selector Discovery (CSS patterns)
- Tier 4: LLM Vision (Claude)
"""

import undetected_chromedriver as uc
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException, WebDriverException
from bs4 import BeautifulSoup
import json
import re
import time
import base64
from typing import List, Dict, Optional, Any
from datetime import datetime
import requests
from anthropic import Anthropic
import os

class VehicleScraper:
    def __init__(self):
        self.driver = None
        self.anthropic = Anthropic(api_key=os.getenv('ANTHROPIC_API_KEY'))

    def initialize_driver(self):
        """Initialize undetected Chrome driver"""
        if self.driver:
            return

        print("🚀 Initializing undetected Chrome driver...")

        options = uc.ChromeOptions()
        options.add_argument('--headless=new')
        options.add_argument('--no-sandbox')
        options.add_argument('--disable-dev-shm-usage')
        options.add_argument('--disable-blink-features=AutomationControlled')
        options.add_argument('--disable-web-security')
        options.add_argument('--ignore-certificate-errors')
        options.add_argument('--window-size=1920,1080')

        # Use undetected-chromedriver (better bot bypass than Playwright)
        self.driver = uc.Chrome(options=options, version_main=None)

        print("✅ Driver initialized with anti-detection")

    def scrape(self, url: str) -> Dict[str, Any]:
        """Main scrape orchestrator"""
        start_time = time.time()

        try:
            self.initialize_driver()

            print(f"\n📨 Scraping: {url}")

            # Navigate to page
            print("📄 Loading page...")
            self.driver.set_page_load_timeout(30)

            try:
                self.driver.get(url)
            except TimeoutException:
                print("⚠️  Page load timeout, continuing anyway...")

            # Wait a bit for dynamic content
            time.sleep(2)

            # Add human-like behavior
            self._simulate_human_behavior()

            # Detect if Shopify and fetch API
            is_shopify = self._detect_shopify()
            shopify_data = None

            if is_shopify:
                print("🛍️  Detected Shopify store, fetching products API...")
                shopify_data = self._fetch_shopify_api(url)

            # Try all 4 tiers in order
            result = None

            # Tier 1: API Interception
            if not result and shopify_data:
                result = self._tier1_api(shopify_data, url)

            # Tier 2: Structured Data
            if not result:
                result = self._tier2_structured_data()

            # Tier 3: Selector Discovery
            if not result:
                result = self._tier3_selectors()

            # Tier 4: Claude Vision
            if not result:
                result = self._tier4_vision(url)

            # If still no result, debug
            if not result:
                self._debug_failed_extraction()
                return {
                    "success": False,
                    "vehicles": [],
                    "tier": "none",
                    "confidence": "low",
                    "error": "No extraction method succeeded",
                    "pagesScraped": 1,
                    "duration": int((time.time() - start_time) * 1000)
                }

            print(f"\n✅ SUCCESS: Extracted {len(result['vehicles'])} vehicles using Tier {result['tier']}")
            print(f"   Duration: {int((time.time() - start_time) * 1000)}ms")

            result['duration'] = int((time.time() - start_time) * 1000)
            return result

        except Exception as e:
            print(f"❌ Scraping error: {str(e)}")
            return {
                "success": False,
                "vehicles": [],
                "tier": "none",
                "confidence": "low",
                "error": str(e),
                "pagesScraped": 0,
                "duration": int((time.time() - start_time) * 1000)
            }

    def _simulate_human_behavior(self):
        """Add human-like delays and interactions"""
        try:
            # Random scroll
            self.driver.execute_script("window.scrollTo(0, 300);")
            time.sleep(0.5)
            self.driver.execute_script("window.scrollTo(0, 0);")
        except:
            pass

    def _detect_shopify(self) -> bool:
        """Detect if site is Shopify"""
        try:
            # Check for Shopify indicators
            page_source = self.driver.page_source

            if 'Shopify' in page_source or 'shopify' in page_source:
                return True

            # Check for Shopify meta tags
            soup = BeautifulSoup(page_source, 'html.parser')
            shopify_meta = soup.find('meta', {'name': 'shopify-digital-wallet'})

            return shopify_meta is not None

        except:
            return False

    def _fetch_shopify_api(self, url: str) -> Optional[Dict]:
        """Fetch Shopify products.json API"""
        try:
            from urllib.parse import urlparse

            parsed = urlparse(url)
            base_url = f"{parsed.scheme}://{parsed.netloc}"

            api_urls = [
                f"{base_url}/products.json",
                f"{base_url}/collections/all/products.json"
            ]

            for api_url in api_urls:
                try:
                    response = requests.get(api_url, timeout=10, headers={
                        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
                    })

                    if response.ok:
                        data = response.json()
                        if data.get('products'):
                            print(f"✅ Fetched Shopify API: {api_url} ({len(data['products'])} products)")
                            return data

                except Exception as e:
                    print(f"⚠️  Failed to fetch {api_url}: {str(e)}")
                    continue

            return None

        except Exception as e:
            print(f"⚠️  Shopify API fetch error: {str(e)}")
            return None

    def _tier1_api(self, shopify_data: Dict, url: str) -> Optional[Dict]:
        """Tier 1: Parse API data (Shopify)"""
        print("\n🔹 TIER 1: Parsing API data...")

        try:
            products = shopify_data.get('products', [])

            if not products:
                print("❌ No products in API response")
                return None

            print(f"🛍️  Parsing {len(products)} Shopify products...")

            vehicles = []

            for product in products:
                try:
                    vehicle = self._parse_shopify_product(product, url)
                    if vehicle:
                        vehicles.append(vehicle)

                        # Log what we extracted
                        vin_str = f"VIN:{vehicle.get('vin', 'no VIN')[-6:]}" if vehicle.get('vin') else 'no VIN'
                        date_str = f"Listed:{vehicle.get('listing_date', '').split('T')[0]}" if vehicle.get('listing_date') else ''
                        print(f"  📦 {vehicle.get('year', '?')} {vehicle.get('make', '?')} {vehicle.get('model', '?')} {vin_str} {date_str}")

                except Exception as e:
                    print(f"⚠️  Failed to parse product: {str(e)}")
                    continue

            if vehicles:
                print(f"✅ Tier 1 (API): Extracted {len(vehicles)} vehicles")
                return {
                    "success": True,
                    "vehicles": vehicles,
                    "tier": "api",
                    "confidence": "high",
                    "pagesScraped": 1
                }

            return None

        except Exception as e:
            print(f"❌ Tier 1 failed: {str(e)}")
            return None

    def _parse_shopify_product(self, product: Dict, base_url: str) -> Optional[Dict]:
        """Parse Shopify product into vehicle"""
        try:
            title = product.get('title', '')

            # Extract year, make, model from title
            year_match = re.search(r'\b(19|20)\d{2}\b', title)
            year = int(year_match.group(0)) if year_match else None

            # Common car makes
            makes = ['Toyota', 'Ford', 'Chevrolet', 'Honda', 'Nissan', 'Jeep', 'BMW', 'Mercedes',
                     'Audi', 'Volkswagen', 'Hyundai', 'Kia', 'Mazda', 'Subaru', 'GMC', 'Ram',
                     'Dodge', 'Cadillac', 'Lexus', 'Acura', 'Infiniti', 'Buick', 'Chrysler']

            make = None
            model = None

            for m in makes:
                if m.lower() in title.lower():
                    make = m
                    # Model is usually after make
                    pattern = rf'{m}\s+([A-Z0-9\-]+)'
                    model_match = re.search(pattern, title, re.IGNORECASE)
                    if model_match:
                        model = model_match.group(1).upper()
                    break

            # Extract price
            price = None
            if product.get('variants'):
                variant = product['variants'][0]
                if variant.get('price'):
                    price = float(variant['price'])

            # Extract mileage
            mileage = None
            mileage_match = re.search(r'(\d{1,3}(?:,\d{3})*)\s*(miles?|mi)\b', title, re.IGNORECASE)
            if mileage_match:
                miles = int(mileage_match.group(1).replace(',', ''))
                if 100 <= miles <= 500000:
                    mileage = miles
            elif product.get('body_html'):
                body_match = re.search(r'(\d{1,3}(?:,\d{3})*)\s*(miles?|mi)\b', product['body_html'], re.IGNORECASE)
                if body_match:
                    miles = int(body_match.group(1).replace(',', ''))
                    if 100 <= miles <= 500000:
                        mileage = miles

            # Extract VIN
            vin = None
            if product.get('body_html'):
                vin_match = re.search(r'\bVIN[:\s#]*([A-HJ-NPR-Z0-9]{17})\b', product['body_html'], re.IGNORECASE)
                if vin_match:
                    vin = vin_match.group(1).upper()

            # Image URL
            image_url = None
            if product.get('images') and len(product['images']) > 0:
                image_url = product['images'][0].get('src')

            # Detail URL
            detail_url = f"{base_url}/products/{product.get('handle', '')}" if product.get('handle') else None

            # Listing date
            listing_date = None
            if product.get('published_at'):
                listing_date = product['published_at']
            elif product.get('created_at'):
                listing_date = product['created_at']

            vehicle = {
                "year": year,
                "make": make,
                "model": model,
                "price": price,
                "mileage": mileage,
                "vin": vin,
                "image_url": image_url,
                "detail_url": detail_url,
                "listing_date": listing_date,
                "stock_number": str(product.get('id', '')),
                "title": title
            }

            # Only return if we have at least year or make
            if year or make:
                return vehicle

            return None

        except Exception as e:
            print(f"⚠️  Parse error: {str(e)}")
            return None

    def _tier2_structured_data(self) -> Optional[Dict]:
        """Tier 2: Look for JSON-LD structured data"""
        print("\n🔹 TIER 2: Checking for structured data...")

        try:
            soup = BeautifulSoup(self.driver.page_source, 'html.parser')
            scripts = soup.find_all('script', {'type': 'application/ld+json'})

            vehicles = []

            for script in scripts:
                try:
                    data = json.loads(script.string)

                    # Handle arrays
                    if isinstance(data, list):
                        for item in data:
                            if item.get('@type') in ['Car', 'Vehicle', 'Product']:
                                vehicle = self._parse_structured_vehicle(item)
                                if vehicle:
                                    vehicles.append(vehicle)
                    elif data.get('@type') in ['Car', 'Vehicle', 'Product']:
                        vehicle = self._parse_structured_vehicle(data)
                        if vehicle:
                            vehicles.append(vehicle)

                except json.JSONDecodeError:
                    continue

            if vehicles:
                print(f"✅ Tier 2 (Structured): Extracted {len(vehicles)} vehicles")
                return {
                    "success": True,
                    "vehicles": vehicles,
                    "tier": "structured",
                    "confidence": "high",
                    "pagesScraped": 1
                }

            return None

        except Exception as e:
            print(f"❌ Tier 2 failed: {str(e)}")
            return None

    def _parse_structured_vehicle(self, data: Dict) -> Optional[Dict]:
        """Parse JSON-LD vehicle data"""
        try:
            vehicle = {}

            # Year
            if data.get('vehicleModelDate'):
                vehicle['year'] = int(data['vehicleModelDate'])
            elif data.get('modelDate'):
                vehicle['year'] = int(data['modelDate'])

            # Make/Model
            if data.get('brand'):
                brand = data['brand']
                if isinstance(brand, dict):
                    vehicle['make'] = brand.get('name')
                else:
                    vehicle['make'] = brand

            if data.get('model'):
                vehicle['model'] = data['model']
            elif data.get('name'):
                vehicle['model'] = data['name']

            # Price
            if data.get('offers'):
                offers = data['offers']
                if isinstance(offers, dict):
                    if offers.get('price'):
                        vehicle['price'] = float(offers['price'])
                elif isinstance(offers, list) and len(offers) > 0:
                    if offers[0].get('price'):
                        vehicle['price'] = float(offers[0]['price'])

            # Image
            if data.get('image'):
                image = data['image']
                if isinstance(image, list):
                    vehicle['image_url'] = image[0]
                elif isinstance(image, str):
                    vehicle['image_url'] = image

            # VIN
            if data.get('vehicleIdentificationNumber'):
                vehicle['vin'] = data['vehicleIdentificationNumber']

            # Mileage
            if data.get('mileageFromOdometer'):
                odometer = data['mileageFromOdometer']
                if isinstance(odometer, dict):
                    vehicle['mileage'] = int(odometer.get('value', 0))
                else:
                    vehicle['mileage'] = int(odometer)

            return vehicle if vehicle else None

        except:
            return None

    def _tier3_selectors(self) -> Optional[Dict]:
        """Tier 3: Try common CSS selectors"""
        print("\n🔹 TIER 3: Discovering selectors...")

        try:
            # Common vehicle listing selectors
            selectors = [
                '.vehicle-card', '.car-listing', '.inventory-item',
                '[data-vehicle]', '.product-item', '.vehicle-item'
            ]

            vehicles = []

            for selector in selectors:
                try:
                    elements = self.driver.find_elements(By.CSS_SELECTOR, selector)

                    if elements and len(elements) > 2:  # Found listings
                        print(f"📋 Found {len(elements)} potential vehicles with selector: {selector}")

                        for elem in elements[:20]:  # Limit to 20
                            try:
                                vehicle = self._parse_element_to_vehicle(elem)
                                if vehicle:
                                    vehicles.append(vehicle)
                            except:
                                continue

                        if vehicles:
                            break

                except:
                    continue

            if vehicles:
                print(f"✅ Tier 3 (Selectors): Extracted {len(vehicles)} vehicles")
                return {
                    "success": True,
                    "vehicles": vehicles,
                    "tier": "selectors",
                    "confidence": "medium",
                    "pagesScraped": 1
                }

            return None

        except Exception as e:
            print(f"❌ Tier 3 failed: {str(e)}")
            return None

    def _parse_element_to_vehicle(self, element) -> Optional[Dict]:
        """Parse a DOM element to extract vehicle data"""
        try:
            text = element.text

            # Extract year
            year_match = re.search(r'\b(19|20)\d{2}\b', text)
            year = int(year_match.group(0)) if year_match else None

            # Extract price
            price_match = re.search(r'\$[\d,]+', text)
            price = float(price_match.group(0).replace('$', '').replace(',', '')) if price_match else None

            # Extract mileage
            mileage_match = re.search(r'(\d{1,3}(?:,\d{3})*)\s*(?:miles|mi)', text, re.IGNORECASE)
            mileage = int(mileage_match.group(1).replace(',', '')) if mileage_match else None

            # Try to get link
            detail_url = None
            try:
                link = element.find_element(By.TAG_NAME, 'a')
                detail_url = link.get_attribute('href')
            except:
                pass

            vehicle = {
                "year": year,
                "price": price,
                "mileage": mileage,
                "detail_url": detail_url,
                "title": text[:100]
            }

            return vehicle if (year or price) else None

        except:
            return None

    def _tier4_vision(self, url: str) -> Optional[Dict]:
        """Tier 4: Use Claude Vision as last resort"""
        print("\n🔹 TIER 4: Using Claude Vision (last resort)...")

        try:
            # Take screenshot
            screenshot_b64 = self.driver.get_screenshot_as_base64()

            # Check size
            size_mb = (len(screenshot_b64) * 0.75) / (1024 * 1024)
            print(f"📸 Screenshot size: {size_mb:.2f} MB")

            if size_mb > 5:
                print("⚠️  Screenshot too large, skipping vision")
                return None

            # Call Claude
            prompt = """Analyze this car dealership website screenshot and extract vehicle inventory data.

Return ONLY valid JSON (no markdown, no code blocks) in this exact format:
{
  "vehicles": [
    {
      "year": 2020,
      "make": "Toyota",
      "model": "Camry",
      "price": 25000,
      "mileage": 35000,
      "stock_number": "ABC123"
    }
  ]
}

Requirements:
- Only include actual vehicles you can clearly see
- Year must be 1990-2025
- Price must be reasonable ($1000-$200000)
- Mileage must be reasonable (100-500000)
- If you can't find vehicles, return {"vehicles": []}
"""

            response = self.anthropic.messages.create(
                model="claude-sonnet-4-5-20250929",
                max_tokens=4096,
                messages=[{
                    "role": "user",
                    "content": [
                        {
                            "type": "image",
                            "source": {
                                "type": "base64",
                                "media_type": "image/png",
                                "data": screenshot_b64
                            }
                        },
                        {
                            "type": "text",
                            "text": prompt
                        }
                    ]
                }]
            )

            # Parse response
            response_text = response.content[0].text.strip()

            # Remove markdown code blocks if present
            response_text = re.sub(r'^```json\s*', '', response_text)
            response_text = re.sub(r'^```\s*', '', response_text)
            response_text = re.sub(r'\s*```$', '', response_text)

            data = json.loads(response_text)
            vehicles = data.get('vehicles', [])

            if vehicles:
                print(f"✅ Tier 4 (Vision): Extracted {len(vehicles)} vehicles")
                return {
                    "success": True,
                    "vehicles": vehicles,
                    "tier": "vision",
                    "confidence": "medium",
                    "pagesScraped": 1
                }

            print("❌ No valid vehicles extracted by Claude")
            return None

        except Exception as e:
            print(f"❌ Tier 4 failed: {str(e)}")
            return None

    def _debug_failed_extraction(self):
        """Debug why extraction failed"""
        try:
            current_url = self.driver.current_url
            title = self.driver.title
            page_source = self.driver.page_source
            html_length = len(page_source)

            soup = BeautifulSoup(page_source, 'html.parser')
            body_text = soup.body.get_text()[:500] if soup.body else ""

            print("\n❌ EXTRACTION FAILED - Debug Info:")
            print(f"   Current URL: {current_url}")
            print(f"   Page Title: {title}")
            print(f"   HTML Length: {html_length} chars")
            print(f"   Body Text (first 500 chars): {body_text}")

            # Check for bot detection
            text_lower = body_text.lower()
            indicators = {
                "hasAccessDenied": "access denied" in text_lower or "forbidden" in text_lower,
                "hasCaptcha": "captcha" in text_lower or "verify you are human" in text_lower,
                "hasCloudflare": "cloudflare" in text_lower or "checking your browser" in text_lower,
                "hasBlankPage": len(body_text.strip()) < 50,
                "hasRedirect": "redirect" in text_lower
            }

            print(f"   Bot Detection Indicators: {indicators}")

        except Exception as e:
            print(f"   Could not gather debug info: {str(e)}")

    def close(self):
        """Clean up driver"""
        if self.driver:
            try:
                self.driver.quit()
            except:
                pass
            self.driver = None
