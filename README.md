# Silent SOS Emergency Web App

A MERN web app that lets someone ask for help without speaking. One press-and-hold sends their live location to trusted contacts by SMS, email and in-app alert, then tracks the alert from **sent** to **acknowledged** to **resolved**.

- **Frontend:** React 18, Vite, React Router, Leaflet (OpenStreetMap), Socket.IO client
- **Backend:** Node.js 18.11+, Express 4, Mongoose 8, Socket.IO, JWT auth, bcrypt
- **Database:** MongoDB
- **Notifications:** SMS through Twilio's REST API, email through any SMTP server (Nodemailer). With no provider configured, messages are printed to the server console so you can develop end to end.

## Quick start

Prerequisites: Node.js 18.11 or newer and a MongoDB instance (local, Docker or Atlas).

```bash
# 1. install everything
npm run setup

# 2. configure the API
cp server/.env.example server/.env      # then edit MONGO_URI and JWT_SECRET

# 3. (optional) create an admin account from ADMIN_* values in server/.env
npm run seed:admin

# 4. run API (http://localhost:5000) and client (http://localhost:5173) together
npm run dev
```

Open http://localhost:5173, register, add a trusted contact, and hold the button on the home screen. In development the SMS and email text appears in the API console, including the tracking link a contact would receive. Open that link in another browser window to see the contact's live view.

### Try the in-app alert
Register a second account using the same email or phone number as the contact you added to the first account. When the first account sends a request, the second account sees a banner and an **Alerts for you** entry immediately.

## Project structure

```
silent-sos/
├─ client/                     React app (Vite)
│  └─ src/
│     ├─ api/client.js         fetch wrapper with JWT handling
│     ├─ context/              AuthContext, SosContext (trigger, geolocation, live sharing)
│     ├─ components/           SosButton, MapView, Timeline, Layout, ...
│     └─ pages/                Dashboard, Contacts, History, AlertDetail, Incoming, Settings, Admin, Track
├─ server/
│  ├─ src/
│  │  ├─ config/               env + database
│  │  ├─ models/               User (with emergencyContacts), Alert
│  │  ├─ controllers/          auth, contacts, alerts, track, admin
│  │  ├─ routes/index.js       all API routes
│  │  ├─ services/             alertService (dispatch + status changes), notify (SMS/email), socket
│  │  └─ middleware/           auth, sanitize, error handling
│  └─ scripts/seedAdmin.js
├─ docs/PRD.md                 product requirements + technical documentation
├─ Dockerfile, docker-compose.yml
└─ package.json                root scripts
```

## How it works

1. **Trigger.** `POST /api/alerts` creates the alert with the last known GPS fix and returns immediately (target under 2 s). Notifications are sent after the response, so delivery never slows the trigger.
2. **Notify.** Each contact gets SMS and/or email containing a private tracking link. Contacts who also have an account get an in-app alert over Socket.IO.
3. **Share location.** While an alert is open, the browser's `watchPosition` uploads the position at most every 5 s (and every 15 s when standing still). Contacts and admins see it live.
4. **Track status.** Contacts press **I am responding** on the tracking page (or in-app, or an admin acknowledges). Every step is time-stamped in the alert's activity log. The person ends sharing with **Mark myself safe**.

### Discreet by design
- The button gives no sound or on-screen confirmation. By default (discreet mode) the screen looks unchanged after a request is sent. A small dot beside the logo shows an open alert and links to its status.
- A short vibration confirms the send on phones that support it (can be turned off in Settings).
- If a send fails, the app retries three times, then shows a plain notice. A silent failure would be more dangerous than a visible one.
- Tracking links stop showing location the moment the alert is resolved and expire 24 hours later.

## Environment variables (`server/.env`)

| Variable | Purpose |
| --- | --- |
| `MONGO_URI` | MongoDB connection string |
| `JWT_SECRET` | Long random string. Required in production |
| `CLIENT_URL` | Public URL of the web app. Used in the tracking links sent to contacts |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM` | Email delivery (optional) |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER` | SMS delivery (optional) |
| `ADMIN_NAME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` | Used by `npm run seed:admin` |

## Production and deployment

```bash
# Docker (API + built client + MongoDB)
export JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(48).toString('hex'))")
export CLIENT_URL=https://sos.example.com
docker compose up --build -d
```

Or without Docker: `npm run build`, then run the API with `NODE_ENV=production`. The API serves `client/dist` itself, so one process handles the site, API and WebSockets.

**Required for real use**
- **HTTPS.** Browsers only allow geolocation on secure origins (localhost is exempt). Put the app behind TLS, for example with Nginx, Caddy or your cloud load balancer, and enable WebSocket upgrade for `/socket.io`.
- **Real SMS/email credentials.** Without them, messages are only logged.
- **Map tiles.** The default OpenStreetMap tile server is fine for development and light use. For production traffic, use a tile provider you have an agreement with and update the URL in `client/src/components/MapView.jsx` (and the `img-src` entry in `server/src/app.js`).
- **Lockfiles.** This project ships without `package-lock.json`. Run `npm install` in `server/` and `client/` once and commit the generated lockfiles.

## API summary

| Method | Path | Notes |
| --- | --- | --- |
| POST | `/api/auth/register`, `/api/auth/login` | Returns `{ token, user }` |
| GET / PUT | `/api/auth/me` | Profile and settings |
| GET / POST / PUT / DELETE | `/api/contacts[/:id]` | Trusted contacts (max 10) |
| POST | `/api/alerts` | Trigger. Body: `{ source, location: { lat, lng, accuracy } }` |
| GET | `/api/alerts`, `/api/alerts/active`, `/api/alerts/incoming`, `/api/alerts/:id` | History, open alert, alerts addressed to me, detail |
| POST | `/api/alerts/:id/location` | Live location update |
| POST | `/api/alerts/:id/resolve`, `/api/alerts/:id/feedback` | End alert, 1-5 rating |
| POST | `/api/alerts/:id/acknowledge` | In-app acknowledgement by a signed-in contact |
| GET / POST | `/api/track/:token`, `/api/track/:token/acknowledge` | Public, token is the credential |
| GET | `/api/admin/stats`, `/api/admin/alerts?filter=` | Admin only |
| POST | `/api/admin/alerts/:id/acknowledge`, `/api/admin/alerts/:id/resolve` | Admin only |
| GET | `/api/health` | Uptime and database state |

Realtime events (Socket.IO): `alert:updated`, `alert:location`, `alert:changed` (admins), `incoming:refresh`.

## Known limitations (Phase 1)

- **Browsers throttle background tabs.** Location sharing runs only while the page stays open. Many phones pause web pages when the screen locks. This is the main limit of a web-only product and the strongest reason to plan a native app or PWA with background support in a later phase.
- Accuracy depends on the device GPS and on the person allowing location access.
- No automatic police or emergency-service integration (out of scope for Phase 1). The app is a supplement to, not a replacement for, local emergency numbers.
- Trusted contacts without an account respond through the tracking link. There is no automated escalation if no one acknowledges.
- The server could not be started and tested in the environment where this project was generated (no network access to install packages). All files were syntax-checked. Run through the checklist in `docs/PRD.md` after installing.
