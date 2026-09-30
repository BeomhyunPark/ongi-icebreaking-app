export type ManittoRoom = {
  code: string;
  title: string;
  assigned: boolean;
  expiresAt: string;
  me: { id: string; name: string; host: boolean; participating: boolean; recipient: string | null };
  participantCount: number;
  missions: { id: string; content: string; createdAt: string; completed: boolean }[];
  dashboard: { id: string; name: string; completedMissionIds: string[] }[];
};
export type RoomReference = Pick<ManittoRoom, 'code' | 'title' | 'expiresAt'>;
