import { fmtDateTime } from '../lib/format';

export default function Timeline({ logs = [] }) {
  if (!logs.length) return <p className="muted">No activity yet.</p>;
  return (
    <ol className="timeline">
      {logs.map((l, i) => (
        <li key={`${l.at}-${i}`} className={`tl-${l.event}`}>
          <span className="tl-msg">{l.message}</span>
          <time className="tl-time" dateTime={l.at}>{fmtDateTime(l.at)}</time>
        </li>
      ))}
    </ol>
  );
}
