# Adventure Planner

Adventure Planner is a lightweight web app that helps you pick the best nearby beach for a sunset. The long-term vision is to grow this into a broader outdoor decision engine (sunset + stargazing + night-sky planning).

---

## What You Can Do Today (P0)

- Get the **top 3 recommended nearby beaches** for a sunset based on:
  - Cloudiness / sky clarity (currently simplified)
  - Arrival feasibility (can you make it before sunset)
  - Comfort (temperature / wind; currently simplified)
  - Basic OSM signal strength
- Use it in two modes:
  - **Now** (depart immediately)
  - **Later** (provide a departure time)

---

## How to Use the App

### Local Web UI (current state)
Right now the UI is still the default Next.js starter page. The “app” behavior is exposed via the API endpoint below.

### API Usage (recommended for now)

#### 1) Start the dev server
```bash
npm run dev
```
## Dummy API to check if GET request goes through

```
curl -i "http://localhost:3000/api/recommendations?lat=37.7749&lon=-122.4194&radius_miles=30&mode=now"
```
