import { type Event, type User, type Player } from '../types';

const createInitialsAvatar = (name: string): string => {
  const initials = name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
  const colors = ['#8b5cf6', '#22d3ee', '#f59e0b', '#10b981', '#ef4444', '#3b82f6'];
  const color = colors[initials.charCodeAt(0) % colors.length];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100"><rect width="100" height="100" fill="${color}"/><text x="50" y="50" font-family="Arial, sans-serif" font-size="50" fill="white" text-anchor="middle" dominant-baseline="central" dy=".1em">${initials}</text></svg>`;
  return `data:image/svg+xml;base64,${btoa(svg)}`;
};


export const MOCK_EVENTS: Event[] = [
  {
    id: 'evt1',
    name: 'Campionato Padel Amatoriale 2024',
    invitationCode: 'PADEL2024',
    players: [
      { id: 'p1', name: 'Mario Rossi', phone: '393331112233', avatar: createInitialsAvatar('Mario Rossi'), status: 'confirmed' },
      { id: 'p2', name: 'Luca Bianchi', phone: '393332223344', avatar: createInitialsAvatar('Luca Bianchi'), status: 'confirmed' },
      { id: 'p3', name: 'Paolo Verdi', phone: '393333334455', avatar: createInitialsAvatar('Paolo Verdi'), status: 'confirmed' },
      { id: 'p4', name: 'Anna Neri', phone: '393334445566', avatar: createInitialsAvatar('Anna Neri'), status: 'confirmed' },
      { id: 'p5', name: 'Giulia Gialli', phone: '393335556677', avatar: createInitialsAvatar('Giulia Gialli'), status: 'confirmed' },
      { id: 'p6', name: 'Marco Blu', phone: '393336667788', avatar: createInitialsAvatar('Marco Blu'), status: 'confirmed' },
      { id: 'p7', name: 'Francesca Viola', phone: '393337778899', avatar: createInitialsAvatar('Francesca Viola'), status: 'pending' },
      { id: 'p8', name: 'Roberto Arancioni', phone: '393338889900', avatar: createInitialsAvatar('Roberto Arancioni'), status: 'confirmed' },
    ],
    tournaments: [
      {
        id: 'trn1',
        name: 'Torneo Maschile',
        settings: {
            pointsPerDraw: 1,
            pointRules: [
                { id: 'pr1', minDiff: 1, maxDiff: 2, winnerPoints: 2, loserPoints: 1 },
                { id: 'pr2', minDiff: 3, maxDiff: 99, winnerPoints: 3, loserPoints: 0 },
            ],
            tieBreakers: ['goalDifference', 'goalsFor', 'wins', 'headToHead'],
            playoffSettings: [],
            hasBronzeFinal: true,
            consolationSettings: [],
        },
        timeSlots: [
            { id: 'ts1', time: new Date('2024-09-10T18:00:00').toISOString(), location: 'Campo 1', matchId: 'm3' },
            { id: 'ts2', time: new Date('2024-09-10T19:00:00').toISOString(), location: 'Campo 1', matchId: null },
            { id: 'ts3', time: new Date('2024-09-11T18:00:00').toISOString(), location: 'Campo 2', matchId: null },
        ],
        playoffs: null,
        consolationBracket: null,
        groups: [
          {
            id: 'g1',
            name: 'Girone A',
            playerIds: ['p1', 'p2', 'p3', 'p4'],
            matches: [
              { id: 'm1', player1Id: 'p1', player2Id: 'p2', score1: 6, score2: 2, status: 'completed' }, // diff 4 -> 3-0 pt
              { id: 'm2', player1Id: 'p3', player2Id: 'p4', score1: 7, score2: 5, status: 'completed' }, // diff 2 -> 2-1 pt
              { id: 'm3', player1Id: 'p1', player2Id: 'p3', score1: 3, score2: 6, status: 'completed'},
              { id: 'm4', player1Id: 'p2', player2Id: 'p4', score1: 6, score2: 1, status: 'completed' },
              { id: 'm5', player1Id: 'p1', player2Id: 'p4', score1: 6, score2: 4, status: 'completed' },
              { id: 'm6', player1Id: 'p2', player2Id: 'p3', score1: 6, score2: 6, status: 'completed' }, // pareggio -> 1-1 pt
            ],
          },
          {
            id: 'g2',
            name: 'Girone B',
            playerIds: ['p5', 'p6', 'p8'],
            matches: [
                { id: 'm7', player1Id: 'p5', player2Id: 'p6', score1: 6, score2: 0, status: 'completed' },
                { id: 'm8', player1Id: 'p5', player2Id: 'p8', score1: 6, score2: 2, status: 'completed' },
                { id: 'm9', player1Id: 'p6', player2Id: 'p8', score1: 4, score2: 6, status: 'completed' },
            ],
          },
        ],
      },
    ],
  },
];

const allPlayers = MOCK_EVENTS.flatMap(e => e.players);

export const MOCK_USERS: User[] = [
    {
        id: 'user-organizer',
        username: 'organizer',
        password: 'password',
        role: 'organizer'
    },
    ...allPlayers.map((player: Player): User => ({
        id: `user-${player.id}`,
        username: player.name,
        password: '1234',
        role: 'participant',
        playerId: player.id,
    }))
];