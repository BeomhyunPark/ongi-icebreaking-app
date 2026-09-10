import { useEffect, useRef, useState } from 'react';
import { PrimaryButton } from '../../../components/PrimaryButton';
import { invitationCode, startQrScanner } from '../services/qrScanner';

export function JoinQrScanner({ onJoinCode }: { onJoinCode: (code: string) => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [attempt, setAttempt] = useState(0);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('카메라 접근을 허용하면 QR을 스캔할 수 있어요.');

  useEffect(() => {
    const controller = new AbortController();
    setError('');
    setNotice('카메라 접근을 허용하면 QR을 스캔할 수 있어요.');
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('이 브라우저에서는 카메라를 열 수 없어요. Safari나 Chrome에서 다시 열거나 휴대폰 기본 카메라로 진행자의 QR을 찍어주세요.');
      return;
    }
    const pause = () => {
      if (document.hidden) {
        controller.abort();
        setError('카메라를 잠시 껐어요. 다시 스캔하려면 카메라를 켜주세요.');
      }
    };
    document.addEventListener('visibilitychange', pause);
    void startQrScanner(video.current!, controller.signal, (value) => {
      const code = invitationCode(value);
      if (!code) {
        setNotice('온기 모임 QR이 아니에요. 진행자 화면의 QR을 비춰주세요.');
        return;
      }
      controller.abort();
      onJoinCode(code);
    }).then(() => {
      if (!controller.signal.aborted) setNotice('진행자 화면의 QR을 카메라에 비춰주세요.');
    }).catch((cause: unknown) => {
      if (controller.signal.aborted) return;
      const name = cause && typeof cause === 'object' && 'name' in cause ? cause.name : '';
      setError(name === 'NotAllowedError'
        ? '카메라 권한이 필요해요. 브라우저 설정에서 카메라를 허용한 뒤 다시 시도하거나, 휴대폰 기본 카메라로 진행자의 QR을 찍어주세요.'
        : '카메라를 열지 못했어요. 다른 앱에서 카메라를 사용 중인지 확인하거나 휴대폰 기본 카메라로 진행자의 QR을 찍어주세요.');
    });
    return () => {
      controller.abort();
      document.removeEventListener('visibilitychange', pause);
    };
  }, [attempt, onJoinCode]);

  return (
    <div className="anonymous-sharing-scanner">
      <video ref={video} autoPlay muted playsInline aria-label="모임 QR 스캔 카메라" hidden={Boolean(error)} />
      {error ? (
        <>
          <p className="anonymous-sharing-help" role="alert">{error}</p>
          <PrimaryButton onClick={() => setAttempt((value) => value + 1)}>카메라 다시 켜기</PrimaryButton>
        </>
      ) : <p className="anonymous-sharing-help" role="status">{notice}</p>}
    </div>
  );
}
