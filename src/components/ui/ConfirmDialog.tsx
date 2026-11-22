import React from 'react';
import {AlertTriangle} from 'lucide-react';
import {Modal} from './Modal';

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  extraAction?: React.ReactNode;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = true,
  extraAction,
}) => {
  return (
    <Modal open={open} onClose={onClose} title={title} maxWidthClass="max-w-md">
      <div className="space-y-4">
        <div className="flex items-start gap-3">
          <div
            className={`p-2.5 rounded-xl shrink-0 ${
              destructive
                ? 'bg-[#FDE8E8] text-[#A2353E] dark:bg-[#442327] dark:text-[#F8C8CE]'
                : 'bg-[#EFE8FC] text-[#5B3EA8] dark:bg-[#2F2547] dark:text-[#DDD0FA]'
            }`}
          >
            <AlertTriangle className="w-5 h-5" />
          </div>
          <p className="text-sm text-[#4A4158] dark:text-[#D5CEE3] leading-relaxed">{description}</p>
        </div>

        {extraAction && <div>{extraAction}</div>}

        <div className="flex items-center justify-end gap-2.5 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-semibold rounded-xl border border-[#E5DDD8] dark:border-[#39334A] text-[#4D445C] dark:text-[#D2CBE0] hover:bg-[#F7F3FA] dark:hover:bg-[#2A2538] transition-colors whitespace-nowrap"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className={`px-4 py-2 text-sm font-semibold rounded-xl transition-colors whitespace-nowrap ${
              destructive
                ? 'bg-[#D95362] hover:bg-[#C34251] text-white'
                : 'bg-[#7F63D8] hover:bg-[#6D52C4] text-white'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
};
