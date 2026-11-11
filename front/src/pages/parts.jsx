import { PopupModal } from "@/src/components/modals";
import CurrencySymbol from "@/src/components/render/currency";
import DataRenderer from "@/src/components/render/pageDataRenderer";
import { PrimaryButton } from "@/src/components/ui/buttons";
import { Input } from "@/src/components/ui/inputs";
import Select from "@/src/components/ui/select";
import { logger } from "@/src/services/logger";
import { setMetas } from "@/src/services/metas";
import { toDisplayNumber } from "@/src/services/other";
import { BookmarkIcon, CircleDollarSignIcon, HashIcon, Package2Icon, PlusIcon, TagIcon, WarehouseIcon, XIcon } from "lucide-react";
import { useState } from "react";
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
            const newPartNumbers = [...(data?.partNumbers || []), _newPartNumber.trim()];
            onInputChange('partNumbers', newPartNumbers);
            _setNewPartNumber('');
        }
    };
    const handleRemovePartNumber = (partNumberToRemove) => {
        const newPartNumbers = (data?.partNumbers || []).filter(partNumber => partNumber !== partNumberToRemove);
        onInputChange('partNumbers', newPartNumbers);
    };

    return (
        <PopupModal isOpen={isOpen} onClose={onClose} className="w-11/12 md:w-[700px] max-h-11/12 overflow-y-auto">
            <div className="w-full flex flex-col gap-3 p-5">
                <form className="flex flex-col gap-5" onSubmit={handleFormSubmit}>
                    <div className="w-full flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                            <TagIcon className="w-5 h-5 text-gray-500" />
                            <label className="font-semibold">{t('SKU')}</label>
                        </div>
                        <Input
                            type="text"
                            name="sku"
                            placeholder={t('Leave blank to auto-generate')}
                            value={data?.sku ?? ''}
                            onChange={(e) => onInputChange('sku', e.target.value)}
                            className="border border-gray-300 rounded-md p-2"
                        />
                    </div>

                    <div className="w-full flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                            <Package2Icon className="w-5 h-5 text-gray-500" />
                            <label className="font-semibold">{t('Name')}</label>
                        </div>
                        <Input
                            type="text"
                            name="name"
                            placeholder={t('Enter part name')}
                            required={true}
                            value={data?.name ?? ''}
                            onChange={(e) => onInputChange('name', e.target.value)}
                            className="border border-gray-300 rounded-md p-2"
                        />
                    </div>

                    <div className="w-full flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                            <BookmarkIcon className="w-5 h-5 text-gray-500" />
                            <label className="font-semibold">{t('Brand')}</label>
                        </div>
                        <Input
                            type="text"
                            name="brand"
                            placeholder={t('Enter brand name (Sachs, Bosch, etc.)')}
                            required={true}
                            value={data?.brand ?? ''}
                            onChange={(e) => onInputChange('brand', e.target.value)}
                            className="border border-gray-300 rounded-md p-2"
                        />
                    </div>

                    <div className="w-full flex flex-col md:flex-row gap-1">
                        <div className="w-full flex flex-col gap-1">
                            <div className="flex items-center gap-2">
                                <CircleDollarSignIcon className="w-5 h-5 text-gray-500" />
                                <label className="font-semibold">{t('Purchase Price')}</label>
                            </div>
                            <Input
                                type="number"
                                name="purchasePrice"
                                value={data?.purchasePrice ?? 0}
                                onChange={(e) => onInputChange('purchasePrice', Number(e.target.value) || 0)}
                                className="border border-gray-300 rounded-md p-2"
                            />
                        </div>

                        <div className="w-full flex flex-col gap-1">
                            <div className="flex items-center gap-2">
                                <CircleDollarSignIcon className="w-5 h-5 text-gray-500" />
                                <label className="font-semibold">{t('Price')}</label>
                            </div>
                            <Input
                                type="number"
                                name="price"
                                value={data?.price ?? 0}
                                onChange={(e) => onInputChange('price', Number(e.target.value) || 0)}
                                className="border border-gray-300 rounded-md p-2"
                            />
                        </div>
                    </div>

                    <div className="w-full flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                            <WarehouseIcon className="w-5 h-5 text-gray-500" />
                            <label className="font-semibold">{t('Quantity')}</label>
                        </div>
                        <Input
                            type="number"
                            name="quantity"
                            value={data?.quantity ?? 0}
                            onChange={(e) => onInputChange('quantity', Number(e.target.value) || 0)}
                            className="border border-gray-300 rounded-md p-2"
                        />
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
                                placeholder={t('Enter part numbers')}
                                value={_newPartNumber}
                                onChange={(e) => _setNewPartNumber(e.target.value)}
                                className="border border-gray-300 rounded-md p-2"
                            />
                            <PrimaryButton
                                type="button"
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


                    <div className="flex justify-end gap-3">
                        <PrimaryButton
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
                        >
                            {t('Cancel')}
                        </PrimaryButton>
                        <PrimaryButton
                            type="submit"
                            className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
                        >
                            {t('Save')}
                        </PrimaryButton>
                    </div>
                </form>
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
                ]}
            />
        </>
    );
}

