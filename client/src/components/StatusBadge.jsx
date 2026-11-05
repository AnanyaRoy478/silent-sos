import { STATUS_LABEL } from '../lib/format';

export default function StatusBadge({ status }) {
  return (
    <span className={`badge badge-${status}`}>
      <span className="badge-dot" aria-hidden="true" />
      {STATUS_LABEL[status] || status}
    </span>
  );
}
