// C:\HDUD_DATA\hdud-web-app\src\components\ComingSoonPanel.tsx

import React from "react";

type ComingSoonPanelProps = {
  title: string;
  subtitle?: string;
  hint?: string;
  children?: React.ReactNode;
  rightSlot?: React.ReactNode;
};

export default function ComingSoonPanel({
  title,
  subtitle,
  hint = "Em breve",
  children,
  rightSlot,
}: ComingSoonPanelProps) {
  return (
    <div className="hdud-card">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-semibold leading-6">{title}</h2>
          {subtitle ? (
            <p className="mt-1 text-sm opacity-80">{subtitle}</p>
          ) : null}
        </div>

        <div className="shrink-0 flex items-center gap-2">
          {rightSlot ? rightSlot : null}
          <span className="inline-flex items-center rounded-full border px-2 py-1 text-xs opacity-90">
            {hint}
          </span>
        </div>
      </div>

      {children ? <div className="mt-4">{children}</div> : null}
    </div>
  );
}
