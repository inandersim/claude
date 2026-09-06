import { useEffect, useId, useRef, useState, type ReactNode } from 'react';

import { useT } from '../i18n';
import { Button, Field, Textarea } from './ui';

export function Modal({
  open,
  title,
  onClose,
  children,
  footer,
  wide,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  const titleId = useId();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const first = ref.current?.querySelector<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    first?.focus();
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className={`modal ${wide ? 'modal-wide' : ''}`} role="dialog" aria-modal="true" aria-labelledby={titleId} ref={ref}>
        <h2 className="modal-title" id={titleId}>
          {title}
        </h2>
        {children}
        {footer ? <div className="modal-actions">{footer}</div> : null}
      </div>
    </div>
  );
}

export interface ConfirmState {
  title: string;
  description?: string;
  /** Gerekçe alanı gösterilsin mi (denetim günlüğü için) */
  withReason?: boolean;
  reasonRequired?: boolean;
  danger?: boolean;
  confirmLabel?: string;
  onConfirm: (reason: string) => unknown | Promise<unknown>;
}

/**
 * Tehlikeli işlemler için onay diyaloğu. Gerekçe alanı denetim günlüğüne yazılır.
 */
export function ConfirmDialog({ state, onClose }: { state: ConfirmState | null; onClose: () => void }) {
  const t = useT();
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reasonId = useId();

  useEffect(() => {
    setReason('');
    setError(null);
    setBusy(false);
  }, [state]);

  if (!state) return null;

  const submit = async () => {
    if (state.reasonRequired && !reason.trim()) {
      setError(t('common.reasonPlaceholder'));
      return;
    }
    setBusy(true);
    try {
      await state.onConfirm(reason.trim());
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      title={state.title}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose} disabled={busy}>
            {t('common.cancel')}
          </Button>
          <Button variant={state.danger ? 'danger' : 'primary'} onClick={submit} disabled={busy}>
            {busy ? t('app.loading') : (state.confirmLabel ?? t('common.confirm'))}
          </Button>
        </>
      }
    >
      {state.description ? <p className="muted">{state.description}</p> : null}
      {state.withReason !== false ? (
        <Field label={t('common.reason')} htmlFor={reasonId}>
          <Textarea
            id={reasonId}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder={t('common.reasonPlaceholder')}
          />
        </Field>
      ) : null}
      {error ? (
        <p role="alert" style={{ color: 'var(--c-danger)', fontWeight: 600 }}>
          {error}
        </p>
      ) : null}
    </Modal>
  );
}

/** Onay diyaloğu durumunu yöneten küçük yardımcı. */
export function useConfirm() {
  const [state, setState] = useState<ConfirmState | null>(null);
  return {
    confirmState: state,
    confirm: (next: ConfirmState) => setState(next),
    closeConfirm: () => setState(null),
  };
}
