/**
 * Renders one input from a FieldDef. Every add/edit form in the app is built
 * from these, so a field the admin creates shows up everywhere with no code
 * change, and one they remove disappears just as quietly.
 */
export default function DynamicField({ def, value, onChange, options, error, disabled }) {
  const id = `f-${def.scope || 'item'}-${def.key}`;
  const list = options?.length ? options : def.options || [];

  const label = (
    <label htmlFor={id}>
      {def.label}
      {def.required ? <span className="req">*</span> : null}
      {def.unit ? <span className="muted" style={{ fontWeight: 400 }}> ({def.unit})</span> : null}
    </label>
  );

  const common = {
    id,
    disabled,
    className: def.type === 'textarea' ? 'textarea' : def.type === 'select' ? 'select' : 'input',
    placeholder: def.placeholder || '',
    'aria-invalid': error ? 'true' : undefined,
    style: error ? { borderColor: 'var(--red-500)' } : undefined,
  };

  let control;

  switch (def.type) {
    case 'textarea':
      control = <textarea {...common} value={value ?? ''} onChange={(e) => onChange(e.target.value)} rows={3} />;
      break;

    case 'number':
      control = (
        <input
          {...common}
          type="number"
          step="any"
          min={def.min ?? undefined}
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))}
        />
      );
      break;

    case 'date':
      control = (
        <input
          {...common}
          type="date"
          value={value ? String(value).slice(0, 10) : ''}
          onChange={(e) => onChange(e.target.value)}
        />
      );
      break;

    case 'select':
      control = (
        <select {...common} value={value ?? ''} onChange={(e) => onChange(e.target.value)}>
          <option value="">— Select {def.label} —</option>
          {list.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
          {/* Keep a legacy value selectable even after it leaves the master list. */}
          {value && !list.includes(value) ? <option value={value}>{value} (not in list)</option> : null}
        </select>
      );
      break;

    case 'multiselect': {
      const selected = Array.isArray(value) ? value : [];
      control = (
        <div
          style={{
            border: `1px solid ${error ? 'var(--red-500)' : 'var(--grey-300)'}`,
            borderRadius: 0,
            padding: '8px 10px',
            maxHeight: 148,
            overflowY: 'auto',
            display: 'grid',
            gap: 6,
            background: '#fff',
          }}
        >
          {list.length === 0 ? <span className="muted small">No options defined.</span> : null}
          {list.map((o) => (
            <label key={o} className="checkbox">
              <input
                type="checkbox"
                disabled={disabled}
                checked={selected.includes(o)}
                onChange={(e) => onChange(e.target.checked ? [...selected, o] : selected.filter((v) => v !== o))}
              />
              <span>{o}</span>
            </label>
          ))}
        </div>
      );
      break;
    }

    case 'checkbox':
      return (
        <div className="field">
          <label className="checkbox" style={{ marginTop: 22 }}>
            <input id={id} type="checkbox" disabled={disabled} checked={Boolean(value)} onChange={(e) => onChange(e.target.checked)} />
            <span>
              {def.label}
              {def.helpText ? <div className="hint" style={{ marginTop: 2 }}>{def.helpText}</div> : null}
            </span>
          </label>
          {error ? <div className="err">{error}</div> : null}
        </div>
      );

    case 'email':
      control = <input {...common} type="email" value={value ?? ''} onChange={(e) => onChange(e.target.value)} />;
      break;

    case 'phone':
      control = <input {...common} type="tel" value={value ?? ''} onChange={(e) => onChange(e.target.value)} />;
      break;

    case 'url':
      control = <input {...common} type="url" value={value ?? ''} onChange={(e) => onChange(e.target.value)} />;
      break;

    default:
      control = <input {...common} type="text" value={value ?? ''} onChange={(e) => onChange(e.target.value)} />;
  }

  return (
    <div className={`field${def.type === 'textarea' || def.type === 'multiselect' ? ' span-2' : ''}`}>
      {label}
      {control}
      {def.helpText ? <div className="hint">{def.helpText}</div> : null}
      {error ? <div className="err">{error}</div> : null}
    </div>
  );
}
