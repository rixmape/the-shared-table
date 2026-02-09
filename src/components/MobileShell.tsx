import { ReactNode } from "react";

export function MobileShell({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`min-h-screen max-w-[414px] mx-auto bg-stone-50 text-stone-900 flex flex-col ${className}`}>
      {children}
    </div>
  );
}

export function ViewHeader({
  title,
  subtitle,
  onBack,
  rightAction,
}: {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  rightAction?: ReactNode;
}) {
  return (
    <div className="px-5 pt-6 pb-4 bg-stone-50 sticky top-0 z-10">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              onClick={onBack}
              className="w-9 h-9 flex items-center justify-center rounded-full bg-stone-200 hover:bg-stone-300 transition-colors"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
          )}
          <div>
            <h1 className="text-lg font-semibold tracking-tight leading-tight">{title}</h1>
            {subtitle && <p className="text-xs text-stone-500 mt-0.5">{subtitle}</p>}
          </div>
        </div>
        {rightAction && <div>{rightAction}</div>}
      </div>
    </div>
  );
}
