import { ExpandableModal } from "@/src/components/modals"
import DataRenderer from "@/src/components/render/pageDataRenderer"
import VehiclesManage from "@/src/components/render/vehicles";
import { PrimaryButton } from "@/src/components/ui/buttons";
import { Input, Textarea } from "@/src/components/ui/inputs";
import { notify } from "@/src/components/ui/sonnar/sonnar";
import { sendBackRequest } from "@/src/services/backend";
import { logger } from "@/src/services/logger";
import { setMetas } from "@/src/services/metas";
import { BuildingComplexIcon, MailIcon, MapPinHouseIcon, PhoneIcon, SquareTextIcon } from "lucide-react";
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
        onSubmit(e);
    }

    const handleVehicleAddOrEdit = async (vehicles) => {
        logger.log('Vehicles added or edited:', vehicles);
        const data = vehicles?.length > 0 ? vehicles[0] : null;
        if (!data) {
            notify({
                type: 'error',
                message: t('No vehicle data provided for add/edit.'),
            });
            logger.log('No vehicle data provided for add/edit.');
            return;
        }
        try {
            const response = await sendBackRequest({
                itsFor: 'vehicles',
                action: 'update',
                data: { ...data, customerId: data.customerId ?? data.customer?.id ?? null },
            });
            logger.log('Vehicle add/edit response:', response);

            if (response.success) {
                logger.log('Vehicle added or edited successfully:', response.data);
                notify({
                    type: 'success',
                    message: t('Vehicle added or edited successfully.'),
                });
            } else {
                logger.error('Failed to add or edit vehicle:', response.error);
                notify({
                    type: 'error',
                    message: t('Failed to add or edit vehicle.'),
                });
            }

        } catch (error) {
            logger.error('Error adding or editing vehicle:', error);
            notify({
                type: 'error',
                message: t('An error occurred while adding or editing the vehicle.'),
            });
            return null;
        }
    };
    const handleVehicleDelete = async (vehicles) => {
        logger.log('Vehicle deleted:', vehicles);
        const data = vehicles?.length > 0 ? vehicles[0] : null;
        if (!data) {
            notify({
                type: 'error',
                message: t('No vehicle data provided for deletion.'),
            });
            logger.log('No vehicle data provided for deletion.');
            return;
        }
        try {
            const response = await sendBackRequest({
                itsFor: 'vehicles',
                action: 'delete',
                data: { id: data.id },
            });

            if (response.success) {
                logger.log('Vehicle deleted successfully:', response.data);
                notify({
                    type: 'success',
                    message: t('Vehicle deleted successfully.'),
                });
            } else {
                logger.log('Failed to delete vehicle:', response.error);
                notify({
                    type: 'error',
                    message: t('Failed to delete vehicle.'),
                });
            }

            return response?.data;

        } catch (error) {
            logger.error('Error deleting vehicle:', error);
            notify({
                type: 'error',
                message: t('An error occurred while deleting the vehicle.'),
            });
            return null;
        }
    };

    // logger.log('ThisEditComponent data:', data);

    return (
        <ExpandableModal isOpen={isOpen} onClose={onClose}>
            <div className="w-full flex flex-col gap-3 p-5">
                <form className="flex flex-col gap-5" onSubmit={handleFormSubmit}>
                    <div className="flex justify-end gap-3">
                        <div className="flex-1 flex items-center gap-2">
                            <h2 className="text-xl font-bold">
                                {editType === 'new' ? t('Add New Customer') : t('Edit Customer')}
                            </h2>
                        </div>
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
                    <div className="flex gap-3 flex-col md:flex-row">
                        <div className="w-full flex flex-col gap-1">
                            <label className="font-semibold">{t('First Name')}*</label>
                            <Input
                                type="text"
                                required={true}
                                name="firstName"
                                value={data?.firstName ?? ''}
                                onChange={(e) => onInputChange('firstName', e.target.value)}
                                className="border border-gray-300 rounded-md p-2"
                            />
                        </div>
                        <div className="w-full flex flex-col gap-1">
                            <label className="font-semibold">{t('Last Name')}*</label>
                            <Input
                                type="text"
                                required={true}
                                name="lastName"
                                value={data?.lastName ?? ''}
                                onChange={(e) => onInputChange('lastName', e.target.value)}
                                className="border border-gray-300 rounded-md p-2"
                            />
                        </div>
                    </div>
                    <div className="w-full flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                            <PhoneIcon className="w-5 h-5 text-gray-500" />
                            <label className="font-semibold">{t('Phone')}*</label>
                        </div>
                        <Input
                            type="tel"
                            required={true}
                            name="phone"
                            value={data?.phone ?? ''}
                            onChange={(e) => onInputChange('phone', e.target.value)}
                            className="border border-gray-300 rounded-md p-2"
                        />
                    </div>
                    <div className="w-full flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                            <MailIcon className="w-5 h-5 text-gray-500" />
                            <label className="font-semibold">{t('Email')}</label>
                        </div>
                        <Input
                            type="email"
                            name="email"
                            value={data?.email ?? ''}
                            onChange={(e) => onInputChange('email', e.target.value)}
                            className="border border-gray-300 rounded-md p-2"
                        />
                    </div>
                    <div className="w-full flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                            <MapPinHouseIcon className="w-5 h-5 text-gray-500" />
                            <label className="font-semibold">{t('Address')}</label>
                        </div>
                        <Input
                            type="text"
                            name="address"
                            value={data?.address ?? ''}
                            onChange={(e) => onInputChange('address', e.target.value)}
                            className="border border-gray-300 rounded-md p-2"
                        />
                    </div>
                    <div className="w-full flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                            <BuildingComplexIcon className="w-5 h-5 text-gray-500" />
                            <label className="font-semibold">{t('Company')}</label>
                        </div>
                        <Input
                            type="text"
                            name="company"
                            value={data?.company ?? ''}
                            onChange={(e) => onInputChange('company', e.target.value)}
                            className="border border-gray-300 rounded-md p-2"
                        />
                    </div>
                    <div className="w-full flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                            <SquareTextIcon className="w-5 h-5 text-gray-500" />
                            <label className="font-semibold">{t('Notes')}</label>
                        </div>
                        <Textarea
                            type="text"
                            name="notes"
                            value={data?.notes ?? ''}
                            onChange={(e) => onInputChange('notes', e.target.value)}
                            className="border border-gray-300 rounded-md p-2"
                        />
                    </div>

                </form>
                <div className="w-full py-5 ">
                    <div className="">
                        <h3 className="text-xl font-semibold mb-2">
                            {t('Vehicles')}
                        </h3>
                    </div>
                    <div className="border border-gray-300 p-2 rounded-md">
                        <VehiclesManage
                            customerId={data?.id ?? null}
                            items={data?.vehicles ?? []}
                            onSave={handleVehicleAddOrEdit}
                            onDelete={handleVehicleDelete}
                        />
                    </div>
                </div>
            </div>
        </ExpandableModal >
    );
}


export default function CustomersPage() {
    const { t } = useTranslation();
    setMetas({
        title: 'Customers',
        description: 'Manage your customers',
    });

    return (
        <>
            {/* <div className="mt-10 mb-20 p-3 bg-white rounded-md shadow-md">
                <VehiclesManage
                    items={[]}
                />
            </div> */}

            <h1 className="text-2xl font-bold mb-4">
                {t('Customers')}
            </h1>
            <DataRenderer
                itsFor="customers"
                editComponent={ThisEditComponent}
                columns={[
                    { name: 'firstName', label: 'First Name' },
                    { name: 'lastName', label: 'Last Name' },
                    { name: 'email', label: 'Email' },
                    { name: 'phone', label: 'Phone' },
                    { name: 'vehicleCount', label: 'Vehicles Count' },
                    { name: 'address', label: 'Address' },
                    { name: 'company', label: 'Company' },
                    { name: 'notes', label: 'Notes' },
                ]}

            />
        </>
    )
}

