import { ExpandableModal, PopupModal } from "@/src/components/modals"
import DataRenderer from "@/src/components/render/pageDataRenderer"
import { PrimaryButton } from "@/src/components/ui/buttons";
import { Input, Textarea } from "@/src/components/ui/inputs";
import { notify } from "@/src/components/ui/sonnar/sonnar";
import { sendBackRequest } from "@/src/services/backend";
import { logger } from "@/src/services/logger";
import { setMetas } from "@/src/services/metas";
import { BookmarkIcon, BuildingComplexIcon, CircleDollarSignIcon, MailIcon, MapPinHouseIcon, PhoneIcon, SquareTextIcon, WrenchIcon } from "lucide-react";
import { useTranslation } from "react-i18next";



function ThisEditComponent({
    isOpen = false, data = null, editType = 'new',
    onClose = () => { }, onInputChange = () => { }, onSubmit = () => { }
}) {


    const { t } = useTranslation();
    const sampleData = {
        name: '',
        email: '',
        phone: '',
        address: '',
        city: '',
        state: '',
        zip: '',
        country: '',
    };

    const handleFormSubmit = (e) => {
        if (e && e.preventDefault) {
            e.preventDefault();
        }

        // logger.info("ThisEditComponent:handleFormSubmit:", e);
        onSubmit(e);
    }

    return (
        <PopupModal isOpen={isOpen} onClose={onClose}>
            <div className="w-full flex flex-col gap-3 p-5">
                <form className="flex flex-col gap-5" onSubmit={handleFormSubmit}>


                    <div className="w-full flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                            <WrenchIcon className="w-5 h-5 text-gray-500" />
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
                            <BookmarkIcon className="w-5 h-5 text-gray-500" />
                            <label className="font-semibold">{t('Category')}</label>
                        </div>
                        <Input
                            type="text"
                            name="category"
                            value={data?.category ?? ''}
                            onChange={(e) => onInputChange('category', e.target.value)}
                            className="border border-gray-300 rounded-md p-2"
                        />
                    </div>
                    <div className="w-full flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                            <SquareTextIcon className="w-5 h-5 text-gray-500" />
                            <label className="font-semibold">{t('Description')}</label>
                        </div>
                        <Textarea
                            name="description"
                            value={data?.description ?? ''}
                            onChange={(e) => onInputChange('description', e.target.value)}
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
        </PopupModal >
    );
}


export default function ServicesPage() {
    const { t } = useTranslation();
    setMetas({
        title: 'Services',
        description: 'Manage your services',
    });

    return (
        <>

            <h1 className="text-2xl font-bold mb-4">
                {t('Services')}
            </h1>
            <DataRenderer
                itsFor="services"
                editComponent={ThisEditComponent}
                columns={[
                    { name: 'name', label: 'Name' },
                    { name: 'price', label: 'Price' },
                    { name: 'description', label: 'Description' },
                    { name: 'category', label: 'category' },
                ]}

            />
        </>
    )
}

