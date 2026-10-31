import { ExpandableModal } from "@/src/components/modals"
import DataRenderer from "@/src/components/render/pageDataRenderer"
import VehiclesManage from "@/src/components/render/vehicles";
import { PrimaryButton } from "@/src/components/ui/buttons";
import { Input, Textarea } from "@/src/components/ui/inputs";
import Select from "@/src/components/ui/select";
import { notify } from "@/src/components/ui/sonnar/sonnar";
import { sendBackRequest } from "@/src/services/backend";
import { logger } from "@/src/services/logger";
import { setMetas } from "@/src/services/metas";
import { BuildingComplexIcon, MailIcon, MapPinHouseIcon, PhoneIcon, SquareTextIcon } from "lucide-react";
import { use, useEffect } from "react";
import { useState } from "react";
import { useTranslation } from "react-i18next";



function ThisEditComponent({
    isOpen = false, data = null, editType = 'new',
    onClose = () => { }, onInputChange = () => { }, onSubmit = () => { }
}) {


    const [_customers, _setCustomers] = useState([]);
    const [_selectedCustomer, _setSelectedCustomer] = useState(null);
    const { t } = useTranslation();


    const getCustomerLable = (c) => {
        if (!c) return 'n/a';

        let l = '';
        if (c?.firstName || c?.lastName) {
            l = `${c?.firstName || ''} ${c?.lastName || ''}`.trim();
        } else {
            l = 'n/a';
        }
        return l;
    };
    const getCustomerValue = (customerId) => {
        const c = _customers.find(c => c.id === customerId) || null;
        if (c) {
            return {
                value: c?.id || _selectedCustomer?.id || c?.id || '',
                label: getCustomerLable(c),
            }
        } else if (_selectedCustomer) {
            return {
                value: _selectedCustomer?.id || '',
                label: getCustomerLable(_selectedCustomer),
            }
        } else {
            return null;
        }
    };
    const getCustomerOptions = () => {
        const v = _customers.map(c => ({
            value: c.id,
            label: getCustomerLable(c),
        }));
        return v;
    };
    const handleCustomerChange = (e) => {
        const value = e?.target?.value || e?.value || null;
        if (value) {
            const c = _customers.find(c => c.id === value) || null;
            if (c) {
                _setSelectedCustomer(c);
            }
        };
    };

    const handleFormSubmit = (e) => {
        if (e && e.preventDefault) {
            e.preventDefault();
        }
        if (!e) {
            logger.error('handleFormSubmit: No data provided for submission.');
            notify({
                type: 'error',
                message: t('No data provided for submission.'),
            });
            return;
        }
        // logger.log('Form submitted with data:', e);
        const d = Array.isArray(e) ? e[0] : e;
        onSubmit({
            ...d,
            customerId: _selectedCustomer?.id || data?.customerId || null,
        });
    };

    // fetch customers on component mount
    useEffect(() => {
        const body = async () => {
            try {
                if (_customers.length > 0) {
                    return;
                }

                const response = await sendBackRequest({
                    itsFor: 'customers',
                    action: 'get',
                });
                // logger.log('Fetched customers:', response);
                if (response.success) {
                    _setCustomers(response.data || []);
                } else {
                    logger.error('Failed to fetch customers:', response.error);
                    notify({
                        type: 'error',
                        message: t('Failed to fetch customers.'),
                    });
                }

                if (data?.customerId) {
                    const c = (response.data || []).find(c => c.id === data.customerId) || null;
                    if (c) {
                        _setSelectedCustomer(c);
                    }
                }

            } catch (error) {
                logger.error('Error fetching customers:', error);
                notify({
                    type: 'error',
                    message: t('An error occurred while fetching customers.'),
                });
            }
        };
        body();
    }, []);


    // logger.log('ThisEditComponent _customers:', _customers);
    // logger.log('ThisEditComponent data:', data);

    return (
        <ExpandableModal isOpen={isOpen} onClose={onClose}>
            <div className="w-full flex flex-col gap-3 p-5">
                <div className="flex flex-col gap-5">
                    <div className="flex justify-end gap-3">
                        <div className="flex-1 flex items-center gap-2">
                            <h2 className="text-xl font-bold">
                                {editType === 'new' ? t('Add New Vehicle') : t('Edit Vehicle')}
                            </h2>
                        </div>
                        {/* <PrimaryButton
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
                        </PrimaryButton> */}
                    </div>
                </div>
                <div className="w-full">
                    <p className="text-gray-600 mb-2">
                        {t('Select a customer to add vehicles for')}
                    </p>
                    <Select
                        className="h-10"
                        label={t('Customer')}
                        value={getCustomerValue(data?.customerId)}
                        onChange={(e) => {
                            handleCustomerChange(e);
                        }}
                        options={getCustomerOptions()}
                    />
                </div>
                <div className="w-full my-5 relative ">
                    <VehiclesManage
                        allowFetch={false}
                        customerId={data?.customerId ?? null}
                        items={data && Object.keys(data).length > 0 ? [data] : []}
                        onSave={handleFormSubmit}
                        // onDelete={handleVehicleDelete}
                        sampleItem={true}
                        allowedActions={['edit']}
                    />
                    {
                        !_selectedCustomer && (
                            <div className="w-full h-full cursor-not-allowed absolute top-0 left-0 flex items-center justify-center bg-gray-100/50">
                            </div>
                        )
                    }
                </div>
            </div>
        </ExpandableModal >
    );
}


export default function VehiclesPage() {
    const { t } = useTranslation();
    setMetas({
        title: 'Vehicles',
        description: 'Manage your vehicles',
    });
    return (
        <>
            <h1 className="text-2xl font-bold mb-4">
                {t('Vehicles')}
            </h1>
            <DataRenderer
                itsFor="vehicles"
                editComponent={ThisEditComponent}
                columns={[
                    { name: 'make', label: t('Make') },
                    { name: 'model', label: t('Model') },
                    { name: 'year', label: t('Year') },
                    { name: 'licensePlate', label: t('License Plate') },
                    { name: 'vin', label: t('VIN') },
                ]}
            />
        </>
    )
}

