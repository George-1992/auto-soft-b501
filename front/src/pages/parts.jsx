import { PopupModal } from "@/src/components/modals";
import DataRenderer from "@/src/components/render/pageDataRenderer";
import { PrimaryButton } from "@/src/components/ui/buttons";
import { Input } from "@/src/components/ui/inputs";
import { setMetas } from "@/src/services/metas";
import { BookmarkIcon, CircleDollarSignIcon, Package2Icon, TagIcon, WarehouseIcon } from "lucide-react";
import { useTranslation } from "react-i18next";

function ThisEditComponent({
    isOpen = false,
    data = null,
    onClose = () => { },
    onInputChange = () => { },
    onSubmit = () => { },
}) {
    const { t } = useTranslation();

    const handleFormSubmit = (e) => {
        e.preventDefault();

        const payload = {
            ...data,
            price: Number(data?.price ?? 0),
            quantity: Number(data?.quantity ?? 0),
        };

        onSubmit(payload);
    };

    return (
        <PopupModal isOpen={isOpen} onClose={onClose}>
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
                            value={data?.brand ?? ''}
                            onChange={(e) => onInputChange('brand', e.target.value)}
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
                            value={data?.price ?? ''}
                            onChange={(e) => onInputChange('price', e.target.value)}
                            className="border border-gray-300 rounded-md p-2"
                        />
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
            </div>
        </PopupModal>
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
                    { name: 'brand', label: 'Brand' },
                    { name: 'price', label: 'Price' },
                    { name: 'quantity', label: 'Quantity' },
                ]}
            />
        </>
    );
}

