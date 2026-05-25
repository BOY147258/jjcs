// Client-side wrapper for the JingJi REST API
const BASE = '';

async function _req(method, path, body) {
  try {
    const opts = { method, headers: { 'Content-Type': 'application/json' } };
    if (body) opts.body = JSON.stringify(body);
    const r = await fetch(BASE + path, opts);
    if (!r.ok) return null;
    return r.json();
  } catch {
    return null;  // offline / unreachable — caller handles gracefully
  }
}

export const ApiClient = {
  // Meets
  getMeets:   ()       => _req('GET',  '/api/meets'),
  createMeet: (body)   => _req('POST', '/api/meets', body),

  // Events
  getEvents:  (meetId) => _req('GET',  meetId ? `/api/events?meetId=${meetId}` : '/api/events'),
  createEvent:(body)   => _req('POST', '/api/events', body),
  getEvent:   (id)     => _req('GET',  `/api/events/${id}`),

  // Athletes
  getAthletes: (q)    => _req('GET',  q ? `/api/athletes?q=${encodeURIComponent(q)}` : '/api/athletes'),

  // Results — primary integration point from timer
  saveResult: (body)   => _req('POST', '/api/results', body),
  updateResult:(id, b) => _req('PUT',  `/api/results/${id}`, b),

  // Rank a group after race
  rankGroup: (eventId, round, group) =>
    _req('POST', '/api/rank', { eventId, round, group }),
};
