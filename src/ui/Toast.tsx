// C:\HDUD_DATA\hdud-web-app\src\ui\Toast.tsx

import { createContext, useCallback, useContext, useState } from "react";

type ToastType = "error" | "success" | "info";

type Toast = {
  id: number;
  type: ToastType;
  message: string;
};

type ToastContextType = {
  showToast: (type: ToastType, message: string) => void;
};

const ToastContext = createContext<ToastContextType | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return ctx;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((type: ToastType, message: string) => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, type, message }]);

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}

      {/* Container */}
      <div
        style={{
          position: "fixed",
          top: 16,
          right: 16,
          display: "flex",
          flexDirection: "column",
          gap: 10,
          zIndex: 9999,
        }}
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            style={{
              minWidth: 260,
              maxWidth: 360,
              padding: "12px 14px",
              borderRadius: 12,
              background:
                t.type === "error"
                  ? "var(--hdud-err-bg)"
                  : t.type === "success"
                  ? "var(--hdud-ok-bg)"
                  : "var(--hdud-surface)",
              border:
                t.type === "error"
                  ? "1px solid var(--hdud-err-border)"
                  : t.type === "success"
                  ? "1px solid var(--hdud-ok-border)"
                  : "1px solid var(--hdud-border)",
              color:
                t.type === "error"
                  ? "var(--hdud-err-text)"
                  : t.type === "success"
                  ? "var(--hdud-ok-text)"
                  : "var(--hdud-text)",
              fontWeight: 700,
              boxShadow: "var(--hdud-shadow)",
            }}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
