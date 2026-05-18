import React from 'react';
import { AlertTriangle, X } from 'lucide-react';
interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isDanger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}
export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  isDanger = false,
  onConfirm,
  onCancel
}) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:p-0">
        <div
          className="fixed inset-0 transition-opacity bg-slate-900/50 backdrop-blur-sm"
          onClick={onCancel} />
        

        <div className="relative inline-block w-full max-w-md p-6 overflow-hidden text-left align-middle transition-all transform bg-white shadow-xl rounded-2xl">
          <div className="absolute top-0 right-0 pt-4 pr-4">
            <button
              onClick={onCancel}
              className="text-slate-400 hover:text-slate-500 focus:outline-none">
              
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="sm:flex sm:items-start">
            <div
              className={`flex items-center justify-center flex-shrink-0 w-12 h-12 mx-auto rounded-full sm:mx-0 sm:h-10 sm:w-10 ${isDanger ? 'bg-red-100' : 'bg-blue-100'}`}>
              
              <AlertTriangle
                className={`w-6 h-6 ${isDanger ? 'text-red-600' : 'text-blue-600'}`} />
              
            </div>
            <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
              <h3 className="text-lg font-medium leading-6 text-slate-900">
                {title}
              </h3>
              <div className="mt-2">
                <p className="text-sm text-slate-500">{message}</p>
              </div>
            </div>
          </div>
          <div className="mt-6 sm:flex sm:flex-row-reverse">
            <button
              type="button"
              onClick={onConfirm}
              className={`w-full inline-flex justify-center rounded-lg border border-transparent px-4 py-2 text-base font-medium text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 sm:ml-3 sm:w-auto sm:text-sm ${isDanger ? 'bg-red-600 hover:bg-red-700 focus:ring-red-500' : 'bg-brand-primary hover:bg-brand-primary/90 focus:ring-brand-primary'}`}>
              
              {confirmLabel}
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="mt-3 w-full inline-flex justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-base font-medium text-slate-700 shadow-sm hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-brand-primary focus:ring-offset-2 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm">
              
              {cancelLabel}
            </button>
          </div>
        </div>
      </div>
    </div>);

};