# Product Roadmap

## Future Features

### Vehicle Data Enrichment
- **Title Status Integration**: Implement a reliable way to fetch or manually input vehicle title status (Clean, Rebuilt, Salvage). Currently hidden from UI as free APIs do not provide this data reliably.
  - Investigate paid APIs (NMVTIS, Carfax, AutoCheck, VinAudit).
  - Add manual override/edit capability in VIN Scan Result.

### Analytics & Reporting
- **Inventory Snapshots History for Analysis**: Implement a history view for inventory assessments for each tenant.
  - Data collection is already implemented in backend (inventory_snapshots_unified).
  - Create a frontend view to visualize trends (Price, Mileage, Top Brands) over time.