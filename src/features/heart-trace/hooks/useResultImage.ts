import { useEffect, useState } from 'react';

import type { ResultTypeId } from '../domain/types';
import {
  getResultImageFilename,
  loadResultImageFile,
  saveResultImageFile,
  type ResultImageAction,
} from '../services/resultImage';
import { recordShareClick } from '../../../engagement/tracker';

type UseResultImageOptions = {
  resultId: ResultTypeId;
  imageSrc: string;
};

export function useResultImage({ resultId, imageSrc }: UseResultImageOptions) {
  const [resultFile, setResultFile] = useState<File | null>(null);
  const [imageLoadFailed, setImageLoadFailed] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [showIosHelp, setShowIosHelp] = useState(false);

  useEffect(() => {
    let isCurrent = true;

    setResultFile(null);
    setImageLoadFailed(false);
    setSaveMessage(null);

    void loadResultImageFile(imageSrc, getResultImageFilename(resultId))
      .then((file) => {
        if (isCurrent) {
          setImageLoadFailed(false);
          setResultFile(file);
        }
      })
      .catch(() => {
        if (isCurrent) {
          setImageLoadFailed(true);
          setSaveMessage('이미지를 준비하지 못했어요. 잠시 후 다시 시도해 주세요.');
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [imageSrc, resultId]);

  const handleImageAction = (action: ResultImageAction) => {
    switch (action) {
      case 'shared':
        setSaveMessage(null);
        void recordShareClick('heart-trace', 'native');
        break;
      case 'downloaded':
        setSaveMessage('결과 이미지 다운로드를 시작했어요.');
        break;
      case 'ios-help':
        setSaveMessage(null);
        setShowIosHelp(true);
        break;
      case 'cancelled':
        setSaveMessage(null);
        break;
    }
  };

  const saveResultImage = async () => {
    if (isSaving) {
      return;
    }

    setIsSaving(true);
    setSaveMessage(null);

    try {
      const file = resultFile ?? await loadResultImageFile(
        imageSrc,
        getResultImageFilename(resultId),
      );

      setResultFile(file);
      setImageLoadFailed(false);

      const action = await saveResultImageFile(file, imageSrc);
      handleImageAction(action);
    } catch {
      setImageLoadFailed(true);
      setSaveMessage('이미지를 저장하지 못했어요. 잠시 후 다시 시도해 주세요.');
    } finally {
      setIsSaving(false);
    }
  };

  return {
    imageLoadFailed,
    isSaving,
    resultFile,
    saveMessage,
    saveResultImage,
    setShowIosHelp,
    showIosHelp,
  };
}
