'use client';
import * as React from 'react';

export function Card({ title, action, children, className = '' }: {
  title?: string; action?: React.ReactNode; children: React.ReactNode; className?: string;
}) {
  return (
    <section className={`rounded-2xl bg-white border border-clinical-border shadow-sm shadow-brand-900/5 ${className}`}>
      {(title || action) && (
        <header className="flex items-center justify-between px-5 py-4 border-b border-clinical-border">
          <h2 className="font-semibold tracking-tight text-clinical-text">{title}</h2>
          {action}
        </header>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
}

export function Button({
  variant = 'primary', size = 'md', className = '', ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' | 'danger' | 'accent'; size?: 'sm' | 'md' }) {
  const base =
    'inline-flex items-center justify-center rounded-lg font-medium transition focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed';
  const sz = size === 'sm' ? 'px-3 py-1.5 text-sm' : 'px-4 py-2 text-sm';
  const v =
    variant === 'primary'
      ? 'bg-gradient-to-r from-brand-600 to-brand-500 text-white shadow-sm shadow-brand-600/20 hover:from-brand-500 hover:to-brand-600 hover:shadow-md hover:shadow-brand-600/30 focus:ring-brand-500/40'
      : variant === 'accent'
        ? 'bg-gradient-to-r from-accent-500 to-accent-400 text-white shadow-sm shadow-accent-500/20 hover:shadow-md hover:shadow-accent-500/30 focus:ring-accent-400/40'
        : variant === 'danger'
          ? 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500/40'
          : 'border border-clinical-border bg-white text-clinical-text hover:bg-brand-50 hover:border-brand-200 hover:text-brand-700 focus:ring-brand-500/30';
  return <button className={`${base} ${sz} ${v} ${className}`} {...rest} />;
}

const fieldCls =
  'w-full rounded-lg border border-clinical-border bg-white px-3.5 py-2.5 text-sm text-clinical-text placeholder:text-clinical-muted/60 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 disabled:bg-clinical-bg disabled:cursor-not-allowed';

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${fieldCls} ${props.className ?? ''}`} />;
}
export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${fieldCls} ${props.className ?? ''}`} />;
}
export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`${fieldCls} ${props.className ?? ''}`} />;
}

export function Badge({ tone = 'neutral', children }: { tone?: 'neutral' | 'success' | 'warn' | 'danger' | 'info' | 'accent'; children: React.ReactNode }) {
  const palette = {
    neutral: 'bg-gray-100 text-gray-700',
    success: 'bg-emerald-100 text-emerald-800',
    warn:    'bg-amber-100 text-amber-800',
    danger:  'bg-red-100 text-red-800',
    info:    'bg-brand-50 text-brand-700 ring-1 ring-brand-100',
    accent:  'bg-accent-50 text-accent-700 ring-1 ring-accent-100',
  }[tone];
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${palette}`}>{children}</span>;
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="text-center py-12">
      <div className="mx-auto mb-3 grid h-10 w-10 place-items-center rounded-full bg-brand-50 text-brand-500">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
          <circle cx="12" cy="12" r="9" />
          <path d="M8 12h8" strokeLinecap="round" />
        </svg>
      </div>
      <div className="text-sm font-medium text-clinical-text">{title}</div>
      {hint && <div className="text-xs text-clinical-muted mt-1">{hint}</div>}
    </div>
  );
}

export function Spinner() {
  return <div className="inline-block size-4 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />;
}

export function Table<T>({ rows, columns, emptyText = 'No data' }: {
  rows: T[];
  columns: { header: string; cell: (row: T) => React.ReactNode; width?: string }[];
  emptyText?: string;
}) {
  if (!rows.length) return <EmptyState title={emptyText} />;
  return (
    <div className="overflow-x-auto -mx-5 px-5">
      <table className="w-full text-sm">
        <thead className="text-left text-[11px] uppercase tracking-wider text-clinical-muted">
          <tr className="border-b border-clinical-border">
            {columns.map((c) => (
              <th key={c.header} style={{ width: c.width }} className="py-2.5 pr-3 font-semibold">{c.header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-clinical-border/60 transition hover:bg-brand-50/40">
              {columns.map((c) => <td key={c.header} className="py-3 pr-3 align-middle">{c.cell(row)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
