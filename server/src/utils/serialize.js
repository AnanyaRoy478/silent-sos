const iso = (d) => (d ? new Date(d).toISOString() : null);

export const serializeLocation = (l) =>
  l && l.lat != null ? { lat: l.lat, lng: l.lng, accuracy: l.accuracy ?? null, updatedAt: iso(l.updatedAt) } : null;

const actor = (a) => (a && a.name ? { name: a.name, via: a.via } : null);
const logs = (list) => list.map((l) => ({ event: l.event, message: l.message, by: l.by, at: iso(l.at) }));
const notifications = (list) =>
  list.map((n) => ({ contactName: n.contactName, channel: n.channel, status: n.status, error: n.error || null, at: iso(n.at) }));

// Everything the person who triggered the alert may see.
export function serializeOwner(a, { withPath = true } = {}) {
  return {
    id: a.id,
    status: a.status,
    isActive: a.isActive,
    triggerSource: a.triggerSource,
    triggeredAt: iso(a.triggeredAt),
    acknowledgedAt: iso(a.acknowledgedAt),
    acknowledgedBy: actor(a.acknowledgedBy),
    resolvedAt: iso(a.resolvedAt),
    resolvedBy: actor(a.resolvedBy),
    deliveryTimeMs: a.deliveryTimeMs ?? null,
    responseTimeMs: a.responseTimeMs ?? null,
    trackingToken: a.trackingToken,
    location: serializeLocation(a.location),
    path: withPath ? a.path.map((p) => [p.lat, p.lng]) : undefined,
    notifications: notifications(a.notifications),
    logs: logs(a.logs),
    feedbackRating: a.feedbackRating ?? null,
  };
}

// What a trusted contact sees through the tracking link. No contact list, no location after resolution.
export function serializePublic(a) {
  const resolved = a.status === 'resolved';
  return {
    userName: a.userName,
    status: a.status,
    triggeredAt: iso(a.triggeredAt),
    acknowledgedAt: iso(a.acknowledgedAt),
    resolvedAt: iso(a.resolvedAt),
    location: resolved ? null : serializeLocation(a.location),
    path: resolved ? [] : a.path.map((p) => [p.lat, p.lng]),
    logs: a.logs
      .filter((l) => ['triggered', 'acknowledged', 'resolved'].includes(l.event))
      .map((l) => ({
        event: l.event,
        message: l.event === 'triggered' ? `${a.userName} sent a silent request for help` : l.message,
        at: iso(l.at),
      })),
  };
}

// Compact view for a registered contact's "alerts for you" list.
export function serializeIncoming(a) {
  const resolved = a.status === 'resolved';
  return {
    id: a.id,
    token: a.trackingToken,
    userName: a.userName,
    status: a.status,
    triggeredAt: iso(a.triggeredAt),
    acknowledgedAt: iso(a.acknowledgedAt),
    resolvedAt: iso(a.resolvedAt),
    location: resolved ? null : serializeLocation(a.location),
  };
}

// Admin view. `a.user` should be populated with name/email/phone.
export function serializeAdmin(a) {
  const u = a.user && a.user.name ? a.user : null;
  const base = serializeOwner(a, { withPath: false });
  delete base.trackingToken;
  return {
    ...base,
    user: u ? { id: u.id, name: u.name, email: u.email, phone: u.phone } : { id: String(a.user), name: a.userName },
  };
}
