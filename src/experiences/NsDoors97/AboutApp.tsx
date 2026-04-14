import "./AboutApp.css";

interface AboutAppProps {
  onClose: () => void;
}

export default function AboutApp({ onClose }: AboutAppProps) {
  return (
    <div className="ns-about">
      <div className="ns-about__logo" aria-hidden>🚪</div>

      <div className="ns-about__name">NS Doors 97</div>
      <div className="ns-about__version">Version 1.0</div>

      <div className="ns-about__rule" />

      <p className="ns-about__tagline">
        It's not Windows. It's a Door.™
      </p>

      <div className="ns-about__rule" />

      <p className="ns-about__credits">
        Developed by{" "}
        <a
          className="ns-about__link"
          href="https://noahwright.dev"
          target="_blank"
          rel="noreferrer"
        >
          Noahsoft Corporation
        </a>
      </p>

      <p className="ns-about__copyright">
        © 1997 Noahsoft Corporation. All rights reserved.
        <br />
        Noah Wright is not responsible for any data loss,
        <br />
        time loss, or excessive fun.
      </p>

      <div className="ns-about__footer">
        <button className="ns-about__ok" onClick={onClose} autoFocus>
          OK
        </button>
      </div>
    </div>
  );
}
