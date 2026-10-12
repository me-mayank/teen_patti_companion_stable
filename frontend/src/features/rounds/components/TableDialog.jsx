import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

export default function TableDialog({ title, onClose, children }) {
  const dialog = useRef(null);
  useEffect(() => {
    const node = dialog.current;
    node?.showModal();
    return () => { node?.close(); };
  }, []);
  return <dialog ref={dialog} className="table-dialog" aria-label={title} onCancel={onClose} onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="dialog-body"><header className="dialog-heading"><h2>{title}</h2><button className="table-icon-button" onClick={onClose} aria-label={`Close ${title}`}><X size={20} /></button></header>{children}</div>
  </dialog>;
}
