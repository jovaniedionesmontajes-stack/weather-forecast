# Bakeshop Weather v0.7.0

## What changed
- Production-oriented branch onboarding with exact coordinates.
- Coordinate preview, copy action, and Google Maps link.
- Coordinate validation endpoint that checks the weather provider before accepting a location.
- PAGASA radar link added to the rainfall monitoring area. PAGASA publishes radar/QPE products; the app treats this as an external official monitoring source rather than pretending it has a private radar API.
- Forecast records can store provider model/timezone metadata.
- Improved branch/location UX.

## Run
1. `npm install`
2. `npm run dev`
3. Optional backend: `npm run server`

## Sources
- Open-Meteo forecast API for coordinate-based weather variables.
- PAGASA radar page for Philippine rainfall/radar monitoring.
