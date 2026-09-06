import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';

import { useT } from '../i18n';

/* ------------------------------------------------------------------ Button */

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: 'sm' | 'md';
  block?: boolean;
}

export function Button({ variant = 'secondary', size = 'md', block, className, ...rest }: ButtonProps) {
  const classes = ['btn', `btn-${variant}`, size === 'sm' ? 'btn-sm' : '', block ? 'btn-block' : '', className ?? '']
    .filter(Boolean)
    .join(' ');
  return <button type="button" className={classes} {...rest} />;
}

/* -------------------------------------------------------------------- Card */

export function Card({
  title,
  subtitle,
  actions,
  children,
  className,
}: {
  title?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={['card', className ?? ''].filter(Boolean).join(' ')}>
      {(title || actions) && (
        <header className="card-head">
          <div>
            {title ? <div className="card-title">{title}</div> : null}
            {subtitle ? <div className="card-sub">{subtitle}</div> : null}
          </div>
          <div className="spacer" />
          {actions}
        </header>
      )}
      {children}
    </section>
  );
}

/* ------------------------------------------------------------------- Badge */

export type BadgeTone = 'neutral' | 'success' | 'danger' | 'warning' | 'info' | 'accent';

export function Badge({ tone = 'neutral', children }: { tone?: BadgeTone; children: ReactNode }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

/* ------------------------------------------------------------- Form pieces */

export function Field({
  label,
  hint,
  htmlFor,
  children,
  grow,
}: {
  label: string;
  hint?: string;
  htmlFor?: string;
  children: ReactNode;
  grow?: boolean;
}) {
  return (
    <div className={['field', grow ? 'grow' : ''].filter(Boolean).join(' ')}>
      <label className="field-label" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {hint ? <span className="field-hint">{hint}</span> : null}
    </div>
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input className="input" {...props} />;
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className="textarea" {...props} />;
}

export function Select({
  options,
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement> & { options: { value: string; label: string }[] }) {
  return (
    <select className="select" {...rest}>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

/* -------------------------------------------------------------------- Tabs */

export function Tabs<T extends string>({
  value,
  onChange,
  items,
  ariaLabel,
}: {
  value: T;
  onChange: (value: T) => void;
  items: { value: T; label: string; badge?: number }[];
  ariaLabel: string;
}) {
  return (
    <div className="tabs" role="tablist" aria-label={ariaLabel}>
      {items.map((item) => (
        <button
          key={item.value}
          type="button"
          role="tab"
          className="tab"
          aria-selected={item.value === value}
          onClick={() => onChange(item.value)}
        >
          {item.label}
          {item.badge !== undefined && item.badge > 0 ? ` (${item.badge})` : ''}
        </button>
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------- Stat */

export function Stat({
  label,
  value,
  delta,
  hint,
}: {
  label: string;
  value: string;
  delta?: number;
  hint?: string;
}) {
  return (
    <div className="stat">
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value}</span>
      {delta !== undefined ? (
        <span className={`stat-delta ${delta >= 0 ? 'up' : 'down'}`}>
          {delta >= 0 ? '▲' : '▼'} %{Math.abs(delta).toFixed(1)}
        </span>
      ) : null}
      {hint ? <span className="small muted">{hint}</span> : null}
    </div>
  );
}

/* --------------------------------------------------------- State displays */

export function Empty({ message }: { message?: string }) {
  const t = useT();
  return <div className="empty">{message ?? t('app.empty')}</div>;
}

export function Loading() {
  const t = useT();
  return (
    <div className="empty" role="status" aria-live="polite">
      {t('app.loading')}
    </div>
  );
}

export function ErrorNote({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const t = useT();
  const message = error instanceof Error ? error.message : String(error);
  return (
    <div className="empty" role="alert">
      <div style={{ color: 'var(--c-danger)', fontWeight: 700 }}>{t('app.error')}</div>
      <div className="small">{message}</div>
      {onRetry ? (
        <div style={{ marginTop: 10 }}>
          <Button onClick={onRetry}>{t('app.retry')}</Button>
        </div>
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------------- Pagination */

export function Pagination({
  page,
  pageSize,
  total,
  onPage,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPage: (page: number) => void;
}) {
  const t = useT();
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <nav className="pagination" aria-label={t('common.page')}>
      <Button size="sm" onClick={() => onPage(page - 1)} disabled={page <= 1} aria-label={t('common.prev')}>
        ‹ {t('common.prev')}
      </Button>
      <span aria-live="polite">
        {t('common.page')} {page} / {pages} · {total} {t('common.rows')}
      </span>
      <Button size="sm" onClick={() => onPage(page + 1)} disabled={page >= pages} aria-label={t('common.next')}>
        {t('common.next')} ›
      </Button>
    </nav>
  );
}

/* ------------------------------------------------------------------ Layout */

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="row" style={{ marginBottom: 16 }}>
      <div>
        <h1>{title}</h1>
        {subtitle ? <div className="muted small">{subtitle}</div> : null}
      </div>
      <div className="spacer" />
      {actions}
    </div>
  );
}

export function KeyValue({ items }: { items: { label: string; value: ReactNode }[] }) {
  return (
    <dl className="kv">
      {items.map((item) => (
        <div key={item.label} style={{ display: 'contents' }}>
          <dt>{item.label}</dt>
          <dd>{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Avatar({ src, alt, large }: { src: string | null; alt: string; large?: boolean }) {
  if (!src) {
    return (
      <span className={['avatar', large ? 'avatar-lg' : ''].join(' ')} aria-hidden="true" style={{ display: 'grid', placeItems: 'center', fontWeight: 700 }}>
        {alt.slice(0, 1).toLocaleUpperCase('tr')}
      </span>
    );
  }
  return <img className={['avatar', large ? 'avatar-lg' : ''].join(' ')} src={src} alt="" aria-hidden="true" loading="lazy" />;
}

export function ProgressBar({ pct, tone }: { pct: number; tone?: string }) {
  return (
    <div className="progress" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
      <div style={{ width: `${Math.min(100, Math.max(0, pct))}%`, background: tone ?? 'var(--c-primary)' }} />
    </div>
  );
}
