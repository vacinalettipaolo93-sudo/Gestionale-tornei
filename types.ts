export interface Player {
  id: string;
  name: string;
  phone: string;
  avatar: string;
  status: 'pending' | 'confirmed';
}

export interface Match {
  id: string;
  player1Id: string;
  player2Id: string;
  score1: number | null;
  score2: number | null;
  status: 'pending' | 'scheduled' | 'completed';
  scheduledTime?: string;
  location?: string;
}

export interface Group {
  id: string;
  name: string;
  playerIds: string[];
  matches: Match[];
}

export interface PointRule {
  id: string;
  minDiff: number;
  maxDiff: number;
  winnerPoints: number;
  loserPoints: number;
}

export type TieBreaker = 'goalDifference' | 'goalsFor' | 'wins' | 'headToHead';

export interface PlayoffSetting {
  groupId: string;
  numQualifiers: number;
}

export interface ConsolationSetting {
  groupId: string;
  startRank: number;
  endRank: number;
}

export interface TournamentSettings {
    pointsPerDraw: number;
    pointRules: PointRule[];
    tieBreakers: TieBreaker[];
    playoffSettings: PlayoffSetting[];
    hasBronzeFinal: boolean;
    consolationSettings: ConsolationSetting[];
}

export interface TimeSlot {
    id: string;
    time: string;
    location: string;
    matchId: string | null;
}

// AGGIUNTA: slot orari globali a livello evento
export interface Event {
  id: string;
  name: string;
  tournaments: Tournament[];
  players: Player[];
  invitationCode: string;
  globalTimeSlots?: TimeSlot[];
}

export interface Tournament {
  id: string;
  name: string;
  groups: Group[];
  settings: TournamentSettings;
  timeSlots: TimeSlot[]; // legacy, per retrocompatibilità: ora si usano globalTimeSlots
  playoffs: PlayoffBracket | null;
  consolationBracket: PlayoffBracket | null;
}

// Altri tipi invariati...
