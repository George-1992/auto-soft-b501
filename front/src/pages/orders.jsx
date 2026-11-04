import { ExpandableModal, PopupModal } from "@/src/components/modals"
import DataRenderer from "@/src/components/render/pageDataRenderer"
import { OutlineButton, PrimaryButton, SecondaryButton } from "@/src/components/ui/buttons";
import Card, { CollapsibleCard } from "@/src/components/ui/card";
import { Input, Textarea } from "@/src/components/ui/inputs";
import { LoaderShimmer } from "@/src/components/ui/loader";
import Select from "@/src/components/ui/select";
import { notify } from "@/src/components/ui/sonnar/sonnar";
import { sendBackRequest } from "@/src/services/backend";
import { logger } from "@/src/services/logger";
import { setMetas } from "@/src/services/metas";
import { randomString, toDisplayDate, toDisplayNumber } from "@/src/services/other";
import _, { cloneDeep, random } from "lodash";
import { BookmarkIcon, BoxesIcon, BuildingComplexIcon, CarFrontIcon, ChevronsRightIcon, CircleDollarSignIcon, Component, DownloadIcon, FileTextIcon, HashIcon, MailIcon, MapPinHouseIcon, MapPinIcon, PencilIcon, PhoneIcon, PlusIcon, PrinterIcon, RouteIcon, ShellIcon, SquareTextIcon, SquareUserRoundIcon, Trash2Icon, WrenchIcon, XIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Car, User, Timer, Percent, MessageSquare, CalendarDays, ListOrdered, CheckCircle2, MoreHorizontal, Plus, X } from 'lucide-react';
import DateInput from "@/src/components/date";
import PartsCatalog from "@/src/components/render/partsCatalog";
import CurrencySymbol from "@/src/components/render/currency";
import Image from "@/src/components/wraps/image";



