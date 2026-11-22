import React from 'react';
import {AlertCircle, CheckCircle2, Info, X} from 'lucide-react';
import {AnimatePresence, motion} from 'motion/react';
import {useApp} from '../../context/AppContext';

export const ToastContainer: React.FC = () => {
  const {toasts, dismissToast} = useApp();

  return (
    <div
      className="fixed bottom-4 right-4 z-[60] flex flex-col gap-2 max-w-sm w-full pointer-events-none px-4 sm:px-0"
      aria-live="polite"
    >
      <AnimatePresence>
        {toasts.map((toast) => {
          const styles =
            toast.variant === 'error'
              ? 'bg-[#FFF0F1] border-[#F4C4C9] text-[#8F2833] dark:bg-[#3B1E23] dark:border-[#6A353D] dark:text-[#FAD0D4]'
              : toast.variant === 'info'
                ? 'bg-[#EFF6FD] border-[#C3DDF9] text-[#1D5482] dark:bg-[#1D3042] dark:border-[#355675] dark:text-[#C4E2FC]'
                : 'bg-[#ECF9F2] border-[#BCE6CE] text-[#1D6344] dark:bg-[#1D382C] dark:border-[#305E49] dark:text-[#BFEFD9]';
          const Icon =
            toast.variant === 'error'
              ? AlertCircle
              : toast.variant === 'info'
                ? Info
                : CheckCircle2;

          return (
            <motion.div
              key={toast.id}
              initial={{opacity: 0, y: 12, scale: 0.96}}
              animate={{opacity: 1, y: 0, scale: 1}}
              exit={{opacity: 0, y: 8, scale: 0.96}}
              transition={{duration: 0.16}}
              className={`pointer-events-auto flex items-center justify-between gap-3 px-4 py-3 rounded-2xl border shadow-md text-sm font-medium ${styles}`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <Icon className="w-4 h-4 shrink-0" />
                <span className="truncate">{toast.message}</span>
              </div>
              <button
                type="button"
                onClick={() => dismissToast(toast.id)}
                aria-label="Dismiss notification"
                className="p-1 rounded-lg opacity-70 hover:opacity-100 transition-opacity shrink-0"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
};
