import { ScreenLayout } from '../../components/ScreenLayout';
import { RoomExitDialog } from './components/RoomExitDialog';
import { SharingHeader } from './components/SharingHeader';
import { useAnonymousSharingController } from './hooks/useAnonymousSharingController';
import { selectSharingScreen } from './domain/selectSharingScreen';
import { SharingEntryScreen } from './screens/SharingEntryScreen';
import { SharingLobbyScreen } from './screens/SharingLobbyScreen';
import { SharingWritingScreen } from './screens/SharingWritingScreen';
import { SharingWaitingScreen } from './screens/SharingWaitingScreen';
import { SharingStoryScreen } from './screens/SharingStoryScreen';
import { SharingCompletedScreen } from './screens/SharingCompletedScreen';
import './styles/anonymous-sharing.css';

export function AnonymousSharingApp({ onBackHome }: { onBackHome: () => void }) {
  const model = useAnonymousSharingController(onBackHome);
  const { loading, roomState, roomId, sharing, currentQuestion, reconnecting, error } = model;
  if (loading)
    return (
      <ScreenLayout className="anonymous-sharing-screen is-centered">
        <p className="anonymous-sharing-loading">모임을 다시 불러오고 있어요…</p>
      </ScreenLayout>
    );
  if (!roomState || !roomId) return <SharingEntryScreen {...model} />;
  const canLeave = roomState.role === 'PARTICIPANT' && ['CREATED', 'WRITING', 'LOCKED'].includes(roomState.status);
  const screen = selectSharingScreen(roomState, model.hostWriting);
  return (
    <ScreenLayout className="anonymous-sharing-screen">
      {roomState.status !== 'COMPLETED' ? (
        <SharingHeader
          onBackHome={model.handleBackHome}
          onLeave={canLeave ? () => model.setLeaveConfirming(true) : undefined}
          busy={model.busy}
        />
      ) : null}
      {reconnecting ? (
        <p className="anonymous-sharing-network" role="status">
          연결을 다시 확인하고 있어요…
        </p>
      ) : null}
      {screen === 'host-lobby' ? <SharingLobbyScreen {...model} roomState={roomState} /> : null}
      {screen === 'writing' && currentQuestion ? (
        <SharingWritingScreen {...model} roomState={roomState} currentQuestion={currentQuestion} />
      ) : null}
      {screen === 'waiting' ? <SharingWaitingScreen {...model} roomState={roomState} /> : null}
      {screen === 'story' && sharing ? (
        <SharingStoryScreen
          key={`${roomId}:${sharing.sequence}:${sharing.state}`}
          {...model}
          roomState={roomState}
          sharing={sharing}
        />
      ) : null}
      {screen === 'completed' ? <SharingCompletedScreen {...model} /> : null}
      {model.cancelConfirming || (canLeave && model.leaveConfirming) ? (
        <RoomExitDialog
          kind={model.cancelConfirming ? 'delete' : 'leave'}
          busy={model.busy}
          error={error}
          onCancel={() => { model.setCancelConfirming(false); model.setLeaveConfirming(false); }}
          onConfirm={model.cancelConfirming ? model.cancelRoom : model.leaveRoom}
        />
      ) : null}
      {error && !model.cancelConfirming && !model.leaveConfirming ? (
        <p className="anonymous-sharing-error" role="alert">
          {error}
        </p>
      ) : null}
    </ScreenLayout>
  );
}
