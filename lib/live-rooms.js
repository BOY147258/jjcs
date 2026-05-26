const ROLE_ORDER = ['start', 'finish', 'observer', 'solo', 'unknown'];

function emptyCounts() {
  return Object.fromEntries(ROLE_ORDER.map(role => [role, 0]));
}

function normalizeClient(client, now) {
  const joinedAt = Number(client.joinedAt) || now;
  const lastSeenAt = Number(client.lastSeenAt) || joinedAt;
  const role = ROLE_ORDER.includes(client.role) ? client.role : 'unknown';

  return {
    id: client.id,
    role,
    joinedAt,
    lastSeenAt,
    onlineMs: Math.max(0, now - joinedAt),
    idleMs: Math.max(0, now - lastSeenAt),
    messages: Number(client.messages) || 0,
    remoteAddress: client.remoteAddress || '',
    userAgent: client.userAgent || '',
  };
}

export function buildLiveRoomSnapshot(rooms, now = Date.now()) {
  const source = rooms instanceof Map ? [...rooms.entries()] : Object.entries(rooms || {});

  return source
    .map(([roomCode, clients]) => {
      const normalizedClients = (clients || []).map(client => normalizeClient(client, now));
      const roleCounts = emptyCounts();
      normalizedClients.forEach(client => {
        roleCounts[client.role] = (roleCounts[client.role] || 0) + 1;
      });

      return {
        roomCode,
        clientCount: normalizedClients.length,
        roleCounts,
        clients: normalizedClients.sort((a, b) => a.joinedAt - b.joinedAt),
        createdAt: normalizedClients.length ? Math.min(...normalizedClients.map(client => client.joinedAt)) : now,
        updatedAt: normalizedClients.length ? Math.max(...normalizedClients.map(client => client.lastSeenAt)) : now,
      };
    })
    .filter(room => room.clientCount > 0)
    .sort((a, b) => b.updatedAt - a.updatedAt);
}
