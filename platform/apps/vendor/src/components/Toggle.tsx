/** Accessible on/off switch. */
export function Toggle(props: {
  on: boolean;
  onChange: (v: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={props.on}
      aria-label={props.label}
      disabled={props.disabled}
      className={`tgl ${props.on ? 'is-on' : ''}`}
      onClick={() => props.onChange(!props.on)}
    >
      <i />
    </button>
  );
}
