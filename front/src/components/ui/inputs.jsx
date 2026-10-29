import React from 'react';

export const Input = React.forwardRef(({
    className = 'bg-white',
    error = '',
    disabled = false,
    ...props
}, ref) => {
    const baseClass = 'w-full h-9 rounded-md border p-2 focus:outline-none focus:ring-0';
    const stateClass = error
        ? 'border-red-400'
        : 'border-gray-300';

    
    return (
        <input
            ref={ref}
            {...props}
            disabled={disabled}
            className={`${baseClass} ${stateClass} ${disabled ? 'cursor-not-allowed opacity-50' : ''} ${className}`.trim()}
        />
    );
});

Input.displayName = 'Input';


export const Textarea = React.forwardRef(({
    className = '',
    error = '',
    disabled = false,
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
            disabled={disabled}
            className={`${baseClass} ${stateClass} ${disabled ? 'cursor-not-allowed opacity-50' : ''} ${className}`.trim()}
        />
    );
}); 