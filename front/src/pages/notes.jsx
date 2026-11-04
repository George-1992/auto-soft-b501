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
                            <label className="font-semibold">{t('Title')}</label>
                        </div>
                        <Input
                            type="text"
                            name="title"
                            value={data?.title ?? ''}
                            onChange={(e) => onInputChange('title', e.target.value)}
                            className="border border-gray-300 rounded-md p-2"
                        />
                    </div>
                    <div className="w-full flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                            <label className="font-semibold">{t('Content')}</label>
                        </div>
                        <Textarea
                            name="content"
                            value={data?.content ?? ''}
                            onChange={(e) => onInputChange('content', e.target.value)}
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


export default function NotesPage() {
    const { t } = useTranslation();
    setMetas({
        title: 'Notes',
        description: 'Manage your notes',
    });

    return (
        <>

            <h1 className="text-2xl font-bold mb-4">
                {t('Notes')}
            </h1>
            <DataRenderer
                itsFor="notes"
                editComponent={ThisEditComponent}
                columns={[
                    { name: 'title', label: 'title' },
                    { name: 'content', label: 'Content' },
                ]}

            />
        </>
    )
}

