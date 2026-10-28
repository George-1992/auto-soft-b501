import { ExpandableModal } from "@/src/components/modals"
import DataRenderer from "@/src/components/pageDataRenderer"
import { PrimaryButton } from "@/src/components/ui/buttons";
import { Input } from "@/src/components/ui/inputs";
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
        e.preventDefault();
        onSubmit(e);
    }

    return (
        <ExpandableModal isOpen={isOpen} onClose={onClose}>
            <div className="w-full flex flex-col gap-3 p-5">
                <h2 className="text-xl font-bold">
                    {editType === 'new' ? 'Add New Customer' : 'Edit Customer'}
                </h2>

                <form className="flex flex-col gap-3" onSubmit={handleFormSubmit}>
                    {Object.keys(sampleData).map((key) => (
                        <div key={key} className="flex flex-col gap-1">
                            <label className="font-semibold">{key.charAt(0).toUpperCase() + key.slice(1)}</label>
                            <Input
                                type="text"
                                required={true}
                                name={key}
                                value={data?.[key] ?? ''}
                                onChange={(e) => onInputChange(key, e.target.value)}
                                className="border border-gray-300 rounded-md p-2"
                            />
                        </div>
                    ))}
                    <div className="flex justify-end gap-3 mt-5">
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
        </ExpandableModal >
    );
}


export default function CustomersPage() {
    return (
        <>
            <DataRenderer
                itsFor="customers"
                editComponent={ThisEditComponent}
            />
        </>
    )
}

