import Card from "@/src/components/ui/card";
import { PopupModal } from "@/src/components/modals";
import { DangerButton, OutlineButton, PrimaryButton, SecondaryButton } from "@/src/components/ui/buttons";
import { Input, Textarea } from "@/src/components/ui/inputs";
import Select from "@/src/components/ui/select";
import { notify } from "@/src/components/ui/sonnar/sonnar";
import { sendBackRequest } from "@/src/services/backend";
import { logger } from "@/src/services/logger";
import { setMetas } from "@/src/services/metas";
import { toDisplayDate, toDisplayStr } from "@/src/services/other";
import { CalendarDaysIcon, ChevronLeftIcon, ChevronRightIcon, PencilIcon, PlusIcon, RefreshCcwIcon, Trash2Icon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import DateInput from "@/src/components/date";

const WEEK_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const APPOINTMENT_STATUS_OPTIONS = [
    { value: 'scheduled', label: 'Scheduled' },
    { value: 'confirmed', label: 'Confirmed' },
    { value: 'checkedIn', label: 'Checked In' },
    { value: 'completed', label: 'Completed' },
    { value: 'noShow', label: 'No Show' },
    { value: 'cancelled', label: 'Cancelled' },
];

const pad = (value) => String(value).padStart(2, '0');

const getDateKey = (dateValue) => {
    const d = new Date(dateValue);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const getTimeLabel = (value) => {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '--:--';
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const toInputDateTime = (value) => {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '';

    const yyyy = d.getFullYear();
    const mm = pad(d.getMonth() + 1);
    const dd = pad(d.getDate());
    const hh = pad(d.getHours());
    const min = pad(d.getMinutes());
    return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
};

const buildDefaultForm = (dateValue) => {
    const start = new Date(dateValue || Date.now());
    start.setHours(9, 0, 0, 0);
    const end = new Date(start);
    end.setHours(start.getHours() + 1);

    return {
        id: null,
        // customerId: '',
        // orderId: '',
        status: 'scheduled',
        startTime: toInputDateTime(start),
        endTime: toInputDateTime(end),
        notes: '',
    };
};

const statusColorMap = {
    scheduled: 'bg-blue-100 text-blue-700',
    confirmed: 'bg-emerald-100 text-emerald-700',
    checkedIn: 'bg-violet-100 text-violet-700',
    checked_in: 'bg-violet-100 text-violet-700',
    completed: 'bg-slate-200 text-slate-700',
    noShow: 'bg-amber-100 text-amber-700',
    no_show: 'bg-amber-100 text-amber-700',
    cancelled: 'bg-rose-100 text-rose-700',
};

export default function AppointmentsPage() {
    setMetas({
        title: 'Appointments',
        description: 'Calendar view for appointments',
    });

    const { t } = useTranslation();
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState('');
    const [appointments, setAppointments] = useState([]);
    const [customers, setCustomers] = useState([]);
    const [orders, setOrders] = useState([]);
    const [viewMonth, setViewMonth] = useState(() => {
        const now = new Date();
        return new Date(now.getFullYear(), now.getMonth(), 1);
    });
    const [selectedDate, setSelectedDate] = useState(() => new Date());
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [editMode, setEditMode] = useState('create');
    const [formData, setFormData] = useState(() => buildDefaultForm(new Date()));

    const fetchAppointments = async () => {
        setIsLoading(true);
        setError('');

        try {
            const result = await sendBackRequest({
                itsFor: 'appointments',
                action: 'get',
                limit: 1000,
                include: {
                    customer: true,
                    order: true,
                },
            });

            if (!result?.success) {
                setAppointments([]);
                setError(t('Failed to load appointments.'));
                return;
            }

            setAppointments(Array.isArray(result.data) ? result.data : []);
        } catch (fetchError) {
            logger.error('AppointmentsPage fetch error', fetchError);
            setAppointments([]);
            setError(t('Failed to load appointments.'));
        } finally {
            setIsLoading(false);
        }
    };

    const fetchReferenceData = async () => {
        try {
            const [customersRes, ordersRes] = await Promise.all([
                sendBackRequest({
                    itsFor: 'customers',
                    action: 'get',
                    limit: 1000,
                }),
                sendBackRequest({
                    itsFor: 'orders',
                    action: 'get',
                    limit: 1000,
                    include: {
                        customer: true,
                    },
                }),
            ]);

            if (customersRes?.success) {
                setCustomers(Array.isArray(customersRes.data) ? customersRes.data : []);
            }

            if (ordersRes?.success) {
                setOrders(Array.isArray(ordersRes.data) ? ordersRes.data : []);
            }
        } catch (fetchError) {
            logger.error('AppointmentsPage reference fetch error', fetchError);
        }
    };

    useEffect(() => {
        fetchAppointments();
        fetchReferenceData();
    }, []);

    const appointmentsByDay = useMemo(() => {
        const map = {};

        for (const appointment of appointments) {
            const key = getDateKey(appointment.startTime);
            if (!map[key]) map[key] = [];
            map[key].push(appointment);
        }

        Object.keys(map).forEach((key) => {
            map[key].sort((a, b) => new Date(a.startTime) - new Date(b.startTime));
        });

        return map;
    }, [appointments]);

    const monthGridDays = useMemo(() => {
        const year = viewMonth.getFullYear();
        const month = viewMonth.getMonth();
        const firstDayOfMonth = new Date(year, month, 1);
        const startOffset = firstDayOfMonth.getDay();
        const gridStart = new Date(year, month, 1 - startOffset);

        return Array.from({ length: 42 }, (_, index) => {
            const day = new Date(gridStart);
            day.setDate(gridStart.getDate() + index);
            return day;
        });
    }, [viewMonth]);

    const selectedDateKey = getDateKey(selectedDate);
    const selectedDayAppointments = appointmentsByDay[selectedDateKey] || [];

    const monthTitle = viewMonth.toLocaleDateString(undefined, {
        month: 'long',
        year: 'numeric',
    });

    const goToPrevMonth = () => {
        setViewMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
    };

    const goToNextMonth = () => {
        setViewMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
    };

    const goToToday = () => {
        const today = new Date();
        setViewMonth(new Date(today.getFullYear(), today.getMonth(), 1));
        setSelectedDate(today);
    };

    const customerOptions = useMemo(() => {
        return customers.map((customer) => ({
            value: customer.id,
            label: `${customer.firstName || ''} ${customer.lastName || ''}`.trim() || customer.email || customer.phone || 'Customer',
        }));
    }, [customers]);

    const orderOptions = useMemo(() => {
        return orders.map((order) => {
            const customerName = order?.customer?.firstName || order?.customer?.lastName
                ? `${order?.customer?.firstName || ''} ${order?.customer?.lastName || ''}`.trim()
                : '';

            return {
                value: order.id,
                label: `#${order.orderNumber || 'N/A'} - ${order.name || t('Order')} ${customerName ? `(${customerName})` : ''}`,
                customerId: order.customerId,
            };
        });
    }, [orders, t]);

    const filteredOrderOptions = useMemo(() => {
        if (!formData.customerId) return orderOptions;
        return orderOptions.filter((option) => String(option.customerId) === String(formData.customerId));
    }, [orderOptions, formData.customerId]);
    const openCreateModal = (day = selectedDate) => {
        setEditMode('create');
        setFormData(buildDefaultForm(day));
        setIsEditOpen(true);
    };
    const openEditModal = (item) => {
        setEditMode('edit');
        setFormData({
            id: item.id,
            status: item.status || 'scheduled',
            startTime: toInputDateTime(item.startTime),
            endTime: toInputDateTime(item.endTime),
            notes: item.notes || '',
        });
        setIsEditOpen(true);
    };
    const onFormChange = (field, value) => {
        setFormData((prev) => ({
            ...prev,
            [field]: value,
            ...(field === 'customerId' ? { orderId: '' } : {}),
        }));
    };
    const validateForm = () => {
        // if (!formData.customerId) return t('Customer is required.');
        // if (!formData.orderId) return t('Order is required.');
        if (!formData.startTime) return t('Start time is required.');
        if (!formData.endTime) return t('End time is required.');

        const start = new Date(formData.startTime);
        const end = new Date(formData.endTime);

        if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
            return t('Invalid date/time value.');
        }

        if (end <= start) {
            return t('End time must be after start time.');
        }

        return '';
    };
    const handleSaveAppointment = async (e) => {
        e?.preventDefault?.();

        const validationError = validateForm();
        if (validationError) {
            notify({ type: 'error', message: validationError });
            return;
        }

        const payload = {
            // customerId: formData.customerId,
            // orderId: formData.orderId,
            status: formData.status,
            startTime: new Date(formData.startTime).toISOString(),
            endTime: new Date(formData.endTime).toISOString(),
            notes: formData.notes || null,
        };

        if (formData.customerId) {
            payload.customerId = formData.customerId;
        };
        if (formData.orderId) {
            payload.orderId = formData.orderId;
        };

        if (editMode === 'edit') {
            payload.id = formData.id;
        }

        try {
            setIsSaving(true);
            const result = await sendBackRequest({
                itsFor: 'appointments',
                action: editMode === 'create' ? 'create' : 'update',
                data: payload,
            });

            if (!result?.success) {
                notify({
                    type: 'error',
                    message: result?.message || t('Failed to save appointment.'),
                });
                return;
            }

            notify({
                type: 'success',
                message: editMode === 'create' ? t('Appointment created.') : t('Appointment updated.'),
            });
            setIsEditOpen(false);
            await fetchAppointments();
        } catch (saveError) {
            logger.error('AppointmentsPage save error', saveError);
            notify({ type: 'error', message: t('Failed to save appointment.') });
        } finally {
            setIsSaving(false);
        }
    };
    const handleDeleteAppointment = async (item) => {
        const confirmed = window.confirm(t('Delete this appointment?'));
        if (!confirmed) return;

        try {
            setIsSaving(true);
            const result = await sendBackRequest({
                itsFor: 'appointments',
                action: 'delete',
                data: { id: item.id },
            });

            if (!result?.success) {
                notify({
                    type: 'error',
                    message: result?.message || t('Failed to delete appointment.'),
                });
                return;
            }

            notify({ type: 'success', message: t('Appointment deleted.') });
            await fetchAppointments();
        } catch (deleteError) {
            logger.error('AppointmentsPage delete error', deleteError);
            notify({ type: 'error', message: t('Failed to delete appointment.') });
        } finally {
            setIsSaving(false);
        }
    };

    const upcomingAppointments = useMemo(() => {
        const now = new Date();
        return [...appointments]
            .filter((item) => new Date(item.startTime) >= now)
            .sort((a, b) => new Date(a.startTime) - new Date(b.startTime))
            .slice(0, 8);
    }, [appointments]);

    return (
        <div className="w-full space-y-4">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div className="flex items-center gap-3">
                    <div>
                        <h1 className="text-2xl font-bold">{t('Appointments')}</h1>
                        <p className="text-sm text-gray-500">
                            {t('Calendar view for scheduled customer visits')}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <PrimaryButton onClick={() => openCreateModal(selectedDate)}>
                        <PlusIcon className="size-4" />
                        {t('New Appointment')}
                    </PrimaryButton>
                    <SecondaryButton onClick={goToToday}>{t('Today')}</SecondaryButton>
                    <SecondaryButton onClick={fetchAppointments} isLoading={isLoading}>
                        <RefreshCcwIcon className="size-4" />
                        {t('Refresh')}
                    </SecondaryButton>
                </div>
            </div>

            {error && (
                <Card className="border-rose-200 bg-rose-50">
                    <p className="text-sm text-rose-700">{error}</p>
                </Card>
            )}

            <div className="grid grid-cols-1 2xl:grid-cols-3 gap-4">
                <Card className="2xl:col-span-2">
                    <div className="flex items-center justify-between mb-3">
                        <SecondaryButton
                            type="button"
                            onClick={goToPrevMonth}
                        >
                            <ChevronLeftIcon className="size-5" />
                        </SecondaryButton>
                        <h2 className="text-lg font-semibold">{monthTitle}</h2>
                        <SecondaryButton
                            type="button"
                            onClick={goToNextMonth}
                        >
                            <ChevronRightIcon className="size-5" />
                        </SecondaryButton>
                    </div>

                    <div className="grid grid-cols-7 gap-2 mb-2">
                        {WEEK_DAYS.map((day) => (
                            <div key={day} className="text-xs font-semibold text-center py-1">
                                {t(day)}
                            </div>
                        ))}
                    </div>

                    <div className="grid grid-cols-7 gap-0 overflow-hidden rounded-lg border border-gray-300">
                        {monthGridDays.map((day) => {
                            const dayKey = getDateKey(day);
                            const dayAppointments = appointmentsByDay[dayKey] || [];
                            const isCurrentMonth = day.getMonth() === viewMonth.getMonth();
                            const isToday = dayKey === getDateKey(new Date());
                            const isSelected = dayKey === selectedDateKey;

                            return (
                                <button
                                    key={dayKey}
                                    type="button"
                                    onClick={() => isCurrentMonth && setSelectedDate(day)}
                                    className={
                                        "h-28 p-2  border text-left transition-all duration-150 " +
                                        "flex flex-col " +
                                        (isSelected ? "border-sky-500 bg-sky-50 " : "border-gray-300 hover:border-sky-300 ") +
                                        (!isCurrentMonth ? "opacity-40 " : "")
                                    }
                                >
                                    <div className="w-full h-8 flex items-center justify-between">
                                        <span
                                            className={
                                                "text-base font-semibold " +
                                                (isToday ? "text-sky-600 underline" : "text-gray-800")
                                            }
                                        >
                                            {day.getDate()}
                                        </span>
                                        {dayAppointments.length > 0 && (
                                            <span className="w-5 h-5 p-1 text-sm rounded-full bg-gray-200 text-gray-700 border border-gray-300 flex items-center justify-center">
                                                {dayAppointments.length}
                                            </span>
                                        )}
                                    </div>

                                    <div className="mt-2 space-y-1 flex-1 overflow-hidden">
                                        {dayAppointments.slice(0, 2).map((item) => (
                                            <div
                                                key={item.id}
                                                className="text-[11px] rounded px-1.5 py-1 bg-gray-50 border border-gray-300 truncate"
                                            >
                                                <span className="font-semibold">{getTimeLabel(item.startTime)}</span>
                                                <span className="text-gray-500"> · </span>
                                                <span>
                                                    {item?.customer?.firstName || item?.customer?.lastName
                                                        ? `${item?.customer?.firstName || ''} ${item?.customer?.lastName || ''}`.trim()
                                                        : t('Customer')}
                                                </span>
                                            </div>
                                        ))}
                                        {dayAppointments.length > 2 && (
                                            <p className="text-[11px] text-gray-500">+{dayAppointments.length - 2} {t('more')}</p>
                                        )}
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </Card>
                <Card>
                    <h3 className="text-base font-semibold mb-2">
                        {t('Agenda')} - {toDisplayDate(selectedDate)}
                    </h3>

                    <div className="mb-3">
                        <SecondaryButton onClick={() => openCreateModal(selectedDate)} className="w-full">
                            <PlusIcon className="size-4" />
                            {t('Add Appointment On This Day')}
                        </SecondaryButton>
                    </div>

                    {selectedDayAppointments.length === 0 && !isLoading && (
                        <p className="text-sm text-gray-500">{t('No appointments on this day.')}</p>
                    )}

                    <div className="space-y-2 mb-5">
                        {selectedDayAppointments.map((item) => {
                            const statusClass = statusColorMap[item.status] || 'bg-gray-100 text-gray-700';
                            const customerName = item?.customer?.firstName || item?.customer?.lastName
                                ? `${item?.customer?.firstName || ''} ${item?.customer?.lastName || ''}`.trim()
                                : t('Customer');

                            return (
                                <div key={item.id} className="border border-gray-200 rounded-md p-3 flex justify-between gap-2 bg-gray-50/50 shadow-sm">
                                    <div className="">
                                        <div className="flex items-center justify-between gap-2">
                                            <p className="font-medium truncate">{customerName}</p>
                                            <span className={`text-xs px-2 py-1 rounded-full ${statusClass}`}>
                                                {toDisplayStr(item.status || 'scheduled')}
                                            </span>
                                        </div>
                                        <p className="text-sm text-gray-600 mt-1">
                                            {getTimeLabel(item.startTime)} - {getTimeLabel(item.endTime)}
                                        </p>
                                        <p className="text-xs text-gray-500 mt-1 truncate">
                                            {item?.order?.name || `${t('Order')} #${item?.order?.orderNumber || 'N/A'}`}
                                        </p>
                                        {item?.notes && (
                                            <p className="text-xs text-gray-500 mt-1 line-clamp-2">{item.notes}</p>
                                        )}
                                    </div>
                                    <div className="md:w-32 mt-3 flex flex-col items-center gap-2">
                                        <SecondaryButton
                                            className="w-full"
                                            onClick={() => openEditModal(item)}
                                            disabled={isSaving}
                                        >
                                            <PencilIcon className="size-4" />
                                            {t('Edit')}
                                        </SecondaryButton>
                                        <DangerButton
                                            className="w-full"
                                            onClick={() => handleDeleteAppointment(item)}
                                            disabled={isSaving}
                                        >
                                            <Trash2Icon className="size-4" />
                                            {t('Delete')}
                                        </DangerButton>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    <h3 className="text-base font-semibold mb-2">{t('Upcoming')}</h3>
                    {upcomingAppointments.length === 0 && !isLoading && (
                        <p className="text-sm text-gray-500">{t('No upcoming appointments.')}</p>
                    )}

                    <div className="space-y-2">
                        {upcomingAppointments.map((item) => {
                            const customerName = item?.customer?.firstName || item?.customer?.lastName
                                ? `${item?.customer?.firstName || ''} ${item?.customer?.lastName || ''}`.trim()
                                : t('Customer');

                            return (
                                <button
                                    key={item.id}
                                    type="button"
                                    onClick={() => {
                                        const d = new Date(item.startTime);
                                        setSelectedDate(d);
                                        setViewMonth(new Date(d.getFullYear(), d.getMonth(), 1));
                                    }}
                                    className="w-full text-left border border-gray-200 rounded-md p-2 hover:bg-gray-50"
                                >
                                    <p className="text-sm font-medium truncate">{customerName}</p>
                                    <p className="text-xs text-gray-500">
                                        {new Date(item.startTime).toLocaleDateString()} {getTimeLabel(item.startTime)}
                                    </p>
                                </button>
                            );
                        })}
                    </div>
                </Card>
            </div>

            <PopupModal
                isOpen={isEditOpen}
                onClose={() => !isSaving && setIsEditOpen(false)}
                title={editMode === 'create' ? t('New Appointment') : t('Edit Appointment')}
                size="lg"
            >
                <form onSubmit={handleSaveAppointment} className="p-2 space-y-3">
                    <div>
                        <label className="text-sm font-medium mb-1 block">{t('Start Time')}</label>
                        <DateInput
                            value={formData.startTime}
                            onChange={(e) => {
                                // logger.log('DateInput onChange', e);
                                onFormChange('startTime', e?.target?.value || e?.value || '');
                            }}
                            required={true}
                            showTime={true}
                        />
                    </div>
                    <div>
                        <label className="text-sm font-medium mb-1 block">{t('End Time')}</label>
                        <DateInput
                            value={formData.endTime}
                            onChange={(e) => {
                                // logger.log('DateInput onChange', e);
                                onFormChange('endTime', e?.target?.value || e?.value || '');
                            }}
                            required={true}
                            showTime={true}
                        />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                            <label className="text-sm font-medium mb-1 block">{t('Customer')}</label>
                            <Select
                                searchable={true}
                                value={formData.customerId}
                                options={customerOptions}
                                onChange={(e) => onFormChange('customerId', e?.target?.value || e?.value || '')}
                                placeholder={t('Select customer')}
                            />
                        </div>
                        <div>
                            <label className="text-sm font-medium mb-1 block">{t('Order')}</label>
                            <Select
                                searchable={true}
                                value={formData.orderId}
                                options={filteredOrderOptions}
                                onChange={(e) => onFormChange('orderId', e?.target?.value || e?.value || '')}
                                placeholder={t('Select order')}
                            />
                        </div>
                        <div>
                            <label className="text-sm font-medium mb-1 block">{t('Status')}</label>
                            <Select
                                value={formData.status}
                                options={APPOINTMENT_STATUS_OPTIONS.map((item) => ({
                                    ...item,
                                    label: t(item.label),
                                }))}
                                onChange={(e) => onFormChange('status', e?.target?.value || e?.value || 'scheduled')}
                            />
                        </div>
                    </div>
                    <div>
                        <label className="text-sm font-medium mb-1 block">{t('Notes')}</label>
                        <Textarea
                            value={formData.notes}
                            onChange={(e) => onFormChange('notes', e.target.value)}
                            placeholder={t('Optional notes for this appointment')}
                        />
                    </div>
                    <div className="flex items-center justify-end gap-2">
                        <OutlineButton
                            type="button"
                            disabled={isSaving}
                            onClick={() => setIsEditOpen(false)}
                        >
                            {t('Cancel')}
                        </OutlineButton>
                        <PrimaryButton type="submit" isLoading={isSaving}>
                            {editMode === 'create' ? t('Create') : t('Save Changes')}
                        </PrimaryButton>
                    </div>
                </form>
            </PopupModal>
        </div >
    );
}