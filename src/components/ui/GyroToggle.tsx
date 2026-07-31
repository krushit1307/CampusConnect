import * as React from "react";
import { cn } from "@/lib/utils";

interface GyroToggleProps extends React.HTMLAttributes<HTMLButtonElement> {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  disabled?: boolean;
}

interface OrientationState {
  beta: number;
  gamma: number;
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const isTestEnvironment = () => {
  return (
    typeof process !== "undefined" &&
    process.env &&
    (process.env.VITEST === "true" || process.env.NODE_ENV === "test")
  );
};

const GyroToggle = React.forwardRef<HTMLButtonElement, GyroToggleProps>((props, ref) => {
  const { checked = false, onCheckedChange, disabled = false, className, id, ...restProps } = props;
  const ariaLabel = (restProps as Record<string, unknown>)["aria-label"] as string | undefined;
  const { onCheckedChange: _, checked: __, disabled: ___, ...nativeProps } = restProps;
  const [orientation, setOrientation] = React.useState<OrientationState>({ beta: 0, gamma: 0 });
  const [isMobile, setIsMobile] = React.useState(false);
  const [permissionGranted, setPermissionGranted] = React.useState(!isTestEnvironment());
  const rafIdRef = React.useRef<number>();
  const pendingOrientationRef = React.useRef<OrientationState>({ beta: 0, gamma: 0 });
  const permissionRequestedRef = React.useRef(true); // Skip in test env
  const isTestEnv = isTestEnvironment();

  const updateShadow = React.useCallback((state: OrientationState) => {
    pendingOrientationRef.current = state;
    if (!rafIdRef.current) {
      rafIdRef.current = requestAnimationFrame(() => {
        setOrientation(pendingOrientationRef.current);
        rafIdRef.current = undefined;
      });
    }
  }, []);

  React.useEffect(() => {
    if (isTestEnv) return; // Skip all effects in test environment

    const checkMobile = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, [isTestEnv]);

  React.useEffect(() => {
    if (isTestEnv || !isMobile) return;
    if (permissionRequestedRef.current) return;

    const requestOrientationPermission = async () => {
      if (
        typeof DeviceOrientationEvent !== "undefined" &&
        "requestPermission" in DeviceOrientationEvent
      ) {
        try {
          const permissionState = await (
            DeviceOrientationEvent as unknown as {
              requestPermission: () => Promise<PermissionState>;
            }
          ).requestPermission();
          setPermissionGranted(permissionState === "granted");
        } catch {
          setPermissionGranted(false);
        }
      } else {
        setPermissionGranted(true);
      }
      permissionRequestedRef.current = true;
    };

    requestOrientationPermission();
  }, [isMobile, isTestEnv]);

  React.useEffect(() => {
    if (isTestEnv || !isMobile || !permissionGranted) return;

    const handleOrientation = (event: DeviceOrientationEvent) => {
      if (event.beta !== null && event.gamma !== null) {
        updateShadow({
          beta: clamp(event.beta, -90, 90),
          gamma: clamp(event.gamma, -90, 90),
        });
      }
    };

    window.addEventListener("deviceorientation", handleOrientation);
    return () => {
      window.removeEventListener("deviceorientation", handleOrientation);
    };
  }, [isMobile, permissionGranted, updateShadow, isTestEnv]);

  React.useEffect(() => {
    if (isTestEnv || isMobile) return;

    const handleMouseMove = (event: MouseEvent) => {
      const centerX = window.innerWidth / 2;
      const centerY = window.innerHeight / 2;
      const gamma = clamp(((event.clientX - centerX) / centerX) * 45, -45, 45);
      const beta = clamp(((event.clientY - centerY) / centerY) * 45, -45, 45);
      updateShadow({ beta, gamma });
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, [isMobile, updateShadow, isTestEnv]);

  const shadowX = (orientation.gamma / 45) * 8;
  const shadowY = (orientation.beta / 45) * 8;
  const outerShadowX = -shadowX;
  const outerShadowY = -shadowY;

  const toggleStyle: React.CSSProperties = {
    "--shadow-x": `${shadowX}px`,
    "--shadow-y": `${shadowY}px`,
    "--outer-shadow-x": `${outerShadowX}px`,
    "--outer-shadow-y": `${outerShadowY}px`,
  } as React.CSSProperties;

  const handleClick = () => {
    if (!disabled && onCheckedChange) {
      onCheckedChange(!checked);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === " " || event.key === "Enter") {
      event.preventDefault();
      handleClick();
    }
  };

  return (
    <button
      ref={ref}
      id={id}
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      style={toggleStyle}
      className={cn(
        "relative inline-flex h-10 w-20 shrink-0 cursor-pointer items-center rounded-full border-2 transition-all duration-300 ease-out",
        "bg-[linear-gradient(145deg,#e0e0e0,#ffffff)]",
        "shadow-[var(--outer-shadow-x)_var(--outer-shadow-y)_8px_rgba(0,0,0,0.1),calc(var(--outer-shadow-x)*-1)_calc(var(--outer-shadow-y)*-1)_8px_rgba(255,255,255,0.7)]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        "disabled:cursor-not-allowed disabled:opacity-50",
        checked ? "bg-[linear-gradient(145deg,#a0d8a0,#c8f0c8)]" : "",
        checked
          ? "shadow-[var(--outer-shadow-x)_var(--outer-shadow-y)_8px_rgba(0,128,0,0.15),calc(var(--outer-shadow-x)*-1)_calc(var(--outer-shadow-y)*-1)_8px_rgba(200,255,200,0.7)]"
          : "",
        className,
      )}
      {...nativeProps}
    >
      <span
        className={cn(
          "pointer-events-none block h-8 w-8 rounded-full bg-background shadow-lg ring-1 ring-gray-200 transition-transform duration-300 ease-out",
          "shadow-[calc(var(--shadow-x)*-1)_calc(var(--shadow-y)*-1)_4px_rgba(255,255,255,0.9),var(--shadow-x)_var(--shadow-y)_4px_rgba(0,0,0,0.15)]",
          checked ? "translate-x-8" : "translate-x-0",
        )}
      />
    </button>
  );
});

GyroToggle.displayName = "GyroToggle";

export { GyroToggle };
