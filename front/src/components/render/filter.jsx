import { OutlineButton, PrimaryButton } from "@/src/components/ui/buttons";
import Select from "@/src/components/ui/select";
import { notify } from "@/src/components/ui/sonnar/sonnar";
import { sendBackRequest } from "@/src/services/backend";
import { logger } from "@/src/services/logger";
import _, { cloneDeep, cloneDeepWith } from "lodash";
import { PlusIcon } from "lucide-react";
import { useEffect, useState, useRef } from "react";
import { useTranslation } from "react-i18next";


export const FilterComponent = ({ itsFor, columns, filters, onChange, onSave }) => {

    const isMulti = (op) => op === 'one_of' || op === 'not_one_of';
    const isEmptyValue = (v) => (Array.isArray(v) ? v.length === 0 : v === '');

    const base = {
        key: '',
        operator: '',
        value: '',
    }
    const operatorOptions = [
        { value: 'equals', label: 'Equals' },
        { value: 'not_equals', label: 'Not Equals' },
        { value: 'contains', label: 'Contains' },
        { value: 'one_of', label: 'One Of' },
        { value: 'not_one_of', label: 'Not One Of' },
    ];

    const [_isLoading, _setIsLoading] = useState(false);
    const [_filters, _setFilters] = useState(filters?.length ? filters : [cloneDeep(base)]);
    const [_valueOptions, _setValueOptions] = useState({});
    const [_showValidation, _setShowValidation] = useState(false);
    const requestedKeys = useRef(new Set());
    const { t } = useTranslation();

    const update = (next) => {
        _setFilters(next);
        _setShowValidation(false);
        onChange?.(next);
    }


    const fetchUniqueValues = async (key) => {
        if (!key || requestedKeys.current.has(key)) return;

        if (!itsFor) {
            logger.warn("Filter can not fetch as itsFor is not provided");
            return;
        }

        requestedKeys.current.add(key);

        try {
            _setIsLoading(true);
            const response = await sendBackRequest({
                action: 'uniques',
                itsFor: itsFor,
                data: [{ name: key }],
            });
            // logger.info("fetchUniqueValues response", response);

            if (response.success) {
                _setValueOptions((prev) => ({ ...prev, [key]: response.data[key] }));
            } else {
                requestedKeys.current.delete(key);
                logger.error("fetchUniqueValues error", response.message || 'Error fetching unique values');
                notify({
                    type: 'error',
                    message: response.message || 'Error fetching unique values',
                });
            }
        } catch (error) {
            requestedKeys.current.delete(key);
            logger.error("fetchUniqueValues error", error);
        } finally {
            _setIsLoading(false);
        }
    }

    // initial fetch for keys that already exist in the incoming filters
    useEffect(() => {
        const keys = [...new Set(_filters.map((f) => f.key).filter(Boolean))];
        keys.forEach(fetchUniqueValues);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleChange = (index, field, value) => {
        const next = _filters.map((f, i) => {
            if (i !== index) return f;

            const updated = { ...f, [field]: value };

            if (field === 'key') {
                updated.value = isMulti(updated.operator) ? [] : '';
            }

            if (field === 'operator') {
                const wasMulti = isMulti(f.operator);
                const nowMulti = isMulti(value);
                if (nowMulti && !wasMulti) {
                    updated.value = f.value ? [f.value] : [];
                } else if (!nowMulti && wasMulti) {
                    updated.value = f.value?.[0] ?? '';
                }
            }

            return updated;
        });
        update(next);

        if (field === 'key') {
            fetchUniqueValues(value);
        }
    };
    const handleRemove = (index) => {
        const next = _filters.filter((_, i) => i !== index);
        update(next.length ? next : [cloneDeep(base)]);
    };
    const handleNoneFilter = () => {
        update([..._filters, cloneDeep(base)]);
    };
    const handleSave = () => {
        const invalidRows = _filters
            .map((f) => ({ ...f, __invalid: isFilterRowIncomplete(f) }))
            .filter((f) => f.__invalid);

        if (invalidRows.length > 0) {
            _setShowValidation(true);
            notify({
                type: 'error',
                message: t('Please complete all filter fields before saving.'),
            });
            return;
        }

        _setShowValidation(false);

        const valid = _filters
            .map((f) => (Array.isArray(f.value)
                ? { ...f, value: f.value.map((v) => v.trim()).filter(Boolean) }
                : f))
            .filter((f) => f.key && f.operator && !isEmptyValue(f.value));
        onSave?.(valid);
    };

    const fieldClass = "h-9 rounded-md px-2 text-sm outline-none focus:border-gray-500 border border-gray-300";
    const multiClass = fieldClass.replace('h-9', 'h-24');

    const isFilterRowIncomplete = (filter) => {
        const hasAnyValue = Boolean(filter?.key || filter?.operator || (!isEmptyValue(filter?.value) && filter?.value !== null && filter?.value !== undefined));
        if (!hasAnyValue) return false;
        return !filter?.key || !filter?.operator || isEmptyValue(filter?.value);
    };
    const renderValue = (filter, index, invalid = false) => {
        const options = _valueOptions[filter.key] || [];
        const hasOptions = options.length > 0;
        const multi = isMulti(filter.operator);
        const selectClassName = invalid ? 'min-h-9 w-full border rounded-md border-red-400' : 'min-h-9 w-full';

        if (hasOptions) {
            return (
                <Select
                    className={selectClassName}
                    options={options.map((val) => ({ value: val, label: val }))}
                    value={multi ? (Array.isArray(filter.value) ? filter.value : []) : (filter.value ?? '')}
                    multiple={multi}
                    clearable={true}
                    searchable={true}
                    onChange={(event) => {
                        const nextValue = event?.target?.value ?? event?.value ?? (multi ? [] : '');
                        handleChange(index, 'value', nextValue);
                    }}
                />
            );
        }

        return (
            <input
                className={(invalid ? ' rounded-md border-red-400 focus:border-red-500 ' : '') + fieldClass + ' w-full'}
                type="text"
                value={filter.value || ''}
                placeholder={t('Value')}
                onChange={(e) => handleChange(index, 'value', e.target.value)}
            />
        );
    }
    const clearFilters = () => {
        update([cloneDeep(base)]);
    }

    return (
        <div className="w-full flex flex-col gap-3">

            <div className="w-full flex flex-col gap-2 min-h-28">
                {_filters.map((filter, index) => {
                    const rowInvalid = _showValidation && isFilterRowIncomplete(filter);

                    return (
                        <div key={`kpt-${index}`} className="w-full flex flex-col gap-1">
                            <div className="w-full flex items-start gap-2">
                                <select
                                    className={(rowInvalid && !filter.key ? 'border-red-400 focus:border-red-500 ' : '') + fieldClass + ' w-40 flex-shrink-0'}
                                    value={filter.key}
                                    onChange={(e) => handleChange(index, 'key', e.target.value)}
                                >
                                    <option value="">{t('Column')}</option>
                                    {columns?.map((col) => (
                                        <option key={col.name + '-col'} value={col.name}>
                                            {col.label}
                                        </option>
                                    ))}
                                </select>

                                <select
                                    className={(rowInvalid && !filter.operator ? 'border-red-400 focus:border-red-500 ' : '') + fieldClass}
                                    value={filter.operator}
                                    onChange={(e) => handleChange(index, 'operator', e.target.value)}
                                >
                                    <option value="">{t('Operator')}</option>
                                    {operatorOptions.map((op) => (
                                        <option key={op.value + '-op'} value={op.value}>
                                            {t(op.label)}
                                        </option>
                                    ))}
                                </select>

                                {renderValue(filter, index, rowInvalid && isEmptyValue(filter.value))}

                                <button
                                    type="button"
                                    className="shrink-0 px-2 h-9 text-gray-500 hover:text-red-600"
                                    onClick={() => handleRemove(index)}
                                >
                                    ✕
                                </button>
                            </div>

                            {rowInvalid && (
                                <p className="text-xs text-red-500 pl-1">
                                    {t('Please complete this filter row before saving.')}
                                </p>
                            )}
                        </div>
                    );
                })}
            </div>

            <OutlineButton className="w-full" onClick={handleNoneFilter}>
                <PlusIcon className="size-4" /> {t('Add Filter')}
            </OutlineButton>
            <OutlineButton className="w-full" onClick={clearFilters}>
                {t('Clear Filters')}
            </OutlineButton>
            <PrimaryButton className="w-full" onClick={handleSave} disabled={_isLoading}>
                {t('Save')}
            </PrimaryButton>
        </div>
    )
}