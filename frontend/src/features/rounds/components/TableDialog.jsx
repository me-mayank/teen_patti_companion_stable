import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

export default function TableDialog({ title, onClose, children }) {
  const dialog = useRef(null);
  useEffect(() => {
    const node = dialog.current;
    const opener = document.activeElement;
    node?.showModal();
    return () => {
      node?.close();
      // React may remove the dialog before this cleanup, preventing the
      // browser's native close from returning keyboard focus to its opener.
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    };
  }, []);
  return <dialog ref={dialog} className="table-dialog" aria-label={title} onCancel={onClose} onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="dialog-body"><header className="dialog-heading"><h2>{title}</h2><button className="table-icon-button" onClick={onClose} aria-label={`Close ${title}`}><X size={20} /></button></header>{children}</div>
  </dialog>;
}
