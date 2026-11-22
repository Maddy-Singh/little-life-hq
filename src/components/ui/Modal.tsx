import React, {useEffect} from 'react';
import {X} from 'lucide-react';
import {AnimatePresence, motion} from 'motion/react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  maxWidthClass?: string;
  children: React.ReactNode;
}

export const Modal: React.FC<ModalProps> = ({
  open,
  onClose,
  title,
  subtitle,
  maxWidthClass = 'max-w-lg',
  children,
}) => {
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-title"
        >
          <motion.div
            initial={{opacity: 0}}
            animate={{opacity: 1}}
            exit={{opacity: 0}}
            transition={{duration: 0.16}}
            onClick={onClose}
            className="fixed inset-0 bg-[#231D2D]/35 dark:bg-black/60 backdrop-blur-[2px]"
          />
          <motion.div
            initial={{opacity: 0, scale: 0.97, y: 8}}
            animate={{opacity: 1, scale: 1, y: 0}}
            exit={{opacity: 0, scale: 0.97, y: 8}}
            transition={{duration: 0.18, ease: [0.16, 1, 0.3, 1]}}
            className={`relative z-10 w-full ${maxWidthClass} max-h-[90vh] flex flex-col rounded-2xl border border-[#EAE2DC] dark:border-[#342F44] bg-white dark:bg-[#1F1C29] shadow-xl`}
          >
            <div className="flex items-start justify-between gap-4 px-6 py-4 border-b border-[#EFE8E3] dark:border-[#2E293D]">
              <div className="min-w-0">
                <h2
                  id="modal-title"
                  className="text-lg font-bold text-[#2D2638] dark:text-[#F3EFFA] leading-snug"
                >
                  {title}
                </h2>
                {subtitle && (
                  <p className="text-xs text-[#6E637E] dark:text-[#AFA6C2] mt-0.5">{subtitle}</p>
                )}
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close modal"
                className="p-2 -mr-2 rounded-xl text-[#736783] hover:text-[#2D2638] hover:bg-[#F5F0FA] dark:text-[#AFA6C2] dark:hover:text-white dark:hover:bg-[#2C273B] transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="px-6 py-5 overflow-y-auto">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
