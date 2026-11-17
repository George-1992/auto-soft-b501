import { BulkPartsFromFiles } from "@/src/components/ai/parts";
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
import { fileToBase64, toDisplayNumber } from "@/src/services/other";
import { BadgeInfoIcon, BookmarkIcon, CircleDollarSignIcon, ClipboardPenIcon, FolderPenIcon, HashIcon, InfoIcon, Package2Icon, PlusIcon, RulerDimensionLineIcon, ScanBarcodeIcon, SearchIcon, TagIcon, TruckIcon, WarehouseIcon, XIcon } from "lucide-react";
import { use, useEffect } from "react";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";

const dummyEditItemsParts = [
    {
        "name": "Lexus RX300 2002-2003 Front Disc Brake Pad Set",
        "brand": "Wearever",
        "description": "Front semi-metallic disc brake pad set for the 2002-2003 Lexus RX300, made in Spain. Interchange references include NAD930, D930, ACT930, PDM930, MX930, RD930 and 102.09300.",
        "partNumber": "MKD930",
        "barcode": "",
        "quantity": 0,
        "partNumbers": [
            "NAD930",
            "D930",
            "ACT930",
            "PDM930",
            "MX930",
            "RD930",
            "102.09300"
        ],
        "otherNames": [
            "Front Disc Brake Pads",
            "Front Brake Pad Set",
            "Semi-Metallic Brake Pads"
        ]
    },
    {
        "name": "Disc Brake Pad Set",
        "brand": "",
        "description": "Disc brake pad set built on FMSI D1965 friction base. Interchange references include ACT1965, BC1965, ZD1965 and OEX1965.",
        "partNumber": "MKD1965",
        "barcode": "",
        "quantity": 0,
        "partNumbers": [
            "D1965",
            "9190-D1965",
            "ACT1965",
            "BC1965",
            "ZD1965",
            "OEX1965"
        ],
        "otherNames": [
            "Disc Brake Pads",
            "Brake Pad Set"
        ]
    }
];

