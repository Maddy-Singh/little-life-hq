import {InternshipStatus, PastelToken} from '../types/models';

export interface PastelStyle {
  label: string;
  bg: string;
  border: string;
  text: string;
  dot: string;
  softBg: string;
}

export const PASTEL_PALETTE: Record<PastelToken, PastelStyle> = {
  lavender: {
    label: 'Lavender',
    bg: 'bg-[#EFE8FC] dark:bg-[#2F2547]',
    border: 'border-[#D7C6F7] dark:border-[#4D3D75]',
    text: 'text-[#4C3482] dark:text-[#DDD0FA]',
    dot: 'bg-[#9D7CE8]',
    softBg: 'bg-[#F6F1FE] dark:bg-[#251E38]',
  },
  pink: {
    label: 'Pastel Pink',
    bg: 'bg-[#FCE8F1] dark:bg-[#462535]',
    border: 'border-[#F7C6DC] dark:border-[#733D58]',
    text: 'text-[#872E59] dark:text-[#FAD0E3]',
    dot: 'bg-[#E879AF]',
    softBg: 'bg-[#FDF3F8] dark:bg-[#371E2A]',
  },
  mint: {
    label: 'Mint Green',
    bg: 'bg-[#E4F7EE] dark:bg-[#1E3B2E]',
    border: 'border-[#B8E8D2] dark:border-[#32634D]',
    text: 'text-[#1D6344] dark:text-[#BFEFD9]',
    dot: 'bg-[#48B884]',
    softBg: 'bg-[#F0FBF6] dark:bg-[#193026]',
  },
  butter: {
    label: 'Butter Yellow',
    bg: 'bg-[#FDF5D7] dark:bg-[#3F361C]',
    border: 'border-[#F3DF9B] dark:border-[#6B5B2C]',
    text: 'text-[#735714] dark:text-[#F8E7B0]',
    dot: 'bg-[#E2B23B]',
    softBg: 'bg-[#FEFBE9] dark:bg-[#332B17]',
  },
  peach: {
    label: 'Peach',
    bg: 'bg-[#FDECE2] dark:bg-[#452B20]',
    border: 'border-[#F6CCB5] dark:border-[#754936]',
    text: 'text-[#884122] dark:text-[#FAD8C5]',
    dot: 'bg-[#EA8C5F]',
    softBg: 'bg-[#FFF5EF] dark:bg-[#38231A]',
  },
  sky: {
    label: 'Sky Blue',
    bg: 'bg-[#E5F2FD] dark:bg-[#1F3447]',
    border: 'border-[#BBDDFB] dark:border-[#365B7D]',
    text: 'text-[#1D5482] dark:text-[#C4E2FC]',
    dot: 'bg-[#5BA4E6]',
    softBg: 'bg-[#F1F8FE] dark:bg-[#192B3B]',
  },
};

export const PASTEL_KEYS: PastelToken[] = [
  'lavender',
  'pink',
  'mint',
  'butter',
  'peach',
  'sky',
];

export const INTERNSHIP_STATUSES: InternshipStatus[] = [
  'Saved',
  'Applied',
  'Under Consideration',
  'Assessment',
  'Interview Scheduled',
  'Interview Completed',
  'Offer Received',
  'Rejected',
  'Withdrawn',
];

export const INTERNSHIP_STATUS_STYLE: Record<
  InternshipStatus,
  {bg: string; text: string; border: string}
> = {
  Saved: {
    bg: 'bg-[#F2EFF8] dark:bg-[#2B2738]',
    text: 'text-[#554B6B] dark:text-[#CEC7DF]',
    border: 'border-[#DDD6EE] dark:border-[#443E59]',
  },
  Applied: {
    bg: 'bg-[#E5F2FD] dark:bg-[#1E3447]',
    text: 'text-[#1D5482] dark:text-[#C4E2FC]',
    border: 'border-[#BBDDFB] dark:border-[#365B7D]',
  },
  'Under Consideration': {
    bg: 'bg-[#EFE8FC] dark:bg-[#2F2547]',
    text: 'text-[#4C3482] dark:text-[#DDD0FA]',
    border: 'border-[#D7C6F7] dark:border-[#4D3D75]',
  },
  Assessment: {
    bg: 'bg-[#FDF5D7] dark:bg-[#3F361C]',
    text: 'text-[#735714] dark:text-[#F8E7B0]',
    border: 'border-[#F3DF9B] dark:border-[#6B5B2C]',
  },
  'Interview Scheduled': {
    bg: 'bg-[#FDECE2] dark:bg-[#452B20]',
    text: 'text-[#884122] dark:text-[#FAD8C5]',
    border: 'border-[#F6CCB5] dark:border-[#754936]',
  },
  'Interview Completed': {
    bg: 'bg-[#FCE8F1] dark:bg-[#462535]',
    text: 'text-[#872E59] dark:text-[#FAD0E3]',
    border: 'border-[#F7C6DC] dark:border-[#733D58]',
  },
  'Offer Received': {
    bg: 'bg-[#E4F7EE] dark:bg-[#1E3B2E]',
    text: 'text-[#1D6344] dark:text-[#BFEFD9]',
    border: 'border-[#B8E8D2] dark:border-[#32634D]',
  },
  Rejected: {
    bg: 'bg-[#FDE8E8] dark:bg-[#442327]',
    text: 'text-[#8C2D36] dark:text-[#F8C8CE]',
    border: 'border-[#F6C5CA] dark:border-[#703940]',
  },
  Withdrawn: {
    bg: 'bg-[#F1F0F4] dark:bg-[#2B2933]',
    text: 'text-[#625D70] dark:text-[#B5B0C4]',
    border: 'border-[#DFDCE6] dark:border-[#423F4D]',
  },
};
