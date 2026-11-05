export default function AuthShell({ title, children }) {
  return (
    <div className="auth">
      <section className="auth-intro">
        <p className="wordmark">Silent SOS</p>
        <h1>Ask for help without saying a word.</h1>
        <p>
          Hold one button. The people you trust get your live location by SMS, email or in the app, and you can follow what
          happens next until you mark yourself safe.
        </p>
      </section>
      <section className="auth-panel">
        <h2>{title}</h2>
        {children}
      </section>
    </div>
  );
}
