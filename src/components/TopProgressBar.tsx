import { useEffect, useState } from "react";
import { useNavigation, useLocation } from "react-router-dom";

export default function TopProgressBar() {
  const navigation = useNavigation();
  const location = useLocation();
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);

  const isNavigationLoading = navigation.state === "loading";

  // 1. Handle react-router asynchronous loading states (e.g. from loaders)
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (isNavigationLoading) {
      setVisible(true);
      setProgress(10);
      interval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 80) {
            clearInterval(interval);
            return 80;
          }
          // Asymptotic increase toward 80%
          return prev + (80 - prev) * 0.15;
        });
      }, 100);
    } else {
      // Completed loading
      setProgress(100);
      const timeout = setTimeout(() => {
        setVisible(false);
        setProgress(0);
      }, 300); // Allow fade out animation to finish
      return () => clearTimeout(timeout);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isNavigationLoading]);

  // 2. Fallback: Simulate loading progress during standard navigation/pathname changes
  useEffect(() => {
    // If the router is already handling an async load, don't interrupt it
    if (isNavigationLoading) return;

    setVisible(true);
    setProgress(30);

    const step2 = setTimeout(() => {
      setProgress(80);
    }, 80);

    const step3 = setTimeout(() => {
      setProgress(100);
    }, 250);

    const fade = setTimeout(() => {
      setVisible(false);
      setProgress(0);
    }, 550);

    return () => {
      clearTimeout(step2);
      clearTimeout(step3);
      clearTimeout(fade);
    };
  }, [location.pathname]);

  if (!visible) return null;

  return (
    <div
      className="fixed top-0 left-0 h-1 bg-[#f5c66b] z-50 transition-[width,opacity] duration-300 ease-out"
      style={{
        width: `${progress}%`,
        opacity: progress === 100 ? 0 : 1,
      }}
    />
  );
}
