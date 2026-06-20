'use client';

interface Props { page: number; total: number; pageSize: number; onChange: (p: number) => void; }

export default function Pagination({ page, total, pageSize, onChange }: Props) {
  const totalPages = Math.ceil(total / pageSize);
  if (totalPages <= 1) return <p className="text-xs text-gray-400">{total} items</p>;

  const pages: (number | '...')[] = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    if (page > 3) pages.push('...');
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.push(i);
    if (page < totalPages - 2) pages.push('...');
    pages.push(totalPages);
  }

  return (
    <div className="flex items-center justify-between">
      <p className="text-xs text-gray-400">{Math.min((page - 1) * pageSize + 1, total)}–{Math.min(page * pageSize, total)} of {total}</p>
      <div className="flex items-center gap-1">
        <button onClick={() => onChange(page - 1)} disabled={page === 1}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-sm disabled:opacity-40 text-gray-500 hover:bg-blue-50 transition-colors">‹</button>
        {pages.map((p, i) => p === '...'
          ? <span key={`e${i}`} className="w-8 h-8 flex items-center justify-center text-sm text-gray-400">…</span>
          : <button key={p} onClick={() => onChange(p as number)}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-sm font-medium transition-colors"
              style={p === page ? { backgroundColor: '#3B82F6', color: '#fff' } : { color: '#374151' }}>
              {p}
            </button>
        )}
        <button onClick={() => onChange(page + 1)} disabled={page === totalPages}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-sm disabled:opacity-40 text-gray-500 hover:bg-blue-50 transition-colors">›</button>
      </div>
    </div>
  );
}