const ThisEditComponent = ({
    isOpen = false, data = null, editType = 'new', isLoading = false,
    onClose = () => { }, onInputChange = () => { }, onSubmit = () => { },
    pipeline = null, // pipelines and stages, specific var
}) => {

    const orderLineSample = {
        id: randomString(25),
        type: 'labor', // service | part | fee
        name: '',
        description: '',
        unitPrice: 0,
        totalPrice: 0,
        quantity: 1,
    };

    const formId = 'order-edit-form';
    const [defaultOrderName] = useState(() => 'Order ' + random(10000, 99999));
    const [defaultOrderNumber] = useState(() => random(1000000, 9999999));

    const [_pipeline, _setPipeline] = useState(pipeline);
    const [_stages, _setStages] = useState(pipeline?.stages || []);
    const [_locations, _setLocations] = useState([]);
    const [_selectedLocation, _setSelectedLocation] = useState(null);
    const [_services, _setServices] = useState([]);
    const [_customers, _setCustomers] = useState([]);
    const [_vehicles, _setVehicles] = useState([]);
    const [_selectedCustomer, _setSelectedCustomer] = useState(null);
    const [_selectedVehicle, _setSelectedVehicle] = useState(null);
    const [_openPartsCatalog, _setOpenPartsCatalog] = useState(false);

    const { t } = useTranslation();

    const handleFormSubmit = (e) => {
        if (e && e.preventDefault) {
            e.preventDefault();
        }
        // logger.info("ThisEditComponent:handleFormSubmit:", data);

        //if pipline is not set notify and return
        if (!data?.stageId) {
            logger.warn("Pipeline is not set, cannot submit order");
            notify({ type: 'error', message: t('Stage is not set') });
            return;
        }

        if (!data?.orderLines || !data?.orderLines.length) {
            logger.warn("No order lines, cannot submit order");
            notify({ type: 'info', message: t('At least one service is required') });
            return;
        }

        onSubmit(data);
    };
    const inputChangePassthrough = (field, value) => {
        if (['startDate', 'dueDate'].includes(field)) {
            // startDate cant be after dueDate, and dueDate cant be before startDate
            if (field === 'startDate' && value && data?.dueDate && new Date(value) > new Date(data.dueDate)) {
                notify({ type: 'error', message: t('Start date cannot be after due date') });
                return;
            }
            if (field === 'dueDate' && value && data?.startDate && new Date(value) < new Date(data.startDate)) {
                notify({ type: 'error', message: t('Due date cannot be before start date') });
                return;
            }
        }
        onInputChange(field, value);
    };


    const fetchCustomers = async () => {
        try {
            const res = await sendBackRequest({
                itsFor: 'customers',
                action: 'get',
            });

            // logger.log("fetchCustomers response:", res);
            if (res.success) {
                return res.data || [];
            } else {
                notify({ type: 'error', message: t('Failed to fetch customers') });
            }

            return res.data || [];
        } catch (error) {
            logger.error("Error fetching customers:", error);
            notify({ type: 'error', message: t('Error fetching customers') });
            return [];
        }
    };
    const fetchVehicles = async (customerId) => {
        try {
            const res = await sendBackRequest({
                itsFor: 'vehicles',
                action: 'get',
                filters: [{
                    key: 'customerId',
                    operator: 'equals',
                    value: customerId,
                }],
                include: {
                    make: true,
                    model: true,
                }
            });

            logger.log("fetchVehicles response:", res);
            if (res.success) {
                _setVehicles(res.data || []);
            } else {
                notify({ type: 'error', message: t('Failed to fetch vehicles') });
            }

            // if no vehicle selected , then pick first
            if (!_selectedVehicle && res.data && res.data.length > 0) {
                const firstVehicle = res.data[0];
                _setSelectedVehicle(firstVehicle);
                inputChangePassthrough('vehicleId', firstVehicle?.id ?? null);
            }

            if (data?.vehicleId) {
                const selectedVehicle = res.data.find(v => String(v.id) === String(data.vehicleId)) || null;
                _setSelectedVehicle(selectedVehicle);
            }

        } catch (error) {
            logger.error("Error fetching vehicles:", error);
            notify({ type: 'error', message: t('Error fetching vehicles') });
        }
    };
    const fetchServices = async () => {
        try {
            const res = await sendBackRequest({
                itsFor: 'services',
                action: 'get',
            });

            // logger.log("fetchServices response:", res);
            if (res.success) {
                return res.data || [];
            } else {
                notify({ type: 'error', message: t('Failed to fetch services') });
            }

            return res.data || [];
        } catch (error) {
            logger.error("Error fetching services:", error);
            notify({ type: 'error', message: t('Error fetching services') });
            return [];
        }
    };
    const fetchPipelineAndStages = async () => {
        try {
            const res = await sendBackRequest({
                itsFor: 'pipelines',
                action: 'get',
                filters: [{
                    key: 'active',
                    operator: 'equals',
                    value: true,
                }],
            });

            logger.log("fetchPipelineAndStages response:", res);
            if (res.success) {
                const pipelines = res.data || [];
                if (pipelines.length > 0) {
                    const firstPipeline = pipelines[0];
                    _setPipeline(firstPipeline);
                    _setStages(firstPipeline.stages || []);
                }
            } else {
                notify({ type: 'error', message: t('Failed to fetch pipelines') });
            }
        } catch (error) {
            logger.error("Error fetching pipelines:", error);
            notify({ type: 'error', message: t('Error fetching pipelines') });
        }
    };
    const fetchLocations = async () => {
        try {
            const res = await sendBackRequest({
                itsFor: 'locations',
                action: 'get',
            });

            // logger.log("fetchLocations response:", res);
            if (res.success) {
                return res.data || [];
            } else {
                notify({ type: 'error', message: t('Failed to fetch locations') });
            }

            return res.data || [];
        } catch (error) {
            logger.error("Error fetching locations:", error);
            notify({ type: 'error', message: t('Error fetching locations') });
            return [];
        }
    };


    const handleCustomerChange = (e) => {
        const customerId = e?.target?.value || e?.value || null;

        const selectedCustomer = _customers.find(c => String(c.id) === String(customerId)) || null;
        _setSelectedCustomer(selectedCustomer);
        inputChangePassthrough('customerId', selectedCustomer?.id ?? null);

        if (selectedCustomer?.id) {
            fetchVehicles(selectedCustomer.id);
        }
    };
    const handleVehicleChange = (e) => {
        const vehicleId = e?.target?.value || e?.value || null;

        const selectedVehicle = _vehicles.find(v => String(v.id) === String(vehicleId)) || null;
        _setSelectedVehicle(selectedVehicle);
        inputChangePassthrough('vehicleId', selectedVehicle?.id ?? null);
    };
    const getCustomerDisplayName = (customer) => {
        if (!customer) return '';
        const parts = [];
        if (customer.firstName) parts.push(customer.firstName);
        if (customer.lastName) parts.push(customer.lastName);
        if (customer.email) parts.push(`<${customer.email}>`);
        if (customer.phone) parts.push(`(${customer.phone})`);
        return parts.join(' ');
    };
    const getVehicleDisplayName = (vehicle) => {
        if (!vehicle) return '';
        const parts = [];

        let make = vehicle?.make?.name || 'n/a';
        let model = vehicle?.model?.name || 'n/a';

        parts.push(make);
        parts.push(model);

        if (vehicle.year) parts.push(`(${vehicle.year})`);
        if (vehicle.licensePlate) parts.push(`[${vehicle.licensePlate}]`);

        return parts.join(', ');
    };


    const handleAddOrderLine = (type = 'labor') => {
        let d = cloneDeep(orderLineSample);
        d.id = 'tempId_' + randomString(25);
        d.type = type;
        // logger.info("handleAddOrderLine d:", d);
        const updatedOrderLines = [...(data?.orderLines || []), d];
        inputChangePassthrough('orderLines', updatedOrderLines);
    };
    const handleOrderLineChange = (lineId, patch) => {
        const updatedOrderLines = (data?.orderLines || []).map((line) => {
            if (String(line.id) !== String(lineId)) return line;

            const nextLine = {
                ...line,
                ...patch,
            };

            if (Object.prototype.hasOwnProperty.call(patch, 'quantity') || Object.prototype.hasOwnProperty.call(patch, 'unitPrice')) {
                const quantity = Number(nextLine?.quantity ?? 1);
                const unitPrice = Number(nextLine?.unitPrice ?? 0);
                nextLine.totalPrice = quantity * unitPrice;
            }

            return nextLine;
        });

        inputChangePassthrough('orderLines', updatedOrderLines);
    };
    const handleOrderLineServicePick = (lineId, eventOrOption) => {
        const serviceId = eventOrOption?.value || eventOrOption?.target?.value || null;
        const selectedService = _services.find(s => String(s.id) === String(serviceId)) || null;
        const currentLine = (data?.orderLines || []).find((line) => String(line.id) === String(lineId));
        const quantity = Number(currentLine?.quantity ?? 1);

        if (!selectedService) {
            handleOrderLineChange(lineId, { serviceId: null });
            return;
        }

        handleOrderLineChange(lineId, {
            serviceId: selectedService.id,
            name: selectedService.name || '',
            description: selectedService.description || '',
            unitPrice: selectedService.price ? Number(selectedService.price) : 0,
            quantity,
        });
    };
    const handleOrderLineRemove = (line) => {
        const updatedOrderLines = (data?.orderLines || []).filter(l => l.id !== line.id);
        inputChangePassthrough('orderLines', updatedOrderLines);
    };
    const getOrderLinesType = (type) => {
        // logger.info("getOrderLinesType called with type:", type);

        if (!type) return [];
        if (!data) return [];
        if (!data?.orderLines || !data.orderLines.length) return [];
        if (!['labor', 'part', 'fee'].includes(type)) return [];

        return (data?.orderLines || []).filter(line => String(line.type) === String(type));
    };

    const handleStageChange = (e) => {
        const stageId = e?.target?.value || e?.value || null;
        inputChangePassthrough('stageId', stageId);
    };
    const getStageDisplayName = (stageId) => {
        const stage = _stages.find(s => String(s.id) === String(stageId));
        if (!stage) return '';
        return stage.name || '';
    };
    const handleLocationChange = (e) => {
        const locationId = e?.target?.value || e?.value || null;
        const selectedLocation = _locations.find(l => String(l.id) === String(locationId)) || null;
        _setSelectedLocation(selectedLocation);
        inputChangePassthrough('locationId', selectedLocation?.id ?? null);
    };
    const getLocationDisplayName = (locationId) => {
        const location = _locations.find(l => String(l.id) === String(locationId));
        if (!location) return '';
        return location.name || '';
    };


    const partsCatalogToggle = (action) => {
        if (action === 'open') {
            _setOpenPartsCatalog(true);
        } else if (action === 'close') {
            _setOpenPartsCatalog(false);
        }
    };
    const handlePartSelectionChange = (parts) => {
        // logger.info("handlePartSelectionChange selectedParts:", parts);

        // add to orderLines
        const newOrderLines = (data?.orderLines || []).concat(
            parts.map(part => ({
                id: 'tempId_' + randomString(25),
                type: 'part',
                partId: part.provider === 'own' ? part.id : null,
                name: part.name || '',
                unitPrice: part.price ? Number(part.price) : 0,
                quantity: 1,
                totalPrice: part.price ? Number(part.price) : 0,
            }))
        );

        // logger.info("newOrderLines:", newOrderLines);
        inputChangePassthrough('orderLines', newOrderLines);
        _setOpenPartsCatalog(false);

    };
    const getTotalOrderPrice = () => {
        if (!data?.orderLines || !data.orderLines.length) return 0;
        return data.orderLines.reduce((total, line) => {
            const lineTotal = Number(line?.totalPrice ?? 0);
            return total + lineTotal;
        }, 0);
    };


    // fetch initial data
    useEffect(() => {
        let isMounted = true;

        const loadInitialData = async () => {
            const [customers, services, locations] = await Promise.all([
                fetchCustomers(),
                fetchServices(),
                fetchLocations(),
            ]);

            if (!isMounted) return;

            _setCustomers(customers || []);
            _setServices(services || []);
            _setLocations(locations || []);

            // if no location selected , then pick first
            if (!_selectedLocation && locations && locations.length > 0) {
                const firstLocation = locations[0];
                _setSelectedLocation(firstLocation);
                inputChangePassthrough('locationId', firstLocation?.id ?? null);
            }


            // if data is defined and has customerId, locationId, vehicleId, stageId, then set selected values accordingly
            if (data?.customerId) {
                const selectedCustomer = customers.find(c => String(c.id) === String(data.customerId)) || null;
                _setSelectedCustomer(selectedCustomer);
                if (selectedCustomer?.id) {
                    await fetchVehicles(selectedCustomer.id);
                }
            }
            if (data?.locationId) {
                const selectedLocation = locations.find(l => String(l.id) === String(data.locationId)) || null;
                _setSelectedLocation(selectedLocation);
            }
            if (data?.stageId) {
                const selectedStage = _stages.find(s => String(s.id) === String(data.stageId)) || null;
                if (selectedStage) {
                    inputChangePassthrough('stageId', selectedStage.id);
                }
            };

        };

        loadInitialData();

        return () => {
            isMounted = false;
        };
    }, []);


    const firstStageId = _stages.length ? _stages.reduce((p, c) => (p.position < c.position ? p : c)).id : null;
    useEffect(() => {
        if (!data?.name) inputChangePassthrough('name', defaultOrderName);
        if (!data?.orderNumber) inputChangePassthrough('orderNumber', defaultOrderNumber);
        if (!data?.startDate) inputChangePassthrough('startDate', new Date().toISOString());
    }, [data?.id]);

    useEffect(() => {
        if (!data?.stageId && firstStageId) inputChangePassthrough('stageId', firstStageId);
    }, [firstStageId]);


    // logger.info("data:", data);
    // logger.info("data?.orderLines:", data?.orderLines);
    // logger.info("selected location:", _selectedLocation);
    // logger.info("selected customer:", _selectedCustomer);
    // logger.info("selected vehicle:", _selectedVehicle);
    // logger.info("stages:", _stages);
    // logger.info("stages:", _stages);

    return (
        <div className="w-full ">
            <div className="flex md:hidden justify-end gap-3 mb-1">
                <PrimaryButton
                    type="button"
                    onClick={onClose}
                    isLoading={isLoading}
                >
                    {t('Cancel')}
                </PrimaryButton>
                <PrimaryButton
                    type="submit"
                    form={formId}
                    isLoading={isLoading}
                >
                    {t('Save')}
                </PrimaryButton>
            </div>
            <div className="flex gap-2">
                <form className="w-full flex flex-col gap-3" id={formId} onSubmit={handleFormSubmit}>
                    <Card className="w-full py-4 flex flex-col gap-3">
                        <div className="name-order flex flex-col md:flex-row gap-3">
                            <div className="w-full flex flex-col gap-1">
                                <div className="flex items-center gap-2">
                                    <label className="font-semibold">{t('Name')}</label>
                                </div>
                                <Input
                                    type="text"
                                    name="name"
                                    required={true}
                                    isLoading={isLoading}
                                    value={data?.name ?? ''}
                                    onChange={(e) => inputChangePassthrough('name', e.target.value)}
                                    className="border border-gray-300 rounded-md p-2"
                                />
                            </div>
                            <div className="w-full flex flex-col gap-1">
                                <div className="flex items-center gap-2">
                                    <label className="font-semibold">{t('Order Number')}</label>
                                </div>
                                <Input
                                    type="text"
                                    name="orderNumber"
                                    required={true}
                                    isLoading={isLoading}
                                    value={data?.orderNumber ?? ''}
                                    onChange={(e) => inputChangePassthrough('orderNumber', e.target.value)}
                                    className="border border-gray-300 rounded-md p-2"
                                />
                            </div>
                        </div>
                        <div className="stage-location flex flex-col md:flex-row gap-3">
                            <div className="w-full">
                                <div className="flex gap-2 mb-1 items-center">
                                    <RouteIcon className="size-6 text-gray-500" />
                                    {t('Stage')}
                                </div>
                                <Select
                                    label={t('Stage')}
                                    required={true}
                                    isLoading={isLoading}
                                    disabled={!_pipeline}
                                    value={data?.stageId ? { value: data.stageId, label: getStageDisplayName(data.stageId) } : null}
                                    onChange={handleStageChange}
                                    options={_stages.map((stage) => ({
                                        value: stage.id,
                                        label: getStageDisplayName(stage.id),
                                    }))}
                                    className="h-10"
                                    placeholder={t('Select a stage')}
                                />
                            </div>
                            <div className="w-full">
                                <div className="flex gap-2 mb-1 items-center">
                                    <MapPinIcon className="size-6 text-gray-500" />
                                    {t('Location')}
                                </div>
                                <Select
                                    label={t('Location')}
                                    required={true}
                                    isLoading={isLoading}
                                    disabled={!_pipeline}
                                    value={data?.locationId ? { value: data.locationId, label: getLocationDisplayName(data.locationId) } : null}
                                    onChange={handleLocationChange}
                                    options={_locations.map((location) => ({
                                        value: location.id,
                                        label: getLocationDisplayName(location.id),
                                    }))}
                                    className="h-10"
                                    placeholder={t('Select a location')}
                                />
                            </div>
                        </div>
                        <div className="start-due-date flex flex-col md:flex-row gap-3">

                            <div className="w-full">
                                <div className="flex gap-2 mb-1 items-center">
                                    {t('Start Date')}
                                </div>
                                <DateInput
                                    label={t('Start Date')}
                                    required={true}
                                    isLoading={isLoading}
                                    value={data?.startDate ? new Date(data.startDate) : null}
                                    onChange={({ target: { value: date } }) => {
                                        inputChangePassthrough('startDate', date ? date.toISOString() : null);
                                    }}
                                    disabled={isLoading}
                                />
                            </div>
                            <div className="w-full">
                                <div className="flex gap-2 mb-1 items-center">
                                    {t('Due Date')}
                                </div>
                                <DateInput
                                    label={t('Due Date')}
                                    required={true}
                                    isLoading={isLoading}
                                    value={data?.dueDate ? new Date(data.dueDate) : null}
                                    onChange={({ target: { value: date } }) => {
                                        inputChangePassthrough('dueDate', date ? date.toISOString() : null);
                                    }}
                                    disabled={isLoading}
                                />
                            </div>
                        </div>

                        <div className="w-full">
                            <div className="flex gap-2 mb-1 items-center">
                                <SquareUserRoundIcon className="size-6 text-gray-500" />
                                {t('Customer')}
                            </div>
                            <Select
                                label={t('Customer')}
                                required={true}
                                isLoading={isLoading}
                                value={_selectedCustomer ? { value: _selectedCustomer.id, label: getCustomerDisplayName(_selectedCustomer) } : null}
                                onChange={handleCustomerChange}
                                options={_customers.map((customer) => ({
                                    value: customer.id,
                                    label: getCustomerDisplayName(customer),
                                }))}
                                className="h-10"
                                placeholder={t('Select a customer')}
                            />
                        </div>
                        <div className="w-full">
                            <div className="flex gap-2 mb-1 items-center">
                                <CarFrontIcon className="size-6 text-gray-500" />
                                {t('Vehicle')}
                            </div>
                            <Select
                                label={t('Vehicle')}
                                required={true}
                                isLoading={isLoading}
                                disabled={!_selectedCustomer}
                                value={_selectedVehicle ? { value: _selectedVehicle.id, label: getVehicleDisplayName(_selectedVehicle) } : null}
                                onChange={handleVehicleChange}
                                options={_vehicles.map((vehicle) => ({
                                    value: vehicle.id,
                                    label: getVehicleDisplayName(vehicle),
                                }))}
                                className="h-10"
                                placeholder={t('Select a vehicle')}
                            />
                        </div>

                    </Card>
                    <Card className="w-full py-4 flex flex-col gap-3">
                        <CollapsibleCard className="w-full" bodyClassName="min-h-40 flex flex-col justify-between" title={t('Services')} headerClassName="bg-gray-100" icon={<WrenchIcon className="size-5 text-gray-500" />}>
                            <div className="flex flex-col gap-2 text-sm">
                                {getOrderLinesType('labor').length > 0 && <>
                                    <div className="w-full flex items-center gap-2 font-semibold text-gray-700 px-1">
                                        <div className="flex-1">{t('Service')}</div>
                                        <div className="w-[110px]">{t('Qty')}</div>
                                        <div className="w-[150px]">{t('Unit Price')}</div>
                                        <div className="w-[150px]">{t('Line Total')}</div>
                                    </div>
                                </>}

                                {getOrderLinesType('labor').map((line, index) => {
                                    const service = _services.find(s => String(s.id) === String(line.serviceId));
                                    const quantity = Number(line?.quantity ?? 1);
                                    const unitPrice = Number(line?.unitPrice ?? 0);

                                    return (
                                        <div key={line?.id || index} className="w-full flex items-start gap-2">
                                            <div className="flex-1">
                                                {line?.name
                                                    ? <Input
                                                        type="text"
                                                        required={true}
                                                        isLoading={isLoading}
                                                        value={line.name}
                                                        onChange={(e) => handleOrderLineChange(line.id, { name: e.target.value })}
                                                        className=""
                                                    />
                                                    : <Select
                                                        label={t('Service')}
                                                        searchable={true}
                                                        required={true}
                                                        isLoading={isLoading}
                                                        value={service ? { value: service.id, label: service.name } : null}
                                                        onChange={(e) => handleOrderLineServicePick(line.id, e)}
                                                        options={_services.map((serviceOption) => ({
                                                            value: serviceOption.id,
                                                            label: serviceOption.name,
                                                        }))}
                                                        className="h-9"
                                                        placeholder={t('Select a service')}
                                                    />
                                                }
                                            </div>
                                            <div className="w-[110px]">
                                                <Input
                                                    type="number"
                                                    required={true}
                                                    isLoading={isLoading}
                                                    min="1"
                                                    value={quantity}
                                                    onChange={(e) => handleOrderLineChange(line.id, { quantity: Number(e.target.value || 1) })}
                                                />
                                            </div>

                                            <div className="w-[150px]">
                                                <Input
                                                    type="number"
                                                    required={true}
                                                    isLoading={isLoading}
                                                    min="0"
                                                    step="0.01"
                                                    value={unitPrice}
                                                    onChange={(e) => handleOrderLineChange(line.id, { unitPrice: Number(e.target.value || 0) })}
                                                />
                                            </div>

                                            <div className="w-[150px]">
                                                <div className="h-9 px-3 rounded-md border border-gray-200 flex items-center bg-gray-50">
                                                    <CurrencySymbol />
                                                    {line?.totalPrice ? `${Number(line.totalPrice).toFixed(2)}` : '0.00'}
                                                </div>
                                            </div>
                                            <div className="h-9 flex items-center justify-end py-1">
                                                <OutlineButton
                                                    type="button"
                                                    onClick={() => handleOrderLineRemove(line)}
                                                    isLoading={isLoading}
                                                    className=""
                                                    style={{ padding: '0.4rem', borderRadius: '9999px' }}
                                                >
                                                    <XIcon className="size-3.5" />
                                                </OutlineButton>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {getOrderLinesType('labor').length === 0 && (
                                <div className="flex-1 text-gray-500 flex items-center justify-center">
                                    {t('No services added yet.')}
                                </div>
                            )}

                            <div className="h-8"></div>
                            <SecondaryButton
                                type="button"
                                onClick={() => handleAddOrderLine('labor')}
                                className="w-full"
                            >
                                <PlusIcon className="size-5 mr-2" />
                                {t('Add Service')}
                            </SecondaryButton>

                        </CollapsibleCard>
                        <CollapsibleCard className="w-full min-h-24" bodyClassName="min-h-40 flex flex-col justify-between" title={t('Parts')} headerClassName="bg-gray-100" icon={<BoxesIcon className="size-5 text-gray-500" />}>
                            <div className="w-full ">
                                <div className="flex flex-col gap-2 text-sm">
                                    {getOrderLinesType('part').length > 0 && <>
                                        <div className="w-full flex items-center gap-2 font-semibold text-gray-700 px-1">
                                            <div className="flex-1">{t('Part')}</div>
                                            <div className="w-[110px]">{t('Qty')}</div>
                                            <div className="w-[150px]">{t('Unit Price')}</div>
                                            <div className="w-[150px]">{t('Line Total')}</div>
                                        </div>
                                    </>}

                                    {getOrderLinesType('part').map((line, index) => {
                                        const service = _services.find(s => String(s.id) === String(line.serviceId));
                                        const quantity = Number(line?.quantity ?? 1);
                                        const unitPrice = Number(line?.unitPrice ?? 0);

                                        return (
                                            <div key={line?.id || index} className="w-full flex items-start gap-2">
                                                <div className="flex-1">
                                                    <Input
                                                        type="text"
                                                        required={true}
                                                        isLoading={isLoading}
                                                        value={line.name}
                                                        onChange={(e) => handleOrderLineChange(line.id, { name: e.target.value })}
                                                        className=""
                                                    />
                                                </div>
                                                <div className="w-[110px]">
                                                    <Input
                                                        type="number"
                                                        required={true}
                                                        isLoading={isLoading}
                                                        min="1"
                                                        value={quantity}
                                                        onChange={(e) => handleOrderLineChange(line.id, { quantity: Number(e.target.value || 1) })}
                                                    />
                                                </div>

                                                <div className="w-[150px]">
                                                    <Input
                                                        type="number"
                                                        required={true}
                                                        isLoading={isLoading}
                                                        min="0"
                                                        step="0.01"
                                                        value={line?.unitPrice || 0}
                                                        onChange={(e) => handleOrderLineChange(line.id, { unitPrice: Number(e.target.value || 0) })}
                                                    />
                                                </div>

                                                <div className="w-[150px]">
                                                    <div className="h-9 px-3 rounded-md border border-gray-200 flex items-center bg-gray-50">
                                                        <CurrencySymbol />
                                                        {line?.totalPrice ? `${Number(line.totalPrice).toFixed(2)}` : '0.00'}
                                                    </div>
                                                </div>

                                                <div className="h-9 flex items-center justify-end py-1">
                                                    <OutlineButton
                                                        type="button"
                                                        onClick={() => handleOrderLineRemove(line)}
                                                        isLoading={isLoading}
                                                        className=""
                                                        style={{ padding: '0.4rem', borderRadius: '9999px' }}
                                                    >
                                                        <XIcon className="size-3.5" />
                                                    </OutlineButton>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                            {getOrderLinesType('part').length === 0 && (
                                <div className="w-full h-full text-gray-500 flex items-center justify-center">
                                    {t('No parts added yet.')}
                                </div>
                            )}

                            <div className="h-8"></div>
                            <SecondaryButton
                                type="button"
                                onClick={() => partsCatalogToggle('open')}
                                className="w-full"
                            >
                                <PlusIcon className="size-5 mr-2" />
                                {t('Add Part')}
                            </SecondaryButton>

                        </CollapsibleCard>
                        {/* total pricing */}
                        <div className="w-full flex justify-end">
                            <div></div>
                            <div className="text-xl font-semibold">
                                <div className="flex items-center gap-2">
                                    <label className="font-semibold">{t('Total Price')}</label>
                                </div>
                                <div className="h-10 px-3 rounded-md ">
                                    <CurrencySymbol />
                                    {toDisplayNumber(getTotalOrderPrice())}
                                </div>
                            </div>

                        </div>

                        <CollapsibleCard className="w-full" title={t('Comments')} headerClassName="bg-gray-100">
                            <div className="w-full flex flex-col gap-1">
                                <div className="flex items-center gap-2">
                                    <label className="font-semibold">{t('Internal Notes')}</label>
                                </div>
                                <Textarea
                                    name="internalNotes"
                                    isLoading={isLoading}
                                    value={data?.internalNotes ?? ''}
                                    onChange={(e) => inputChangePassthrough('internalNotes', e.target.value)}
                                    className="border border-gray-300 rounded-md p-2"
                                />
                            </div>
                            <div className="w-full flex flex-col gap-1">
                                <div className="flex items-center gap-2">
                                    <label className="font-semibold">{t('Customer Notes')}</label>
                                </div>
                                <Textarea
                                    name="customerNotes"
                                    isLoading={isLoading}
                                    value={data?.customerNotes ?? ''}
                                    onChange={(e) => inputChangePassthrough('customerNotes', e.target.value)}
                                    className="border border-gray-300 rounded-md p-2"
                                />
                            </div>
                        </CollapsibleCard>
                    </Card>
                </form>
                <div className="w-[220px] shrink-0 flex flex-col gap-3">
                    <Card className="w-full p-5 mb-5 shadow-sm border border-gray-100 bg-white rounded-xl">
                        <div className="mb-4 hidden md:flex justify-center gap-3 mb-1">
                            <PrimaryButton
                                type="button"
                                onClick={onClose}
                                isLoading={isLoading}
                                className="w-full"
                            >
                                {t('Cancel')}
                            </PrimaryButton>
                            <PrimaryButton
                                type="submit"
                                form={formId}
                                isLoading={isLoading}
                                className="w-full"
                            >
                                {t('Save')}
                            </PrimaryButton>
                        </div>
                        <div className="flex flex-col gap-3.5">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                                    Actions
                                </span>
                            </div>

                            <div className="flex grid grid-cols-2 gap-3">
                                <button
                                    type="button"
                                    className="w-full h-24 inline-flex flex-col items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-3.5 py-2 text-xs font-medium text-gray-700 shadow-sm hover:bg-gray-50 hover:border-gray-300 hover:text-gray-900 active:bg-gray-100 transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                                >
                                    <MailIcon className="size-6 text-gray-500" />
                                    Email
                                </button>

                                <button
                                    type="button"
                                    className="w-full h-24 inline-flex flex-col items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-3.5 py-2 text-xs font-medium text-gray-700 shadow-sm hover:bg-gray-50 hover:border-gray-300 hover:text-gray-900 active:bg-gray-100 transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                                >
                                    <PrinterIcon className="size-6 text-gray-500" />
                                    Print
                                </button>

                                <button
                                    type="button"
                                    className="w-full h-24 inline-flex flex-col items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-3.5 py-2 text-xs font-medium text-gray-700 shadow-sm hover:bg-gray-50 hover:border-gray-300 hover:text-gray-900 active:bg-gray-100 transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                                >
                                    <FileTextIcon className="size-6 text-gray-500" />
                                    View PDF
                                </button>

                                <button
                                    type="button"
                                    className="w-full h-24 inline-flex flex-col items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-3.5 py-2 text-xs font-medium text-gray-700 shadow-sm hover:bg-gray-50 hover:border-gray-300 hover:text-gray-900 active:bg-gray-100 transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                                >
                                    <DownloadIcon className="size-6 text-gray-500" />
                                    Download
                                </button>
                            </div>
                        </div>
                    </Card>
                </div>
            </div>

            {
                _openPartsCatalog && (
                    <PopupModal
                        className="w-11/12 md:w-[1000px]"
                        isOpen={_openPartsCatalog} onClose={() => partsCatalogToggle('close')}
                    >
                        <div className="">
                            <PartsCatalog
                                onChange={handlePartSelectionChange}
                            />
                        </div>

                    </PopupModal>
                )
            }
            <div className="h-80"></div>
        </div>
    );
}




const ThisCardViewer = ({
    data = null, columns = [],
    handleEditRow = () => { }, initDeleteRow = () => { },
    onClose = () => { }, inputChangePassthrough = () => { }, onSubmit = () => { },
    onEdit = () => { }, onDelete = () => { },
}) => {
    const tags = data?.tags ?? [
        { label: 'New Client', color: 'yellow' },
        { label: 'Friends & Family', color: 'red' },
    ];
    const PLACEHOLDER_IMAGE = 'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&w=900&q=80';
    const getOrderTotal = (data) => {
        const lines = data?.orderLines ?? [];
        const subtotal = lines.reduce((sum, l) => sum + Number(l.price || 0) * Number(l.quantity || 1), 0);
        const discount = Number(data?.discount || 0);
        const tax = Number(data?.tax || 0);
        const afterDiscount = data?.discountType === 'percentage' ? subtotal * (1 - discount / 100) : subtotal - discount;
        const total = data?.taxType === 'percentage' ? afterDiscount * (1 + tax / 100) : afterDiscount + tax;
        return total;
    };
    const getTitle = (data) => {
        const lines = data?.orderLines ?? [];
        if (!lines.length) return data?.name ?? 'Untitled order';
        const extra = lines.length - 1;
        return extra > 0 ? `${lines[0].name} and ${extra} more` : lines[0].name;
    };
    const tagStyles = {
        yellow: 'bg-yellow-200 text-yellow-900',
        red: 'bg-red-300 text-red-900',
    };
    const getLinesTotal = (lines) => {
        return lines.reduce((total, line) => {
            const lineTotal = Number(line?.quantity ?? 1) * Number(line?.unitPrice ?? 0);
            return total + lineTotal;
        }, 0);
    }


    const total = getOrderTotal(data);
    const hoursLeft = data?.hoursLeft ?? 0;
    const hoursBilled = data?.hoursBilled ?? 0;
    const progress = Math.min(100, Math.max(0, Number(data?.progress ?? 0)));
    const assignee = data?.assignee?.initials ?? 'JT';

    const { t } = useTranslation();


    return (
        <div className="w-full max-w-sm bg-white p-3 rounded-lg border border-gray-200 shadow-sm">
            <Image
                src={data?.vehicle?.image ?? PLACEHOLDER_IMAGE}
                alt="Vehicle"
                className="w-full h-auto object-cover rounded-md"
            />
            <div className="flex justify-between">
                <div className="flex items-center gap-2 text-gray-500 text-sm mt-2">
                    <span>{data?.name || 'n/a'}</span>
                    <HashIcon className="size-4 text-gray-500" />
                    <span>{data?.orderNumber || 'RO-0000'}</span>
                </div>
                <div></div>
            </div>




            <div className="flex items-center justify-between gap-3 mt-2">
                <h3 className="text-sm font-semibold text-gray-900 leading-snug">{getTitle(data)}</h3>
                <span className="shrink-0 w-7 h-7 rounded-full bg-emerald-200 text-emerald-900 text-xs font-medium flex items-center justify-center">
                    {assignee}
                </span>
            </div>

            {/* <div className="flex flex-wrap items-center gap-2 mt-3">
                {tags.map((tag) => (
                    <span
                        key={tag.label}
                        className={`inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium ${tagStyles[tag.color] ?? 'bg-gray-200 text-gray-800'}`}
                    >
                        {tag.label}
                        <X size={12} className="opacity-50" />
                    </span>
                ))}
                <button type="button" className="inline-flex items-center gap-1.5 px-2 py-1 rounded text-sm font-medium bg-blue-50 text-blue-700">
                    <Plus size={14} /> Add
                </button>
            </div> */}

            <div className="flex items-center gap-3 p-0.5 my-1 border border-blue-200 rounded-lg bg-blue-50">
                <span> {toDisplayDate(data?.startDate)}</span>
                <div><ChevronsRightIcon className="size-4 text-gray-500" /></div>
                <span> {toDisplayDate(data?.dueDate)}</span>
            </div>

            <div className="flex flex-col gap-2.5 mt-3 text-sm text-gray-800">
                <div className="flex items-center gap-3">
                    <Car size={18} className="text-gray-600" />
                    <span>
                        {`${data?.vehicle?.make?.name ?? ''} ${data?.vehicle?.model?.name ?? ''} ${data?.vehicle?.year ?? ''} ${data?.vehicle?.licensePlate ? `(${data.vehicle.licensePlate})` : ''}`}
                    </span>
                </div>
                <div className="flex items-center gap-3">
                    <User size={18} className="text-gray-600" />
                    <span>
                        {data?.customer ? `${data.customer.firstName ?? ''} ${data.customer.lastName ?? ''} (${data.customer.email ?? ''})` : ''}
                    </span>
                </div>
                <div className="flex items-center gap-3">
                    <Timer size={18} className="text-gray-600" />
                    <span>{hoursLeft} hrs left / {hoursBilled} hrs billed</span>
                </div>
            </div>


            <div className="flex items-center justify-between mt-1 border-t border-gray-200">
                <div className="flex items-center gap-1 font-semibold">
                    <CurrencySymbol />
                    {toDisplayNumber(getLinesTotal(data?.orderLines ?? []))}
                </div>
                <div className="flex justify-end gap-2 mt-2">
                    <button
                        type="button"
                        title={t('Edit')}
                        aria-label={t('Edit')}
                        onClick={() => onEdit(data)}
                        className="inline-flex items-center justify-center rounded-md border border-blue-200 bg-blue-50 p-2 text-blue-600 transition hover:bg-blue-100"
                    >
                        <PencilIcon className="size-4" />
                    </button>
                    <button
                        type="button"
                        title={t('Delete')}
                        aria-label={t('Delete')}
                        onClick={() => initDeleteRow(data)}
                        className="inline-flex items-center justify-center rounded-md border border-red-200 bg-red-50 p-2 text-red-600 transition hover:bg-red-100"
                    >
                        <Trash2Icon className="size-4" />
                    </button>
                </div>
            </div>
        </div>
    );
};





export default function OrdersPage(props) {

    setMetas({
        title: 'Orders',
        description: 'Manage your orders',
    });

    const [_pipeline, _setPipeline] = useState(null);


    const { t } = useTranslation();

    const fetchPipelineAndStages = async () => {
        try {
            const res = await sendBackRequest({
                itsFor: 'pipelines',
                action: 'get',
                filters: [{
                    key: 'active',
                    operator: 'equals',
                    value: true,
                }],
            });

            // logger.log("fetchPipelineAndStages response:", res);
            if (res.success) {
                const pipelines = res.data || [];
                if (pipelines.length > 0) {
                    const firstPipeline = pipelines[0];
                    _setPipeline(firstPipeline);
                }
            } else {
                notify({ type: 'error', message: t('Failed to fetch pipelines') });
            }
        } catch (error) {
            logger.error("Error fetching pipelines:", error);
            notify({ type: 'error', message: t('Error fetching pipelines') });
        }
    };

    useEffect(() => {
        fetchPipelineAndStages();
    }, []);


    return (
        <>
            <h1 className="text-2xl font-bold mb-4">
                {t('Orders')}
            </h1>
            <DataRenderer
                itsFor="orders"
                pipeline={_pipeline}
                editComponent={ThisEditComponent}
                cardViewer={ThisCardViewer}
                defaultDataViewType="kanban"
                dataViewOptions={['table', 'kanban']}
                columns={[
                    { name: 'name', label: 'Name' },
                    { name: 'orderNumber', label: 'Order Number' },
                    {
                        name: 'stage', label: 'Stage',
                        component: ({ value }) => {
                            if (!value) return <span className="text-gray-500">n/a</span>;
                            return (
                                <div className="flex items-center gap-2">
                                    <span className="w-3 h-3 rounded-full" style={{ backgroundColor: value.color || '#ccc' }}></span>
                                    <span>{value.name}</span>
                                </div>
                            );
                        }
                    },
                    {
                        name: 'totalPrice', label: 'Total Price',
                        component: ({ value, row }) => {
                            // logger.log("Rendering totalPrice for row:", row);
                            const lines = row.orderLines && Array.isArray(row.orderLines) ? row.orderLines : [];
                            const total = lines.reduce((sum, line) => sum + Number(line?.quantity || 1) * Number(line?.unitPrice || 0), 0);
                            return (
                                <div className="flex items-center gap-1">
                                    <CurrencySymbol />
                                    {toDisplayNumber(total)}
                                </div>
                            );
                        }
                    },
                    {
                        name: 'orderLines', label: 'Services & Parts', width: 400,
                        component: ({ value }) => {
                            const lines = value && Array.isArray(value) ? value : [];
                            return (
                                <div className="flex flex-wrap gap-1">
                                    {lines.map((line, index) => (
                                        <div key={index} className="w-fit flex items-center gap-2 bg-blue-50 px-2 py-1 rounded-md border border-blue-200">
                                            <span className="text-xs font-medium">{line.name}</span>
                                        </div>
                                    ))}
                                </div>
                            );
                        }
                    },
                    {
                        name: 'customer', label: 'Customer',
                        component: ({ value }) => {
                            if (!value) return <span className="text-gray-500">n/a</span>;
                            return (
                                <div className="flex flex-col">
                                    <span>{value.firstName} {value.lastName}</span>
                                    <span className="text-gray-500 text-sm">{value.email}</span>
                                </div>
                            );
                        }
                    },
                    {
                        name: 'vehicle', label: 'Vehicle',
                        component: ({ value }) => {
                            if (!value) return <span className="text-gray-500">n/a</span>;
                            return (
                                <div className="flex flex-col">
                                    <span>{value.make?.name} {value.model?.name} {value.year}</span>
                                    <span className="text-gray-500 text-sm">{value.licensePlate}</span>
                                </div>
                            );
                        }
                    },

                ]}
            />
        </>
    )
}

