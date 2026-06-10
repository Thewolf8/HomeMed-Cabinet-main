import { toast as sonnerToast } from 'sonner';

export type ToastType = typeof sonnerToast;

export function useToast() {
  return { toast: sonnerToast };
}
