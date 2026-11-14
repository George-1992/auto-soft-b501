import { PopupModal } from "@/src/components/modals";
import CurrencySymbol from "@/src/components/render/currency";
import DataRenderer from "@/src/components/render/pageDataRenderer";
import { PrimaryButton } from "@/src/components/ui/buttons";
import { Input } from "@/src/components/ui/inputs";
import Select from "@/src/components/ui/select";
import { notify } from "@/src/components/ui/sonnar/sonnar";
import Image from "@/src/components/wraps/image";
import { sendBackRequest } from "@/src/services/backend";
import { logger } from "@/src/services/logger";
import { setMetas } from "@/src/services/metas";
import { toDisplayNumber } from "@/src/services/other";
import { BookmarkIcon, CircleDollarSignIcon, ClipboardPenIcon, FolderPenIcon, HashIcon, Package2Icon, PlusIcon, ScanBarcodeIcon, SearchIcon, TagIcon, TruckIcon, WarehouseIcon, XIcon } from "lucide-react";
import { use, useEffect } from "react";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";

function ThisEditComponent({
    isOpen = false,
    data = null,
    onClose = () => { },
    onInputChange = () => { },
    onSubmit = () => { },
}) {
    const { t } = useTranslation();
    const [_newPartNumber, _setNewPartNumber] = useState('');
    const [_newOtherName, _setNewOtherName] = useState('');
    const [_searchTerm, _setSearchTerm] = useState('');
    const [_isLoading, _setIsLoading] = useState(false);
    const formId = 'new-part-form';

    const handleFormSubmit = (e) => {
        e.preventDefault();

        const payload = {
            ...data,
            price: Number(data?.price ?? 0),
            quantity: Number(data?.quantity ?? 0),
        };


        ['purchasePrice', 'price', 'quantity'].forEach(field => {
            if (payload[field] === undefined || payload[field] === null || isNaN(payload[field])) {
                payload[field] = 0;
            }
        });

        // logger.info('payload', payload);
        onSubmit(payload);
    };

    const handleAddPartNumber = () => {
        if (_newPartNumber.trim() !== '') {

            const arr = [];
            if (_newPartNumber.includes(',')) {
                arr.push(..._newPartNumber.split(',').map(item => item.trim()).filter(item => item !== ''));
            } else {
                arr.push(_newPartNumber.trim());
            }
            const newPartNumbers = [...(data?.partNumbers || []), ...arr];
            onInputChange('partNumbers', newPartNumbers);
            _setNewPartNumber('');
        }
    };
    const handleRemovePartNumber = (partNumberToRemove) => {
        const newPartNumbers = (data?.partNumbers || []).filter(partNumber => partNumber !== partNumberToRemove);
        onInputChange('partNumbers', newPartNumbers);
    };
    const handleAddOtherName = () => {
        if (_newOtherName.trim() !== '') {

            const arr = [];
            if (_newOtherName.includes(',')) {
                arr.push(..._newOtherName.split(',').map(item => item.trim()).filter(item => item !== ''));
            } else {
                arr.push(_newOtherName.trim());
            }
            const newOtherNames = [...(data?.otherNames || []), ...arr];
            onInputChange('otherNames', newOtherNames);
            _setNewOtherName('');
        }
    };
    const handleRemoveOtherName = (otherNameToRemove) => {
        const newOtherNames = (data?.otherNames || []).filter(otherName => otherName !== otherNameToRemove);
        onInputChange('otherNames', newOtherNames);
    };
    const handlePartNumberKeyDown = (event) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            handleAddPartNumber();
        }
    };
    const handleOtherNameKeyDown = (event) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            handleAddOtherName();
        }
    };


    const handleAiFetch = async (query) => {
        try {

        } catch (error) {
            logger.error('Error in handleAiFetch:', error);
        }
    };

    // const handleNameInputUnfocus = (e) => {
    //     try {
    //         const tagName = e.target.tagName.toLowerCase();
    //         const inputName = e.target.name;
    //         logger.info('handleNameInputUnfocus:', tagName, inputName);

    //         if (tagName === 'input' && ['name', 'otherNames'].includes(inputName)) {
    //             handleAiFetch();
    //         }

    //     } catch (error) {
    //         logger.error('Error in handleNameInputUnfocus:', error);
    //     }
    // };
    // useEffect(() => {
    //     const onFocusIn = e => logger.info('Focused:', e.target.tagName, e.target.id);
    //     const onFocusOut = e => handleNameInputUnfocus(e);

    //     document.addEventListener('focusin', onFocusIn);
    //     document.addEventListener('focusout', onFocusOut);

    //     return () => {
    //         document.removeEventListener('focusin', onFocusIn);
    //         document.removeEventListener('focusout', onFocusOut);
    //     };
    // }, []);


    const handleSearchInputChange = (e) => {
        try {
            e?.preventDefault?.();

            _setSearchTerm(e.target.value);
        } catch (error) {
            logger.error('Error in handleSearchInputChange:', error);
        }
    };
    const searchInputEnter = (e) => {
        if (e.key === 'Enter') {
            e?.preventDefault?.();
            handleSearchSubmit();
        }
    };
    const handleSearchSubmit = async () => {
        try {
            logger.info('handleSearchSubmit called with searchTerm:', _searchTerm);
            _setIsLoading(true);

            const response = await sendBackRequest({
                itsFor: 'ai-partNumber-search',
                action: 'searchParts',
                data: {
                    query: _searchTerm,
                },
            })

            // logger.info('AI Search Response:', response);
            if (!response.success) {
                notify({
                    type: 'error',
                    message: `Part number search: ${response.message || 'Unknown error'}`,
                });
            };

            // update the form data with the response data
            Object.entries(response.data || {}).forEach(([key, value]) => {
                if (key === 'partNumbers' || key === 'otherNames') {
                    const arr = Array.isArray(value) ? value : [value];
                    onInputChange(key, arr);
                } else {
                    onInputChange(key, value);
                }
            });


        } catch (error) {
            logger.error('Error in handleSearchSubmit:', error);
        } finally {
            _setIsLoading(false);
        }
    };


    const inputs = [
        [
            {
                name: 'name',
                label: 'Name',
                type: 'text',
                placeholder: 'Enter part name',
                value: data?.name ?? '',
                required: true,
                onChange: (e) => onInputChange('name', e.target.value),
                icon: <ClipboardPenIcon className="w-5 h-5 text-gray-500" />,
            },
            {
                name: 'barcode',
                label: 'Barcode',
                type: 'text',
                placeholder: 'Enter part barcode',
                value: data?.barcode ?? '',
                required: true,
                onChange: (e) => onInputChange('barcode', e.target.value),
                icon: <ScanBarcodeIcon className="w-5 h-5 text-gray-500" />,
            },
        ],
        [
            {
                name: 'sku',
                label: 'SKU',
                type: 'text',
                placeholder: 'Leave blank to auto-generate',
                value: data?.sku ?? '',
                required: false,
                onChange: (e) => onInputChange('sku', e.target.value),
                icon: <TagIcon className="w-5 h-5 text-gray-500" />,
            },

            {
                name: 'brand',
                label: 'Brand',
                type: 'text',
                placeholder: 'Enter brand name (Sachs, Bosch, etc.)',
                value: data?.brand ?? '',
                required: false,
                onChange: (e) => onInputChange('brand', e.target.value),
                icon: <BookmarkIcon className="w-5 h-5 text-gray-500" />,
            }
        ],
        [
            {
                name: 'supplier',
                label: 'Supplier',
                type: 'text',
                placeholder: 'Enter supplier name',
                value: data?.supplier ?? '',
                required: false,
                onChange: (e) => onInputChange('supplier', e.target.value),
                icon: <TruckIcon className="w-5 h-5 text-gray-500" />,
            },
            {
                name: 'description',
                label: 'Description',
                type: 'text',
                placeholder: 'Enter part description',
                value: data?.description ?? '',
                required: false,
                onChange: (e) => onInputChange('description', e.target.value),
                icon: <ClipboardPenIcon className="w-5 h-5 text-gray-500" />,
            },
        ],
        [
            {
                name: 'purchasePrice',
                label: 'Purchase Price',
                type: 'number',
                value: data?.purchasePrice ?? 0,
                onChange: (e) => onInputChange('purchasePrice', Number(e.target.value) || 0),
                icon: <CircleDollarSignIcon className="w-5 h-5 text-gray-500" />,
            },
            {
                name: 'price',
                label: 'Price',
                type: 'number',
                value: data?.price ?? 0,
                onChange: (e) => onInputChange('price', Number(e.target.value) || 0),
                icon: <CircleDollarSignIcon className="w-5 h-5 text-gray-500" />,
            },
            {
                name: 'quantity',
                label: 'Quantity',
                type: 'number',
                value: data?.quantity ?? 0,
                onChange: (e) => onInputChange('quantity', Number(e.target.value) || 0),
                icon: <WarehouseIcon className="w-5 h-5 text-gray-500" />,
            },
            {
                name: 'minStock',
                label: 'Minimum Stock',
                type: 'number',
                value: data?.minStock ?? 0,
                onChange: (e) => onInputChange('minStock', Number(e.target.value) || 0),
                icon: <WarehouseIcon className="w-5 h-5 text-gray-500" />,
            },
        ],
    ];

    return (
        <PopupModal isOpen={isOpen} onClose={onClose} className="w-11/12 md:w-[700px] px-3 ">
            <div className="w-full">
                <div className="search w-full bg-slate-200 rounded-md p-2 shadow-sm">
                    <div className="flex items-center gap-2 mb-1">
                        <SearchIcon className="w-5 h-5 text-sky-700" />
                        <label htmlFor="">
                            {t('Searchby part number or name')}
                        </label>

                    </div>
                    <div className="w-full flex gap-1 items-center ">
                        <Input
                            type="text"
                            name="searchTerm"
                            placeholder={t('Search for parts')}
                            value={_searchTerm}
                            isLoading={_isLoading}
                            onChange={handleSearchInputChange}
                            onKeyDown={searchInputEnter}
                        />
                        <button onClick={(e) => { e.preventDefault(); handleSearchSubmit(); }} className="cursor-pointer hover:scale-[98%] transition-transform duration-200">
                            <Image
                                src="/images/other/keyboard_enter_2.png"
                                alt="AI Icon"
                                className="w-10 h-10"
                            />
                        </button>
                    </div>
                </div>
                <div className="h-7"></div>
                <form id={formId} className="flex flex-col gap-5 overflow-y-auto max-h-[clamp(300px,55dvh,800px)] md:max-h-[clamp(300px,80dvh,800px)]" onSubmit={handleFormSubmit}>

                    {inputs.map((row, rowIndex) => (
                        <div key={rowIndex} className="w-full flex flex-col md:flex-row gap-1">
                            {row.map((field) => (
                                <div key={field.name} className="w-full flex flex-col gap-1">
                                    <div className="flex items-center gap-2">
                                        {field.icon}
                                        <label className="font-semibold">{t(field.label)}</label>
                                    </div>
                                    <Input
                                        type={field.type}
                                        name={field.name}
                                        isLoading={_isLoading}
                                        placeholder={field.placeholder ? t(field.placeholder) : undefined}
                                        required={Boolean(field.required)}
                                        value={field.value}
                                        onChange={field.onChange}
                                    />
                                </div>
                            ))}
                        </div>
                    ))}


                    <div className="w-full flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                            <FolderPenIcon className="w-5 h-5 text-gray-500" />
                            <label className="font-semibold">{t('Other names')}</label>
                        </div>
                        <div className="flex items-center gap-2">
                            <Input
                                type="text"
                                name="otherNames"
                                placeholder={t('Enter alternate names, allows comma-separated values eg. Brake Pad, Rotor Set')}
                                value={_newOtherName}
                                isLoading={_isLoading}
                                onChange={(e) => _setNewOtherName(e.target.value)}
                                onKeyDown={handleOtherNameKeyDown}
                            />
                            <PrimaryButton
                                type="button"
                                isLoading={_isLoading}
                                onClick={handleAddOtherName}
                                className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
                            >
                                <PlusIcon className="size-4" />
                                {t('Add')}
                            </PrimaryButton>
                        </div>
                        <div className="flex flex-wrap gap-2 mt-2">
                            {(data?.otherNames || []).map((otherName, index) => (
                                <div key={index} className="flex items-center gap-2 bg-gray-200 rounded-md px-2 py-1">
                                    <span>{otherName}</span>
                                    <button
                                        type="button"
                                        onClick={() => handleRemoveOtherName(otherName)}
                                        className="text-red-500 hover:text-red-700"
                                    >
                                        <XIcon className="size-3.5" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="w-full flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                            <HashIcon className="w-5 h-5 text-gray-500" />
                            <label className="font-semibold">{t('Part numbers')}</label>
                        </div>
                        <div className="flex items-center gap-2">
                            <Input
                                type="text"
                                name="partNumbers"
                                placeholder={t('Enter part numbers, allows comma-separated values eg. 12345, 67890')}
                                value={_newPartNumber}
                                isLoading={_isLoading}
                                onChange={(e) => _setNewPartNumber(e.target.value)}
                                onKeyDown={handlePartNumberKeyDown}
                            />
                            <PrimaryButton
                                type="button"
                                isLoading={_isLoading}
                                onClick={handleAddPartNumber}
                                className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
                            >
                                <PlusIcon className="size-4" />
                                {t('Add')}
                            </PrimaryButton>
                        </div>
                        <div className="flex flex-wrap gap-2 mt-2">
                            {(data?.partNumbers || []).map((partNumber, index) => (
                                <div key={index} className="flex items-center gap-2 bg-gray-200 rounded-md px-2 py-1">
                                    <span>{partNumber}</span>
                                    <button
                                        disabled={_isLoading}
                                        type="button"
                                        onClick={() => handleRemovePartNumber(partNumber)}
                                        className="text-red-500 hover:text-red-700"
                                    >
                                        <XIcon className="size-3.5" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>




                </form>
                <div className="flex justify-end gap-3 py-3">
                    <PrimaryButton
                        type="button"
                        isLoading={_isLoading}
                        onClick={onClose}
                        className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
                    >
                        {t('Cancel')}
                    </PrimaryButton>
                    <PrimaryButton
                        form={formId}
                        type="submit"
                        isLoading={_isLoading}
                        className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
                    >
                        {t('Save')}
                    </PrimaryButton>
                </div>
            </div >
        </PopupModal >
    );
}

export default function InventoryPage() {
    const { t } = useTranslation();

    setMetas({
        title: 'Inventory',
        description: 'Manage your inventory',
    });

    return (
        <>
            <h1 className="text-2xl font-bold mb-4">{t('Inventory')}</h1>
            <DataRenderer
                itsFor="parts"
                editComponent={ThisEditComponent}
                columns={[
                    { name: 'sku', label: 'SKU' },
                    { name: 'name', label: 'Name' },
                    { name: 'brand', label: 'Brand', width: 130 },
                    { name: 'quantity', label: 'Quantity', width: 120 },
                    {
                        name: 'purchasePrice', label: 'Purchase Price', width: 120,
                        component: ({ value, row }) => {
                            return (
                                <div className="flex items-center gap-1">
                                    <CurrencySymbol />
                                    {toDisplayNumber(value)}
                                </div>
                            );
                        }
                    },
                    {
                        name: 'price', label: 'Price', width: 120,
                        component: ({ value, row }) => {
                            return (
                                <div className="flex items-center gap-1">
                                    <CurrencySymbol />
                                    {toDisplayNumber(value)}
                                </div>
                            );
                        }
                    },
                    {
                        name: 'totalPrice', label: 'Total Price', width: 130,
                        component: ({ value, row }) => {

                            const totalPrice = (row?.price ?? 0) * (row?.quantity ?? 0);

                            return (
                                <div className="flex items-center gap-1">
                                    <CurrencySymbol />
                                    {toDisplayNumber(totalPrice)}
                                </div>
                            );
                        }
                    },
                    {
                        name: 'partNumbers', label: 'Part Numbers',
                        component: ({ value, row }) => {

                            return (
                                <div className="flex items-center gap-1">
                                    {(value || []).map((partNumber, index) => (
                                        <div key={index} className="flex items-center gap-2 bg-gray-200 rounded-md px-2 py-1">
                                            <span className="text-xs">{partNumber}</span>
                                        </div>
                                    ))}
                                </div>
                            );
                        }
                    },
                    {
                        name: 'otherNames', label: 'Other Names',
                        component: ({ value, row }) => {

                            return (
                                <div className="flex items-center gap-1">
                                    {(value || []).map((otherName, index) => (
                                        <div key={index} className="flex items-center gap-2 bg-gray-200 rounded-md px-2 py-1">
                                            <span className="text-xs">{otherName}</span>
                                        </div>
                                    ))}
                                </div>
                            );
                        }
                    },
                ]}
            />
        </>
    );
}

