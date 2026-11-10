import { LoaderShimmer } from '@/src/components/ui/loader';
import React from 'react';

export const Input = React.forwardRef(({
    className = '',
    error = '',
    disabled = false,
    isLoading = false,
    onChange = () => { },
    ...props
}, ref) => {
    const baseClass = 'w-full h-9 rounded-md border p-2 focus:outline-none focus:ring-0';
    const stateClass = error ? 'border-red-400' : 'border-gray-300';
    const bgClass = isLoading ? 'loading-shimmer' : '';

    const handleChange = (e) => {
        if (disabled || isLoading) return;

        // if type is number and 05 typed make it 5, if 00 make it 0
        if (props.type === 'number') {
            const value = e.target.value;
            if (value === '00') {
                e.target.value = '0';
            }
            if (value.startsWith('0') && value.length > 1) {
                e.target.value = value.replace(/^0+/, '');
            }
        }

        onChange(e);
    };

    return (
        <input
            ref={ref}
            {...props}
            onChange={handleChange}
            disabled={disabled || isLoading}
            aria-busy={isLoading}
            aria-invalid={!!error}
            className={`bg-[var(--input)] ${baseClass} ${stateClass} ${bgClass} ${disabled ? 'cursor-not-allowed opacity-50' : ''} ${className}`.trim()}
        />
    );
});

Input.displayName = 'Input';


export const Textarea = React.forwardRef(({
    className = '',
    error = '',
    disabled = false,
    isLoading = false,
    ...props
}, ref) => {
    const baseClass = 'w-full min-h-20 rounded-md border p-2 focus:outline-none focus:ring-0';
    const stateClass = error
        ? 'border-red-400'
        : 'border-gray-300';

    return (
        <textarea
            ref={ref}
            {...props}
            disabled={disabled || isLoading}
            className={`bg-[var(--input)] ${baseClass} ${stateClass} ${isLoading ? 'loading-shimmer' : ''} ${disabled ? 'cursor-not-allowed opacity-50' : ''} ${className}`.trim()}
        />
    );
}); 