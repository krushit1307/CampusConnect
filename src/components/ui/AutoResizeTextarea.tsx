import React, { useEffect, useRef, useImperativeHandle, forwardRef } from "react";

export interface AutoResizeTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  minHeight?: number;
}

export const AutoResizeTextarea = forwardRef<HTMLTextAreaElement, AutoResizeTextareaProps>(
  ({ value, onChange, className = "", minHeight = 40, style, ...props }, ref) => {
    const internalRef = useRef<HTMLTextAreaElement>(null);

    useImperativeHandle(ref, () => internalRef.current as HTMLTextAreaElement);

    const resize = () => {
      const textarea = internalRef.current;
      if (!textarea) return;

      window.requestAnimationFrame(() => {
        if (!textarea) return;

        const computedStyle = window.getComputedStyle(textarea);
        const borderTop = parseFloat(computedStyle.borderTopWidth) || 0;
        const borderBottom = parseFloat(computedStyle.borderBottomWidth) || 0;
        const targetHeight = Math.max(textarea.scrollHeight + borderTop + borderBottom, minHeight);

        window.requestAnimationFrame(() => {
          if (textarea) {
            textarea.style.height = `${targetHeight}px`;
          }
        });
      });
    };

    useEffect(() => {
      resize();
    }, [value]);

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      resize();
      if (onChange) {
        onChange(e);
      }
    };

    return (
      <textarea
        ref={internalRef}
        value={value}
        onChange={handleChange}
        rows={1}
        className={`overflow-hidden resize-none transition-[height] duration-75 ${className}`}
        style={{ ...style, minHeight: `${minHeight}px` }}
        {...props}
      />
    );
  },
);

AutoResizeTextarea.displayName = "AutoResizeTextarea";
