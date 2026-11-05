# Silent SOS Emergency Web App: PRD and Technical Documentation

## 1. Summary
Silent SOS is a web platform for sending a non-verbal emergency alert with a single action. It notifies trusted contacts with the user's live location, and tracks the alert until it is resolved. It is designed for moments when calling or speaking is unsafe or impossible.

## 2. Problem
In harassment, stalking, domestic abuse, medical distress and public safety threats, people often cannot call or speak, panic makes it hard to describe a location, and response is slow. Existing emergency channels depend on voice.

## 3. Objectives
**Primary:** one-click silent alerts, real-time location sharing, shorter response time, better personal safety.
**Secondary:** a discreet alternative to calling, trusted-contact networks, reliable data for responders, a base that can scale to cities and campuses.

## 4. Scope
| In scope (Phase 1) | Out of scope (Phase 1) |
| --- | --- |
| Web alert system | Native mobile apps |
| One-click / long-press trigger | Automated police integration |
| Real-time location sharing | AI threat detection |
| Contact notifications (SMS, email, in-app) | |
| Alert status tracking | |
| Admin monitoring and basic reporting | |

## 5. Functional requirements and where they live

| Requirement | Implementation |
| --- | --- |
| One-click or long-press activation | `SosButton.jsx`. Hold ~1.2 s (default) or single tap, chosen in Settings. Keyboard Space/Enter supported |
| No sound or visible alert on device | Discreet mode (default): no confirmation on screen, no audio. Optional short vibration. Failures are shown, because a silent failure is dangerous |
| GPS live tracking until resolved | `SosContext.jsx` uses `watchPosition`, uploads at most every 5 s with a 15 s heartbeat, until `POST /alerts/:id/resolve` |
| Pre-configured trusted contacts | `/contacts` page, stored on the `User` document (max 10) |
| SMS / email / in-app notification | `services/alertService.js` + `services/notify.js` (Twilio REST, Nodemailer) and Socket.IO for in-app |
| Sent, acknowledged, resolved states with time-stamped logs | `Alert.status` plus `Alert.logs[]`. Atomic transitions in `alertService.js` |
| Admin: view active alerts, basic reporting | `/admin` (Monitor): live map, filters, acknowledge/resolve, KPI figures, 7-day chart |

## 6. Non-functional requirements

| Requirement | How it is met |
| --- | --- |
| Response under 2 s | The trigger endpoint does one insert and responds; notifications run after the response. The client sends the last known GPS fix it already holds, so it never waits for a new fix |
| High availability | Stateless API (JWT), MongoDB-backed, health endpoint at `/api/health`, graceful shutdown. Run 2+ instances behind a load balancer for 24x7 service. See scaling note below |
| Secure data handling and privacy | bcrypt (cost 12), JWT, Helmet + CSP, CORS allow-list, rate limits (auth, trigger, global), request sanitising against operator injection, 50 kb body limit, tracking tokens with 192 bits of entropy, tokens masked in logs, location hidden once an alert is resolved, tracking links expire 24 h after resolution, contacts never see each other |
| Mobile responsive | Responsive CSS, bottom navigation on phones, 44 px minimum touch targets |
| Reliable geolocation | High-accuracy GPS requested; accuracy radius is stored and drawn on the map; the UI states when location is blocked or unavailable |

**Scaling note.** Socket.IO rooms are held in memory per process. To run more than one API instance, add the Socket.IO Redis adapter (`@socket.io/redis-adapter`) so events reach clients connected to other instances.

## 7. User flow
1. Register, add trusted contacts.
2. Open the app (location permission requested on the home screen).
3. In an emergency, hold the button.
4. Contacts receive SMS/email with a private link, and in-app alerts if they have accounts.
5. Contacts open the link: live map, **I am responding** button.
6. The user ends sharing with **Mark myself safe** and may rate the experience.

## 8. Data model

**User**: `name`, `email` (unique), `phone`, `passwordHash`, `role` (user | admin), `emergencyContacts[]` (`name`, `relationship`, `phone`, `email`, `channels{sms,email}`), `settings` (`triggerMode`, `stealthMode`, `haptic`, `customMessage`).

**Alert**: `user`, `userName`, `trackingToken` (unique), `status` (sent | acknowledged | resolved), `isActive`, `triggerSource`, `triggeredAt`, `acknowledgedAt/By`, `resolvedAt/By`, `deliveryTimeMs`, `responseTimeMs`, `location{lat,lng,accuracy,updatedAt}`, `path[]` (last 500 fixes), `notifications[]` (contact, channel, status, error), `logs[]` (event, message, by, at), `contactUserIds[]`, `feedbackRating`.

A partial unique index on `{ user }` where `isActive: true` enforces one open alert per person and makes double triggers safe.

## 9. KPIs and how they are measured
| KPI | Source |
| --- | --- |
| Average alert delivery time | mean of `deliveryTimeMs` (trigger to all notifications dispatched) |
| Successful alerts sent | alerts where at least one notification was dispatched (`deliveryTimeMs` set) |
| Response acknowledgment rate | alerts with `acknowledgedAt` / total alerts |
| Average time to acknowledge | mean of `responseTimeMs` |
| System uptime | `/api/health` and process uptime are exposed. For a true uptime figure use an external monitor (UptimeRobot, Better Stack, cloud health checks) pointed at `/api/health` |
| User safety satisfaction | 1-5 rating collected after an alert is resolved |

All of the above appear on the Monitor page (`GET /api/admin/stats`). In development without SMS/email providers, "simulated" deliveries count as dispatched.

## 10. Assumptions and constraints
Users pre-configure contacts. Internet is available. Location services are enabled. Web only in Phase 1. Accuracy depends on device GPS. No direct emergency-service integration.

## 11. Risks and mitigations
| Risk | Mitigation |
| --- | --- |
| Browser pauses location sharing when the screen locks | Documented limitation. Phase 2: PWA with background sync or native app |
| Accidental triggers | Default press-and-hold; rate limit on triggers; easy "Mark myself safe" |
| Abuser sees the screen | Discreet mode; no sound; no on-screen confirmation by default |
| SMS/email provider outage | Channels are independent and the log records failures per contact. Add a second provider for redundancy |
| Contact does not respond | Visible status in the user's activity log. Phase 2: automatic escalation to the next contact |
| Misuse of the tracking link | 192-bit random token, location hidden after resolution, link expires after 24 h |

## 12. Smoke-test checklist after installing
1. `npm run setup`, copy `server/.env.example` to `server/.env`, start MongoDB, `npm run dev`.
2. Register user A. Add a contact with an email and phone number (E.164, for example `+14155550123`).
3. On the home screen, allow location and hold the button. The API console prints the SMS and email with the tracking link. The home screen shows nothing new apart from a small dot beside the logo.
4. Open the tracking link in a private window. You should see the map, then press **I am responding**. User A's dot turns teal and the activity log shows the acknowledgment.
5. Click the dot, then **Mark myself safe**. The tracking page switches to "is safe".
6. Run `npm run seed:admin`, sign in as the admin and open **Monitor** to see KPIs and the alert.
7. Register user B with the contact's email, repeat step 3, and confirm user B gets the in-app banner.

## 13. Roadmap (post Phase 1)
Installable PWA and background location, push notifications, escalation chains, SMS acknowledgment by reply, responder/volunteer network, geofenced campus deployments, audit exports, and integration with local emergency services where available.
