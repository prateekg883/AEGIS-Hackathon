export default function EmptyState({ title = 'No records found', message = 'Try adjusting the current filters.' }) {
  return <div className="empty-state"><strong>{title}</strong><span>{message}</span></div>;
}