function ThisEditComponent({
    isOpen = false,
    data = null,
    onClose = () => { },
    onInputChange = () => { },
    onSubmit = async () => { },
}) {
    const { t } = useTranslation();
    const [_newPartNumber, _setNewPartNumber] = useState('');
    const [_newOtherName, _setNewOtherName] = useState('');
    const [_searchTerm, _setSearchTerm] = useState('');
    const [_isLoading, _setIsLoading] = useState(false);

    const [_editItems, _setEditItems] = useState([]);
    const [_editItem, _setEditItem] = useState(data || null);
    // const [_editItems, _setEditItems] = useState(dummyEditItemsParts);
    // const [_editItem, _setEditItem] = useState(_editItems[0]);

    const formId = 'new-part-form';


    const handleFormSubmit = async (e) => {
        e?.preventDefault?.();

        const payload = {
            ...data,
            ..._editItem,
            purchasePrice: Number(_editItem?.purchasePrice ?? data?.purchasePrice ?? 0),
            price: Number(_editItem?.price ?? data?.price ?? 0),
            quantity: Number(_editItem?.quantity || data?.quantity || 1),
            unit: _editItem?.unit ?? data?.unit ?? 'piece',
            status: _editItem?.status ?? data?.status ?? 'active',
        };
        // logger.info('payload >>> ', payload);
        const response = await onSubmit(payload);

        if (response.success) {
            if (_editItems.length === 0) {
                notify({
                    type: 'success',
                    message: t('Part saved successfully'),
                })
                onClose({ isRefetch: false });
            } else {
                // notify({
                //     type: 'success',
                //     message: t('Part saved successfully. You can continue editing the next part.'),
                // });

                // remove saved part from _editItems and set the next one as _editItem
                _setEditItems(prev => {
                    const newItems = prev.filter(item => item.partNumber !== _editItem.partNumber);
                    if (newItems.length > 0) {
                        _setEditItem(newItems[0]);
                    } else {
                        _setEditItem(null);
                        // refetch the list after all parts are saved,so no duplicated
                        // lines remain
                        onClose({ isRefetch: true });
                    }
                    return newItems;
                });
            }
        } else {
            notify({
                type: 'error',
                message: t('Failed to save part'),
            });
        }
    };

    const handleThisInputChange = (field, value) => {
        // onInputChange(field, value);
        _setEditItem(prev => ({
            ...prev,
            [field]: value,
        }));
    };
    const handleAddPartNumber = () => {
        if (_newPartNumber.trim() !== '') {

            const arr = [];
            if (_newPartNumber.includes(',')) {
                arr.push(..._newPartNumber.split(',').map(item => item.trim()).filter(item => item !== ''));
            } else {
                arr.push(_newPartNumber.trim());
            }
            const newPartNumbers = [...(_editItem?.partNumbers || []), ...arr];
            handleThisInputChange('partNumbers', newPartNumbers);
            _setNewPartNumber('');
        }
    };
    const handleRemovePartNumber = (partNumberToRemove) => {
        const newPartNumbers = (_editItem?.partNumbers || []).filter(partNumber => partNumber !== partNumberToRemove);
        handleThisInputChange('partNumbers', newPartNumbers);
    };
    const handleAddOtherName = () => {
        if (_newOtherName.trim() !== '') {

            const arr = [];
            if (_newOtherName.includes(',')) {
                arr.push(..._newOtherName.split(',').map(item => item.trim()).filter(item => item !== ''));
            } else {
                arr.push(_newOtherName.trim());
            }
            const newOtherNames = [...(_editItem?.otherNames || []), ...arr];
            handleThisInputChange('otherNames', newOtherNames);
            _setNewOtherName('');
        }
    };
    const handleRemoveOtherName = (otherNameToRemove) => {
        const newOtherNames = (_editItem?.otherNames || []).filter(otherName => otherName !== otherNameToRemove);
        handleThisInputChange('otherNames', newOtherNames);
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
    const handleSearchSubmit = async (files = []) => {
        try {
            logger.info('handleSearchSubmit called with searchTerm:', _searchTerm);
            // logger.info('handleSearchSubmit files:', files);
            _setIsLoading(true);

            const mediasToMessageObject = async (medias = []) => {
                return await Promise.all(
                    medias.map(async (file) => ({
                        type: 'file',
                        data: await fileToBase64(file), // Accepts data URL ("data:image/jpeg;base64,...") or raw base64
                        mediaType: file.type || 'image/jpeg', // Uses the File's MIME type (e.g., 'image/png') with a fallback
                    }))
                );
            };

            const response = await sendBackRequest({
                itsFor: 'ai-partNumber-search',
                action: 'searchParts',
                data: {
                    // query: _searchTerm,
                    // files: files || [],
                    messages: [
                        ...(
                            _searchTerm.trim() !== '' ? [{
                                role: 'user',
                                content: _searchTerm.trim(),
                            }] : []
                        ),
                        ...(files.length > 0 ? [{
                            role: 'user',
                            content: await mediasToMessageObject(files),
                        }] : []),
                    ],
                },
            })

            logger.info('AI Search Response:', response);
            if (!response.success) {
                notify({
                    type: 'error',
                    message: `Part number search: ${response.message || 'Unknown error'}`,
                });
            };

            // // update the form data with the response data
            // Object.entries(response.data || {}).forEach(([key, value]) => {
            //     if (key === 'partNumbers' || key === 'otherNames') {
            //         const arr = Array.isArray(value) ? value : [value];
            //         onInputChange(key, arr);
            //     } else {
            //         onInputChange(key, value);
            //     }
            // });


            // set _editItem with the response data first if array ort
            // just it if object 
            // and if more than one set _editItems with the rest
            if (Array.isArray(response.data) && response.data.length > 0) {
                _setEditItem(response.data[0]);
                if (response.data.length > 1) {
                    _setEditItems(response.data);
                } else {
                    _setEditItems([]);
                }
            } else if (response.data && typeof response.data === 'object') {
                _setEditItem(response.data);
            } else {
                notify({
                    type: 'warning',
                    message: 'No parts found for the given search term or files.',
                });
            }


        } catch (error) {
            logger.error('Error in handleSearchSubmit:', error);
        } finally {
            _setIsLoading(false);
        }
    };


    const handleFilesAdded = (files = []) => {
        try {
            // logger.info('Files added:', files);
            if (files.length > 0) {
                handleSearchSubmit(files);
            } else {
                notify({
                    type: 'warning',
                    message: 'No files added',
                });
            }
        } catch (error) {
            logger.error('Error in handleFilesAdded:', error);
        }
    };


    const inputs = [
        [
            {
                name: 'name',
                label: 'Name',
                elementType: 'input',
                type: 'text',
                placeholder: 'Enter part name',
                value: _editItem?.name ?? data?.name ?? '',
                required: true,
                onChange: (e) => handleThisInputChange('name', e.target.value),
                icon: <ClipboardPenIcon className="w-5 h-5 text-gray-500" />,
            },
            {
                name: 'barcode',
                label: 'Barcode',
                elementType: 'input',
                type: 'text',
                placeholder: 'Enter part barcode',
                value: _editItem?.barcode ?? data?.barcode ?? '',
                required: false,
                onChange: (e) => handleThisInputChange('barcode', e.target.value),
                icon: <ScanBarcodeIcon className="w-5 h-5 text-gray-500" />,
            },
            {
                name: 'status',
                label: 'Status',
                elementType: 'select',
                placeholder: 'Select part status',
                value: _editItem?.status ?? data?.status ?? 'active',
                required: true,
                options: [
                    { value: 'active', label: 'Active' },
                    { value: 'inactive', label: 'Inactive' },
                    { value: 'discontinued', label: 'Discontinued' },
                ],
                onChange: (e) => handleThisInputChange('status', e.target.value),
                icon: <BadgeInfoIcon className="w-5 h-5 text-gray-500" />,
            },
        ],
        [
            {
                name: 'sku',
                label: 'SKU',
                elementType: 'input',
                type: 'text',
                placeholder: 'Leave blank to auto-generate',
                value: _editItem?.sku ?? data?.sku ?? '',
                required: false,
                onChange: (e) => handleThisInputChange('sku', e.target.value),
                icon: <TagIcon className="w-5 h-5 text-gray-500" />,
            },
            {
                name: 'brand',
                label: 'Brand',
                elementType: 'input',
                type: 'text',
                placeholder: 'Enter brand name (Sachs, Bosch, etc.)',
                value: _editItem?.brand ?? data?.brand ?? '',
                required: false,
                onChange: (e) => handleThisInputChange('brand', e.target.value),
                icon: <BookmarkIcon className="w-5 h-5 text-gray-500" />,
            },
            {
                name: 'partNumber',
                label: 'Part Number',
                elementType: 'input',
                type: 'text',
                placeholder: 'Enter part number',
                value: _editItem?.partNumber ?? data?.partNumber ?? '',
                required: false,
                onChange: (e) => handleThisInputChange('partNumber', e.target.value),
                icon: <HashIcon className="w-5 h-5 text-gray-500" />,
            }
        ],
        [
            {
                name: 'supplier',
                label: 'Supplier',
                elementType: 'input',
                type: 'text',
                placeholder: 'Enter supplier name',
                value: _editItem?.supplier ?? data?.supplier ?? '',
                required: false,
                onChange: (e) => handleThisInputChange('supplier', e.target.value),
                icon: <TruckIcon className="w-5 h-5 text-gray-500" />,
            },
            {
                name: 'description',
                label: 'Description',
                elementType: 'input',
                type: 'text',
                placeholder: 'Enter part description',
                value: _editItem?.description ?? data?.description ?? '',
                required: false,
                onChange: (e) => handleThisInputChange('description', e.target.value),
                icon: <ClipboardPenIcon className="w-5 h-5 text-gray-500" />,
            },
        ],
        [
            {
                name: 'purchasePrice',
                label: 'Purchase Price',
                elementType: 'input',
                type: 'number',
                value: _editItem?.purchasePrice ?? data?.purchasePrice ?? 0,
                onChange: (e) => handleThisInputChange('purchasePrice', Number(e.target.value) || 0),
                icon: <CircleDollarSignIcon className="w-5 h-5 text-gray-500" />,
            },
            {
                name: 'price',
                label: 'Price',
                elementType: 'input',
                type: 'number',
                value: _editItem?.price ?? data?.price ?? 0,
                onChange: (e) => handleThisInputChange('price', Number(e.target.value) || 0),
                icon: <CircleDollarSignIcon className="w-5 h-5 text-gray-500" />,
            },
            {
                name: 'quantity',
                label: 'Quantity',
                elementType: 'input',
                type: 'number',
                value: _editItem?.quantity || data?.quantity || 1,
                onChange: (e) => handleThisInputChange('quantity', Number(e.target.value) || 0),
                icon: <WarehouseIcon className="w-5 h-5 text-gray-500" />,
            },
            {
                name: 'minStock',
                label: 'Minimum Stock',
                elementType: 'input',
                type: 'number',
                value: _editItem?.minStock ?? data?.minStock ?? 0,
                onChange: (e) => handleThisInputChange('minStock', Number(e.target.value) || 0),
                icon: <WarehouseIcon className="w-5 h-5 text-gray-500" />,
            },
            {
                name: 'unit',
                label: 'Unit',
                elementType: 'select',
                placeholder: 'Select part unit',
                value: _editItem?.unit ?? data?.unit ?? 'piece',
                required: true,
                options: [
                    { value: 'piece', label: 'Piece' },
                    { value: 'box', label: 'Box' },
                    { value: 'pack', label: 'Pack' },
                    { value: 'set', label: 'Set' },
                    { value: 'roll', label: 'Roll' },
                    { value: 'meter', label: 'Meter' },
                    { value: 'liter', label: 'Liter' },
                    { value: 'gallon', label: 'Gallon' },
                ],
                onChange: (e) => handleThisInputChange('unit', e.target.value),
                icon: <RulerDimensionLineIcon className="w-5 h-5 text-gray-500" />,
            },

        ],

    ];

    return (
        <PopupModal isOpen={isOpen} onClose={onClose} className="w-11/12 md:w-[800px] px-3 ">
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
                        >
                            <button onClick={(e) => { e.preventDefault(); handleSearchSubmit(); }} className="cursor-pointer hover:scale-[98%] transition-transform duration-200">
                                <Image
                                    src="/images/other/keyboard_enter_2.png"
                                    alt="AI Icon"
                                    className="w-auto h-7"
                                />
                            </button>
                        </Input>

                        <BulkPartsFromFiles onChange={handleFilesAdded} />
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
                                    {field.elementType === 'select' ? (
                                        <Select
                                            name={field.name}
                                            className="h-9"
                                            isLoading={_isLoading}
                                            required={Boolean(field.required)}
                                            value={field.value}
                                            onChange={field.onChange}
                                            options={field.options || []}
                                            placeholder={field.placeholder ? t(field.placeholder) : undefined}
                                        />
                                    ) : (
                                        <Input
                                            type={field.type}
                                            name={field.name}
                                            isLoading={_isLoading}
                                            placeholder={field.placeholder ? t(field.placeholder) : undefined}
                                            required={Boolean(field.required)}
                                            value={field.value}
                                            onChange={field.onChange}
                                        />
                                    )}
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
                            {(_editItem?.otherNames || []).map((otherName, index) => (
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
                            <div className="flex items-center gap-1 relative">
                                <HashIcon className="w-5 h-5 text-gray-500" />
                                <HashIcon className="w-5 h-5 text-gray-500 absolute top-0.5 left-1.5 opacity-60" />
                            </div>
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
                            {(_editItem?.partNumbers || []).map((partNumber, index) => (
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

                <div className="w-full flex flex-col md:flex-row justify-end gap-3 mt-3 border-t border-gray-300 pt-3">
                    {
                        _editItems.length > 1 && (
                            <div className="w-full justify-start">
                                <div className="w-fit flex items-center gap-2 mb-2 bg-amber-100 border border-amber-300 rounded-md px-2 py-1">
                                    <InfoIcon className=" text-gray-500" />
                                    <div className="text-sm  text-gray-600">
                                        {t('Editing part')}
                                        <span className="mx-1 font-semibold">
                                            {_editItems.length > 1 ? `(${_editItems.length} parts remaining)` : ''}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        )
                    }

                    <div className="flex justify-end gap-3 shrink-0">

                        <PrimaryButton
                            type="button"
                            isLoading={_isLoading}
                            onClick={onClose}
                        >
                            {t('Cancel')}
                        </PrimaryButton>
                        <PrimaryButton
                            form={formId}
                            type="submit"
                            isLoading={_isLoading}
                        >
                            {t('Save')}
                            {_editItems.length > 1 && (
                                <span className="ml-1 text-sm font-semibold">
                                    1 of {_editItems.length}
                                </span>
                            )}
                        </PrimaryButton>
                    </div>
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
            {/* <ThisEditComponent isOpen={true} />
            <div className="h-96"></div> */}

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

