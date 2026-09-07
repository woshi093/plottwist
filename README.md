# PlotTwist

A cooperative group media consensus web app, built to match the Master System Designs
(Task 5) exactly - same variable names, component names, and logic as the pseudocode
and UI Annotations.

## Structure

```
plottwist/
  server/     Node.js + Express + Socket.io backend (room state, filtering, scoring, veto, live sync)
  client/     React + Vite frontend (Join/Create Room, Room Lobby, Swipe Deck, Results Dashboard)
```

## How the code maps to your Task 5 documentation

| Master Pseudocode procedure | Where it lives |
|---|---|
| `GenerateRoomCode()` | `server/server.js` |
| `ValidateRoomCode()` | `server/server.js` |
| `HostSetFilters()` / `FilterCatalogue()` | `server/server.js` |
| `ProcessSwipe()` (+1 / -1) | `server/server.js` -> `user_swipe` event |
| Two-step veto (`btn_veto` -> `modal_veto_confirm`) | `client/src/screens/SwipeDeck.jsx` + `server/server.js` -> `veto_confirm` event |
| `BroadcastLiveUpdate()` | `server/server.js` -> `io.to(Room_Code).emit(...)` |

Component names from the UI Annotations table (`btn_veto`, `txt_room_code_input`,
`lbl_room_code`, `modal_veto_confirm`, `list_results_ranked`, etc.) are used directly
as CSS class names in `client/src/styles.css` and the JSX files, so you can trace every
element straight back to your Task 5 spec.

## Running it locally

You'll need [Node.js](https://nodejs.org) installed (v18+).

**1. Start the backend:**
```bash
cd server
npm install
npm start
```
This runs on `http://localhost:4000`.

**2. In a second terminal, start the frontend:**
```bash
cd client
npm install
npm run dev
```
This runs on `http://localhost:5173`.

**3. Open `http://localhost:5173` in two browser tabs (or two devices on the same
Wi-Fi, using your computer's local IP instead of `localhost`) to test the multi-device
sync - create a room in one tab and join with the code in the other.**

## Notes for your SAC

- The movie catalogue is a small seed list in `server/catalogue.js` - swap in your own
  titles/posters there.
- This has been tested end-to-end (room creation, join, live lobby sync, filter
  broadcast, +1/-1 scoring, two-step veto with correct exclusion, and the ranked
  results dashboard) using an automated two-browser test.
- To deploy so it's reachable outside your own machine (e.g. for real user testing),
  you'd host `server/` somewhere like Render or Railway, and set `VITE_SERVER_URL`
  when building `client/` to point at that URL.

## Deploying online (so it doesn't depend on your laptop)

See the step-by-step deployment guide provided separately. In short: the backend
(`server/`) gets deployed as a "Web Service" and the frontend (`client/`) gets deployed
as a "Static Site", both from a GitHub repo, using a free host like Render. The
frontend needs one environment variable, `VITE_SERVER_URL`, set to the backend's live
URL before it's built.

