import { useId, useMemo, useState, useEffect } from 'react';

const normalizeHex = (value) => {
    if (typeof value !== 'string') return '#000000';

    let hex = value.trim().toLowerCase();
    if (!hex) return '#000000';
    if (!hex.startsWith('#')) hex = `#${hex}`;

    if (/^#[0-9a-f]{3}$/i.test(hex)) {
        const expanded = hex.slice(1).split('').map((char) => char + char).join('');
        return `#${expanded}`;
    }

    if (/^#[0-9a-f]{6}$/i.test(hex)) {
        return hex;
    }

    return '#000000';
};

export default function ColorPicker({
    color = '#000000',
    onChange = () => { },
    name = '',
    label = 'Color',
    disabled = false,
    className = '',
    id = '',
}) {
    const generatedId = useId();
    const safeId = id || generatedId;
    const [value, setValue] = useState(normalizeHex(color));

    useEffect(() => {
        setValue(normalizeHex(color));
    }, [color]);

    const displayValue = useMemo(() => normalizeHex(value), [value]);

    const emitChange = (nextColor) => {
        const normalized = normalizeHex(nextColor);
        setValue(normalized);
        onChange({
            target: {
                name,
                value: normalized,
            },
        });
    };

    return (
        <div className={`${className} `}  >

            {!disabled &&
                <div className='rounded-full w-8 h-8 border border-gray-500 flex items-center justify-center cursor-pointer' style={{ backgroundColor: displayValue }}>
                    <input
                        id={safeId}
                        type="color"
                        value={displayValue}
                        onChange={(e) => emitChange(e.target.value)}
                        disabled={disabled}
                        aria-label={label}
                        className='rounded-full w-full h-full p-0 cursor-pointer'
                    // style={{
                    //     width: '52px',
                    //     height: '36px',
                    //     border: '1px solid #d1d5db',
                    //     borderRadius: '8px',
                    //     background: '#fff',
                    //     padding: '3px',
                    //     cursor: disabled ? 'not-allowed' : 'pointer',
                    //     opacity: disabled ? 0.6 : 1,
                    // }}
                    />
                </div>

            }
            {/* <input
                type="text"
                value={displayValue}
                onChange={(e) => {
                    const nextValue = e.target.value;
                    if (!nextValue || nextValue.startsWith('#')) {
                        const normalized = normalizeHex(nextValue);
                        setValue(normalized);
                        onChange({
                            target: {
                                name,
                                value: normalized,
                            },
                        });
                    }
                }}
                onBlur={(e) => {
                    emitChange(e.target.value);
                }}
                disabled={disabled}
                aria-label={`${label} value`}
                style={{
                    width: '96px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    padding: '7px 10px',
                    fontSize: '13px',
                    fontFamily: 'inherit',
                    background: '#fff',
                    color: '#111827',
                    outline: 'none',
                    opacity: disabled ? 0.6 : 1,
                }}
            /> */}

            {disabled &&
                <div
                    aria-hidden="true"
                    style={{
                        width: '20px',
                        height: '20px',
                        borderRadius: '999px',
                        border: '1px solid rgba(0,0,0,0.12)',
                        background: displayValue,
                        boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.5)',
                        flexShrink: 0,
                    }}
                />
            }
        </div>
    );
}