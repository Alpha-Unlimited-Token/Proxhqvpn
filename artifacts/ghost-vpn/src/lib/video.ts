import { useEffect, useState } from 'react';

export function useVideoPlayer({ durations }: { durations: Record<string, number> }) {
  const [currentScene, setCurrentScene] = useState(0);
  const sceneKeys = Object.keys(durations);
  
  useEffect(() => {
    // @ts-ignore
    window.startRecording?.();
    
    let timer: NodeJS.Timeout;
    const playScene = (index: number) => {
      const key = sceneKeys[index];
      const duration = durations[key];
      timer = setTimeout(() => {
        if (index === sceneKeys.length - 1) {
          // @ts-ignore
          window.stopRecording?.();
          setCurrentScene(0); // Loop
        } else {
          setCurrentScene(index + 1);
        }
      }, duration);
    };

    playScene(currentScene);
    return () => clearTimeout(timer);
  }, [currentScene, durations, sceneKeys]);

  return { currentScene };
}
