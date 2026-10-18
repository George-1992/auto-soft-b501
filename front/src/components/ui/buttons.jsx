import React from 'react';

const VARIANT_STYLES = {
    primary: {
        backgroundColor: 'var(--primary)',
        color: 'var(--primary-foreground)',
        '--hover-bg': 'var(--primary-hover)',
    },
    secondary: {
        backgroundColor: 'var(--secondary)',
        color: 'var(--secondary-foreground)',
        '--hover-bg': 'var(--secondary-hover)',
    },
    accent: {
        backgroundColor: 'var(--accent)',
        color: 'var(--accent-foreground)',
        '--hover-bg': 'var(--accent-light)',
    },
    warning: {
        backgroundColor: 'var(--warning)',
        color: 'var(--warning-foreground)',
        '--hover-bg': 'color-mix(in srgb, var(--warning) 85%, black)',
    },
    danger: {
        backgroundColor: 'var(--destructive)',
        color: 'var(--destructive-foreground)',
        '--hover-bg': 'color-mix(in srgb, var(--destructive) 85%, black)',
    },
    success: {
        backgroundColor: 'var(--success)',
        color: 'var(--success-foreground)',
        '--hover-bg': 'color-mix(in srgb, var(--success) 85%, black)',
    },
    outline: {
        backgroundColor: 'transparent',
        color: 'var(--foreground)',
        borderColor: 'var(--border)',
        borderWidth: '1px',
        borderStyle: 'solid',
        '--hover-bg': 'var(--muted)',
    },
    ghost: {
        backgroundColor: 'transparent',
        color: 'var(--foreground)',
        '--hover-bg': 'var(--muted)',
    },
};

const SIZE_STYLES = {
    // sm: 'px-3 py-1.5 text-sm',
    // md: 'px-4 py-2 text-base',
    // lg: 'px-6 py-3 text-lg',
    sm: 'px-2 py-1 text-sm',
    md: 'px-3 py-1.5 text-sm',
    lg: 'px-4 py-2 text-base',
    xl: 'px-6 py-3 text-lg',
};

export const Button = React.forwardRef(({
    children,
    variant = 'primary',
    size = 'md',
    type = 'button',
    isLoading = false,
    disabled = false,
    className = '',
    style = {},
    ...props
}, ref) => {
    const baseClasses = [
        'inline-flex items-center justify-center gap-2 font-medium rounded-md',
        'cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed',
        'focus:outline-none focus:ring-0',
        'hover:[background-color:var(--hover-bg)] hover:scale-[0.99]',
        'transition-all duration-200 ease-in-out',
    ].join(' ');

    const selectedVariantStyle = VARIANT_STYLES[variant] || VARIANT_STYLES.primary;
    const sizeClass = SIZE_STYLES[size] || SIZE_STYLES.md;

    // Merge default variant styles with custom inline styles
    const mergedStyles = {
        ...selectedVariantStyle,
        '--tw-ring-color': 'var(--ring)',
        ...style,
    };

    return (
        <button
            ref={ref}
            type={type}
            disabled={disabled || isLoading}
            aria-busy={isLoading}
            style={mergedStyles}
            className={`${baseClasses} ${sizeClass} ${className}`}
            {...props}
        >
            {isLoading && (
                <svg
                    className="animate-spin -ml-1 mr-2 h-4 w-4 text-current"
                    fill="none"
                    viewBox="0 0 24 24"
                >
                    <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                    />
                    <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                </svg>
            )}
            {children}
        </button>
    );
});

Button.displayName = 'Button';

// Specialized Convenience Wrappers
export const PrimaryButton = (props) => <Button variant="primary" {...props} />;
export const SecondaryButton = (props) => <Button variant="secondary" {...props} />;
export const AccentButton = (props) => <Button variant="accent" {...props} />;
export const DangerButton = (props) => <Button variant="danger" {...props} />;
export const WarningButton = (props) => <Button variant="warning" {...props} />;
export const SuccessButton = (props) => <Button variant="success" {...props} />;
export const OutlineButton = (props) => <Button variant="outline" {...props} />;
export const GhostButton = (props) => <Button variant="ghost" {...props} />;