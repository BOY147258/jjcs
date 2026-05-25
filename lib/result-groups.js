function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function groupKey(result) {
  return [
    result.eventId ?? 'none',
    result.round ?? 1,
    result.group ?? 1,
  ].join('-');
}

export function parseResultGroupId(id) {
  const match = /^(\d+)-(\d+)-(\d+)$/.exec(String(id || ''));
  if (!match) return null;
  const parsed = {
    eventId: Number(match[1]),
    round: Number(match[2]),
    group: Number(match[3]),
  };
  return parsed.eventId > 0 && parsed.round > 0 && parsed.group > 0 ? parsed : null;
}

export function buildResultGroups({ meets = [], events = [], results = [] }) {
  const meetById = new Map(meets.map(meet => [Number(meet.id), meet]));
  const eventById = new Map(events.map(event => [Number(event.id), event]));
  const groups = new Map();

  for (const result of results) {
    const event = eventById.get(Number(result.eventId)) || {};
    const meet = meetById.get(Number(event.meetId)) || {};
    const round = toNumber(result.round, 1);
    const heat = toNumber(result.group, 1);
    const key = groupKey({ eventId: result.eventId, round, group: heat });
    const recordedAt = result.recordedAt || result.updatedAt || result.createdAt || Date.now();

    if (!groups.has(key)) {
      groups.set(key, {
        id: key,
        date: new Date(recordedAt).toISOString(),
        meetId: event.meetId ?? null,
        meetName: meet.name || '',
        eventId: result.eventId ?? null,
        raceName: event.name || '未命名比赛',
        distance: event.distance || '',
        laps: toNumber(event.laps, 1),
        round,
        group: heat,
        roomCode: result.roomCode || '',
        results: [],
        recordedAt,
      });
    }

    const group = groups.get(key);
    if (recordedAt > group.recordedAt) {
      group.recordedAt = recordedAt;
      group.date = new Date(recordedAt).toISOString();
    }

    group.results.push({
      id: result.id,
      laneIdx: result.laneIndex ?? null,
      name: result.athleteName || '',
      raceTime: result.timeMs ?? null,
      isDNF: result.timeMs == null,
      rank: result.rank ?? null,
      team: result.team || '',
      number: result.number || '',
    });
  }

  return [...groups.values()]
    .map(group => ({
      ...group,
      results: group.results.sort((a, b) => {
        if (a.isDNF && !b.isDNF) return 1;
        if (!a.isDNF && b.isDNF) return -1;
        return (a.raceTime ?? Infinity) - (b.raceTime ?? Infinity);
      }),
    }))
    .sort((a, b) => b.recordedAt - a.recordedAt);
}
