import { forwardRef } from 'react';
import DatePicker from 'react-datepicker';
import { Calendar, X } from 'lucide-react';
import 'react-datepicker/dist/react-datepicker.css';


// Custom input component that matches your form-control styling
const CustomInput = forwardRef(({ value, onClick, placeholder, disabled, error, clearable, onClear, className, displayValue, isLoading }, ref) => (
    <div className={`relative h-9 w-full border border-gray-300 rounded-md shadow-sm overflow-hidden ${isLoading ? 'loading-shimmer' : ''} ${className}`}>
        <div
            ref={ref}
            onClick={onClick}
            className={`
                form-control flex h-full w-full items-center justify-between cursor-pointer
                transition-all duration-200
                ${disabled ? 'cursor-not-allowed opacity-50' : 'hover:border-gray-400'}
                ${error ? 'border-red-400 focus:outline-red-500' : ''}
            `}
        >


            <div className="flex items-center gap-2 px-2">
                {clearable && !disabled && value && (
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            onClear();
                        }}
                        className="text-gray-400 hover:text-gray-600 transition-colors"
                    >
                        <X className="w-4 h-4" />
                    </button>
                )}
                <Calendar className="w-4 h-4 text-[var(--accent)]" />
            </div>
            <div className="flex-1 min-w-0 px-2">
                {displayValue || value ? (
                    <span className="text-gray-900">{displayValue || value}</span>
                ) : (
                    <span className="text-gray-500">{placeholder}</span>
                )}
            </div>
        </div>
    </div>
));

CustomInput.displayName = 'CustomInput';

export const DateInput = ({
    value = '',
    onChange = () => { },
    placeholder = 'Select date...',
    disabled = false,
    required = false,
    error = '',
    className = '',
    name = '',
    id = '',
    showTime = false,
    dateFormat = 'yyyy-MM-dd',
    clearable = true,
    minDate = null,
    maxDate = null,
    inline = false, // for table inline editing
    isLoading = false,
    ...props
}) => {
    // appConsole.log('DateInput value ==> ', value);
    // return null;

    // Parse string value to Date object
    const parseValue = (val) => {
        if (!val) {
            // appConsole.log('DateInput parseValue empty ==> ');
            return null;
        }
        if (val instanceof Date) {
            // appConsole.log('DateInput parseValue Date ==> ', val);
            return val;
        }

        // Handle ISO 8601 format properly
        try {
            const parsed = new Date(val);
            // Check if the date is valid
            if (isNaN(parsed.getTime())) return null;
            return parsed;
        } catch (error) {
            return null;
        }
    };

    // Format Date object to ISO 8601 string
    const formatValue = (date) => {
        return date;
        if (!date) return '';

        // Convert string to Date object if it's a string
        const dateObj = typeof date === 'string' ? new Date(date) : date;

        if (showTime) {
            // Return full ISO 8601 datetime: 2024-10-08T14:30:00.000Z
            return dateObj.toISOString();
        } else {
            // Return ISO 8601 date only: 2024-10-08
            return dateObj.toISOString().split('T')[0];
        }
    };

    // Format date for display purposes (user-friendly format)
    const formatDisplayValue = (date) => {
        if (!date) return '';

        const options = {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
        };

        if (showTime) {
            options.hour = '2-digit';
            options.minute = '2-digit';
            options.hour12 = false; // Use 24-hour format
        }

        return date.toLocaleDateString('en-CA', options).replace(',', '');
    };

    const selectedDate = parseValue(value);
    const displayValue = formatDisplayValue(selectedDate);

    const handleChange = (date) => {
        const formattedValue = formatValue(date);
        // appConsole.log('Date changed: ', formattedValue);

        onChange({
            target: { name, value: formattedValue }
        });
    };

    const handleClear = () => {
        onChange({
            target: { name, value: '' }
        });
    };

    // For inline table editing, use simple HTML5 date input
    if (inline) {
        const handleInlineChange = (e) => {
            const inputValue = e.target.value;
            if (!inputValue) {
                onChange({ target: { name, value: '' } });
                return;
            }

            // Convert HTML5 input value to ISO 8601
            const date = new Date(inputValue);
            const isoValue = formatValue(date);
            onChange({ target: { name, value: isoValue } });
        };

        // Convert ISO value to HTML5 input format
        const getInputValue = () => {
            if (!selectedDate) return '';

            if (showTime) {
                // For datetime-local input: 2024-10-08T14:30
                return selectedDate.toISOString().slice(0, 16);
            } else {
                // For date input: 2024-10-08
                return selectedDate.toISOString().split('T')[0];
            }
        };

        return (
            <input
                type={showTime ? 'datetime-local' : 'date'}
                value={getInputValue()}
                onChange={handleInlineChange}
                className="p-1 text-sm border border-gray-300 rounded focus:ring-0 focus:outline-none w-full"
                disabled={disabled}
            />
        );
    }

    return (
        <div className={`relative w-full rounded-md ${className} `}>
            {/* Native required validator for custom select */}
            {
                required && !disabled && (
                    <input
                        tabIndex={-1}
                        value={selectedDate ? formatValue(selectedDate) : ''}
                        onChange={() => { }}
                        required
                        name={`${name}-required-validation`}
                        className="w-[1px] h-[1px] absolute opacity-0 pointer-events-none"
                    />
                )
            }
            <DatePicker
                selected={selectedDate}
                onChange={handleChange}
                dateFormat={showTime ? 'yyyy-MM-dd HH:mm' : dateFormat}
                showTimeSelect={showTime}
                timeFormat="HH:mm"
                timeIntervals={15}
                disabled={disabled}
                minDate={minDate ? parseValue(minDate) : null}
                maxDate={maxDate ? parseValue(maxDate) : null}
                placeholderText={placeholder}
                customInput={
                    <CustomInput
                        error={error}
                        clearable={clearable}
                        onClear={handleClear}
                        className={className}
                        isLoading={isLoading}
                        displayValue={displayValue}
                    />
                }
                popperClassName="date-picker-popper p-0 m-0"
                calendarClassName="date-picker-calendar"
                {...props}
            />

            {disabled && <div className="h-9 absolute inset-0 bg-gray-200 opacity-50 cursor-not-allowed  rounded-md"></div>}
            {/* Error message */}
            {error && (
                <p className="text-sm text-red-500 mt-1 expanding">
                    {error}
                </p>
            )}



        </div>
    );
};

export default DateInput;