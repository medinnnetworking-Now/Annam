'use client';
// Client building blocks: dialog (bottom sheet on phones), toasts, tabs, submit button.
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useFormStatus } from 'react-dom';

const ToastCtx = createContext<(msg: string) => void>(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const show = useCallback((m: string) => {
    setMsg(m);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setMsg(null), 3000);
  }, []);
  return (
    <ToastCtx.Provider value={show}>
      {children}
      <div role="status" aria-live="polite">{msg && <div className="toast">{msg}</div>}</div>
    </ToastCtx.Provider>
  );
}

export function Dialog({ open, onClose, title, children, labelledBy }: { open: boolean; onClose: () => void; title: string; children: ReactNode; labelledBy?: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = labelledBy ?? `dlg-${title.replace(/\W+/g, '-').toLowerCase()}`;
  useEffect(() => {
    const d = ref.current; if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog ref={ref} className="dlg" aria-labelledby={id} onClose={onClose} onCancel={onClose}>
      {open && <div><h2 id={id}>{title}</h2>{children}</div>}
    </dialog>
  );
}

export function Submit({ children, className = 'btn', pendingText }: { children: ReactNode; className?: string; pendingText?: string }) {
  const { pending } = useFormStatus();
  return <button className={className} type="submit" disabled={pending} aria-disabled={pending}>{pending ? pendingText ?? 'Saving…' : children}</button>;
}

export function Tabs({ base, tabs }: { base: string; tabs: [string, string][] }) {
  const path = usePathname();
  return (
    <nav className="tabs" aria-label="Patient sections">
      {tabs.map(([slug, label]) => {
        const href = slug ? `${base}/${slug}` : base;
        const current = slug ? path.startsWith(href) : path === base;
        return <Link key={slug} href={href} aria-current={current ? 'page' : undefined}>{label}</Link>;
      })}
    </nav>
  );
}

export function NavLink({ href, children }: { href: string; children: ReactNode }) {
  const path = usePathname();
  return <Link href={href} aria-current={path === href || path.startsWith(href + '/') ? 'page' : undefined}>{children}</Link>;
}

export function PrintButton({ label = 'Print or save as PDF', onPrint }: { label?: string; onPrint?: () => void }) {
  return <button type="button" className="btn" onClick={() => { onPrint?.(); window.print(); }}>{label}</button>;
}
